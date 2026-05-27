import { prisma } from "@/lib/db";
import { getOrCreateOwner } from "@/lib/owner";
import { ScheduleBlockCard } from "@/components/schedule-block-card";
import { PlannerActions } from "@/components/planner-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { startOfWeek, endOfWeek } from "date-fns";

export default async function PlannerPage() {
  const owner = await getOrCreateOwner();
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const blocks = await prisma.scheduleBlock.findMany({
    where: {
      ownerId: owner.id,
      startTime: { gte: weekStart, lte: weekEnd },
    },
    include: { task: true },
    orderBy: { startTime: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planner</h1>
          <p className="text-muted-foreground">
            AI-generated schedule for this week
          </p>
        </div>
        <PlannerActions />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schedule Blocks</CardTitle>
          <CardDescription>
            {blocks.length} block(s) this week
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No schedule yet. Add tasks via Brain Dump, then generate a plan.
            </p>
          ) : (
            blocks.map((b) => <ScheduleBlockCard key={b.id} block={b} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
