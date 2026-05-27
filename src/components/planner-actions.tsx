"use client";

import { Button } from "@/components/ui/button";
import { generateScheduleAction } from "@/app/actions";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";

export function PlannerActions() {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
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
    </div>
  );
}
