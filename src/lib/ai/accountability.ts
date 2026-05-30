import OpenAI from "openai";
import {
  accountabilitySchema,
  type AccountabilityOutput,
} from "@/lib/ai/schemas";
import { parseModelJson } from "@/lib/ai/json";
import type { CoachingStyle } from "@prisma/client";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "lm-studio",
  baseURL: process.env.OPENAI_BASE_URL,
});

const TONE_MAP: Record<CoachingStyle, string> = {
  SUPPORTIVE: "supportive coach — encouraging but firm",
  STRICT: "strict operator — direct, no excuses",
  MILITARY: "military execution mode — commands, zero tolerance for delay",
  STRATEGIC: "calm strategic planner — analytical, long-term focused",
};

export async function generateAccountabilityMessage(
  context: {
    coachingStyle: CoachingStyle;
    overdueTasks: string[];
    missedBlocks: number;
    completionRate: number;
    overloaded: boolean;
    behindProjects: string[];
  }
): Promise<AccountabilityOutput> {
  if (!process.env.OPENAI_API_KEY) {
    return mockAccountability(context);
  }

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    ...(process.env.OPENAI_BASE_URL
      ? {}
      : { response_format: { type: "json_object" as const } }),
    messages: [
      {
        role: "system",
        content: `You are an accountability AI acting as a ${TONE_MAP[context.coachingStyle]}. Be direct and push execution. completionRate is today's schedule completion (blocks marked done / blocks scheduled today). Return JSON with message, recommendation, severity (1-10), and type (WARNING|NUDGE|PERFORMANCE_REVIEW|RESCHEDULE_SUGGESTION|OVERLOAD_ALERT).`,
      },
      {
        role: "user",
        content: JSON.stringify(context),
      },
    ],
    temperature: 0.4,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("No accountability response");

  return accountabilitySchema.parse(parseModelJson(raw));
}

function mockAccountability(context: {
  overdueTasks: string[];
  missedBlocks: number;
  completionRate: number;
  overloaded: boolean;
  behindProjects: string[];
}): AccountabilityOutput {
  if (context.overloaded) {
    return {
      type: "OVERLOAD_ALERT",
      severity: 9,
      message:
        "Your plan is unrealistic with your current workload. You are overcommitted.",
      recommendation:
        "Drop or defer low-priority tasks. Protect deep work blocks for deadline-critical work only.",
    };
  }
  if (context.overdueTasks.length > 0) {
    return {
      type: "WARNING",
      severity: 8,
      message: `You are behind schedule on: ${context.overdueTasks.join(", ")}.`,
      recommendation:
        "Reschedule missed blocks immediately. Move low-priority work to later this week.",
    };
  }
  if (context.missedBlocks > 2) {
    return {
      type: "NUDGE",
      severity: 7,
      message: `You wasted ${context.missedBlocks} scheduled focus blocks.`,
      recommendation:
        "Start the highest-priority incomplete block now. No more planning until execution.",
    };
  }
  if (context.completionRate < 0.5) {
    return {
      type: "PERFORMANCE_REVIEW",
      severity: 6,
      message: `Today's completion rate is ${Math.round(context.completionRate * 100)}%. Below target.`,
      recommendation:
        "Finish today's remaining blocks before adding new work.",
    };
  }
  return {
    type: "NUDGE",
    severity: 3,
    message: "On track. Maintain execution momentum.",
    recommendation: "Complete your next scheduled block without delay.",
  };
}
