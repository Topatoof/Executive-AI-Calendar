"use client";

import { createScheduleBlock } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BlockType } from "@prisma/client";
import { useMemo, useState, useTransition } from "react";

const BLOCK_TYPES: BlockType[] = [
  "DEEP_WORK",
  "SHALLOW_WORK",
  "MEETING",
  "HABIT",
  "BREAK",
  "BUFFER",
];

function toLocalInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function defaultTimesForDay(dateIso: string) {
  const day = new Date(dateIso);
  const start = new Date(day);
  start.setHours(9, 0, 0, 0);
  const end = new Date(day);
  end.setHours(10, 0, 0, 0);
  return { start: toLocalInputValue(start), end: toLocalInputValue(end) };
}

export function AddScheduleBlockForm({
  dateIso,
  onClose,
}: {
  dateIso: string;
  onClose: () => void;
}) {
  const defaults = useMemo(() => defaultTimesForDay(dateIso), [dateIso]);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState(defaults.start);
  const [endTime, setEndTime] = useState(defaults.end);
  const [blockType, setBlockType] = useState<BlockType>("DEEP_WORK");

  const handleSubmit = () =>
    startTransition(async () => {
      await createScheduleBlock({ title, startTime, endTime, blockType });
      onClose();
    });

  return (
    <div className="mt-3 space-y-3 rounded-md border p-3">
      <div className="space-y-1">
        <Label htmlFor={`add-title-${dateIso}`}>Title</Label>
        <Input
          id={`add-title-${dateIso}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What are you working on?"
          disabled={pending}
          autoFocus
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`add-start-${dateIso}`}>Start</Label>
          <Input
            id={`add-start-${dateIso}`}
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`add-end-${dateIso}`}>End</Label>
          <Input
            id={`add-end-${dateIso}`}
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            disabled={pending}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`add-type-${dateIso}`}>Block type</Label>
        <select
          id={`add-type-${dateIso}`}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          value={blockType}
          onChange={(e) => setBlockType(e.target.value as BlockType)}
          disabled={pending}
        >
          {BLOCK_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={pending}>
          Add block
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
