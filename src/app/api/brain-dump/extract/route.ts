import { NextResponse } from "next/server";
import { extractFromBrainDump } from "@/lib/ai/extract";

export async function POST(request: Request) {
  try {
    const { content } = await request.json();
    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }
    const extraction = await extractFromBrainDump(
      content,
      new Date().toISOString()
    );
    return NextResponse.json(extraction);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
