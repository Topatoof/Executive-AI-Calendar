"use client";

import { useEffect, useRef, useState } from "react";
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
const STICKER_STORAGE_KEY = "exec-ai-brain-dump-stickers";

type StickerAsset = {
  id: string;
  name: string;
  dataUrl: string;
};

type PlacedSticker = {
  id: string;
  assetId: string;
  x: number;
  y: number;
  rotation: number;
  size: number;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read uploaded image."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load sticker image."));
    img.src = src;
  });
}

async function optimizedStickerDataUrl(file: File): Promise<string> {
  const original = await fileToDataUrl(file);
  const img = await loadImage(original);
  const maxSide = 220;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return original;
  ctx.drawImage(img, 0, 0, w, h);
  const optimized = canvas.toDataURL("image/webp", 0.82);
  return optimized.length < original.length ? optimized : original;
}

function intersectsRect(
  x: number,
  y: number,
  size: number,
  rect: { left: number; top: number; right: number; bottom: number }
) {
  return (
    x < rect.right &&
    x + size > rect.left &&
    y < rect.bottom &&
    y + size > rect.top
  );
}

function fitOutsideBlockedRect(
  x: number,
  y: number,
  size: number,
  maxW: number,
  maxH: number,
  blocked: { left: number; top: number; right: number; bottom: number } | null
) {
  const nx = Math.max(0, Math.min(maxW - size, x));
  const ny = Math.max(0, Math.min(maxH - size, y));
  if (!blocked || !intersectsRect(nx, ny, size, blocked)) return { x: nx, y: ny };

  const candidates = [
    { x: Math.max(0, blocked.left - size - 8), y: ny },
    { x: Math.min(maxW - size, blocked.right + 8), y: ny },
    { x: nx, y: Math.max(0, blocked.top - size - 8) },
    { x: nx, y: Math.min(maxH - size, blocked.bottom + 8) },
  ];
  candidates.sort((a, b) => Math.hypot(a.x - nx, a.y - ny) - Math.hypot(b.x - nx, b.y - ny));
  for (const c of candidates) {
    if (!intersectsRect(c.x, c.y, size, blocked)) return c;
  }
  return { x: nx, y: ny };
}

function getBlockedRect(el: HTMLElement | null) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const padding = 24;
  return {
    left: r.left - padding,
    top: r.top - padding,
    right: r.right + padding,
    bottom: r.bottom + padding,
  };
}

