import { describe, expect, it } from "vitest";
import {
  deadlineToIso,
  formatDateInputValue,
  formatDeadlineLabel,
  parseDeadline,
} from "./dates";

describe("parseDeadline", () => {
  it("parses ISO date strings", () => {
    const d = parseDeadline("2026-06-10");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(5);
    expect(d!.getDate()).toBe(10);
  });

  it("keeps date picker and label on the same calendar day", () => {
    const iso = deadlineToIso("2026-05-30");
    expect(iso).not.toBeNull();
    expect(formatDateInputValue(iso)).toBe("2026-05-30");
    expect(formatDeadlineLabel(iso)).toMatch(/May 30, 2026/);
  });

  it("parses ISO date-only without UTC day shift", () => {
    const parsed = parseDeadline("2026-05-30");
    expect(parsed).not.toBeNull();
    expect(parsed!.getFullYear()).toBe(2026);
    expect(parsed!.getMonth()).toBe(4);
    expect(parsed!.getDate()).toBe(30);
  });

  it("parses dates after June 9", () => {
    expect(parseDeadline("2026-06-09")).not.toBeNull();
    expect(parseDeadline("2026-06-10")).not.toBeNull();
    expect(parseDeadline("2026-06-15")).not.toBeNull();
    expect(parseDeadline("2026-07-01")).not.toBeNull();
  });

  it("parses flexible single-digit month/day", () => {
    expect(parseDeadline("2026-6-10")).not.toBeNull();
    expect(parseDeadline("2026-06-9")).not.toBeNull();
  });

  it("parses natural language dates", () => {
    expect(parseDeadline("June 10, 2026")).not.toBeNull();
    expect(parseDeadline("July 1, 2026")).not.toBeNull();
  });

  it("returns null for invalid values", () => {
    expect(parseDeadline("Invalid Date")).toBeNull();
    expect(parseDeadline("not-a-date")).toBeNull();
    expect(parseDeadline("")).toBeNull();
    expect(deadlineToIso("June 32, 2026")).toBeNull();
  });
});
