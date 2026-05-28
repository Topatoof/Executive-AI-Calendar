"use client";

import { useEffect, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { CommandPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  ACCENT_STORAGE_KEY,
  BACKGROUND_BLUR_STORAGE_KEY,
  BACKGROUND_STORAGE_KEY,
  applyAccentColor,
  applyBackgroundBlur,
  applyBackgroundStyle,
  type BackgroundStyle,
} from "@/lib/theme";

export function AppShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    const savedAccent = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (savedAccent) applyAccentColor(savedAccent);

    const savedBackground = localStorage.getItem(BACKGROUND_STORAGE_KEY);
    applyBackgroundStyle((savedBackground as BackgroundStyle) || "none");

    const savedBlur = localStorage.getItem(BACKGROUND_BLUR_STORAGE_KEY);
    applyBackgroundBlur(savedBlur ? Number(savedBlur) : 0);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b px-6">
          <p className="text-sm text-muted-foreground">
            Execution over planning
          </p>
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
