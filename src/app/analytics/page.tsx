import { getOrCreateOwner } from "@/lib/owner";
import {
  computeAnalytics,
  getWeeklyDailyWorkMinutes,
} from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { DailyWorkLineChart } from "@/components/daily-work-line-chart";
import { Button } from "@/components/ui/button";
import { addWeeks, endOfWeek, format, startOfWeek } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDuration } from "@/lib/utils";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

function parseWeekParam(value?: string): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(year, month - 1, day, 12);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function weekAnalyticsHref(weekStart: Date, currentWeekStart: Date) {
  if (
    format(weekStart, "yyyy-MM-dd") === format(currentWeekStart, "yyyy-MM-dd")
  ) {
    return "/analytics";
  }
  return `/analytics?week=${format(weekStart, "yyyy-MM-dd")}`;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week: weekParam } = await searchParams;
  const owner = await getOrCreateOwner();
  const now = new Date();
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const referenceDate = parseWeekParam(weekParam);
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
  const isCurrentWeek =
    format(weekStart, "yyyy-MM-dd") === format(currentWeekStart, "yyyy-MM-dd");

  const [analytics, dailyWork] = await Promise.all([
    computeAnalytics(owner.id),
    getWeeklyDailyWorkMinutes(owner.id, referenceDate),
  ]);

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
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <CardTitle>
                {isCurrentWeek
                  ? "This week"
                  : `Week of ${format(weekStart, "MMM d, yyyy")}`}
              </CardTitle>
              <CardDescription>
                Hours & minutes worked per day ·{" "}
                {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
              </CardDescription>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="outline" size="icon" asChild>
                <Link
                  href={weekAnalyticsHref(
                    addWeeks(weekStart, -1),
                    currentWeekStart
                  )}
                  aria-label="Previous week"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              </Button>
              {isCurrentWeek ? (
                <Button
                  variant="outline"
                  size="icon"
                  disabled
                  aria-label="Next week"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button variant="outline" size="icon" asChild>
                  <Link
                    href={weekAnalyticsHref(
                      addWeeks(weekStart, 1),
                      currentWeekStart
                    )}
                    aria-label="Next week"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DailyWorkLineChart data={dailyWork} />
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
