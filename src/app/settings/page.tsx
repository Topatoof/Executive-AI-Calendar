import { getOrCreateOwner } from "@/lib/owner";
import { SettingsForm } from "@/components/settings-form";

export default async function SettingsPage() {
  const owner = await getOrCreateOwner();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Work hours, focus windows, and coaching mode
        </p>
      </div>
      <SettingsForm owner={owner} />
    </div>
  );
}
