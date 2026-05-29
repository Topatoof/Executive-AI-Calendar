import {
  addDays,
  addMinutes,
  endOfDay,
  isAfter,
  isBefore,
  isSameDay,
  max,
  startOfDay,
} from "date-fns";
import type { BlockType } from "@prisma/client";
import type {
  OwnerPreferences,
  ReservedSlot,
  ScheduleBlockInput,
  ScheduleResult,
  SchedulableTask,
} from "@/lib/scheduler/types";

const MAX_CHUNK_MINUTES = 120;

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

function setTimeOnDay(day: Date, hour: number): Date {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function roundUpToNext15(date: Date): Date {
  const d = new Date(date);
  const minutes = d.getMinutes();
  const remainder = minutes % 15;
  if (remainder !== 0) {
    d.setMinutes(minutes + (15 - remainder), 0, 0);
  }
  return d;
}

interface DayBucket {
  date: Date;
  tasks: SchedulableTask[];
  plannedMinutes: number;
  capacity: number;
}

function getSchedulableDays(
  rangeStart: Date,
  rangeEnd: Date,
  now: Date
): Date[] {
  const first = startOfDay(max([rangeStart, now]));
  const last = startOfDay(rangeEnd);
  const days: Date[] = [];
  let cursor = first;
  while (cursor <= last) {
    days.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  return days;
}

function assignTasksToDays(
  tasks: SchedulableTask[],
  days: Date[],
  prefs: OwnerPreferences,
  now: Date
): { buckets: DayBucket[]; unassigned: SchedulableTask[] } {
  const buckets: DayBucket[] = days.map((date) => ({
    date,
    tasks: [],
    plannedMinutes: 0,
    capacity: prefs.maxDailyMinutes,
  }));

  const sorted = [...tasks].sort((a, b) => {
    const aDeadline = a.deadline?.getTime() ?? Infinity;
    const bDeadline = b.deadline?.getTime() ?? Infinity;
    if (aDeadline !== bDeadline) return aDeadline - bDeadline;
    return priorityScore(b) - priorityScore(a);
  });

  const unassigned: SchedulableTask[] = [];

  for (const task of sorted) {
    const minutes = task.estimatedMinutes;
    let placed = false;

    if (task.scheduledDate) {
      const targetDay = startOfDay(task.scheduledDate);
      const bucket = buckets.find((b) => isSameDay(b.date, targetDay));
      if (
        bucket &&
        bucket.date >= startOfDay(now) &&
        bucket.plannedMinutes + minutes <= bucket.capacity
      ) {
        bucket.tasks.push(task);
        bucket.plannedMinutes += minutes;
        placed = true;
      } else {
        unassigned.push(task);
      }
      continue;
    }

    if (task.deadline) {
      const deadlineDay = startOfDay(task.deadline);
      const candidates = buckets
        .filter(
          (b) =>
            b.date <= deadlineDay &&
            b.date >= startOfDay(now) &&
            b.plannedMinutes + minutes <= b.capacity
        )
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      if (candidates.length > 0) {
        const bucket = candidates[0];
        bucket.tasks.push(task);
        bucket.plannedMinutes += minutes;
        placed = true;
      }
    }

    if (!placed) {
      const byRoom = [...buckets]
        .filter((b) => b.plannedMinutes + minutes <= b.capacity)
        .sort(
          (a, b) =>
            b.capacity -
            b.plannedMinutes -
            (a.capacity - a.plannedMinutes)
        );

      if (byRoom.length > 0) {
        const bucket = byRoom[0];
        bucket.tasks.push(task);
        bucket.plannedMinutes += minutes;
        placed = true;
      }
    }

    if (!placed) unassigned.push(task);
  }

  for (const bucket of buckets) {
    bucket.tasks.sort((a, b) => priorityScore(b) - priorityScore(a));
  }

  return { buckets, unassigned };
}

function intervalsOverlap(
  start: Date,
  end: Date,
  busyStart: Date,
  busyEnd: Date
): boolean {
  return isBefore(start, busyEnd) && isAfter(end, busyStart);
}

function slotFits(
  start: Date,
  durationMinutes: number,
  busy: ReservedSlot[],
  bufferMinutes: number,
  dayEnd: Date
): boolean {
  const end = addMinutes(start, durationMinutes);
  if (isAfter(end, dayEnd)) return false;
  for (const b of busy) {
    const blockedEnd = addMinutes(b.endTime, bufferMinutes);
    if (intervalsOverlap(start, end, b.startTime, blockedEnd)) return false;
  }
  return true;
}

function findFreeSlotStart(
  cursor: Date,
  durationMinutes: number,
  busy: ReservedSlot[],
  prefs: OwnerPreferences,
  dayEnd: Date
): Date | null {
  let c = cursor;
  const maxAttempts = busy.length + 12;

  for (let i = 0; i < maxAttempts; i++) {
    if (!isBefore(c, dayEnd)) return null;
    if (slotFits(c, durationMinutes, busy, prefs.bufferMinutes, dayEnd)) {
      return c;
    }

    const end = addMinutes(c, durationMinutes);
    const conflict = busy
      .filter((b) =>
        intervalsOverlap(
          c,
          end,
          b.startTime,
          addMinutes(b.endTime, prefs.bufferMinutes)
        )
      )
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0];

    if (!conflict) return null;
    c = addMinutes(conflict.endTime, prefs.bufferMinutes);
  }

  return null;
}

function reservedMinutesByDay(slots: ReservedSlot[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const slot of slots) {
    const key = startOfDay(slot.startTime).toISOString();
    const minutes =
      (slot.endTime.getTime() - slot.startTime.getTime()) / (1000 * 60);
    map.set(key, (map.get(key) ?? 0) + minutes);
  }
  return map;
}

function getEarliestSlot(
  day: Date,
  prefs: OwnerPreferences,
  now: Date
): Date | null {
  const dayStart = setTimeOnDay(day, prefs.workStartHour);
  const dayEnd = setTimeOnDay(day, prefs.workEndHour);

  let cursor = dayStart;
  if (isSameDay(day, now)) {
    cursor = max([cursor, roundUpToNext15(addMinutes(now, 5))]);
  }

  if (!isBefore(cursor, dayEnd)) return null;
  return cursor;
}

function placeTaskOnDay(
  task: SchedulableTask,
  day: Date,
  cursor: Date,
  prefs: OwnerPreferences,
  now: Date,
  busy: ReservedSlot[] = []
): { block: ScheduleBlockInput | null; nextCursor: Date | null; remaining: number } {
  const dayEnd = setTimeOnDay(day, prefs.workEndHour);
  const focusStart = setTimeOnDay(day, prefs.focusStartHour);
  const focusEnd = setTimeOnDay(day, prefs.focusEndHour);

  if (!isBefore(cursor, dayEnd)) {
    return { block: null, nextCursor: null, remaining: task.estimatedMinutes };
  }

  const duration = Math.min(task.estimatedMinutes, MAX_CHUNK_MINUTES);
  const blockType = blockTypeForTask(task);

  let slotStart =
    findFreeSlotStart(cursor, duration, busy, prefs, dayEnd) ?? cursor;

  if (blockType === "DEEP_WORK" && task.cognitiveLoad >= 6) {
    const inFocus = max([slotStart, focusStart]);
    if (
      !isAfter(inFocus, focusEnd) &&
      !isAfter(addMinutes(inFocus, duration), focusEnd) &&
      slotFits(inFocus, duration, busy, prefs.bufferMinutes, dayEnd)
    ) {
      slotStart = inFocus;
    }
  }

  if (isSameDay(day, now) && isBefore(slotStart, now)) {
    const afterNow = roundUpToNext15(addMinutes(now, 5));
    slotStart =
      findFreeSlotStart(afterNow, duration, busy, prefs, dayEnd) ?? afterNow;
  }

  if (!slotFits(slotStart, duration, busy, prefs.bufferMinutes, dayEnd)) {
    const adjusted = findFreeSlotStart(
      slotStart,
      duration,
      busy,
      prefs,
      dayEnd
    );
    if (!adjusted) {
      return {
        block: null,
        nextCursor: null,
        remaining: task.estimatedMinutes,
      };
    }
    slotStart = adjusted;
  }

  const slotEnd = addMinutes(slotStart, duration);
  if (isAfter(slotEnd, dayEnd)) {
    return { block: null, nextCursor: null, remaining: task.estimatedMinutes };
  }

  const block: ScheduleBlockInput = {
    taskId: task.id,
    title: task.title,
    blockType,
    startTime: slotStart,
    endTime: slotEnd,
    explanation:
      blockType === "DEEP_WORK"
        ? `High-focus block for ${task.title} during peak energy window`
        : `Scheduled ${task.title} based on priority and deadline`,
  };

  const nextCursor = addMinutes(slotEnd, prefs.bufferMinutes);
  const remaining = task.estimatedMinutes - duration;

  return {
    block,
    nextCursor: isBefore(nextCursor, dayEnd) ? nextCursor : null,
    remaining,
  };
}

function busySlotsForDay(
  day: Date,
  reserved: ReservedSlot[],
  placed: ScheduleBlockInput[]
): ReservedSlot[] {
  return [
    ...reserved.filter((s) => isSameDay(s.startTime, day)),
    ...placed
      .filter((b) => isSameDay(b.startTime, day))
      .map((b) => ({ startTime: b.startTime, endTime: b.endTime })),
  ];
}

export function generateSchedule(
  tasks: SchedulableTask[],
  preferences: OwnerPreferences,
  rangeStart: Date,
  rangeEnd: Date,
  now: Date = new Date(),
  reservedSlots: ReservedSlot[] = []
): ScheduleResult {
  const pending = tasks.filter(
    (t) => t.status === "PENDING" || t.status === "IN_PROGRESS"
  );

  const blocks: ScheduleBlockInput[] = [];
  const unscheduled: SchedulableTask[] = [];
  const warnings: string[] = [];

  const days = getSchedulableDays(rangeStart, rangeEnd, now);
  if (days.length === 0) {
    return {
      blocks,
      unscheduled: pending,
      overloaded: pending.length > 0,
      warnings: ["No schedulable time remains in this range."],
      totalScheduledMinutes: 0,
    };
  }

  const { buckets, unassigned } = assignTasksToDays(
    pending,
    days,
    preferences,
    now
  );
  unscheduled.push(...unassigned);

  const existingByDay = reservedMinutesByDay(reservedSlots);
  for (const bucket of buckets) {
    bucket.plannedMinutes +=
      existingByDay.get(bucket.date.toISOString()) ?? 0;
  }

  const overflowQueue: SchedulableTask[] = [];

  for (const bucket of buckets) {
    let cursor = getEarliestSlot(bucket.date, preferences, now);
    if (!cursor) {
      overflowQueue.push(...bucket.tasks);
      continue;
    }

    const dayTasks = [...bucket.tasks, ...overflowQueue];
    overflowQueue.length = 0;

    for (const task of dayTasks) {
      let remaining = task.estimatedMinutes;
      let currentTask: SchedulableTask = { ...task };
      let chunkIndex = 0;

      while (remaining > 0) {
        if (!cursor) {
          overflowQueue.push({
            ...currentTask,
            estimatedMinutes: remaining,
            title:
              chunkIndex > 0
                ? `${task.title} (continued)`
                : currentTask.title,
          });
          break;
        }

        const dayBusy = busySlotsForDay(
          bucket.date,
          reservedSlots,
          blocks
        );

        const result = placeTaskOnDay(
          { ...currentTask, estimatedMinutes: remaining },
          bucket.date,
          cursor,
          preferences,
          now,
          dayBusy
        );

        if (!result.block) {
          overflowQueue.push({
            ...currentTask,
            estimatedMinutes: remaining,
            title:
              chunkIndex > 0 ? `${task.title} (continued)` : currentTask.title,
          });
          break;
        }

        blocks.push(result.block);
        remaining = result.remaining;
        cursor = result.nextCursor;
        chunkIndex += 1;
        currentTask = {
          ...currentTask,
          title: `${task.title} (continued)`,
        };
      }
    }
  }

  if (overflowQueue.length > 0) {
    for (let i = 0; i < days.length && overflowQueue.length > 0; i++) {
      const bucket = buckets.find((b) => isSameDay(b.date, days[i]));
      if (!bucket) continue;

      let cursor = getEarliestSlot(bucket.date, preferences, now);
      if (!cursor) continue;

      const dayBusy = busySlotsForDay(bucket.date, reservedSlots, blocks);
      const lastBlockOnDay = [...dayBusy].sort(
        (a, b) => b.endTime.getTime() - a.endTime.getTime()
      )[0];
      if (lastBlockOnDay) {
        cursor = max([
          cursor,
          addMinutes(lastBlockOnDay.endTime, preferences.bufferMinutes),
        ]);
      }

      const stillOverflow: SchedulableTask[] = [];
      for (const task of overflowQueue) {
        const result = placeTaskOnDay(
          task,
          bucket.date,
          cursor,
          preferences,
          now,
          dayBusy
        );
        if (result.block) {
          blocks.push(result.block);
          cursor = result.nextCursor;
          if (result.remaining > 0) {
            stillOverflow.push({
              ...task,
              estimatedMinutes: result.remaining,
              title: `${task.title} (continued)`,
            });
          }
        } else {
          stillOverflow.push(task);
        }
      }
      overflowQueue.length = 0;
      overflowQueue.push(...stillOverflow);
    }
    unscheduled.push(...overflowQueue);
  }

  blocks.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const totalScheduledMinutes = blocks.reduce(
    (sum, b) =>
      sum + (b.endTime.getTime() - b.startTime.getTime()) / (1000 * 60),
    0
  );

  const totalAvailable = days.length * preferences.maxDailyMinutes;
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
  day: Date,
  now: Date = new Date(),
  reservedSlots: ReservedSlot[] = []
): ScheduleResult {
  const start = startOfDay(day);
  const end = endOfDay(day);
  return generateSchedule(
    tasks,
    preferences,
    start,
    end,
    now,
    reservedSlots
  );
}

export function generateWeeklySchedule(
  tasks: SchedulableTask[],
  preferences: OwnerPreferences,
  weekStart: Date,
  now: Date = new Date(),
  reservedSlots: ReservedSlot[] = []
): ScheduleResult {
  const start = startOfDay(max([weekStart, now]));
  const end = addDays(start, 6);
  end.setHours(23, 59, 59, 999);
  return generateSchedule(tasks, preferences, start, end, now, reservedSlots);
}
