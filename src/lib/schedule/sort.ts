import {
  addDays,
  endOfDay,
  format,
  isSameDay,
  isToday,
  startOfDay,
} from "date-fns";
import type { ScheduleBlock, Task } from "@prisma/client";

export type ScheduleBlockWithTask = ScheduleBlock & {
  task?: Task | null;
};

/** Grace period after block end before it counts as overdue. */
export const SCHEDULE_OVERDUE_GRACE_MS = 60 * 60 * 1000;

export function isScheduleBlockCompleted(
  block: ScheduleBlockWithTask
): boolean {
  if (block.status === "COMPLETED") return true;
  if (block.task?.status === "COMPLETED") return true;
  return false;
}

/** Share of today's scheduled blocks marked complete (1 when no blocks today). */
export function computeDailyCompletionRate(
  blocks: ScheduleBlockWithTask[],
  day: Date = new Date()
): { completionRate: number; completedCount: number; totalCount: number } {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  const dayBlocks = blocks.filter(
    (b) => b.startTime >= dayStart && b.startTime <= dayEnd
  );
  const totalCount = dayBlocks.length;
  const completedCount = dayBlocks.filter(isScheduleBlockCompleted).length;

  return {
    completionRate: totalCount > 0 ? completedCount / totalCount : 1,
    completedCount,
    totalCount,
  };
}

/** Bulk shift penalty: only yesterday → today counts overdue; other shifted today/tomorrow blocks are graced. */
export function isShiftPenaltyOverdue(
  block: ScheduleBlockWithTask,
  now: Date = new Date()
): boolean | null {
  if (block.shiftedFromDay == null) return null;

  const today = startOfDay(now);
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  const blockDay = startOfDay(block.startTime);
  const fromDay = startOfDay(block.shiftedFromDay);

  const onTodayOrTomorrow =
    isSameDay(blockDay, today) || isSameDay(blockDay, tomorrow);
  if (!onTodayOrTomorrow) return null;

  if (isSameDay(blockDay, today) && isSameDay(fromDay, yesterday)) {
    return true;
  }

  return false;
}

export function isScheduleBlockOverdue(
  block: ScheduleBlockWithTask,
  now: Date = new Date()
): boolean {
  if (isScheduleBlockCompleted(block)) return false;

  const shiftRule = isShiftPenaltyOverdue(block, now);
  if (shiftRule === true) return true;
  if (shiftRule === false) return false;

  if (block.status === "MISSED") return false;
  const overdueAfter = block.endTime.getTime() + SCHEDULE_OVERDUE_GRACE_MS;
  return now.getTime() >= overdueAfter;
}

/** Block is happening right now (by clock or explicit status). */
export function isScheduleBlockInProgress(
  block: ScheduleBlockWithTask,
  now: Date = new Date()
): boolean {
  if (isScheduleBlockCompleted(block)) return false;
  if (block.status === "MISSED") return false;
  if (block.status === "IN_PROGRESS") return true;
  const t = now.getTime();
  return t >= block.startTime.getTime() && t < block.endTime.getTime();
}

export function scheduleBlockRemainingMs(
  block: ScheduleBlockWithTask,
  now: Date = new Date()
): number {
  return Math.max(0, block.endTime.getTime() - now.getTime());
}

export function partitionScheduleBlocks<T extends ScheduleBlockWithTask>(
  blocks: T[],
  now: Date = new Date()
): { schedule: T[]; overdue: T[]; completed: T[] } {
  const schedule: T[] = [];
  const overdue: T[] = [];
  const completed: T[] = [];

  for (const block of blocks) {
    if (isScheduleBlockCompleted(block)) {
      completed.push(block);
    } else if (isScheduleBlockOverdue(block, now)) {
      overdue.push(block);
    } else {
      schedule.push(block);
    }
  }

  const byStart = (a: T, b: T) => a.startTime.getTime() - b.startTime.getTime();
  schedule.sort(byStart);
  overdue.sort(byStart);
  completed.sort(byStart);

  return { schedule, overdue, completed };
}

/** Schedule, then overdue, then completed — each group chronological. */
export function sortScheduleBlocks<T extends ScheduleBlockWithTask>(
  blocks: T[],
  now: Date = new Date()
): T[] {
  const { schedule, overdue, completed } = partitionScheduleBlocks(blocks, now);
  return [...schedule, ...overdue, ...completed];
}

export function groupScheduleBlocksByDay<T extends ScheduleBlockWithTask>(
  blocks: T[],
  rangeStart: Date,
  rangeEnd: Date
): { date: Date; blocks: T[] }[] {
  const start = startOfDay(rangeStart);
  const end = startOfDay(rangeEnd);
  const days: { date: Date; blocks: T[] }[] = [];

  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    const dayBlocks = blocks
      .filter((b) => isSameDay(b.startTime, cursor))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    days.push({ date: cursor, blocks: dayBlocks });
  }

  return days;
}

export function formatPlannerDayHeader(date: Date): string {
  const label = format(date, "EEEE, MMM d");
  return isToday(date) ? `Today · ${label}` : label;
}
