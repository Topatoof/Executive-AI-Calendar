import { BrainDumpForm } from "@/components/brain-dump-form";

export default function BrainDumpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Brain Dump</h1>
        <p className="text-muted-foreground">
          Dump everything. AI extracts tasks, deadlines, and priorities.
        </p>
      </div>
      <BrainDumpForm />
    </div>
  );
}
