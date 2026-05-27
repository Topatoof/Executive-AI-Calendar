import { describe, it, expect } from "vitest";
import { generateIcsContent, blocksToIcsEvents } from "@/lib/calendar/ics";
import type { ScheduleBlock, Task } from "@prisma/client";

function makeBlock(
  overrides: Partial<ScheduleBlock> = {}
): ScheduleBlock & { task: Task | null } {
  const start = new Date("2026-05-19T10:00:00");
  const end = new Date("2026-05-19T11:30:00");
  return {
    id: "block-1",
    ownerId: "owner-1",
    taskId: null,
    title: "Study calculus",
    blockType: "DEEP_WORK",
    status: "SCHEDULED",
    startTime: start,
    endTime: end,
    explanation: "Focus block",
    rescheduleCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    task: null,
    ...overrides,
  };
}

describe("ICS export", () => {
  it("converts blocks to events", () => {
    const { events } = blocksToIcsEvents([makeBlock()]);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Study calculus");
  });

  it("generates valid ICS string", () => {
    const ics = generateIcsContent([makeBlock()]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("Study calculus");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("returns empty for no blocks", () => {
    expect(generateIcsContent([])).toBe("");
  });
});
