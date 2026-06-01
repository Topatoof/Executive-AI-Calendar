import { addDays, startOfDay } from "date-fns";

/** Earliest calendar day included in bulk +1 day shift (yesterday). */
export function plannerShiftCutoffDay(now: Date = new Date()): Date {
  return startOfDay(addDays(now, -1));
}

/** Blocks before yesterday are left unchanged when shifting the planner. */
export function shouldShiftBlockOnDay(
  blockDay: Date,
  now: Date = new Date()
): boolean {
  return startOfDay(blockDay) >= plannerShiftCutoffDay(now);
}
