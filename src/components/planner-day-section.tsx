"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
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
  const date = useMemo(() => new Date(dateIso), [dateIso]);
  const countLabel = `${blockCount} block${blockCount === 1 ? "" : "s"}`;

  return (
    <section>
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-2 border-b pb-2 text-left text-sm font-semibold tracking-tight transition-colors hover:text-primary"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1">{formatPlannerDayHeader(date)}</span>
        <span className="text-xs font-normal text-muted-foreground">
          {countLabel}
        </span>
      </button>
      {!collapsed && <div className="mt-3">{children}</div>}
    </section>
  );
}
