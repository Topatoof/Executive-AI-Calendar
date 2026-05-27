import { createEvents, type EventAttributes } from "ics";
import type { ScheduleBlock, Task } from "@prisma/client";

type BlockWithTask = ScheduleBlock & { task: Task | null };

const CATEGORY_COLORS: Record<string, string> = {
  DEEP_WORK: "#6366f1",
  SHALLOW_WORK: "#22c55e",
  HABIT: "#f59e0b",
  MEETING: "#ec4899",
  BREAK: "#94a3b8",
  BUFFER: "#64748b",
};

export function blocksToIcsEvents(
  blocks: BlockWithTask[]
): { events: EventAttributes[]; errors: string[] } {
  const events: EventAttributes[] = [];
  const errors: string[] = [];

  for (const block of blocks) {
    const start = block.startTime;
    const end = block.endTime;

    const event: EventAttributes = {
      start: [
        start.getFullYear(),
        start.getMonth() + 1,
        start.getDate(),
        start.getHours(),
        start.getMinutes(),
      ],
      end: [
        end.getFullYear(),
        end.getMonth() + 1,
        end.getDate(),
        end.getHours(),
        end.getMinutes(),
      ],
      title: block.title,
      description: block.explanation ?? undefined,
      categories: [block.blockType],
      status: block.status === "COMPLETED" ? "CONFIRMED" : "TENTATIVE",
      calName: "Exec AI Schedule",
      productId: "exec-ai/personal",
    };

    events.push(event);
  }

  return { events, errors };
}

export function generateIcsContent(blocks: BlockWithTask[]): string {
  const { events, errors } = blocksToIcsEvents(blocks);
  if (events.length === 0) {
    return "";
  }

  const { error, value } = createEvents(events);
  if (error) {
    throw new Error(
      `ICS generation failed: ${errors.concat(error.message).join(", ")}`
    );
  }
  return value ?? "";
}

export function getBlockColor(blockType: string): string {
  return CATEGORY_COLORS[blockType] ?? "#6366f1";
}
