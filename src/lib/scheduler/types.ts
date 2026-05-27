import type { BlockType, TaskPriority } from "@prisma/client";

export interface SchedulableTask {
  id: string;
  title: string;
  estimatedMinutes: number;
  priority: TaskPriority;
  importance: number;
  urgency: number;
  cognitiveLoad: number;
  deadline: Date | null;
  category: string;
  status: string;
}

export interface OwnerPreferences {
  workStartHour: number;
  workEndHour: number;
  focusStartHour: number;
  focusEndHour: number;
  maxDailyMinutes: number;
  bufferMinutes: number;
}

export interface ScheduleBlockInput {
  taskId: string | null;
  title: string;
  blockType: BlockType;
  startTime: Date;
  endTime: Date;
  explanation: string;
}

export interface ScheduleResult {
  blocks: ScheduleBlockInput[];
  unscheduled: SchedulableTask[];
  overloaded: boolean;
  warnings: string[];
  totalScheduledMinutes: number;
}
