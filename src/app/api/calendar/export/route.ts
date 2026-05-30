import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateOwner } from "@/lib/owner";
import { generateIcsContent } from "@/lib/calendar/ics";
import { startOfDay, addDays, startOfMonth, endOfMonth, parse } from "date-fns";

export async function GET(request: Request) {
  const owner = await getOrCreateOwner();
  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month");

  let start: Date;
  let end: Date;

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    start = startOfMonth(parse(monthParam, "yyyy-MM", new Date()));
    end = endOfMonth(start);
  } else {
    const days = parseInt(searchParams.get("days") ?? "7", 10);
    start = startOfDay(new Date());
    end = addDays(start, days);
  }

  const blocks = await prisma.scheduleBlock.findMany({
    where: {
      ownerId: owner.id,
      startTime: { gte: start, lte: end },
    },
    include: { task: true },
    orderBy: { startTime: "asc" },
  });

  const ics = generateIcsContent(blocks);
  if (!ics) {
    return NextResponse.json(
      { error: "No schedule blocks to export" },
      { status: 404 }
    );
  }

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="exec-ai-schedule.ics"`,
    },
  });
}
