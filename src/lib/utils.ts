import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatRemainingMs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s left`;
  }
  return `${seconds}s left`;
}

export function priorityLabel(score: number): string {
  if (score >= 8) return "Critical";
  if (score >= 6) return "High";
  if (score >= 4) return "Medium";
  return "Low";
}
