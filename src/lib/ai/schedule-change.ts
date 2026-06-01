import OpenAI from "openai";
import {
  scheduleChangePlanSchema,
  type ScheduleChangePlan,
} from "@/lib/ai/schemas";
import { parseModelJson } from "@/lib/ai/json";
import {
  addDays,
  format,
  nextMonday,
  nextTuesday,
  nextWednesday,
  nextThursday,
  nextFriday,
  nextSaturday,
  nextSunday,
  startOfDay,
} from "date-fns";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "lm-studio",
  baseURL: process.env.OPENAI_BASE_URL,
});

export type ScheduleBlockContext = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  dayLabel: string;
  status: string;
};

const SCHEDULE_CHANGE_PROMPT = `You are an executive assistant helping reschedule an existing planner.

The user describes a change of plans. You receive their current schedule blocks (with ids) and must return a plan of concrete adjustments.

Rules:
- Use action "clear_day" when the user cannot work on a whole day — clears all incomplete blocks that day (after moves are applied separately).
- Use action "move" to move specific sessions to another day. Set blockTitleContains to a distinctive substring of the block title (e.g. "calculus", "LinkedIn").
- Use action "cancel" to remove a specific session entirely.
- Use action "mark_missed" to mark a session missed without deleting.
- sourceDate and targetDate must be YYYY-MM-DD when you can infer them from phrases like "Monday", "tomorrow", "next Tuesday".
- Apply moves BEFORE clear_day on the same source day when the user moves one session off a busy day.
- If the user names a session, prefer "move" over clearing the whole day unless they say the entire day is unavailable.
- Only reference blocks that exist in the provided schedule.
- Put ambiguous items in warnings.

Return STRICT JSON only:
{
  "summary": "string",
  "warnings": ["string"],
  "changes": [
    {
      "action": "clear_day|move|cancel|mark_missed",
      "blockTitleContains": "optional substring",
      "sourceDate": "YYYY-MM-DD or null",
      "targetDate": "YYYY-MM-DD or null",
      "targetStartHour": 0-23 optional,
      "notes": "optional"
    }
  ]
}`;

function formatBlocksForPrompt(blocks: ScheduleBlockContext[]): string {
  if (blocks.length === 0) return "No upcoming schedule blocks.";
  return blocks
    .map(
      (b) =>
        `- [${b.id}] "${b.title}" | ${b.dayLabel} ${format(new Date(b.startTime), "h:mm a")}–${format(new Date(b.endTime), "h:mm a")} | ${b.status}`
    )
    .join("\n");
}

export async function planScheduleChanges(
  instructions: string,
  todayIso: string,
  blocks: ScheduleBlockContext[]
): Promise<ScheduleChangePlan> {
  if (!process.env.OPENAI_API_KEY) {
    return mockScheduleChangePlan(instructions, todayIso, blocks);
  }

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    ...(process.env.OPENAI_BASE_URL
      ? {}
      : { response_format: { type: "json_object" as const } }),
    messages: [
      { role: "system", content: SCHEDULE_CHANGE_PROMPT },
      {
        role: "user",
        content: `Today is ${todayIso} (${format(new Date(todayIso), "EEEE, MMMM d, yyyy")}).

Current schedule:
${formatBlocksForPrompt(blocks)}

User request:
${instructions}`,
      },
    ],
    temperature: 0.2,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("No schedule change response from AI");

  return scheduleChangePlanSchema.parse(parseModelJson(raw));
}

function mockScheduleChangePlan(
  instructions: string,
  todayIso: string,
  blocks: ScheduleBlockContext[]
): ScheduleChangePlan {
  const lower = instructions.toLowerCase();
  const today = startOfDay(new Date(todayIso));
  const changes: ScheduleChangePlan["changes"] = [];
  const warnings: string[] = [];

  const dayMatchers: { pattern: RegExp; date: Date }[] = [
    { pattern: /\bmonday\b/, date: startOfDay(nextMonday(today)) },
    { pattern: /\btuesday\b/, date: startOfDay(nextTuesday(today)) },
    { pattern: /\bwednesday\b/, date: startOfDay(nextWednesday(today)) },
    { pattern: /\bthursday\b/, date: startOfDay(nextThursday(today)) },
    { pattern: /\bfriday\b/, date: startOfDay(nextFriday(today)) },
    { pattern: /\bsaturday\b/, date: startOfDay(nextSaturday(today)) },
    { pattern: /\bsunday\b/, date: startOfDay(nextSunday(today)) },
    { pattern: /\btomorrow\b/, date: startOfDay(addDays(today, 1)) },
  ];

  let busyDay: Date | null = null;
  for (const { pattern, date } of dayMatchers) {
    if (pattern.test(lower) && /\bbusy\b|can't work|cannot work|unavailable\b/.test(lower)) {
      busyDay = date;
      break;
    }
  }

  const moveMatch = lower.match(/move\s+(?:my\s+)?(.+?)\s+to\s+(\w+)/);
  if (moveMatch) {
    const titlePart = moveMatch[1].replace(/session|block/gi, "").trim();
    let targetDate = startOfDay(addDays(today, 1));
    const targetWord = moveMatch[2];
    for (const { pattern, date } of dayMatchers) {
      if (pattern.test(targetWord)) {
        targetDate = date;
        break;
      }
    }
    changes.push({
      action: "move",
      blockTitleContains: titlePart.slice(0, 40) || "session",
      sourceDate: busyDay ? format(busyDay, "yyyy-MM-dd") : null,
      targetDate: format(targetDate, "yyyy-MM-dd"),
      notes: "Mock move from instructions",
    });
  }

  if (busyDay) {
    changes.push({
      action: "clear_day",
      sourceDate: format(busyDay, "yyyy-MM-dd"),
      targetDate: null,
      notes: "Day marked unavailable",
    });
  }

  if (changes.length === 0 && blocks.length > 0) {
    const first = blocks[0];
    changes.push({
      action: "move",
      blockTitleContains: first.title.slice(0, 20),
      targetDate: format(addDays(today, 1), "yyyy-MM-dd"),
      notes: "Default mock adjustment",
    });
    warnings.push("Could not parse details — applied a sample move. Use clearer wording with AI connected.");
  }

  if (blocks.length === 0) {
    warnings.push("No schedule blocks to adjust. Add blocks in Planner first.");
  }

  return {
    summary: changes.length
      ? `Planned ${changes.length} schedule adjustment(s) from your request.`
      : "No changes could be inferred.",
    warnings,
    changes,
  };
}
