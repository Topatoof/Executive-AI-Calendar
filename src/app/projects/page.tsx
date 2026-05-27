import { prisma } from "@/lib/db";
import { getOrCreateOwner } from "@/lib/owner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/utils";
import { format } from "date-fns";

export default async function ProjectsPage() {
  const owner = await getOrCreateOwner();

  const projects = await prisma.project.findMany({
    where: { ownerId: owner.id },
    include: {
      tasks: {
        orderBy: { priority: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const unassigned = await prisma.task.findMany({
    where: { ownerId: owner.id, projectId: null },
    orderBy: { priority: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <p className="text-muted-foreground">
          Long-term outcomes and task breakdowns
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((project) => {
          const completed = project.tasks.filter(
            (t) => t.status === "COMPLETED"
          ).length;
          const total = project.tasks.length;
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

          return (
            <Card key={project.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: project.color }}
                  />
                  <CardTitle>{project.title}</CardTitle>
                </div>
                {project.description && (
                  <CardDescription>{project.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {completed}/{total} tasks · {pct}% complete
                  {project.targetDate &&
                    ` · Due ${format(project.targetDate, "MMM d")}`}
                </p>
                {project.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-lg border p-2 text-sm"
                  >
                    <span>{task.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(task.estimatedMinutes)}
                      </span>
                      <Badge variant="outline">{task.status}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {unassigned.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Unassigned Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {unassigned.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
              >
                <span>{t.title}</span>
                <Badge>{t.priority}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
