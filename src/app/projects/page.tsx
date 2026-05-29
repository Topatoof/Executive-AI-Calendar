import { prisma } from "@/lib/db";
import { getOrCreateOwner } from "@/lib/owner";
import { ProjectsPanel } from "@/components/projects-panel";

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

      <ProjectsPanel projects={projects} unassigned={unassigned} />
    </div>
  );
}
