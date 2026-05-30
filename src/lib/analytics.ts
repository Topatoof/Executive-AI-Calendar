import { prisma } from "@/lib/db";
import { countOverdueTasks } from "@/lib/tasks/overdue";
import { startOfWeek, subWeeks } from "date-fns";

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
