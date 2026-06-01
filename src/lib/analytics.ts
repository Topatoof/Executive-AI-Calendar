import { prisma } from "@/lib/db";
import { countOverdueTasks } from "@/lib/tasks/overdue";
import {
  eachDayOfInterval,
  endOfDay,
  endOfWeek,
  format,
  isWithinInterval,
  startOfDay,
  startOfWeek,
  subWeeks,
} from "date-fns";

export type DailyWorkMinutes = {
  date: string;
  label: string;
  minutes: number;
};

function blockDurationMinutes(block: {
  startTime: Date;
  endTime: Date;
}): number {
  return Math.round(
    (block.endTime.getTime() - block.startTime.getTime()) / (1000 * 60)
  );
}

/** Completed schedule block time per calendar day (by block start day, Mon–Sun). */
export function bucketWorkMinutesByDay(
  blocks: { startTime: Date; endTime: Date }[],
  weekStart: Date,
  weekEnd: Date
): DailyWorkMinutes[] {
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return days.map((day) => {
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    const minutes = blocks
      .filter((b) =>
        isWithinInterval(b.startTime, { start: dayStart, end: dayEnd })
      )
      .reduce((sum, b) => sum + blockDurationMinutes(b), 0);

    return {
      date: format(day, "yyyy-MM-dd"),
      label: format(day, "EEE"),
      minutes,
    };
  });
}

export async function getWeeklyDailyWorkMinutes(
  ownerId: string,
  referenceDate: Date = new Date()
): Promise<DailyWorkMinutes[]> {
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });

  const blocks = await prisma.scheduleBlock.findMany({
    where: {
      ownerId,
      status: "COMPLETED",
      startTime: { gte: weekStart, lte: weekEnd },
    },
    select: { startTime: true, endTime: true },
  });

  return bucketWorkMinutesByDay(blocks, weekStart, weekEnd);
}

export async function computeAnalytics(ownerId: string) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });

  const [tasks, allBlocks, blocks] = await Promise.all([
    prisma.task.findMany({ where: { ownerId } }),
    prisma.scheduleBlock.findMany({
      where: { ownerId },
      include: { task: true },
    }),
    prisma.scheduleBlock.findMany({
      where: {
        ownerId,
        startTime: { gte: weekStart },
      },
    }),
  ]);

  const missedDeadlines = countOverdueTasks(tasks, allBlocks, now);

  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
  const totalTasks = tasks.length;
  const overdueTaskRate = totalTasks > 0 ? missedDeadlines / totalTasks : 0;

  const completedBlocks = blocks.filter((b) => b.status === "COMPLETED");
  const missedBlocks = blocks.filter((b) => b.status === "MISSED").length;
  const focusMinutes = completedBlocks.reduce((sum, b) => {
    return sum + (b.endTime.getTime() - b.startTime.getTime()) / (1000 * 60);
  }, 0);

  const workloadMinutes = blocks.reduce((sum, b) => {
    return sum + (b.endTime.getTime() - b.startTime.getTime()) / (1000 * 60);
  }, 0);

  const overloaded = workloadMinutes > 40 * 60;
  const burnoutRisk = Math.min(
    1,
    missedBlocks * 0.15 +
      missedDeadlines * 0.2 +
      overdueTaskRate * 0.4 +
      (overloaded ? 0.25 : 0)
  );

  const prevWeek = await prisma.analyticsSnapshot.findFirst({
    where: { ownerId, weekStart: subWeeks(weekStart, 1) },
  });
  const consistencyStreak =
    overdueTaskRate <= 0.2 ? (prevWeek?.consistencyStreak ?? 0) + 1 : 0;

  const existing = await prisma.analyticsSnapshot.findFirst({
    where: { ownerId, weekStart },
  });

  const snapshotData = {
    completedTasks,
    missedDeadlines,
    focusMinutes: Math.round(focusMinutes),
    consistencyStreak,
    workloadMinutes: Math.round(workloadMinutes),
    overdueTaskRate,
    burnoutRisk,
  };

  if (existing) {
    await prisma.analyticsSnapshot.update({
      where: { id: existing.id },
      data: snapshotData,
    });
  } else {
    await prisma.analyticsSnapshot.create({
      data: { ownerId, weekStart, ...snapshotData },
    });
  }

  return {
    completedTasks,
    totalTasks,
    overdueTaskRate,
    missedDeadlines,
    focusMinutes: Math.round(focusMinutes),
    consistencyStreak,
    workloadMinutes: Math.round(workloadMinutes),
    burnoutRisk,
    missedBlocks,
    overloaded,
  };
}
