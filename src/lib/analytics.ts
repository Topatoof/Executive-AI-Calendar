import { prisma } from "@/lib/db";
import { startOfWeek, subWeeks } from "date-fns";

export async function computeAnalytics(ownerId: string) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });

  const [tasks, blocks, missedDeadlines] = await Promise.all([
    prisma.task.findMany({ where: { ownerId } }),
    prisma.scheduleBlock.findMany({
      where: {
        ownerId,
        startTime: { gte: weekStart },
      },
    }),
    prisma.task.count({
      where: {
        ownerId,
        deadline: { lt: now },
        status: { in: ["PENDING", "IN_PROGRESS", "MISSED"] },
      },
    }),
  ]);

  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

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
      (1 - completionRate) * 0.4 +
      (overloaded ? 0.25 : 0)
  );

  const prevWeek = await prisma.analyticsSnapshot.findFirst({
    where: { ownerId, weekStart: subWeeks(weekStart, 1) },
  });
  const consistencyStreak =
    completionRate >= 0.6 ? (prevWeek?.consistencyStreak ?? 0) + 1 : 0;

  const existing = await prisma.analyticsSnapshot.findFirst({
    where: { ownerId, weekStart },
  });

  const snapshotData = {
    completedTasks,
    missedDeadlines,
    focusMinutes: Math.round(focusMinutes),
    consistencyStreak,
    workloadMinutes: Math.round(workloadMinutes),
    completionRate,
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
    completionRate,
    missedDeadlines,
    focusMinutes: Math.round(focusMinutes),
    consistencyStreak,
    workloadMinutes: Math.round(workloadMinutes),
    burnoutRisk,
    missedBlocks,
    overloaded,
  };
}
