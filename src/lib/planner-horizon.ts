import { addDays, endOfDay, startOfDay, startOfWeek } from "date-fns";

/** Days ahead to show in planner and schedule when planning the week. */
export const PLANNER_HORIZON_DAYS = 14;

export function getPlannerViewRange(now: Date = new Date()) {
  const viewStart = startOfWeek(now, { weekStartsOn: 1 });
  const viewEnd = endOfDay(
    addDays(startOfDay(now), PLANNER_HORIZON_DAYS - 1)
  );
  return { viewStart, viewEnd };
}

export function getWeeklyScheduleRange(now: Date = new Date()) {
  const rangeStart = startOfDay(now);
  const rangeEnd = endOfDay(
    addDays(startOfDay(now), PLANNER_HORIZON_DAYS - 1)
  );
  return { rangeStart, rangeEnd };
}
