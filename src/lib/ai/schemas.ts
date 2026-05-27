import { z } from "zod";

export const extractedTaskSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  category: z.string().default("general"),
  estimatedMinutes: z.coerce.number().int().positive().default(60),
  deadline: z.string().nullable().optional(),
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
