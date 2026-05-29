import { addDays, format, isSameDay, isToday, startOfDay } from "date-fns";
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

export function isScheduleBlockOverdue(
  block: ScheduleBlockWithTask,
  now: Date = new Date()
): boolean {
  if (isScheduleBlockCompleted(block)) return false;
  if (block.status === "MISSED") return false;
  const overdueAfter = block.endTime.getTime() + SCHEDULE_OVERDUE_GRACE_MS;
  return now.getTime() >= overdueAfter;
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
