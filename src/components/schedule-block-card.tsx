"use client";

import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBlockColor } from "@/lib/calendar/ics";
import { updateBlockStatus } from "@/app/actions";
import type { ScheduleBlock, Task } from "@prisma/client";

export function ScheduleBlockCard({
  block,
}: {
  block: ScheduleBlock & { task?: Task | null };
}) {
  const color = getBlockColor(block.blockType);

  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderLeftWidth: 4, borderLeftColor: color }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">{block.title}</p>
          <p className="text-xs text-muted-foreground">
            {format(block.startTime, "EEE h:mm a")} –{" "}
            {format(block.endTime, "h:mm a")}
          </p>
          {block.explanation && (
            <p className="mt-1 text-xs text-muted-foreground">
              {block.explanation}
            </p>
          )}
        </div>
        <Badge variant="outline">{block.blockType.replace("_", " ")}</Badge>
      </div>
      {block.status === "SCHEDULED" && (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            onClick={() => updateBlockStatus(block.id, "COMPLETED")}
          >
            Done
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateBlockStatus(block.id, "MISSED")}
          >
            Missed
          </Button>
        </div>
      )}
      {block.status !== "SCHEDULED" && (
        <Badge
          className="mt-2"
          variant={block.status === "COMPLETED" ? "success" : "destructive"}
        >
          {block.status}
        </Badge>
      )}
    </div>
  );
}
