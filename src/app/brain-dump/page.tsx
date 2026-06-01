import { BrainDumpPanel } from "@/components/brain-dump-panel";

export default function BrainDumpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Brain Dump</h1>
        <p className="text-muted-foreground">
          Capture new tasks or tell the app how to adjust your existing planner
          schedule when plans change.
        </p>
      </div>
      <BrainDumpPanel />
    </div>
  );
}
