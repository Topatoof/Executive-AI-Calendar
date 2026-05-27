"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  LayoutDashboard,
  Brain,
  CalendarDays,
  Calendar,
  FolderKanban,
  BarChart3,
  Settings,
} from "lucide-react";

const commands = [
  { href: "/dashboard", label: "Go to Dashboard", icon: LayoutDashboard },
  { href: "/brain-dump", label: "New Brain Dump", icon: Brain },
  { href: "/planner", label: "Open Planner", icon: CalendarDays },
  { href: "/calendar", label: "Open Calendar", icon: Calendar },
  { href: "/projects", label: "View Projects", icon: FolderKanban },
  { href: "/analytics", label: "View Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [toggle]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command Menu"
      className="fixed inset-0 z-50"
    >
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => setOpen(false)}
      />
      <div className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border bg-card shadow-2xl">
        <Command.Input
          placeholder="Type a command..."
          className="w-full border-b bg-transparent px-4 py-3 text-sm outline-none"
        />
        <Command.List className="max-h-72 overflow-y-auto p-2">
          <Command.Empty className="px-4 py-6 text-sm text-muted-foreground">
            No results found.
          </Command.Empty>
          {commands.map((cmd) => (
            <Command.Item
              key={cmd.href}
              value={cmd.label}
              onSelect={() => {
                router.push(cmd.href);
                setOpen(false);
              }}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm aria-selected:bg-accent"
            >
              <cmd.icon className="h-4 w-4" />
              {cmd.label}
            </Command.Item>
          ))}
        </Command.List>
      </div>
    </Command.Dialog>
  );
}
