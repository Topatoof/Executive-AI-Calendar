import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateOwner } from "@/lib/owner";
import { generateIcsContent } from "@/lib/calendar/ics";
import { startOfDay, addDays } from "date-fns";

export async function GET(request: Request) {
  const owner = await getOrCreateOwner();
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") ?? "7", 10);

  const start = startOfDay(new Date());
  const end = addDays(start, days);

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
