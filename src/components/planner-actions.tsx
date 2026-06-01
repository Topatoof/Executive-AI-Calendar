"use client";

import { Button } from "@/components/ui/button";
import {
  generateScheduleAction,
  shiftPlannerScheduleByOneDay,
} from "@/app/actions";
import { useTransition } from "react";
import { CalendarClock, Loader2 } from "lucide-react";

export function PlannerActions() {
  const [pending, startTransition] = useTransition();

  const shiftAllByOneDay = () => {
    const ok = confirm(
      "Shift blocks from yesterday onward forward by one day?\n\n" +
        "Blocks before yesterday stay unchanged.\n\n" +
        "Penalty: only blocks moved from yesterday onto today count as overdue. " +
        "Other shifted blocks on today or tomorrow are not marked overdue."
    );
    if (!ok) return;
    startTransition(() => shiftPlannerScheduleByOneDay());
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(() => generateScheduleAction("daily"))
        }
      >
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Plan Today
      </Button>
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(() => generateScheduleAction("weekly"))
        }
      >
        Plan Week
      </Button>
      <Button
        variant="outline"
        disabled={pending}
        onClick={shiftAllByOneDay}
        title="Move all planner blocks forward one day"
      >
        {pending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CalendarClock className="mr-2 h-4 w-4" />
        )}
        Shift +1 Day
      </Button>
    </div>
  );
}
