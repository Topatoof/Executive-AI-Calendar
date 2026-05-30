import { prisma } from "@/lib/db";
import { getOrCreateOwner } from "@/lib/owner";
import { PlannerScheduleByDay } from "@/components/planner-schedule-by-day";
import { PlannerActions } from "@/components/planner-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPlannerViewRange } from "@/lib/planner-horizon";
import { format } from "date-fns";

export default async function PlannerPage() {
  const owner = await getOrCreateOwner();
  const { viewStart: weekStart, viewEnd: weekEnd } = getPlannerViewRange();

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
            {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
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
          <PlannerScheduleByDay
            blocks={blocks}
            weekStart={weekStart}
            weekEnd={weekEnd}
          />
        </CardContent>
      </Card>
    </div>
  );
}
