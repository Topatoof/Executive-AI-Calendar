import { prisma } from "@/lib/db";
import type {
  ResolvedScheduleChange,
  ScheduleChangeItem,
  ScheduleChangePlan,
  ScheduleChangePreview,
} from "@/lib/ai/schemas";
import { parseDeadline } from "@/lib/dates";
import { getPlannerViewRange } from "@/lib/planner-horizon";
import { relocateBlockToDay } from "@/lib/schedule/relocate";
import type { OwnerPreferences, ReservedSlot } from "@/lib/scheduler/types";
import type { OwnerProfile, ScheduleBlock } from "@prisma/client";
import { format, isSameDay, startOfDay } from "date-fns";

type BlockRow = ScheduleBlock & {
  task?: { id: string; scheduledDate: Date | null } | null;
};

function ownerPrefs(owner: OwnerProfile): OwnerPreferences {
  return {
    workStartHour: owner.workStartHour,
    workEndHour: owner.workEndHour,
    focusStartHour: owner.focusStartHour,
    focusEndHour: owner.focusEndHour,
    maxDailyMinutes: owner.maxDailyMinutes,
    bufferMinutes: owner.bufferMinutes,
  };
}

function parsePlanDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return parseDeadline(value) ?? null;
}

function isBlockActive(block: BlockRow): boolean {
  return block.status !== "COMPLETED" && block.status !== "MISSED";
}

function matchBlocks(
  blocks: BlockRow[],
  item: ScheduleChangeItem,
  movedBlockIds: Set<string>
): BlockRow[] {
  const sourceDay = parsePlanDate(item.sourceDate);
  const query = item.blockTitleContains?.trim().toLowerCase();

  return blocks.filter((b) => {
    if (!isBlockActive(b)) return false;
    if (movedBlockIds.has(b.id)) return false;
    if (sourceDay && !isSameDay(b.startTime, sourceDay)) return false;
    if (query && !b.title.toLowerCase().includes(query)) return false;
    return true;
  });
}

function describeChange(
  item: ScheduleChangeItem,
  matched: BlockRow[],
  skipped: boolean,
  skipReason?: string
): string {
  if (skipped) return skipReason ?? "Skipped";
  switch (item.action) {
    case "clear_day": {
      const day = parsePlanDate(item.sourceDate);
      const label = day ? format(day, "EEEE, MMM d") : "selected day";
      return `Clear ${matched.length} block(s) on ${label}`;
    }
    case "move": {
      const target = parsePlanDate(item.targetDate);
      const targetLabel = target ? format(target, "EEEE, MMM d") : "new day";
      const names = matched.map((b) => b.title).join(", ");
      return `Move ${matched.length ? `"${names}"` : "session(s)"} to ${targetLabel}`;
    }
    case "cancel":
      return `Cancel ${matched.length} block(s)`;
    case "mark_missed":
      return `Mark ${matched.length} block(s) as missed`;
    default:
      return "Adjust schedule";
  }
}

export function resolveScheduleChangePlan(
  plan: ScheduleChangePlan,
  blocks: BlockRow[]
): ScheduleChangePreview {
  const movedBlockIds = new Set<string>();
  const resolved: ResolvedScheduleChange[] = [];

  for (const item of plan.changes) {
    if (item.action === "move") {
      const matched = matchBlocks(blocks, item, movedBlockIds);
      for (const b of matched) movedBlockIds.add(b.id);
      resolved.push({
        action: item.action,
        item,
        description: describeChange(item, matched, false),
        blockIds: matched.map((b) => b.id),
        skipped: matched.length === 0,
        skipReason:
          matched.length === 0
            ? `No matching block for "${item.blockTitleContains ?? "session"}"`
            : undefined,
      });
      continue;
    }

    if (item.action === "clear_day") {
      const day = parsePlanDate(item.sourceDate);
      const matched = blocks.filter(
        (b) =>
          isBlockActive(b) &&
          !movedBlockIds.has(b.id) &&
          (!day || isSameDay(b.startTime, day))
      );
      resolved.push({
        action: item.action,
        item,
        description: describeChange(item, matched, false),
        blockIds: matched.map((b) => b.id),
        skipped: !day,
        skipReason: !day ? "clear_day needs sourceDate" : undefined,
      });
      continue;
    }

    const matched = matchBlocks(blocks, item, movedBlockIds);
    resolved.push({
      action: item.action,
      item,
      description: describeChange(item, matched, false),
      blockIds: matched.map((b) => b.id),
      skipped: matched.length === 0,
      skipReason:
        matched.length === 0 ? "No blocks matched this instruction" : undefined,
    });
  }

  return { plan, resolved };
}

