import {
  addMinutes,
  startOfDay,
  endOfDay,
  isBefore,
  isAfter,
  max,
  min,
} from "date-fns";
import type { BlockType } from "@prisma/client";
import type {
  OwnerPreferences,
  ScheduleBlockInput,
  ScheduleResult,
  SchedulableTask,
} from "@/lib/scheduler/types";

function priorityScore(task: SchedulableTask): number {
  const deadlineBoost = task.deadline
    ? Math.max(
        0,
        10 -
          (task.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : 0;
  return (
    task.importance * 2 +
    task.urgency * 2 +
    deadlineBoost +
    (task.priority === "CRITICAL" ? 10 : task.priority === "HIGH" ? 6 : 0)
  );
}

function blockTypeForTask(task: SchedulableTask): BlockType {
  if (task.cognitiveLoad >= 7) return "DEEP_WORK";
  if (task.category === "fitness" || task.category === "health") return "HABIT";
  if (task.estimatedMinutes <= 30) return "SHALLOW_WORK";
  return "DEEP_WORK";
}

export function generateSchedule(
  tasks: SchedulableTask[],
  preferences: OwnerPreferences,
  rangeStart: Date,
  rangeEnd: Date
): ScheduleResult {
  const pending = tasks
    .filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS")
    .sort((a, b) => priorityScore(b) - priorityScore(a));

  const blocks: ScheduleBlockInput[] = [];
  const unscheduled: SchedulableTask[] = [];
  const warnings: string[] = [];
  let totalScheduledMinutes = 0;

  let currentDay = startOfDay(rangeStart);
  const lastDay = startOfDay(rangeEnd);

  const taskQueue = [...pending];

  while (currentDay <= lastDay && taskQueue.length > 0) {
    const dayStart = new Date(currentDay);
    dayStart.setHours(preferences.workStartHour, 0, 0, 0);
    const dayEnd = new Date(currentDay);
    dayEnd.setHours(preferences.workEndHour, 0, 0, 0);

    const focusStart = new Date(currentDay);
    focusStart.setHours(preferences.focusStartHour, 0, 0, 0);
    const focusEnd = new Date(currentDay);
    focusEnd.setHours(preferences.focusEndHour, 0, 0, 0);

    let cursor = max([dayStart, rangeStart]);
    let dayMinutes = 0;

    const dayTasks = [...taskQueue];
    taskQueue.length = 0;

    for (const task of dayTasks) {
      if (dayMinutes >= preferences.maxDailyMinutes) {
        taskQueue.push(task);
        continue;
      }

      const duration = Math.min(task.estimatedMinutes, 120);
      const blockType = blockTypeForTask(task);

      let slotStart = cursor;
      if (blockType === "DEEP_WORK" && task.cognitiveLoad >= 6) {
        slotStart = max([cursor, focusStart]);
        if (isAfter(addMinutes(slotStart, duration), focusEnd)) {
          slotStart = cursor;
        }
      }

      const slotEnd = addMinutes(slotStart, duration);
      if (isAfter(slotEnd, dayEnd) || isAfter(slotEnd, endOfDay(rangeEnd))) {
        taskQueue.push(task);
        continue;
      }

      if (isBefore(slotStart, rangeStart)) {
        taskQueue.push(task);
        continue;
      }

      blocks.push({
        taskId: task.id,
        title: task.title,
        blockType,
        startTime: slotStart,
        endTime: slotEnd,
        explanation:
          blockType === "DEEP_WORK"
            ? `High-focus block for ${task.title} during peak energy window`
            : `Scheduled ${task.title} based on priority and deadline pressure`,
      });

      cursor = addMinutes(slotEnd, preferences.bufferMinutes);
      dayMinutes += duration + preferences.bufferMinutes;
      totalScheduledMinutes += duration;

      const remaining = task.estimatedMinutes - duration;
      if (remaining > 0) {
        taskQueue.push({
          ...task,
          estimatedMinutes: remaining,
          title: `${task.title} (continued)`,
        });
      }
    }

    currentDay = addMinutes(currentDay, 24 * 60);
  }

  unscheduled.push(...taskQueue);

  const totalAvailable =
    Math.ceil(
      (rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)
    ) * preferences.maxDailyMinutes;

  const totalNeeded = pending.reduce((s, t) => s + t.estimatedMinutes, 0);
  const overloaded = totalNeeded > totalAvailable * 0.9;

  if (overloaded) {
    warnings.push(
      `Workload (${totalNeeded} min) exceeds available capacity (~${totalAvailable} min).`
    );
  }
  if (unscheduled.length > 0) {
    warnings.push(
      `${unscheduled.length} task(s) could not be scheduled in this range.`
    );
  }

  return {
    blocks,
    unscheduled,
    overloaded,
    warnings,
    totalScheduledMinutes,
  };
}

export function generateDailySchedule(
  tasks: SchedulableTask[],
  preferences: OwnerPreferences,
  day: Date
): ScheduleResult {
  const start = startOfDay(day);
  const end = endOfDay(day);
  return generateSchedule(tasks, preferences, start, end);
}

export function generateWeeklySchedule(
  tasks: SchedulableTask[],
  preferences: OwnerPreferences,
  weekStart: Date
): ScheduleResult {
  const start = startOfDay(weekStart);
  const end = addMinutes(start, 7 * 24 * 60 - 1);
  return generateSchedule(tasks, preferences, start, end);
}
