import { describe, expect, it } from "vitest";
import { shouldShiftBlockOnDay } from "./shift";

describe("shouldShiftBlockOnDay", () => {
  const now = new Date("2026-05-30T15:00:00");

  it("skips blocks before yesterday", () => {
    expect(shouldShiftBlockOnDay(new Date("2026-05-28T10:00:00"), now)).toBe(
      false
    );
  });

  it("includes blocks on yesterday", () => {
    expect(shouldShiftBlockOnDay(new Date("2026-05-29T10:00:00"), now)).toBe(
      true
    );
  });

  it("includes blocks on today and later", () => {
    expect(shouldShiftBlockOnDay(new Date("2026-05-30T10:00:00"), now)).toBe(
      true
    );
    expect(shouldShiftBlockOnDay(new Date("2026-06-05T10:00:00"), now)).toBe(
      true
    );
  });
});
