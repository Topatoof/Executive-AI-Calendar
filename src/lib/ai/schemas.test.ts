import { describe, it, expect } from "vitest";
import { extractionResultSchema } from "@/lib/ai/schemas";

describe("extractionResultSchema", () => {
  it("parses valid extraction", () => {
    const data = {
      tasks: [
        {
          title: "Finish economics paper",
          category: "school",
          estimatedMinutes: 180,
          deadline: "2026-05-22T23:59:00.000Z",
          priority: "CRITICAL",
          importance: 9,
          urgency: 9,
          cognitiveLoad: 8,
          confidence: 0.85,
        },
      ],
      projects: [{ title: "Economics Paper" }],
      summary: "Extracted 1 task",
      warnings: [],
    };
    const result = extractionResultSchema.parse(data);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe("Finish economics paper");
  });

  it("rejects invalid priority", () => {
    expect(() =>
      extractionResultSchema.parse({
        tasks: [{ title: "Test", priority: "URGENT" }],
        projects: [],
        summary: "",
        warnings: [],
      })
    ).toThrow();
  });
});
