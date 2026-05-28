"use client";

export const ACCENT_STORAGE_KEY = "exec-ai-accent-color";
export const BACKGROUND_STORAGE_KEY = "exec-ai-background-style";
export const BACKGROUND_BLUR_STORAGE_KEY = "exec-ai-background-blur";

export const ACCENT_PRESETS = [
  "#6366f1", // Indigo
  "#0ea5e9", // Sky
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#ec4899", // Pink
];

export const BACKGROUND_STYLES = [
  { id: "none", label: "None" },
  { id: "floral", label: "Floral Design" },
  { id: "watercolor", label: "Watercolor Paint" },
  { id: "geometric", label: "Geometric Pattern" },
] as const;

export type BackgroundStyle = (typeof BACKGROUND_STYLES)[number]["id"];

function hexToRgb(hex: string) {
  const cleaned = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  const int = parseInt(cleaned, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function getContrastForeground(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#ffffff";
  const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return yiq >= 150 ? "#111827" : "#ffffff";
}

export function applyAccentColor(hex: string) {
  if (typeof document === "undefined") return;
  const value = hex.startsWith("#") ? hex : `#${hex}`;
  document.documentElement.style.setProperty("--primary", value);
  document.documentElement.style.setProperty("--ring", value);
  document.documentElement.style.setProperty(
    "--primary-foreground",
    getContrastForeground(value)
  );
}

export function applyBackgroundStyle(style: BackgroundStyle) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-bg-style", style);
}

export function applyBackgroundBlur(blurPx: number) {
  if (typeof document === "undefined") return;
  const safe = Number.isFinite(blurPx) ? Math.max(0, Math.min(20, blurPx)) : 0;
  document.documentElement.style.setProperty("--app-bg-blur", `${safe}px`);
}
