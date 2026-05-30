import type { ScheduleBlock, Task } from "@prisma/client";
import {
  isScheduleBlockOverdue,
  type ScheduleBlockWithTask,
} from "@/lib/schedule/sort";

const INCOMPLETE_STATUSES: Task["status"][] = [
  "PENDING",
  "IN_PROGRESS",
  "MISSED",
];

export function isTaskIncomplete(task: Task): boolean {
  return INCOMPLETE_STATUSES.includes(task.status);
}

/** Task is overdue if missed, past deadline/session day, or linked to an overdue/missed block. */
export function isTaskOverdue(
  task: Task,
  blocks: ScheduleBlockWithTask[],
  now: Date = new Date()
): boolean {
  if (!isTaskIncomplete(task)) return false;

  if (task.status === "MISSED") return true;

  if (task.deadline != null && task.deadline < now) return true;
  if (task.scheduledDate != null && task.scheduledDate < now) return true;

  return blocks.some(
    (b) =>
      b.taskId === task.id &&
      (b.status === "MISSED" || isScheduleBlockOverdue(b, now))
  );
}

export function groupBlocksByTaskId(
  blocks: ScheduleBlock[]
): Map<string, ScheduleBlockWithTask[]> {
  const map = new Map<string, ScheduleBlockWithTask[]>();
  for (const block of blocks) {
    if (!block.taskId) continue;
    const list = map.get(block.taskId) ?? [];
    list.push(block);
    map.set(block.taskId, list);
  }
  return map;
}

export function countOverdueTasks(
  tasks: Task[],
  blocks: ScheduleBlockWithTask[],
  now: Date = new Date()
): number {
  const blocksByTask = groupBlocksByTaskId(blocks);
  return tasks.filter((t) =>
    isTaskOverdue(t, blocksByTask.get(t.id) ?? [], now)
  ).length;
}

export function filterOverdueTasks<T extends Task>(
  tasks: T[],
  blocks: ScheduleBlockWithTask[],
  now: Date = new Date()
): T[] {
  const blocksByTask = groupBlocksByTaskId(blocks);
  return tasks.filter((t) =>
    isTaskOverdue(t, blocksByTask.get(t.id) ?? [], now)
  );
}
