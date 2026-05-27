"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateOwnerSettings } from "@/app/actions";
import type { OwnerProfile, CoachingStyle } from "@prisma/client";

const COACHING_STYLES: CoachingStyle[] = [
  "SUPPORTIVE",
  "STRICT",
  "MILITARY",
  "STRATEGIC",
];

export function SettingsForm({ owner }: { owner: OwnerProfile }) {
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    workStartHour: owner.workStartHour,
    workEndHour: owner.workEndHour,
    focusStartHour: owner.focusStartHour,
    focusEndHour: owner.focusEndHour,
    maxDailyMinutes: owner.maxDailyMinutes,
    coachingStyle: owner.coachingStyle,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await updateOwnerSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Work start (hour)"
              type="number"
              min={0}
              max={23}
              value={form.workStartHour}
              onChange={(v) => setForm({ ...form, workStartHour: v })}
            />
            <Field
              label="Work end (hour)"
              type="number"
              min={0}
              max={23}
              value={form.workEndHour}
              onChange={(v) => setForm({ ...form, workEndHour: v })}
            />
            <Field
              label="Focus start (hour)"
              type="number"
              min={0}
              max={23}
              value={form.focusStartHour}
              onChange={(v) => setForm({ ...form, focusStartHour: v })}
            />
            <Field
              label="Focus end (hour)"
              type="number"
              min={0}
              max={23}
              value={form.focusEndHour}
              onChange={(v) => setForm({ ...form, focusEndHour: v })}
            />
            <Field
              label="Max daily minutes"
              type="number"
              min={60}
              max={960}
              value={form.maxDailyMinutes}
              onChange={(v) => setForm({ ...form, maxDailyMinutes: v })}
            />
          </div>

          <div>
            <Label>Coaching style (Boss Mode)</Label>
            <select
              className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              value={form.coachingStyle}
              onChange={(e) =>
                setForm({
                  ...form,
                  coachingStyle: e.target.value as CoachingStyle,
                })
              }
            >
              {COACHING_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>

          <Button type="submit">Save Settings</Button>
          {saved && (
            <p className="text-sm text-emerald-600">Settings saved.</p>
          )}
        </CardContent>
      </Card>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  ...props
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
} & React.ComponentProps<typeof Input>) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        className="mt-1"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        {...props}
      />
    </div>
  );
}
