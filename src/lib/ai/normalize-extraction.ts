import { deadlineToIso } from "@/lib/dates";
import type { ExtractionResult } from "@/lib/ai/schemas";

/** Normalize schedule dates; deadline matches session day when set. */
export function normalizeExtractionDeadlines(
  extraction: ExtractionResult
): ExtractionResult {
  const warnings = [...extraction.warnings];

  const tasks = extraction.tasks.map((task) => {
    const rawDate = task.scheduledDate ?? task.deadline;
    if (!rawDate) {
      return { ...task, scheduledDate: null, deadline: null };
    }

    const scheduled = deadlineToIso(rawDate);
    if (!scheduled) {
      warnings.push(
        `Could not parse plan date for "${task.title}" — pick a date in review.`
      );
      return { ...task, scheduledDate: null, deadline: null };
    }

    return {
      ...task,
      scheduledDate: scheduled,
      deadline: scheduled,
    };
  });

  const projects = extraction.projects.map((project) => {
    if (!project.targetDate) return project;
    const iso = deadlineToIso(project.targetDate);
    if (!iso) {
      warnings.push(
        `Could not parse target date for project "${project.title}".`
      );
      return { ...project, targetDate: null };
    }
    return { ...project, targetDate: iso };
  });

  return { ...extraction, tasks, projects, warnings };
}
