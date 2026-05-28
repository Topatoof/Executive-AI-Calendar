"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateOwnerSettings } from "@/app/actions";
import type { OwnerProfile, CoachingStyle } from "@prisma/client";
import { useTheme } from "next-themes";
import {
  ACCENT_PRESETS,
  ACCENT_STORAGE_KEY,
  BACKGROUND_STYLES,
  BACKGROUND_BLUR_STORAGE_KEY,
  BACKGROUND_STORAGE_KEY,
  applyAccentColor,
  applyBackgroundBlur,
  applyBackgroundStyle,
  type BackgroundStyle,
} from "@/lib/theme";

const COACHING_STYLES: CoachingStyle[] = [
  "SUPPORTIVE",
  "STRICT",
  "MILITARY",
  "STRATEGIC",
];

export function SettingsForm({ owner }: { owner: OwnerProfile }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [accentColor, setAccentColor] = useState("#6366f1");
  const [backgroundStyle, setBackgroundStyle] = useState<BackgroundStyle>("none");
  const [backgroundBlur, setBackgroundBlur] = useState(0);
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

  useEffect(() => {
    setMounted(true);
    const savedAccent = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (savedAccent) {
      setAccentColor(savedAccent);
      applyAccentColor(savedAccent);
    }

    const savedBackground = localStorage.getItem(BACKGROUND_STORAGE_KEY) as
      | BackgroundStyle
      | null;
    if (savedBackground) {
      setBackgroundStyle(savedBackground);
      applyBackgroundStyle(savedBackground);
    } else {
      applyBackgroundStyle("none");
    }

    const savedBlur = localStorage.getItem(BACKGROUND_BLUR_STORAGE_KEY);
    if (savedBlur) {
      const value = Number(savedBlur);
      if (!Number.isNaN(value)) {
        setBackgroundBlur(value);
        applyBackgroundBlur(value);
      }
    } else {
      applyBackgroundBlur(0);
    }
  }, []);

  function handleAccentChange(nextColor: string) {
    setAccentColor(nextColor);
    localStorage.setItem(ACCENT_STORAGE_KEY, nextColor);
    applyAccentColor(nextColor);
  }

  function handleBackgroundChange(nextStyle: BackgroundStyle) {
    setBackgroundStyle(nextStyle);
    localStorage.setItem(BACKGROUND_STORAGE_KEY, nextStyle);
    applyBackgroundStyle(nextStyle);
  }

  function handleBackgroundBlurChange(nextBlur: number) {
    setBackgroundBlur(nextBlur);
    localStorage.setItem(BACKGROUND_BLUR_STORAGE_KEY, String(nextBlur));
    applyBackgroundBlur(nextBlur);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Website theme</Label>
            <select
              className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              value={mounted ? theme ?? "system" : "system"}
              onChange={(e) => setTheme(e.target.value)}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <div>
            <Label>Primary color</Label>
            <div className="mt-2 flex items-center gap-3">
              <Input
                type="color"
                value={accentColor}
                onChange={(e) => handleAccentChange(e.target.value)}
                className="h-10 w-16 p-1"
              />
              <Input
                value={accentColor}
                onChange={(e) => handleAccentChange(e.target.value)}
                className="w-36 uppercase"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {ACCENT_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Use accent ${color}`}
                  className="h-6 w-6 rounded-full border"
                  style={{ backgroundColor: color }}
                  onClick={() => handleAccentChange(color)}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Appearance updates instantly and is saved on this device.
            </p>
          </div>
          <div>
            <Label>Background style</Label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {BACKGROUND_STYLES.map((style) => (
                <Button
                  key={style.id}
                  type="button"
                  variant={backgroundStyle === style.id ? "default" : "outline"}
                  onClick={() => handleBackgroundChange(style.id)}
                  className="justify-start"
                >
                  {style.label}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label htmlFor="background-blur">Background blur</Label>
              <span className="text-xs text-muted-foreground">
                {backgroundBlur}px
              </span>
            </div>
            <Input
              id="background-blur"
              type="range"
              min={0}
              max={12}
              step={1}
              value={backgroundBlur}
              onChange={(e) =>
                handleBackgroundBlurChange(Number(e.target.value))
              }
            />
          </div>
        </CardContent>
      </Card>

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
    </div>
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
