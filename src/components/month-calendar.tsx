"use client";

import { ScheduleBlockList } from "@/components/schedule-block-list";
import { AddScheduleBlockForm } from "@/components/add-schedule-block-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getBlockColor } from "@/lib/calendar/ics";
import {
  isScheduleBlockCompleted,
  type ScheduleBlockWithTask,
} from "@/lib/schedule/sort";
import type { BlockType, BlockStatus, ScheduleBlock, Task } from "@prisma/client";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type SerializedTask = Omit<Task, "deadline" | "scheduledDate" | "completedAt" | "createdAt" | "updatedAt"> & {
  deadline: string | null;
  scheduledDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedCalendarBlock = Omit<
  ScheduleBlock,
  "startTime" | "endTime" | "createdAt" | "updatedAt"
> & {
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
  task: SerializedTask | null;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_VISIBLE_EVENTS = 3;

function monthHref(date: Date) {
  return `/calendar?month=${format(date, "yyyy-MM")}`;
}

function hydrateBlock(block: SerializedCalendarBlock): ScheduleBlockWithTask {
  return {
    ...block,
    blockType: block.blockType as BlockType,
    status: block.status as BlockStatus,
    startTime: new Date(block.startTime),
    endTime: new Date(block.endTime),
    createdAt: new Date(block.createdAt),
    updatedAt: new Date(block.updatedAt),
    task: block.task
      ? {
          ...block.task,
          status: block.task.status,
          priority: block.task.priority,
          deadline: block.task.deadline ? new Date(block.task.deadline) : null,
          scheduledDate: block.task.scheduledDate
            ? new Date(block.task.scheduledDate)
            : null,
          completedAt: block.task.completedAt
            ? new Date(block.task.completedAt)
            : null,
          createdAt: new Date(block.task.createdAt),
          updatedAt: new Date(block.task.updatedAt),
        }
      : null,
  };
}

export function MonthCalendar({
  month,
  blocks,
}: {
  month: Date;
  blocks: SerializedCalendarBlock[];
}) {
  const hydratedBlocks = useMemo(() => blocks.map(hydrateBlock), [blocks]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(() =>
    isSameMonth(new Date(), month) ? new Date() : null
  );
  const [adding, setAdding] = useState(false);

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const blocksByDay = useMemo(() => {
    const map = new Map<string, ScheduleBlockWithTask[]>();
    for (const block of hydratedBlocks) {
      const key = format(block.startTime, "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(block);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    }
    return map;
  }, [hydratedBlocks]);

  const selectedBlocks = selectedDay
    ? (blocksByDay.get(format(selectedDay, "yyyy-MM-dd")) ?? [])
    : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>{format(month, "MMMM yyyy")}</CardTitle>
            <CardDescription>
              Click a day to view blocks · double-click to add one
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" asChild>
              <Link href={monthHref(addMonths(month, -1))} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/calendar">Today</Link>
            </Button>
            <Button variant="outline" size="icon" asChild>
              <Link href={monthHref(addMonths(month, 1))} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 border-b pb-2 text-center text-xs font-medium text-muted-foreground">
            {WEEKDAYS.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 border-l border-t">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayBlocks = blocksByDay.get(key) ?? [];
              const inMonth = isSameMonth(day, month);
              const selected = selectedDay ? isSameDay(day, selectedDay) : false;
              const visible = dayBlocks.slice(0, MAX_VISIBLE_EVENTS);
              const hiddenCount = dayBlocks.length - visible.length;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedDay(day);
                    setAdding(false);
                  }}
                  onDoubleClick={() => {
                    setSelectedDay(day);
                    setAdding(true);
                  }}
                  className={`min-h-28 border-r border-b p-2 text-left transition-colors hover:bg-accent/40 ${
                    selected ? "bg-primary/5 ring-2 ring-inset ring-primary" : ""
                  } ${!inMonth ? "bg-muted/30 text-muted-foreground" : ""}`}
                >
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                      isToday(day)
                        ? "bg-primary font-semibold text-primary-foreground"
                        : inMonth
                          ? "font-medium"
                          : ""
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="mt-1 space-y-1">
                    {visible.map((block) => (
                      <div
                        key={block.id}
                        className={`truncate rounded px-1.5 py-0.5 text-[10px] leading-tight text-white ${
                          isScheduleBlockCompleted(block) ? "opacity-50 line-through" : ""
                        }`}
                        style={{ background: getBlockColor(block.blockType) }}
                        title={`${format(block.startTime, "h:mm a")} – ${block.title}`}
                      >
                        {format(block.startTime, "h:mm")} {block.title}
                      </div>
                    ))}
                    {hiddenCount > 0 && (
                      <p className="px-1 text-[10px] text-muted-foreground">
                        +{hiddenCount} more
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedDay && (
        <Card>
          <CardHeader>
            <CardTitle>{format(selectedDay, "EEEE, MMMM d")}</CardTitle>
            <CardDescription>
              {selectedBlocks.length === 0
                ? "No blocks scheduled"
                : `${selectedBlocks.length} block(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {adding && (
              <AddScheduleBlockForm
                dateIso={selectedDay.toISOString()}
                onClose={() => setAdding(false)}
              />
            )}
            {selectedBlocks.length === 0 && !adding ? (
              <p className="text-sm text-muted-foreground">
                Nothing on this day. Double-click the day in the calendar to add
                a block.
              </p>
            ) : (
              selectedBlocks.length > 0 && (
                <ScheduleBlockList blocks={selectedBlocks} overdueMode="inline" />
              )
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
