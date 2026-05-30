import { ScheduleBlockList } from "@/components/schedule-block-list";
import { PlannerDaySection } from "@/components/planner-day-section";
import {
  groupScheduleBlocksByDay,
  type ScheduleBlockWithTask,
} from "@/lib/schedule/sort";
import { addDays, isSameDay, startOfDay } from "date-fns";

function isTodayOrTomorrow(date: Date, now: Date = new Date()) {
  const day = startOfDay(date);
  const today = startOfDay(now);
  return isSameDay(day, today) || isSameDay(day, addDays(today, 1));
}

export function PlannerScheduleByDay({
  blocks,
  weekStart,
  weekEnd,
}: {
  blocks: ScheduleBlockWithTask[];
  weekStart: Date;
  weekEnd: Date;
}) {
  const days = groupScheduleBlocksByDay(blocks, weekStart, weekEnd);

  return (
    <div className="space-y-4">
      {days.map(({ date, blocks: dayBlocks }) => (
        <PlannerDaySection
          key={date.toISOString()}
          dateIso={date.toISOString()}
          blockCount={dayBlocks.length}
          defaultCollapsed={!isTodayOrTomorrow(date)}
        >
          {dayBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blocks scheduled.</p>
          ) : (
            <ScheduleBlockList blocks={dayBlocks} />
          )}
        </PlannerDaySection>
      ))}
    </div>
  );
}
