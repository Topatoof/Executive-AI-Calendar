"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getOrCreateOwner } from "@/lib/owner";
import { extractFromBrainDump } from "@/lib/ai/extract";
import {
  generateDailySchedule,
  generateWeeklySchedule,
} from "@/lib/scheduler/engine";
import { generateAccountabilityMessage } from "@/lib/ai/accountability";
import { computeAnalytics } from "@/lib/analytics";
import type { TaskPriority } from "@prisma/client";
import { startOfDay, startOfWeek } from "date-fns";
import type { ExtractionResult } from "@/lib/ai/schemas";

export async function submitBrainDump(content: string) {
  const owner = await getOrCreateOwner();
  const extraction = await extractFromBrainDump(content, new Date().toISOString());

  const dump = await prisma.brainDump.create({
    data: {
      ownerId: owner.id,
      rawContent: content,
      status: "EXTRACTED",
      extraction: extraction as object,
    },
  });

  return { dumpId: dump.id, extraction };
}

export async function confirmBrainDump(
  dumpId: string,
  extraction: ExtractionResult
) {
  const owner = await getOrCreateOwner();
  const projectMap = new Map<string, string>();

  for (const proj of extraction.projects) {
    const created = await prisma.project.create({
      data: {
        ownerId: owner.id,
        title: proj.title,
        description: proj.description,
        targetDate: proj.targetDate ? new Date(proj.targetDate) : undefined,
      },
    });
    projectMap.set(proj.title, created.id);
  }

  for (const task of extraction.tasks) {
    let projectId: string | undefined;
    if (task.projectTitle) {
      projectId = projectMap.get(task.projectTitle);
      if (!projectId) {
        const p = await prisma.project.create({
          data: { ownerId: owner.id, title: task.projectTitle },
        });
        projectId = p.id;
        projectMap.set(task.projectTitle, p.id);
      }
    }

    await prisma.task.create({
      data: {
        ownerId: owner.id,
        brainDumpId: dumpId,
        projectId,
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority as TaskPriority,
        importance: task.importance,
        urgency: task.urgency,
        cognitiveLoad: task.cognitiveLoad,
        estimatedMinutes: task.estimatedMinutes,
        deadline: task.deadline ? new Date(task.deadline) : undefined,
        recurrence: task.recurrence ?? undefined,
        confidence: task.confidence,
      },
    });
  }

  await prisma.brainDump.update({
    where: { id: dumpId },
    data: { status: "CONFIRMED" },
  });

  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath("/planner");
}

export async function generateScheduleAction(mode: "daily" | "weekly") {
  const owner = await getOrCreateOwner();
  const tasks = await prisma.task.findMany({
    where: {
      ownerId: owner.id,
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
  });

  const schedulable = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    estimatedMinutes: t.estimatedMinutes,
    priority: t.priority,
    importance: t.importance,
    urgency: t.urgency,
    cognitiveLoad: t.cognitiveLoad,
    deadline: t.deadline,
    category: t.category,
    status: t.status,
  }));

  const prefs = {
    workStartHour: owner.workStartHour,
    workEndHour: owner.workEndHour,
    focusStartHour: owner.focusStartHour,
    focusEndHour: owner.focusEndHour,
    maxDailyMinutes: owner.maxDailyMinutes,
    bufferMinutes: owner.bufferMinutes,
  };

  const result =
    mode === "daily"
      ? generateDailySchedule(schedulable, prefs, startOfDay(new Date()))
      : generateWeeklySchedule(
          schedulable,
          prefs,
          startOfWeek(new Date(), { weekStartsOn: 1 })
        );

  await prisma.scheduleBlock.deleteMany({
    where: {
      ownerId: owner.id,
      startTime: { gte: startOfDay(new Date()) },
      status: "SCHEDULED",
    },
  });

  if (result.blocks.length > 0) {
    await prisma.scheduleBlock.createMany({
      data: result.blocks.map((b) => ({
        ownerId: owner.id,
        taskId: b.taskId,
        title: b.title,
        blockType: b.blockType,
        startTime: b.startTime,
        endTime: b.endTime,
        explanation: b.explanation,
      })),
    });
  }

  if (result.overloaded) {
    await prisma.accountabilityEvent.create({
      data: {
        ownerId: owner.id,
        type: "OVERLOAD_ALERT",
        message: result.warnings.join(" "),
        severity: 9,
      },
    });
  }

  revalidatePath("/planner");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");

  return {
    scheduled: result.blocks.length,
    unscheduled: result.unscheduled.length,
    warnings: result.warnings,
    overloaded: result.overloaded,
  };
}

export async function updateBlockStatus(
  blockId: string,
  status: "COMPLETED" | "MISSED" | "IN_PROGRESS"
) {
  const owner = await getOrCreateOwner();
  const block = await prisma.scheduleBlock.update({
    where: { id: blockId, ownerId: owner.id },
    data: { status },
    include: { task: true },
  });

  if (status === "COMPLETED" && block.taskId) {
    await prisma.task.update({
      where: { id: block.taskId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  }
  if (status === "MISSED" && block.taskId) {
    await prisma.task.update({
      where: { id: block.taskId },
      data: { status: "MISSED" },
    });
  }

  revalidatePath("/planner");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
}

export async function runAccountabilityCheck() {
  const owner = await getOrCreateOwner();
  const analytics = await computeAnalytics(owner.id);

  const overdueTasks = await prisma.task.findMany({
    where: {
      ownerId: owner.id,
      deadline: { lt: new Date() },
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
    take: 5,
  });

  const output = await generateAccountabilityMessage({
    coachingStyle: owner.coachingStyle,
    overdueTasks: overdueTasks.map((t) => t.title),
    missedBlocks: analytics.missedBlocks,
    completionRate: analytics.completionRate,
    overloaded: analytics.overloaded,
    behindProjects: [],
  });

  await prisma.accountabilityEvent.create({
    data: {
      ownerId: owner.id,
      type: output.type,
      message: output.message,
      recommendation: output.recommendation,
      severity: output.severity,
    },
  });

  revalidatePath("/dashboard");
  return output;
}

export async function updateOwnerSettings(data: {
  workStartHour?: number;
  workEndHour?: number;
  focusStartHour?: number;
  focusEndHour?: number;
  coachingStyle?: "SUPPORTIVE" | "STRICT" | "MILITARY" | "STRATEGIC";
  maxDailyMinutes?: number;
}) {
  const owner = await getOrCreateOwner();
  await prisma.ownerProfile.update({
    where: { id: owner.id },
    data,
  });
  revalidatePath("/settings");
}
