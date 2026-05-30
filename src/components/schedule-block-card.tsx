"use client";

import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBlockColor } from "@/lib/calendar/ics";
import {
  deleteScheduleBlock,
  updateBlockStatus,
  updateScheduleBlock,
} from "@/app/actions";
import type { ScheduleBlock, Task } from "@prisma/client";
import { useEffect, useState, useTransition } from "react";
import {
  isScheduleBlockCompleted,
  isScheduleBlockInProgress,
  scheduleBlockRemainingMs,
} from "@/lib/schedule/sort";
import { formatRemainingMs } from "@/lib/utils";

function toLocalInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function ScheduleBlockCard({
  block,
}: {
  block: ScheduleBlock & { task?: Task | null };
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(block.title);
  const [startTime, setStartTime] = useState(toLocalInputValue(block.startTime));
  const [endTime, setEndTime] = useState(toLocalInputValue(block.endTime));
  const [explanation, setExplanation] = useState(block.explanation ?? "");
  const [now, setNow] = useState(() => new Date());
  const color = getBlockColor(block.blockType);
  const inProgress = isScheduleBlockInProgress(block, now);
  const remainingMs = inProgress ? scheduleBlockRemainingMs(block, now) : 0;

  useEffect(() => {
    if (isScheduleBlockCompleted(block) || block.status === "MISSED") return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const tick = () => setNow(new Date());

    const schedule = () => {
      const current = new Date();
      const inWindow =
        block.status === "IN_PROGRESS" ||
        (current >= block.startTime && current < block.endTime);

      if (current >= block.endTime && block.status !== "IN_PROGRESS") return;

      tick();
      timeoutId = setTimeout(schedule, inWindow ? 1000 : 30_000);
    };

    schedule();
    return () => clearTimeout(timeoutId);
  }, [block.id, block.startTime, block.endTime, block.status]);

  const saveEdit = () =>
    startTransition(async () => {
      await updateScheduleBlock({
        blockId: block.id,
        title,
        startTime,
        endTime,
        explanation,
      });
      setEditing(false);
    });

  const removeBlock = () =>
    startTransition(async () => {
      if (!confirm("Delete this block from the planner?")) return;
      await deleteScheduleBlock(block.id);
    });

  return (
    <div
      className={`rounded-lg border p-4 transition-shadow ${
        inProgress ? "border-primary bg-primary/5 ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
      }`}
      style={{ borderLeftWidth: 4, borderLeftColor: color }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{block.title}</p>
            {inProgress && (
              <Badge className="animate-pulse bg-primary text-primary-foreground">
                In progress
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {format(block.startTime, "EEE h:mm a")} –{" "}
            {format(block.endTime, "h:mm a")}
          </p>
          {inProgress && (
            <p className="mt-1 text-sm font-medium tabular-nums text-primary">
              {formatRemainingMs(remainingMs)}
            </p>
          )}
          {block.explanation && (
            <p className="mt-1 text-xs text-muted-foreground">
              {block.explanation}
            </p>
          )}
        </div>
        <Badge variant="outline">{block.blockType.replace("_", " ")}</Badge>
      </div>
      {editing && (
        <div className="mt-3 space-y-3 rounded-md border p-3">
          <div className="space-y-1">
            <Label htmlFor={`title-${block.id}`}>Title</Label>
            <Input
              id={`title-${block.id}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`start-${block.id}`}>Start</Label>
              <Input
                id={`start-${block.id}`}
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`end-${block.id}`}>End</Label>
              <Input
                id={`end-${block.id}`}
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={pending}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`notes-${block.id}`}>Explanation</Label>
            <Input
              id={`notes-${block.id}`}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveEdit} disabled={pending}>
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setEditing(false);
                setTitle(block.title);
                setStartTime(toLocalInputValue(block.startTime));
                setEndTime(toLocalInputValue(block.endTime));
                setExplanation(block.explanation ?? "");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {block.status === "SCHEDULED" && (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(() => updateBlockStatus(block.id, "COMPLETED"))
            }
          >
            Done
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(() => updateBlockStatus(block.id, "MISSED"))
            }
          >
            Missed
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Close Edit" : "Edit"}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={removeBlock}
          >
            Delete
          </Button>
        </div>
      )}
      {block.status !== "SCHEDULED" && (
        <div className="mt-3 flex gap-2">
          <Badge
            variant={block.status === "COMPLETED" ? "success" : "destructive"}
          >
            {block.status}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Close Edit" : "Edit"}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={removeBlock}
          >
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}
