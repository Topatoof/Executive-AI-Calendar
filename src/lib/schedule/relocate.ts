import {
  addMinutes,
  isAfter,
  isBefore,
  isSameDay,
  max,
  startOfDay,
} from "date-fns";
import type { OwnerPreferences, ReservedSlot } from "@/lib/scheduler/types";

function setTimeOnDay(day: Date, hour: number, minute = 0): Date {
  const d = new Date(day);
  d.setHours(hour, minute, 0, 0);
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

/** Place a block on a new day, preserving clock time when possible. */
export function relocateBlockToDay(
  startTime: Date,
  endTime: Date,
  targetDay: Date,
  prefs: OwnerPreferences,
  reserved: ReservedSlot[],
  now: Date = new Date()
): { startTime: Date; endTime: Date } | null {
  const durationMinutes = Math.max(
    15,
    Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))
  );
  const dayEnd = setTimeOnDay(targetDay, prefs.workEndHour);
  let cursor = setTimeOnDay(
    targetDay,
    startTime.getHours(),
    startTime.getMinutes()
  );

  if (isSameDay(targetDay, now) && isBefore(cursor, now)) {
    cursor = roundUpToNext15(addMinutes(now, 5));
  }

  if (!slotFits(cursor, durationMinutes, reserved, prefs.bufferMinutes, dayEnd)) {
    const dayStart = setTimeOnDay(targetDay, prefs.workStartHour);
    const adjusted =
      findFreeSlotStart(
        max([dayStart, cursor]),
        durationMinutes,
        reserved,
        prefs,
        dayEnd
      ) ?? findFreeSlotStart(dayStart, durationMinutes, reserved, prefs, dayEnd);
    if (!adjusted) return null;
    cursor = adjusted;
  }

  const newEnd = addMinutes(cursor, durationMinutes);
  if (isAfter(newEnd, dayEnd)) return null;

  return { startTime: cursor, endTime: newEnd };
}
