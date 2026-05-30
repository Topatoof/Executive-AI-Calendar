import { describe, expect, it } from "vitest";
import type { ScheduleBlock, Task } from "@prisma/client";
import {
  countOverdueTasks,
  isTaskOverdue,
} from "@/lib/tasks/overdue";

const now = new Date("2026-05-30T15:00:00");

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    ownerId: "o1",
    projectId: null,
    brainDumpId: null,
    title: "Task",
    description: null,
    category: "general",
    status: "PENDING",
    priority: "MEDIUM",
    importance: 5,
    urgency: 5,
    cognitiveLoad: 5,
    estimatedMinutes: 60,
    deadline: null,
    scheduledDate: null,
    dependsOnId: null,
    recurrence: null,
    confidence: 1,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function block(overrides: Partial<ScheduleBlock> = {}): ScheduleBlock {
  return {
    id: "b1",
    ownerId: "o1",
    taskId: "t1",
    title: "Block",
    blockType: "DEEP_WORK",
    status: "SCHEDULED",
    startTime: new Date("2026-05-30T13:00:00"),
    endTime: new Date("2026-05-30T14:00:00"),
    explanation: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("isTaskOverdue", () => {
  it("counts incomplete tasks past deadline", () => {
    expect(
      isTaskOverdue(
        task({ deadline: new Date("2026-05-29T23:59:00") }),
        [],
        now
      )
    ).toBe(true);
  });

  it("excludes completed tasks even with past deadline", () => {
    expect(
      isTaskOverdue(
        task({
          status: "COMPLETED",
          deadline: new Date("2026-05-29T23:59:00"),
        }),
        [],
        now
      )
    ).toBe(false);
  });

  it("counts tasks with overdue schedule blocks not marked done", () => {
    expect(
      isTaskOverdue(
        task({ id: "t1", deadline: null }),
        [
          block({
            taskId: "t1",
            endTime: new Date("2026-05-30T13:00:00"),
          }),
        ],
        now
      )
    ).toBe(true);
  });

  it("excludes tasks whose blocks are marked complete", () => {
    expect(
      isTaskOverdue(
        task({ id: "t1" }),
        [block({ taskId: "t1", status: "COMPLETED" })],
        now
      )
    ).toBe(false);
  });

  it("counts tasks marked missed", () => {
    expect(isTaskOverdue(task({ status: "MISSED" }), [], now)).toBe(true);
  });

  it("counts tasks with schedule blocks marked missed", () => {
    expect(
      isTaskOverdue(
        task({ id: "t1", deadline: null }),
        [block({ taskId: "t1", status: "MISSED" })],
        now
      )
    ).toBe(true);
  });
});

describe("countOverdueTasks", () => {
  it("deduplicates tasks with both past deadline and overdue block", () => {
    expect(
      countOverdueTasks(
        [
          task({
            id: "t1",
            deadline: new Date("2026-05-29T23:59:00"),
          }),
        ],
        [block({ taskId: "t1" })],
        now
      )
    ).toBe(1);
  });
});
