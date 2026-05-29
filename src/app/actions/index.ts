"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getOrCreateOwner } from "@/lib/owner";
import { extractFromBrainDump } from "@/lib/ai/extract";
import {
  generateDailySchedule,
  generateSchedule,
} from "@/lib/scheduler/engine";
import { generateAccountabilityMessage } from "@/lib/ai/accountability";
import { computeAnalytics } from "@/lib/analytics";
import type { TaskPriority } from "@prisma/client";
import { endOfDay, startOfDay } from "date-fns";
import type { ExtractionResult } from "@/lib/ai/schemas";
import {
  applyProjectMatching,
  buildProjectTitleMap,
  matchExistingProject,
  normalizeProjectTitle,
  resolveProjectId,
} from "@/lib/project-match";
import { normalizeExtractionDeadlines } from "@/lib/ai/normalize-extraction";
import { parseDeadline } from "@/lib/dates";
import { getPlannerViewRange, getWeeklyScheduleRange } from "@/lib/planner-horizon";

export async function submitBrainDump(content: string) {
  const owner = await getOrCreateOwner();
  const existingProjects = await prisma.project.findMany({
    where: { ownerId: owner.id },
    select: { id: true, title: true, description: true },
  });
  const extraction = await extractFromBrainDump(
    content,
    new Date().toISOString(),
    existingProjects
  );

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
  const existingProjects = await prisma.project.findMany({
    where: { ownerId: owner.id },
    select: { id: true, title: true, description: true },
  });

  const normalizedExtraction = normalizeExtractionDeadlines(
    applyProjectMatching(extraction, existingProjects)
  );

  const projectMap = buildProjectTitleMap(existingProjects, []);

  for (const proj of normalizedExtraction.projects) {
    const key = normalizeProjectTitle(proj.title);
    if (projectMap.has(key)) continue;

    const created = await prisma.project.create({
      data: {
        ownerId: owner.id,
        title: proj.title.trim(),
        description: proj.description,
        targetDate: proj.targetDate
          ? (parseDeadline(proj.targetDate) ?? undefined)
          : undefined,
      },
    });
    projectMap.set(key, created.id);
  }

  for (const task of normalizedExtraction.tasks) {
    let projectId: string | undefined;
    if (task.projectTitle) {
      projectId = resolveProjectId(task.projectTitle, projectMap);
      if (!projectId) {
        const matched = matchExistingProject(
          task.projectTitle,
          existingProjects
        );
        if (matched) {
          projectId = matched.id;
        } else {
          const key = normalizeProjectTitle(task.projectTitle);
          const created = await prisma.project.create({
            data: { ownerId: owner.id, title: task.projectTitle.trim() },
          });
          projectId = created.id;
          projectMap.set(key, created.id);
        }
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
        deadline: task.deadline
          ? (parseDeadline(task.deadline) ?? undefined)
          : undefined,
        scheduledDate: task.scheduledDate
          ? (parseDeadline(task.scheduledDate) ?? undefined)
          : undefined,
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

  const prefs = {
    workStartHour: owner.workStartHour,
    workEndHour: owner.workEndHour,
    focusStartHour: owner.focusStartHour,
    focusEndHour: owner.focusEndHour,
    maxDailyMinutes: owner.maxDailyMinutes,
    bufferMinutes: owner.bufferMinutes,
  };

  const now = new Date();
  const generationStart = startOfDay(now);
  const generationEnd = mode === "daily" ? endOfDay(now) : getWeeklyScheduleRange(now).rangeEnd;
  const rangeStart =
    mode === "daily" ? generationStart : getWeeklyScheduleRange(now).rangeStart;
  const rangeEnd = generationEnd;

  const existingBlocks = await prisma.scheduleBlock.findMany({
    where: {
      ownerId: owner.id,
      startTime: { lt: rangeEnd },
      endTime: { gt: rangeStart },
    },
    select: {
      taskId: true,
      startTime: true,
      endTime: true,
    },
  });

  const alreadyScheduledTaskIds = new Set(
    existingBlocks
      .map((b) => b.taskId)
      .filter((id): id is string => id != null)
  );

  const schedulable = tasks
    .filter((t) => !alreadyScheduledTaskIds.has(t.id))
    .map((t) => ({
      id: t.id,
      title: t.title,
      estimatedMinutes: t.estimatedMinutes,
      priority: t.priority,
      importance: t.importance,
      urgency: t.urgency,
      cognitiveLoad: t.cognitiveLoad,
      deadline: t.deadline,
      scheduledDate: t.scheduledDate,
      category: t.category,
      status: t.status,
    }));

  const reservedSlots = existingBlocks.map((b) => ({
    startTime: b.startTime,
    endTime: b.endTime,
  }));

  const result =
    mode === "daily"
      ? generateDailySchedule(
          schedulable,
          prefs,
          generationStart,
          now,
          reservedSlots
        )
      : generateSchedule(
          schedulable,
          prefs,
          generationStart,
          generationEnd,
          now,
          reservedSlots
        );

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
    skippedExisting: alreadyScheduledTaskIds.size,
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

export async function updateScheduleBlock(data: {
  blockId: string;
  title: string;
  startTime: string;
  endTime: string;
  explanation?: string;
}) {
  const owner = await getOrCreateOwner();
  const startTime = new Date(data.startTime);
  const endTime = new Date(data.endTime);

  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    throw new Error("Invalid start or end time.");
  }
  if (endTime <= startTime) {
    throw new Error("End time must be after start time.");
  }

  await prisma.scheduleBlock.update({
    where: { id: data.blockId, ownerId: owner.id },
    data: {
      title: data.title.trim() || "Untitled block",
      startTime,
      endTime,
      explanation: data.explanation?.trim() || null,
      rescheduleCount: { increment: 1 },
    },
  });

  revalidatePath("/planner");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
}

async function deleteTasksAndBlocks(ownerId: string, taskIds: string[]) {
  if (taskIds.length === 0) return;

  await prisma.scheduleBlock.deleteMany({
    where: { taskId: { in: taskIds }, ownerId },
  });
  await prisma.task.deleteMany({
    where: { id: { in: taskIds }, ownerId },
  });
}

export async function deleteScheduleBlock(blockId: string) {
  const owner = await getOrCreateOwner();

  const block = await prisma.scheduleBlock.findFirst({
    where: { id: blockId, ownerId: owner.id },
    select: { id: true, taskId: true },
  });
  if (!block) return;

  if (block.taskId) {
    await deleteTasksAndBlocks(owner.id, [block.taskId]);
  } else {
    await prisma.scheduleBlock.deleteMany({
      where: { id: blockId, ownerId: owner.id },
    });
  }

  revalidatePath("/planner");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/projects");
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

export async function createProject(data: {
  title: string;
  description?: string;
  targetDate?: string | null;
  color?: string;
}) {
  const owner = await getOrCreateOwner();
  await prisma.project.create({
    data: {
      ownerId: owner.id,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
      color: data.color,
    },
  });
  revalidatePath("/projects");
}

export async function updateProject(data: {
  projectId: string;
  title: string;
  description?: string;
  targetDate?: string | null;
  color?: string;
}) {
  const owner = await getOrCreateOwner();
  await prisma.project.update({
    where: { id: data.projectId, ownerId: owner.id },
    data: {
      title: data.title.trim(),
      description: data.description?.trim() || null,
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
      color: data.color,
    },
  });
  revalidatePath("/projects");
}

export async function deleteProject(projectId: string) {
  const owner = await getOrCreateOwner();
  await prisma.project.deleteMany({
    where: { id: projectId, ownerId: owner.id },
  });
  revalidatePath("/projects");
  revalidatePath("/planner");
  revalidatePath("/dashboard");
}

export async function createUnassignedTask(data: {
  title: string;
  estimatedMinutes?: number;
}) {
  const owner = await getOrCreateOwner();
  const title = data.title.trim();
  if (!title) return;

  await prisma.task.create({
    data: {
      ownerId: owner.id,
      title,
      estimatedMinutes: data.estimatedMinutes ?? 60,
    },
  });

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/planner");
}

export async function createTaskInProject(data: {
  projectId: string;
  title: string;
  estimatedMinutes?: number;
}) {
  const owner = await getOrCreateOwner();
  const title = data.title.trim();
  if (!title) return;

  const project = await prisma.project.findFirst({
    where: { id: data.projectId, ownerId: owner.id },
  });
  if (!project) return;

  await prisma.task.create({
    data: {
      ownerId: owner.id,
      projectId: data.projectId,
      title,
      estimatedMinutes: data.estimatedMinutes ?? 60,
    },
  });

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/planner");
}

export async function assignTaskToProject(taskId: string, projectId: string) {
  const owner = await getOrCreateOwner();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: owner.id },
  });
  if (!project) return;

  await prisma.task.updateMany({
    where: { id: taskId, ownerId: owner.id },
    data: { projectId },
  });

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/planner");
}

export async function removeTaskFromProject(taskId: string) {
  const owner = await getOrCreateOwner();

  await prisma.task.updateMany({
    where: { id: taskId, ownerId: owner.id },
    data: { projectId: null },
  });

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/planner");
}

export async function deleteUnassignedTask(taskId: string) {
  const owner = await getOrCreateOwner();

  const task = await prisma.task.findFirst({
    where: { id: taskId, ownerId: owner.id, projectId: null },
    select: { id: true },
  });
  if (!task) return;

  await deleteTasksAndBlocks(owner.id, [task.id]);

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/planner");
  revalidatePath("/calendar");
  revalidatePath("/analytics");
}

export async function clearUnassignedTasks() {
  const owner = await getOrCreateOwner();

  const unassigned = await prisma.task.findMany({
    where: { ownerId: owner.id, projectId: null },
    select: { id: true },
  });

  await deleteTasksAndBlocks(
    owner.id,
    unassigned.map((t) => t.id)
  );

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/planner");
  revalidatePath("/calendar");
  revalidatePath("/analytics");

  return { deleted: unassigned.length };
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