export function BrainDumpForm() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [dumpId, setDumpId] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<StickerAsset[]>([]);
  const [placed, setPlaced] = useState<PlacedSticker[]>([]);
  const [stickerError, setStickerError] = useState<string | null>(null);
  const [stickersHydrated, setStickersHydrated] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string;
    mouseStartX: number;
    mouseStartY: number;
    startX: number;
    startY: number;
    size: number;
  } | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STICKER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          assets?: StickerAsset[];
          placed?: Array<
            | PlacedSticker
            | (Omit<PlacedSticker, "x" | "y"> & { left?: string; top?: string })
          >;
        };
        setAssets(parsed.assets ?? []);
        const migrated = (parsed.placed ?? []).map((s) => {
          if ("x" in s && "y" in s) return s;
          const legacy = s as Omit<PlacedSticker, "x" | "y"> & {
            left?: string;
            top?: string;
          };
          const width = window.innerWidth;
          const height = window.innerHeight;
          const x =
            legacy.left?.endsWith("%")
              ? (Number(legacy.left.replace("%", "")) / 100) * width
              : Number((legacy.left || "0").replace("px", "")) || 0;
          const y =
            legacy.top?.endsWith("%")
              ? (Number(legacy.top.replace("%", "")) / 100) * height
              : Number((legacy.top || "0").replace("px", "")) || 0;
          return { ...legacy, x, y };
        }) as PlacedSticker[];
        setPlaced(migrated);
      }
    } catch {
      localStorage.removeItem(STICKER_STORAGE_KEY);
    } finally {
      setStickersHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!stickersHydrated) return;
    try {
      localStorage.setItem(STICKER_STORAGE_KEY, JSON.stringify({ assets, placed }));
      if (stickerError?.includes("storage")) setStickerError(null);
    } catch {
      setStickerError(
        "Could not save stickers to browser storage (too large). Try removing some uploaded stickers."
      );
    }
  }, [assets, placed, stickerError, stickersHydrated]);

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

  async function handleStickerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setStickerError(null);
    try {
      const next = await Promise.all(
        files.map(async (file) => {
          const dataUrl = await optimizedStickerDataUrl(file);
          return {
            id: crypto.randomUUID(),
            name: file.name,
            dataUrl,
          } satisfies StickerAsset;
        })
      );
      setAssets((prev) => [...prev, ...next]);
    } catch (err) {
      setStickerError(err instanceof Error ? err.message : "Sticker upload failed.");
    } finally {
      e.target.value = "";
    }
  }

  function placeSticker(assetId: string) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const size = 88;
    const blocked = getBlockedRect(contentRef.current);
    const candidates = [
      { x: 20, y: 20 },
      { x: width - size - 20, y: 20 },
      { x: 20, y: height - size - 20 },
      { x: width - size - 20, y: height - size - 20 },
      { x: 20, y: Math.max(20, height / 2 - size / 2) },
      { x: width - size - 20, y: Math.max(20, height / 2 - size / 2) },
    ];
    const base = candidates[placed.length % candidates.length];
    const safe = fitOutsideBlockedRect(
      base.x,
      base.y,
      size,
      width,
      height,
      blocked
    );
    setPlaced((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        assetId,
        x: safe.x,
        y: safe.y,
        rotation: (prev.length * 17) % 30 - 15,
        size,
      },
    ]);
  }

  function removePlacedSticker(id: string) {
    setPlaced((prev) => prev.filter((s) => s.id !== id));
  }

  function removeStickerAsset(assetId: string) {
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
    setPlaced((prev) => prev.filter((s) => s.assetId !== assetId));
  }

  function clearAllStickers() {
    setPlaced([]);
  }

  function handleStickerMouseDown(
    e: React.MouseEvent<HTMLButtonElement>,
    sticker: PlacedSticker
  ) {
    dragRef.current = {
      id: sticker.id,
      mouseStartX: e.clientX,
      mouseStartY: e.clientY,
      startX: sticker.x,
      startY: sticker.y,
      size: sticker.size,
    };
    e.preventDefault();
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragRef.current) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const blocked = getBlockedRect(contentRef.current);
      const dx = e.clientX - dragRef.current.mouseStartX;
      const dy = e.clientY - dragRef.current.mouseStartY;
      const maxLeft = Math.max(0, width - dragRef.current.size);
      const maxTop = Math.max(0, height - dragRef.current.size);
      const desiredX = Math.min(maxLeft, Math.max(0, dragRef.current.startX + dx));
      const desiredY = Math.min(maxTop, Math.max(0, dragRef.current.startY + dy));
      const safe = fitOutsideBlockedRect(
        desiredX,
        desiredY,
        dragRef.current.size,
        width,
        height,
        blocked
      );
      const id = dragRef.current.id;
      setPlaced((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, x: Math.round(safe.x), y: Math.round(safe.y) }
            : s
        )
      );
    }

    function onMouseUp() {
      dragRef.current = null;
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <div className="space-y-4">
      {placed.map((sticker) => {
        const asset = assets.find((a) => a.id === sticker.assetId);
        if (!asset) return null;
        return (
          <button
            key={sticker.id}
            type="button"
            title="Drag to move. Double-click to remove."
            onMouseDown={(e) => handleStickerMouseDown(e, sticker)}
            onDoubleClick={() => removePlacedSticker(sticker.id)}
            className="absolute z-0 rounded-md opacity-85 transition hover:opacity-100"
            style={{
              top: `${sticker.y}px`,
              left: `${sticker.x}px`,
              transform: `rotate(${sticker.rotation}deg)`,
              position: "fixed",
              cursor: "grab",
              zIndex: 5,
            }}
          >
            <img
              src={asset.dataUrl}
              alt={asset.name}
              width={sticker.size}
              height={sticker.size}
              className="rounded-md object-cover shadow-md"
            />
          </button>
        );
      })}

      <Card className="relative z-10">
        <CardHeader>
          <CardTitle>Sticker Decor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleStickerUpload}
              className="text-sm"
            />
            <Button
              type="button"
              variant="outline"
              onClick={clearAllStickers}
              disabled={placed.length === 0}
            >
              Clear Placed Stickers
            </Button>
          </div>
          {stickerError && (
            <p className="text-sm text-destructive">{stickerError}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Tip: drag stickers with your mouse to reposition. Double-click a placed
            sticker to remove it.
          </p>
          {assets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="group relative rounded-lg border p-1 transition hover:bg-accent"
                >
                  <button
                    type="button"
                    onClick={() => placeSticker(asset.id)}
                    className="block"
                    title={`Add ${asset.name}`}
                  >
                    <img
                      src={asset.dataUrl}
                      alt={asset.name}
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded object-cover"
                    />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove uploaded sticker ${asset.name}`}
                    title="Remove uploaded sticker"
                    onClick={() => removeStickerAsset(asset.id)}
                    className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full border bg-background text-xs font-bold text-foreground shadow-sm group-hover:flex"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div ref={contentRef} className="relative z-10 space-y-4">
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
    </div>
  );
}
