import { getOrCreateOwner } from "@/lib/owner";
import { computeAnalytics } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDuration } from "@/lib/utils";

export default async function AnalyticsPage() {
  const owner = await getOrCreateOwner();
  const analytics = await computeAnalytics(owner.id);

  const snapshots = await prisma.analyticsSnapshot.findMany({
    where: { ownerId: owner.id },
    orderBy: { weekStart: "desc" },
    take: 8,
  });

  const categoryBreakdown = await prisma.task.groupBy({
    by: ["category"],
    where: { ownerId: owner.id },
    _count: { id: true },
    _sum: { estimatedMinutes: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Performance review and workload signals
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Overdue Task Rate"
          value={`${Math.round(analytics.overdueTaskRate * 100)}%`}
          desc={`${analytics.missedDeadlines} of ${analytics.totalTasks} incomplete tasks overdue`}
          warn={analytics.overdueTaskRate > 0.2}
        />
        <MetricCard
          title="Focus Time"
          value={formatDuration(analytics.focusMinutes)}
          desc="Completed schedule blocks this week"
        />
        <MetricCard
          title="Burnout Risk"
          value={`${Math.round(analytics.burnoutRisk * 100)}%`}
          desc={
            analytics.burnoutRisk > 0.6
              ? "High — reduce load"
              : "Within normal range"
          }
          warn={analytics.burnoutRisk > 0.6}
        />
        <MetricCard
          title="Missed Deadlines"
          value={String(analytics.missedDeadlines)}
          desc="Past deadline or schedule block not marked done"
        />
        <MetricCard
          title="Consistency Streak"
          value={`${analytics.consistencyStreak} weeks`}
          desc="Weeks at or below 20% overdue"
        />
        <MetricCard
          title="Workload"
          value={formatDuration(analytics.workloadMinutes)}
          desc="Scheduled minutes this week"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Trend</CardTitle>
          <CardDescription>Overdue task rate by week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-32">
            {snapshots.reverse().map((s) => (
              <div key={s.id} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t ${s.overdueTaskRate > 0.2 ? "bg-destructive" : "bg-primary"}`}
                  style={{
                    height: `${Math.max(8, s.overdueTaskRate * 100)}%`,
                    minHeight: 8,
                  }}
                />
                <span className="text-[10px] text-muted-foreground">
                  {Math.round(s.overdueTaskRate * 100)}%
                </span>
              </div>
            ))}
            {snapshots.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Complete tasks to build history.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workload by Category</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {categoryBreakdown.map((c) => (
            <div key={c.category} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="capitalize">{c.category}</span>
                <span className="text-muted-foreground">
                  {c._count.id} tasks ·{" "}
                  {formatDuration(c._sum.estimatedMinutes ?? 0)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${Math.min(100, ((c._sum.estimatedMinutes ?? 0) / 600) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  title,
  value,
  desc,
  warn,
}: {
  title: string;
  value: string;
  desc: string;
  warn?: boolean;
}) {
  return (
    <Card className={warn ? "border-destructive/50" : undefined}>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className={warn ? "text-destructive" : undefined}>
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}
