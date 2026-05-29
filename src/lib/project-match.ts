export type ExistingProject = {
  id: string;
  title: string;
  description: string | null;
};

export function normalizeProjectTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

export function matchExistingProject(
  title: string,
  existing: ExistingProject[]
): ExistingProject | null {
  const needle = normalizeProjectTitle(title);
  if (!needle) return null;

  const exact = existing.find(
    (p) => normalizeProjectTitle(p.title) === needle
  );
  if (exact) return exact;

  const contained = existing.find((p) => {
    const hay = normalizeProjectTitle(p.title);
    return hay.includes(needle) || needle.includes(hay);
  });
  if (contained) return contained;

  const tokens = needle.split(" ").filter((t) => t.length > 2);
  if (tokens.length === 0) return null;

  let best: ExistingProject | null = null;
  let bestScore = 0;
  for (const p of existing) {
    const hay = normalizeProjectTitle(p.title);
    const score = tokens.filter((t) => hay.includes(t)).length;
    if (score > bestScore && score >= Math.min(2, tokens.length)) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

export function resolveProjectId(
  projectTitle: string | null | undefined,
  titleToId: Map<string, string>
): string | undefined {
  if (!projectTitle?.trim()) return undefined;
  const key = normalizeProjectTitle(projectTitle);
  return titleToId.get(key);
}

export function buildProjectTitleMap(
  existing: ExistingProject[],
  created: { title: string; id: string }[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of [...existing, ...created]) {
    map.set(normalizeProjectTitle(p.title), p.id);
  }
  return map;
}

function inferProjectForTask(
  task: { category: string; title: string },
  existing: ExistingProject[]
): string | null {
  const hay = `${task.category} ${task.title}`.toLowerCase();
  const rules: { pattern: RegExp; keywords: string[] }[] = [
    { pattern: /school|study|exam|class|homework|course|chapter|paper/, keywords: ["school", "study", "finance", "economics", "corporate", "class", "exam"] },
    { pattern: /fitness|gym|workout|train|legs|health/, keywords: ["fitness", "workout", "health", "gym"] },
    { pattern: /podcast|video|edit|creative|publish/, keywords: ["podcast", "creative", "content"] },
    { pattern: /bank|admin|rent|call|email/, keywords: ["admin", "school", "personal"] },
  ];

  for (const rule of rules) {
    if (!rule.pattern.test(hay)) continue;
    const match = existing.find((p) => {
      const pHay = `${p.title} ${p.description ?? ""}`.toLowerCase();
      return rule.keywords.some((k) => pHay.includes(k));
    });
    if (match) return match.title;
  }
  return null;
}

export function applyProjectMatching<T extends {
  tasks: Array<{ projectTitle?: string | null; category: string; title: string }>;
  projects: Array<{ title: string; description?: string; targetDate?: string | null }>;
}>(extraction: T, existing: ExistingProject[]): T {
  const existingNorm = new Set(
    existing.map((p) => normalizeProjectTitle(p.title))
  );

  const tasks = extraction.tasks.map((task) => {
    if (task.projectTitle) {
      const match = matchExistingProject(task.projectTitle, existing);
      if (match) return { ...task, projectTitle: match.title };
      const inferred = inferProjectForTask(task, existing);
      if (inferred) return { ...task, projectTitle: inferred };
      return task;
    }
    const inferred = inferProjectForTask(task, existing);
    if (inferred) return { ...task, projectTitle: inferred };
    return task;
  });

  const referenced = new Set(
    tasks
      .map((t) => t.projectTitle)
      .filter((title): title is string => Boolean(title))
      .map((title) => normalizeProjectTitle(title))
  );

  const projects = extraction.projects.filter((p) => {
    const key = normalizeProjectTitle(p.title);
    return !existingNorm.has(key) && referenced.has(key);
  });

  const seen = new Set(projects.map((p) => normalizeProjectTitle(p.title)));
  for (const task of tasks) {
    if (!task.projectTitle) continue;
    const key = normalizeProjectTitle(task.projectTitle);
    if (existingNorm.has(key) || seen.has(key)) continue;
    projects.push({
      title: task.projectTitle,
      description: undefined,
      targetDate: null,
    });
    seen.add(key);
  }

  return { ...extraction, tasks, projects };
}
