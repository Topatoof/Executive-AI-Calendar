import OpenAI from "openai";
import {
  extractionResultSchema,
  type ExtractionResult,
} from "@/lib/ai/schemas";
import { parseModelJson } from "@/lib/ai/json";
import {
  applyProjectMatching,
  type ExistingProject,
} from "@/lib/project-match";
import { normalizeExtractionDeadlines } from "@/lib/ai/normalize-extraction";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "lm-studio",
  baseURL: process.env.OPENAI_BASE_URL,
});

const EXTRACTION_PROMPT = `You are an executive assistant AI. Extract actionable tasks from messy brain dumps.

Rules:
- Infer the plan day from phrases like "on Friday", "this week", "tomorrow", "by Friday" — store as scheduledDate only (not a separate deadline)
- Estimate realistic durations in minutes
- Assign importance (1-10), urgency (1-10), cognitiveLoad (1-10)
- Detect dependencies (dependsOnTitle references another task title)
- Group related tasks under projectTitle when appropriate
- If existing projects are provided, assign each task to the best matching existing project using the EXACT existing project title
- Only propose new projects in "projects" when no existing project fits
- School/study tasks go to school-related projects; fitness tasks to fitness projects; podcast/content to creative projects
- Set confidence 0-1 for inferred dates/durations
- scheduledDate must be YYYY-MM-DD or null; set deadline to null (the app sets due date = session day automatically)
- When the user assigns work to a specific day, set scheduledDate to that calendar day as YYYY-MM-DD
- When the user asks for multiple blocks/sessions per chapter, create separate tasks per block with scheduledDate on the requested days when specified
- Flag ambiguous items in warnings array
- Today's date context will be provided

Return STRICT JSON only.
Do not use markdown fences.
Do not add comments.
Do not include trailing commas.

Required shape:
{
  "tasks": [
    {
      "title": "string",
      "description": "string",
      "category": "school|work|fitness|admin|creative|general",
      "estimatedMinutes": 60,
      "deadline": "ISO date string or null",
      "scheduledDate": "YYYY-MM-DD or null",
      "priority": "LOW|MEDIUM|HIGH|CRITICAL",
      "importance": 5,
      "urgency": 5,
      "cognitiveLoad": 5,
      "dependsOnTitle": null,
      "recurrence": null,
      "confidence": 0.8,
      "projectTitle": null
    }
  ],
  "projects": [],
  "summary": "string",
  "warnings": []
}`;

function formatExistingProjects(projects: ExistingProject[]): string {
  if (projects.length === 0) return "No existing projects.";
  return projects
    .map((p) => {
      const desc = p.description ? ` — ${p.description}` : "";
      return `- ${p.title}${desc}`;
    })
    .join("\n");
}

export async function extractFromBrainDump(
  content: string,
  todayIso: string,
  existingProjects: ExistingProject[] = []
): Promise<ExtractionResult> {
  if (!process.env.OPENAI_API_KEY) {
    return mockExtraction(content, existingProjects);
  }

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    ...(process.env.OPENAI_BASE_URL
      ? {}
      : { response_format: { type: "json_object" as const } }),
    messages: [
      { role: "system", content: EXTRACTION_PROMPT },
      {
        role: "user",
        content: `Today is ${todayIso}.

Existing projects (reuse exact titles when relevant):
${formatExistingProjects(existingProjects)}

Brain dump:
${content}`,
      },
    ],
    temperature: 0.2,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("No extraction response from AI");

  const parsed = parseModelJson(raw);
  const extraction = extractionResultSchema.parse(parsed);
  return normalizeExtractionDeadlines(
    applyProjectMatching(extraction, existingProjects)
  );
}

function mockExtraction(
  content: string,
  existingProjects: ExistingProject[] = []
): ExtractionResult {
  const lower = content.toLowerCase();
  const tasks: ExtractionResult["tasks"] = [];

  if (lower.includes("economics") || lower.includes("paper")) {
    tasks.push({
      title: "Finish economics paper",
      category: "school",
      estimatedMinutes: 180,
      scheduledDate: getNextFriday(),
      priority: "CRITICAL",
      importance: 9,
      urgency: 9,
      cognitiveLoad: 8,
      confidence: 0.85,
      projectTitle: "Economics Paper",
    });
  }
  if (lower.includes("train") || lower.includes("legs")) {
    tasks.push({
      title: "Train legs",
      category: "fitness",
      estimatedMinutes: 60,
      priority: "MEDIUM",
      importance: 7,
      urgency: 5,
      cognitiveLoad: 3,
      recurrence: "3x/week",
      confidence: 0.9,
    });
  }
  if (lower.includes("podcast")) {
    tasks.push({
      title: "Edit podcast episode",
      category: "creative",
      estimatedMinutes: 90,
      priority: "HIGH",
      importance: 7,
      urgency: 6,
      cognitiveLoad: 6,
      confidence: 0.8,
      projectTitle: "Podcast",
    });
  }
  if (lower.includes("calculus") || lower.includes("study")) {
    tasks.push({
      title: "Study calculus chapter 4",
      category: "school",
      estimatedMinutes: 120,
      priority: "HIGH",
      importance: 8,
      urgency: 7,
      cognitiveLoad: 9,
      confidence: 0.75,
    });
  }
  if (lower.includes("bank") || lower.includes("call")) {
    tasks.push({
      title: "Call bank",
      category: "admin",
      estimatedMinutes: 15,
      priority: "MEDIUM",
      importance: 5,
      urgency: 4,
      cognitiveLoad: 2,
      confidence: 0.95,
    });
  }

  if (tasks.length === 0) {
    tasks.push({
      title: content.slice(0, 80).trim() || "Untitled task",
      category: "general",
      estimatedMinutes: 60,
      priority: "MEDIUM",
      importance: 5,
      urgency: 5,
      cognitiveLoad: 5,
      confidence: 0.5,
    });
  }

  const result: ExtractionResult = {
    tasks,
    projects: [
      ...new Set(tasks.map((t) => t.projectTitle).filter(Boolean)),
    ].map((title) => ({
      title: title as string,
      description: undefined,
      targetDate: null,
    })),
    summary: `Extracted ${tasks.length} task(s) from brain dump.`,
    warnings:
      tasks.some((t) => t.confidence < 0.7)
        ? ["Some deadlines/durations have low confidence — please review."]
        : [],
  };

  return normalizeExtractionDeadlines(
    applyProjectMatching(result, existingProjects)
  );
}

function getNextFriday(): string {
  const d = new Date();
  const day = d.getDay();
  const daysUntilFriday = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilFriday);
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}
