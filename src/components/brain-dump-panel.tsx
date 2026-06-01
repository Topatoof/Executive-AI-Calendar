"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BrainDumpForm } from "@/components/brain-dump-form";
import { BrainDumpScheduleChanges } from "@/components/brain-dump-schedule-changes";

export type BrainDumpMode = "dump" | "changes";

export function BrainDumpPanel() {
  const [mode, setMode] = useState<BrainDumpMode>("dump");

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border p-1">
        <Button
          type="button"
          size="sm"
          variant={mode === "dump" ? "default" : "ghost"}
          onClick={() => setMode("dump")}
        >
          New brain dump
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "changes" ? "default" : "ghost"}
          onClick={() => setMode("changes")}
        >
          Schedule changes
        </Button>
      </div>
      {mode === "dump" ? <BrainDumpForm /> : <BrainDumpScheduleChanges />}
    </div>
  );
}
