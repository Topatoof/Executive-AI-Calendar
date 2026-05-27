import { describe, it, expect } from "vitest";
import {
  generateDailySchedule,
  generateWeeklySchedule,
} from "@/lib/scheduler/engine";
import type { SchedulableTask, OwnerPreferences } from "@/lib/scheduler/types";

const prefs: OwnerPreferences = {
  workStartHour: 8,
  workEndHour: 18,
  focusStartHour: 8,
  focusEndHour: 12,
  maxDailyMinutes: 480,
  bufferMinutes: 15,
};

const tasks: SchedulableTask[] = [
  {
    id: "1",
    title: "Deep work task",
    estimatedMinutes: 90,
    priority: "HIGH",
    importance: 9,
    urgency: 8,
    cognitiveLoad: 9,
    deadline: new Date(Date.now() + 86400000),
    category: "school",
    status: "PENDING",
  },
  {
    id: "2",
    title: "Quick admin",
    estimatedMinutes: 15,
    priority: "LOW",
    importance: 3,
    urgency: 3,
    cognitiveLoad: 2,
    deadline: null,
    category: "admin",
    status: "PENDING",
  },
];

describe("scheduling engine", () => {
  it("schedules tasks within work hours", () => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    const result = generateDailySchedule(tasks, prefs, day);

    expect(result.blocks.length).toBeGreaterThan(0);
    for (const block of result.blocks) {
      expect(block.startTime.getHours()).toBeGreaterThanOrEqual(8);
      expect(block.endTime.getHours()).toBeLessThanOrEqual(18);
    }
  });

  it("detects overload when too many tasks", () => {
    const heavy: SchedulableTask[] = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      title: `Task ${i}`,
      estimatedMinutes: 120,
      priority: "HIGH" as const,
      importance: 8,
      urgency: 8,
      cognitiveLoad: 7,
      deadline: new Date(Date.now() + 86400000),
      category: "work",
      status: "PENDING",
    }));

    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    const result = generateWeeklySchedule(heavy, prefs, weekStart);
    expect(result.overloaded || result.unscheduled.length > 0).toBe(true);
  });

  it("places high cognitive load in focus window when possible", () => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    const result = generateDailySchedule([tasks[0]], prefs, day);
    const deepBlock = result.blocks.find((b) => b.blockType === "DEEP_WORK");
    expect(deepBlock).toBeDefined();
  });
});
