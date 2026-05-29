import { describe, it, expect } from "vitest";
import {
  generateDailySchedule,
  generateSchedule,
  generateWeeklySchedule,
} from "@/lib/scheduler/engine";
import type { SchedulableTask, OwnerPreferences } from "@/lib/scheduler/types";
import { addDays, startOfDay } from "date-fns";

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

  it("does not schedule blocks in the past when planning today", () => {
    const now = new Date();
    now.setHours(14, 30, 0, 0);
    const day = startOfDay(now);

    const result = generateDailySchedule(
      [
        {
          id: "past-test",
          title: "Afternoon task",
          estimatedMinutes: 60,
          priority: "HIGH",
          importance: 8,
          urgency: 8,
          cognitiveLoad: 5,
          deadline: null,
          category: "work",
          status: "PENDING",
        },
      ],
      prefs,
      day,
      now
    );

    expect(result.blocks.length).toBeGreaterThan(0);
    for (const block of result.blocks) {
      expect(block.startTime.getTime()).toBeGreaterThanOrEqual(now.getTime());
    }
  });

  it("does not create overlapping blocks", () => {
    const now = new Date();
    const day = startOfDay(now);
    const many: SchedulableTask[] = Array.from({ length: 6 }, (_, i) => ({
      id: String(i),
      title: `Task ${i}`,
      estimatedMinutes: 45,
      priority: "MEDIUM" as const,
      importance: 6,
      urgency: 6,
      cognitiveLoad: 5,
      deadline: addDays(now, 3),
      category: "work",
      status: "PENDING",
    }));

    const result = generateDailySchedule(many, prefs, day, now);
    const sorted = [...result.blocks].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].startTime.getTime()).toBeGreaterThanOrEqual(
        sorted[i - 1].endTime.getTime()
      );
    }
  });

  it("spreads tasks across multiple days in weekly mode", () => {
    const now = new Date();
    now.setHours(10, 0, 0, 0);
    const weekStart = startOfDay(now);

    const weeklyTasks: SchedulableTask[] = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      title: `Task ${i}`,
      estimatedMinutes: 90,
      priority: "HIGH" as const,
      importance: 8,
      urgency: 7,
      cognitiveLoad: 6,
      deadline: addDays(now, 5),
      category: "school",
      status: "PENDING",
    }));

    const result = generateWeeklySchedule(weeklyTasks, prefs, weekStart, now);
    const uniqueDays = new Set(
      result.blocks.map((b) => startOfDay(b.startTime).toDateString())
    );

    expect(result.blocks.length).toBeGreaterThan(0);
    expect(uniqueDays.size).toBeGreaterThan(1);
  });

  it("detects overload when too many tasks", () => {
    const heavy: SchedulableTask[] = Array.from({ length: 30 }, (_, i) => ({
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

  it("schedules tasks on their scheduledDate", () => {
    const now = new Date("2026-05-28T10:00:00");
    const scheduled = new Date(2026, 4, 30, 12, 0, 0, 0);

    const result = generateSchedule(
      [
        {
          id: "fixed-day",
          title: "Chapter 8 reading",
          estimatedMinutes: 60,
          priority: "HIGH",
          importance: 8,
          urgency: 7,
          cognitiveLoad: 6,
          deadline: null,
          scheduledDate: scheduled,
          category: "school",
          status: "PENDING",
        },
      ],
      prefs,
      startOfDay(now),
      new Date("2026-06-10T23:59:59"),
      now
    );

    expect(result.blocks.length).toBe(1);
    expect(result.blocks[0].startTime.getDate()).toBe(30);
    expect(result.blocks[0].startTime.getMonth()).toBe(4);
  });

  it("does not overlap reserved existing blocks", () => {
    const now = new Date();
    now.setHours(8, 0, 0, 0);
    const day = startOfDay(now);

    const reserved = [
      {
        startTime: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0),
        endTime: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 11, 0),
      },
    ];

    const result = generateDailySchedule(
      [
        {
          id: "new-task",
          title: "New task",
          estimatedMinutes: 60,
          priority: "MEDIUM",
          importance: 5,
          urgency: 5,
          cognitiveLoad: 5,
          deadline: null,
          category: "work",
          status: "PENDING",
        },
      ],
      prefs,
      day,
      now,
      reserved
    );

    expect(result.blocks.length).toBe(1);
    const block = result.blocks[0];
    const reservedEnd = reserved[0].endTime.getTime() + 15 * 60 * 1000;
    expect(block.startTime.getTime()).toBeGreaterThanOrEqual(reservedEnd);
  });

  it("places high cognitive load in focus window when possible", () => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    const morning = new Date(day);
    morning.setHours(9, 0, 0, 0);
    const result = generateDailySchedule([tasks[0]], prefs, day, morning);
    const deepBlock = result.blocks.find((b) => b.blockType === "DEEP_WORK");
    expect(deepBlock).toBeDefined();
    expect(deepBlock!.startTime.getHours()).toBeGreaterThanOrEqual(8);
    expect(deepBlock!.startTime.getHours()).toBeLessThan(12);
  });
});
