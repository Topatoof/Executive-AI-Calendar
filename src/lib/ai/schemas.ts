import { z } from "zod";

export const extractedTaskSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  category: z.string().default("general"),
  estimatedMinutes: z.coerce.number().int().positive().default(60),
  deadline: z.string().nullable().optional(),
  /** Preferred calendar day for scheduling (YYYY-MM-DD). */
  scheduledDate: z.string().nullable().optional(),
  priority: z
    .preprocess(
      (value) => (typeof value === "string" ? value.toUpperCase() : value),
      z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
    )
    .default("MEDIUM"),
  importance: z.coerce.number().min(1).max(10).default(5),
  urgency: z.coerce.number().min(1).max(10).default(5),
  cognitiveLoad: z.coerce.number().min(1).max(10).default(5),
  dependsOnTitle: z.string().nullable().optional(),
  recurrence: z.string().nullable().optional(),
  confidence: z.coerce.number().min(0).max(1).default(0.8),
  projectTitle: z.string().nullable().optional(),
});

export const extractionResultSchema = z.object({
  tasks: z.array(extractedTaskSchema),
  projects: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        targetDate: z.string().nullable().optional(),
      })
    )
    .default([]),
  summary: z.string().default("Extracted tasks from brain dump."),
  warnings: z
    .array(
      z.preprocess(
        (value) =>
          typeof value === "string" ? value : JSON.stringify(value, null, 2),
        z.string()
      )
    )
    .default([]),
});

export type ExtractionResult = z.infer<typeof extractionResultSchema>;
export type ExtractedTask = z.infer<typeof extractedTaskSchema>;

export const accountabilitySchema = z.object({
  message: z.string(),
  recommendation: z.string().optional(),
  severity: z.number().min(1).max(10).default(5),
  type: z.enum([
    "WARNING",
    "NUDGE",
    "PERFORMANCE_REVIEW",
    "RESCHEDULE_SUGGESTION",
    "OVERLOAD_ALERT",
  ]),
});

export type AccountabilityOutput = z.infer<typeof accountabilitySchema>;

export const scheduleChangeItemSchema = z.object({
  action: z.enum(["clear_day", "move", "cancel", "mark_missed"]),
  blockTitleContains: z.string().optional(),
  sourceDate: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  targetStartHour: z.coerce.number().int().min(0).max(23).optional(),
  notes: z.string().optional(),
});

export const scheduleChangePlanSchema = z.object({
  summary: z.string().default("Schedule adjustment plan."),
  warnings: z
    .array(
      z.preprocess(
        (value) =>
          typeof value === "string" ? value : JSON.stringify(value, null, 2),
        z.string()
      )
    )
    .default([]),
  changes: z.array(scheduleChangeItemSchema).default([]),
});

export type ScheduleChangeItem = z.infer<typeof scheduleChangeItemSchema>;
export type ScheduleChangePlan = z.infer<typeof scheduleChangePlanSchema>;

export const resolvedScheduleChangeSchema = z.object({
  action: z.enum(["clear_day", "move", "cancel", "mark_missed"]),
  item: scheduleChangeItemSchema,
  description: z.string(),
  blockIds: z.array(z.string()),
  skipped: z.boolean().default(false),
  skipReason: z.string().optional(),
});

export const scheduleChangePreviewSchema = z.object({
  plan: scheduleChangePlanSchema,
  resolved: z.array(resolvedScheduleChangeSchema),
});

export type ScheduleChangePreview = z.infer<typeof scheduleChangePreviewSchema>;
export type ResolvedScheduleChange = z.infer<typeof resolvedScheduleChangeSchema>;
