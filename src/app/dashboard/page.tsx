import { prisma } from "@/lib/db";
import { getOrCreateOwner } from "@/lib/owner";
import { computeAnalytics } from "@/lib/analytics";
import { runAccountabilityCheck } from "@/app/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScheduleBlockCard } from "@/components/schedule-block-card";
import { formatDuration } from "@/lib/utils";
import { startOfDay, endOfDay } from "date-fns";
import Link from "next/link";
import type { ComponentType } from "react";
import { AlertTriangle, CheckCircle2, Clock, Target } from "lucide-react";

export default async function DashboardPage() {
  const owner = await getOrCreateOwner();
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const [blocks, alerts, overdueTasks, analytics] = await Promise.all([
    prisma.scheduleBlock.findMany({
      where: {
        ownerId: owner.id,
        startTime: { gte: todayStart, lte: todayEnd },
      },
      include: { task: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.accountabilityEvent.findMany({
      where: { ownerId: owner.id, acknowledged: false },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    prisma.task.findMany({
      where: {
        ownerId: owner.id,
        deadline: { lt: new Date() },
        status: { in: ["PENDING", "IN_PROGRESS", "MISSED"] },
      },
      take: 5,
    }),
    computeAnalytics(owner.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Today&apos;s execution command center
          </p>
        </div>
        <form action={runAccountabilityCheck}>
          <Button type="submit" variant="outline">
            Run Boss Mode Check
          </Button>
        </form>
      </div>

      {alerts.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Boss Mode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((a) => (
              <div key={a.id} className="rounded-lg border bg-card p-4">
                <p className="font-medium">{a.message}</p>
                {a.recommendation && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {a.recommendation}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          icon={CheckCircle2}
          label="Completion Rate"
          value={`${Math.round(analytics.completionRate * 100)}%`}
        />
        <StatCard
          icon={Clock}
          label="Focus Time"
          value={formatDuration(analytics.focusMinutes)}
        />
        <StatCard
          icon={Target}
          label="Streak"
          value={`${analytics.consistencyStreak} wks`}
        />
        <StatCard
          icon={AlertTriangle}
          label="Burnout Risk"
          value={`${Math.round(analytics.burnoutRisk * 100)}%`}
          warn={analytics.burnoutRisk > 0.6}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Schedule</CardTitle>
            <CardDescription>
              {blocks.length} block(s) scheduled
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {blocks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No blocks today.{" "}
                <Link href="/planner" className="text-primary underline">
                  Generate a plan
                </Link>
              </p>
            ) : (
              blocks.map((b) => <ScheduleBlockCard key={b.id} block={b} />)
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Overdue</CardTitle>
            <CardDescription>Tasks past deadline</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing overdue.</p>
            ) : (
              overdueTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <span className="text-sm font-medium">{t.title}</span>
                  <Badge variant="destructive">{t.priority}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  warn,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon
          className={`h-5 w-5 ${warn ? "text-destructive" : "text-primary"}`}
        />
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
