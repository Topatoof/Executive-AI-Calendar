import { prisma } from "@/lib/db";
import { getOrCreateOwner } from "@/lib/owner";
import { ScheduleBlockList } from "@/components/schedule-block-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getBlockColor } from "@/lib/calendar/ics";
import { addDays, startOfDay } from "date-fns";
import Link from "next/link";
import { Download } from "lucide-react";

export default async function CalendarPage() {
  const owner = await getOrCreateOwner();
  const start = startOfDay(new Date());
  const end = addDays(start, 14);

  const blocks = await prisma.scheduleBlock.findMany({
    where: {
      ownerId: owner.id,
      startTime: { gte: start, lte: end },
    },
    include: { task: true },
    orderBy: { startTime: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">
            Export to Apple Calendar via .ics
          </p>
        </div>
        <Button asChild>
          <Link href="/api/calendar/export?days=14">
            <Download className="mr-2 h-4 w-4" />
            Export .ics
          </Link>
        </Button>
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

      <div className="space-y-3">
        <ScheduleBlockList
          blocks={blocks}
          emptyMessage="No upcoming blocks. Generate a plan first."
        />
      </div>
    </div>
  );
}
