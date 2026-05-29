import { describe, expect, it } from "vitest";
import {
  formatPlannerDayHeader,
  groupScheduleBlocksByDay,
  isScheduleBlockCompleted,
  isScheduleBlockOverdue,
  partitionScheduleBlocks,
  sortScheduleBlocks,
  SCHEDULE_OVERDUE_GRACE_MS,
} from "./sort";
import { startOfWeek, endOfWeek } from "date-fns";
import type { ScheduleBlock, Task } from "@prisma/client";

function block(
  overrides: Partial<ScheduleBlock> & { task?: Task | null }
): ScheduleBlock & { task?: Task | null } {
  const { task, ...rest } = overrides;
  return {
    id: "b1",
    ownerId: "o1",
    taskId: null,
    title: "Block",
    blockType: "DEEP_WORK",
    status: "SCHEDULED",
    startTime: new Date("2026-05-28T10:00:00"),
    endTime: new Date("2026-05-28T11:00:00"),
    explanation: null,
    rescheduleCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    task: task ?? null,
    ...rest,
  };
}

describe("sortScheduleBlocks", () => {
  it("sorts active blocks chronologically before completed", () => {
    const sorted = sortScheduleBlocks([
      block({
        id: "done-early",
        status: "COMPLETED",
        startTime: new Date("2026-05-28T09:00:00"),
      }),
      block({
        id: "active-late",
        startTime: new Date("2026-05-28T14:00:00"),
      }),
      block({
        id: "active-early",
        startTime: new Date("2026-05-28T11:00:00"),
      }),
      block({
        id: "done-late",
        status: "COMPLETED",
        startTime: new Date("2026-05-28T16:00:00"),
      }),
    ]);

    expect(sorted.map((b) => b.id)).toEqual([
      "active-early",
      "active-late",
      "done-early",
      "done-late",
    ]);
  });

  it("treats linked completed tasks as completed", () => {
    const sorted = sortScheduleBlocks([
      block({
        id: "pending",
        startTime: new Date("2026-05-28T15:00:00"),
      }),
      block({
        id: "via-task",
        startTime: new Date("2026-05-28T08:00:00"),
        task: {
          id: "t1",
          status: "COMPLETED",
        } as Task,
      }),
    ]);

    expect(sorted.map((b) => b.id)).toEqual(["pending", "via-task"]);
  });

  it("marks blocks overdue one hour after end time", () => {
    const now = new Date("2026-05-28T14:00:00");
    const ended = block({
      endTime: new Date(
        now.getTime() - SCHEDULE_OVERDUE_GRACE_MS - 60_000
      ),
    });
    const withinGrace = block({
      endTime: new Date(now.getTime() - SCHEDULE_OVERDUE_GRACE_MS + 60_000),
    });

    expect(isScheduleBlockOverdue(ended, now)).toBe(true);
    expect(isScheduleBlockOverdue(withinGrace, now)).toBe(false);
    expect(isScheduleBlockOverdue(block({ status: "COMPLETED" }), now)).toBe(
      false
    );
  });

  it("partitions schedule, overdue, and completed blocks", () => {
    const now = new Date("2026-05-28T18:00:00");
    const parts = partitionScheduleBlocks(
      [
        block({
          id: "done",
          status: "COMPLETED",
          startTime: new Date("2026-05-28T08:00:00"),
        }),
        block({
          id: "overdue",
          endTime: new Date("2026-05-28T15:00:00"),
          startTime: new Date("2026-05-28T14:00:00"),
        }),
        block({
          id: "upcoming",
          startTime: new Date("2026-05-28T19:00:00"),
          endTime: new Date("2026-05-28T20:00:00"),
        }),
      ],
      now
    );

    expect(parts.schedule.map((b) => b.id)).toEqual(["upcoming"]);
    expect(parts.overdue.map((b) => b.id)).toEqual(["overdue"]);
    expect(parts.completed.map((b) => b.id)).toEqual(["done"]);
  });

  it("groups blocks by day within a week range", () => {
    const weekStart = startOfWeek(new Date("2026-05-28"), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date("2026-05-28"), { weekStartsOn: 1 });

    const grouped = groupScheduleBlocksByDay(
      [
        block({
          id: "wed",
          startTime: new Date("2026-05-28T10:00:00"),
        }),
        block({
          id: "mon",
          startTime: new Date("2026-05-26T14:00:00"),
        }),
      ],
      weekStart,
      weekEnd
    );

    expect(grouped).toHaveLength(7);
    const mon = grouped.find((d) => d.blocks.some((b) => b.id === "mon"));
    const wed = grouped.find((d) => d.blocks.some((b) => b.id === "wed"));
    expect(mon?.blocks.map((b) => b.id)).toEqual(["mon"]);
    expect(wed?.blocks.map((b) => b.id)).toEqual(["wed"]);
  });

  it("formats today in planner day headers", () => {
    const today = new Date();
    expect(formatPlannerDayHeader(today)).toMatch(/^Today · /);
  });

  it("detects completed blocks and tasks", () => {
    expect(
      isScheduleBlockCompleted(block({ status: "COMPLETED" }))
    ).toBe(true);
    expect(
      isScheduleBlockCompleted(
        block({ task: { status: "COMPLETED" } as Task })
      )
    ).toBe(true);
    expect(isScheduleBlockCompleted(block({ status: "SCHEDULED" }))).toBe(
      false
    );
  });
});