function reservedSlotsExcluding(
  allBlocks: BlockRow[],
  excludeIds: Set<string>
): ReservedSlot[] {
  return allBlocks
    .filter((b) => !excludeIds.has(b.id))
    .map((b) => ({ startTime: b.startTime, endTime: b.endTime }));
}

export async function applyScheduleChangePreview(
  owner: OwnerProfile,
  preview: ScheduleChangePreview,
  now: Date = new Date()
): Promise<{ applied: number; errors: string[] }> {
  const prefs = ownerPrefs(owner);
  const { viewStart, viewEnd } = getPlannerViewRange(now);

  const blocks = await prisma.scheduleBlock.findMany({
    where: {
      ownerId: owner.id,
      startTime: { gte: viewStart, lte: viewEnd },
    },
    include: { task: true },
  });

  const blockById = new Map(blocks.map((b) => [b.id, b]));
  let applied = 0;
  const errors: string[] = [];

  for (const change of preview.resolved) {
    if (change.skipped || change.blockIds.length === 0) continue;

    if (change.action === "move") {
      const target = parsePlanDate(change.item.targetDate);
      if (!target) {
        errors.push("Move action is missing a target date.");
        continue;
      }

      for (const blockId of change.blockIds) {
        const block = blockById.get(blockId);
        if (!block) continue;

        const reserved = reservedSlotsExcluding(blocks, new Set([blockId]));
        const slot = relocateBlockToDay(
          block.startTime,
          block.endTime,
          target,
          prefs,
          reserved,
          now
        );

        if (!slot) {
          errors.push(
            `No open slot on ${format(target, "MMM d")} for "${block.title}"`
          );
          continue;
        }

        await prisma.scheduleBlock.update({
          where: { id: block.id },
          data: {
            startTime: slot.startTime,
            endTime: slot.endTime,
            shiftedFromDay: null,
            rescheduleCount: { increment: 1 },
            explanation: change.item.notes
              ? `Rescheduled: ${change.item.notes}`
              : "Rescheduled per your schedule change request",
          },
        });

        if (block.taskId) {
          await prisma.task.update({
            where: { id: block.taskId },
            data: { scheduledDate: startOfDay(slot.startTime) },
          });
        }

        block.startTime = slot.startTime;
        block.endTime = slot.endTime;
        applied += 1;
      }
      continue;
    }

    if (change.action === "clear_day" || change.action === "mark_missed") {
      for (const blockId of change.blockIds) {
        await prisma.scheduleBlock.update({
          where: { id: blockId },
          data: { status: "MISSED" },
        });
        applied += 1;
      }
      continue;
    }

    if (change.action === "cancel") {
      for (const blockId of change.blockIds) {
        const block = blockById.get(blockId);
        if (!block) continue;
        if (block.taskId) {
          await prisma.scheduleBlock.deleteMany({ where: { taskId: block.taskId } });
          await prisma.task.deleteMany({ where: { id: block.taskId } });
        } else {
          await prisma.scheduleBlock.delete({ where: { id: blockId } });
        }
        applied += 1;
      }
    }
  }

  return { applied, errors };
}
