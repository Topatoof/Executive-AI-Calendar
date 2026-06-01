import { describe, expect, it } from "vitest";
import { resolveScheduleChangePlan } from "./apply-changes";
import type { ScheduleBlock } from "@prisma/client";

function block(
  overrides: Partial<ScheduleBlock> & { title: string; startTime: Date }
): ScheduleBlock {
  const start = overrides.startTime;
  const end =
    overrides.endTime ?? new Date(start.getTime() + 60 * 60 * 1000);
  return {
    id: "b1",
    ownerId: "o1",
    taskId: null,
    title: "Untitled",
    blockType: "DEEP_WORK",
    status: "SCHEDULED",
    startTime: start,
    endTime: end,
    explanation: null,
    rescheduleCount: 0,
    shiftedFromDay: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("resolveScheduleChangePlan", () => {
  it("resolves move then clear_day without double-counting moved blocks", () => {
    const monday = new Date("2026-06-01T10:00:00");
    const tuesday = new Date("2026-06-02T14:00:00");
    const blocks = [
      block({
        id: "calc",
        title: "Study calculus",
        startTime: monday,
      }),
      block({
        id: "other",
        title: "Admin email",
        startTime: monday,
      }),
    ];

    const preview = resolveScheduleChangePlan(
      {
        summary: "Busy Monday",
        warnings: [],
        changes: [
          {
            action: "move",
            blockTitleContains: "calculus",
            sourceDate: "2026-06-01",
            targetDate: "2026-06-02",
          },
          {
            action: "clear_day",
            sourceDate: "2026-06-01",
            targetDate: null,
          },
        ],
      },
      blocks
    );

    const move = preview.resolved.find((c) => c.action === "move");
    const clear = preview.resolved.find((c) => c.action === "clear_day");

    expect(move?.blockIds).toEqual(["calc"]);
    expect(clear?.blockIds).toEqual(["other"]);
  });
});
