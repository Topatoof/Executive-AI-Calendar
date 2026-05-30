"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { AddScheduleBlockForm } from "@/components/add-schedule-block-form";
import { Button } from "@/components/ui/button";
import { formatPlannerDayHeader } from "@/lib/schedule/sort";

export function PlannerDaySection({
  dateIso,
  blockCount,
  defaultCollapsed = false,
  children,
}: {
  dateIso: string;
  blockCount: number;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [adding, setAdding] = useState(false);
  const date = useMemo(() => new Date(dateIso), [dateIso]);
  const countLabel = `${blockCount} block${blockCount === 1 ? "" : "s"}`;

  return (
    <section>
      <div className="border-b pb-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={!collapsed}
            className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-semibold tracking-tight transition-colors hover:text-primary"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="flex-1 truncate">{formatPlannerDayHeader(date)}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {countLabel}
            </span>
          </button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            aria-label="Add block"
            onClick={() => {
              setAdding(true);
              setCollapsed(false);
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {adding && (
          <AddScheduleBlockForm dateIso={dateIso} onClose={() => setAdding(false)} />
        )}
      </div>
      {!collapsed && <div className="mt-3">{children}</div>}
    </section>
  );
}
