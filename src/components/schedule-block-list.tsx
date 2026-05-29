import { ScheduleBlockCard } from "@/components/schedule-block-card";
import {
  partitionScheduleBlocks,
  type ScheduleBlockWithTask,
} from "@/lib/schedule/sort";

function BlockGroup({ blocks }: { blocks: ScheduleBlockWithTask[] }) {
  if (blocks.length === 0) return null;
  return (
    <div className="space-y-3">
      {blocks.map((b) => (
        <ScheduleBlockCard key={b.id} block={b} />
      ))}
    </div>
  );
}

export function ScheduleBlockList({
  blocks,
  emptyMessage,
  overdueMode = "inline",
}: {
  blocks: ScheduleBlockWithTask[];
  emptyMessage?: string;
  /** inline: overdue section in this list; omit: exclude overdue (show elsewhere) */
  overdueMode?: "inline" | "omit";
}) {
  const { schedule, overdue, completed } = partitionScheduleBlocks(blocks);
  const visibleOverdue = overdueMode === "inline" ? overdue : [];
  const hasContent =
    schedule.length > 0 ||
    visibleOverdue.length > 0 ||
    completed.length > 0;

  if (!hasContent) {
    return emptyMessage ? (
      <p className="text-sm text-muted-foreground">{emptyMessage}</p>
    ) : null;
  }

  return (
    <div className="space-y-4">
      <BlockGroup blocks={schedule} />
      {visibleOverdue.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">Overdue</p>
          <BlockGroup blocks={visibleOverdue} />
        </div>
      )}
      <BlockGroup blocks={completed} />
    </div>
  );
}

/** Overdue blocks only — for dashboard side panel, etc. */
export function ScheduleBlockOverdueList({
  blocks,
}: {
  blocks: ScheduleBlockWithTask[];
}) {
  const { overdue } = partitionScheduleBlocks(blocks);
  return <BlockGroup blocks={overdue} />;
}
