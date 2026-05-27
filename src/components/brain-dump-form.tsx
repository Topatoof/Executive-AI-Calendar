"use client";

import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { submitBrainDump, confirmBrainDump } from "@/app/actions";
import type { ExtractionResult } from "@/lib/ai/schemas";
import { formatDuration } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const EXAMPLE =
  "I need to finish my economics paper by Friday, train legs 3x this week, edit my podcast, study calculus chapter 4, and call my bank.";

export function BrainDumpForm() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [dumpId, setDumpId] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  async function handleExtract() {
    if (!content.trim()) return;
    setLoading(true);
    setDone(false);
    setError(null);
    try {
      const result = await submitBrainDump(content);
      setDumpId(result.dumpId);
      setExtraction(result.extraction);
      setTimeout(() => {
        outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!dumpId || !extraction) return;
    setConfirming(true);
    setError(null);
    try {
      await confirmBrainDump(dumpId, extraction);
      setDone(true);
      setContent("");
      setExtraction(null);
      setDumpId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save tasks");
    } finally {
      setConfirming(false);
    }
  }

  function updateTask(
    index: number,
    field: keyof ExtractionResult["tasks"][0],
    value: string | number
  ) {
    if (!extraction) return;
    const tasks = [...extraction.tasks];
    tasks[index] = { ...tasks[index], [field]: value };
    setExtraction({ ...extraction, tasks });
  }

  return (
    <div className="space-y-4">
      <Textarea
        placeholder={EXAMPLE}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[160px] text-base"
      />
      <div className="flex gap-2">
        <Button onClick={handleExtract} disabled={loading || !content.trim()}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Extract Tasks
        </Button>
        <Button variant="outline" onClick={() => setContent(EXAMPLE)}>
          Use Example
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        After extraction, your tasks will appear directly below in a Review
        Extraction card. Click Confirm & Save Tasks to send them to Planner.
      </p>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {done && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Tasks saved. Head to Planner to schedule them.
        </p>
      )}

      {extraction && (
        <Card ref={outputRef} className="border-primary/50">
          <CardHeader>
            <CardTitle>
              Review Extraction ({extraction.tasks.length} task
              {extraction.tasks.length === 1 ? "" : "s"})
            </CardTitle>
            <p className="text-sm text-muted-foreground">{extraction.summary}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {extraction.warnings.map((w, i) => (
              <p key={i} className="text-sm text-amber-600">
                {w}
              </p>
            ))}
            {extraction.tasks.map((task, i) => (
              <div key={i} className="rounded-lg border p-4 space-y-2">
                <input
                  className="w-full bg-transparent font-medium outline-none"
                  value={task.title}
                  onChange={(e) => updateTask(i, "title", e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{task.category}</Badge>
                  <Badge>{task.priority}</Badge>
                  <Badge variant="secondary">
                    {formatDuration(task.estimatedMinutes)}
                  </Badge>
                  {task.deadline && (
                    <Badge variant="warning">
                      Due {new Date(task.deadline).toLocaleDateString()}
                    </Badge>
                  )}
                  {task.confidence < 0.7 && (
                    <Badge variant="warning">Low confidence</Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <label>
                    Importance
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={task.importance}
                      onChange={(e) =>
                        updateTask(i, "importance", parseInt(e.target.value))
                      }
                      className="mt-1 w-full rounded border bg-transparent px-2 py-1"
                    />
                  </label>
                  <label>
                    Urgency
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={task.urgency}
                      onChange={(e) =>
                        updateTask(i, "urgency", parseInt(e.target.value))
                      }
                      className="mt-1 w-full rounded border bg-transparent px-2 py-1"
                    />
                  </label>
                  <label>
                    Minutes
                    <input
                      type="number"
                      min={5}
                      value={task.estimatedMinutes}
                      onChange={(e) =>
                        updateTask(
                          i,
                          "estimatedMinutes",
                          parseInt(e.target.value)
                        )
                      }
                      className="mt-1 w-full rounded border bg-transparent px-2 py-1"
                    />
                  </label>
                </div>
              </div>
            ))}
            <Button onClick={handleConfirm} disabled={confirming}>
              {confirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm & Save Tasks
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
