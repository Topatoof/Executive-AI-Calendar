import { describe, expect, it } from "vitest";
import { bucketWorkMinutesByDay } from "../analytics";
import { endOfWeek, startOfWeek } from "date-fns";

describe("bucketWorkMinutesByDay", () => {
  it("sums completed block duration per day by start time", () => {
    const ref = new Date("2026-06-04T12:00:00");
    const weekStart = startOfWeek(ref, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(ref, { weekStartsOn: 1 });

    const buckets = bucketWorkMinutesByDay(
      [
        {
          startTime: new Date("2026-06-02T10:00:00"),
          endTime: new Date("2026-06-02T11:30:00"),
        },
        {
          startTime: new Date("2026-06-02T14:00:00"),
          endTime: new Date("2026-06-02T15:00:00"),
        },
        {
          startTime: new Date("2026-06-04T09:00:00"),
          endTime: new Date("2026-06-04T10:00:00"),
        },
      ],
      weekStart,
      weekEnd
    );

    expect(buckets).toHaveLength(7);
    const tue = buckets.find((b) => b.date === "2026-06-02");
    const wed = buckets.find((b) => b.date === "2026-06-04");
    expect(tue?.minutes).toBe(150);
    expect(wed?.minutes).toBe(60);
  });
});
