"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  applyScheduleChanges,
  previewScheduleChanges,
} from "@/app/actions";
import type { ScheduleChangePreview } from "@/lib/ai/schemas";
import { Loader2 } from "lucide-react";
import Link from "next/link";

const EXAMPLE =
  "I'm busy on Monday and can't work. Move my calculus study session to Tuesday and adjust my schedule.";

export function BrainDumpScheduleChanges() {
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState<ScheduleChangePreview | null>(null);
  const [done, setDone] = useState(false);
  const [applyResult, setApplyResult] = useState<{
    applied: number;
    errors: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview() {
    if (!instructions.trim()) return;
    setLoading(true);
    setError(null);
    setDone(false);
    setApplyResult(null);
    setPreview(null);
    try {
      const result = await previewScheduleChanges(instructions);
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not plan changes");
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!preview) return;
    setApplying(true);
    setError(null);
    try {
      const result = await applyScheduleChanges(preview);
      setApplyResult(result);
      setDone(true);
      setPreview(null);
      setInstructions("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply changes");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Describe your schedule change</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder={EXAMPLE}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="min-h-[140px] text-base"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={handlePreview} disabled={loading || !instructions.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Preview changes
            </Button>
            <Button variant="outline" onClick={() => setInstructions(EXAMPLE)}>
              Use example
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Examples: &quot;I&apos;m busy Monday — move my podcast edit to
            Wednesday&quot;, &quot;Cancel Friday gym&quot;, &quot;Push all of
            today&apos;s blocks to tomorrow&quot;.
          </p>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {done && applyResult && (
        <Card className="border-emerald-500/40 bg-emerald-500/5">
          <CardContent className="pt-6 space-y-2">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Applied {applyResult.applied} schedule adjustment(s).
            </p>
            {applyResult.errors.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-amber-600">
                {applyResult.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <Link href="/planner" className="text-sm text-primary underline">
              Open planner to review
            </Link>
          </CardContent>
        </Card>
      )}

      {preview && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle>Review schedule changes</CardTitle>
            <p className="text-sm text-muted-foreground">{preview.plan.summary}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {preview.plan.warnings.map((w, i) => (
              <p key={i} className="text-sm text-amber-600">
                {w}
              </p>
            ))}
            <ul className="space-y-3">
              {preview.resolved.map((change, i) => (
                <li
                  key={i}
                  className="rounded-lg border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={change.skipped ? "secondary" : "outline"}>
                      {change.action.replace("_", " ")}
                    </Badge>
                    <span className="font-medium">{change.description}</span>
                  </div>
                  {change.skipped && change.skipReason && (
                    <p className="mt-1 text-muted-foreground">{change.skipReason}</p>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button
                onClick={handleApply}
                disabled={
                  applying ||
                  preview.resolved.every((c) => c.skipped || c.blockIds.length === 0)
                }
              >
                {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Apply to planner
              </Button>
              <Button variant="outline" onClick={() => setPreview(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
