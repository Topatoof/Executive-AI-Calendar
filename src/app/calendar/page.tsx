import { prisma } from "@/lib/db";
import { getOrCreateOwner } from "@/lib/owner";
import { MonthCalendar } from "@/components/month-calendar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getBlockColor } from "@/lib/calendar/ics";
import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import Link from "next/link";
import { Download } from "lucide-react";

function parseMonthParam(value?: string): Date {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    return startOfMonth(new Date(year, month - 1, 1));
  }
  return startOfMonth(new Date());
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const owner = await getOrCreateOwner();
  const month = parseMonthParam(monthParam);
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });

  const blocks = await prisma.scheduleBlock.findMany({
    where: {
      ownerId: owner.id,
      startTime: { gte: gridStart, lte: gridEnd },
    },
    include: { task: true },
    orderBy: { startTime: "asc" },
  });

  const serializedBlocks = blocks.map((block) => ({
    ...block,
    startTime: block.startTime.toISOString(),
    endTime: block.endTime.toISOString(),
    createdAt: block.createdAt.toISOString(),
    updatedAt: block.updatedAt.toISOString(),
    task: block.task
      ? {
          ...block.task,
          deadline: block.task.deadline?.toISOString() ?? null,
          scheduledDate: block.task.scheduledDate?.toISOString() ?? null,
          completedAt: block.task.completedAt?.toISOString() ?? null,
          createdAt: block.task.createdAt.toISOString(),
          updatedAt: block.task.updatedAt.toISOString(),
        }
      : null,
  }));

  const monthKey = format(month, "yyyy-MM");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">
            Monthly view of your schedule blocks
          </p>
        </div>
        <Button asChild>
          <Link href={`/api/calendar/export?month=${monthKey}`}>
            <Download className="mr-2 h-4 w-4" />
            Export .ics
          </Link>
        </Button>
      </div>

      <MonthCalendar month={month} blocks={serializedBlocks} />

      <div className="flex flex-wrap gap-3">
        {["DEEP_WORK", "SHALLOW_WORK", "HABIT", "MEETING", "BREAK"].map(
          (type) => (
            <div key={type} className="flex items-center gap-2 text-xs">
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: getBlockColor(type) }}
              />
              {type.replace("_", " ")}
            </div>
          )
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import to Apple Calendar</CardTitle>
          <CardDescription>
            Download the .ics file, then open it or drag into Calendar.app.
            Blocks sync as new events; re-export after schedule changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Click Export .ics above</li>
            <li>Open the downloaded file — Calendar will import events</li>
            <li>Re-export whenever you regenerate your schedule</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
