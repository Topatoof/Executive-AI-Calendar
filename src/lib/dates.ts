import { isValid, parse, parseISO } from "date-fns";

const FALLBACK_FORMATS = [
  "yyyy-MM-dd",
  "yyyy-M-d",
  "M/d/yyyy",
  "MM/dd/yyyy",
  "MMMM d, yyyy",
  "MMMM d yyyy",
  "MMM d, yyyy",
  "MMM d yyyy",
] as const;

/** End of calendar day in the user's local timezone (avoids UTC date-only drift). */
function localEndOfDay(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

function parseYmdPrefix(
  value: string
): { year: number; month: number; day: number } | null {
  const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

/** Parse brain-dump / AI deadline strings; returns null if unparseable. */
export function parseDeadline(
  value: string | null | undefined
): Date | null {
  if (value == null) return null;

  const trimmed = String(value).trim();
  if (
    !trimmed ||
    trimmed.toLowerCase() === "null" ||
    trimmed.toLowerCase() === "undefined" ||
    trimmed.toLowerCase() === "invalid date"
  ) {
    return null;
  }

  const ymd = parseYmdPrefix(trimmed);
  if (ymd) {
    const local = localEndOfDay(ymd.year, ymd.month, ymd.day);
    if (isValid(local)) return local;
  }

  let parsed = parseISO(trimmed);
  if (isValid(parsed)) {
    return localEndOfDay(
      parsed.getFullYear(),
      parsed.getMonth() + 1,
      parsed.getDate()
    );
  }

  for (const fmt of FALLBACK_FORMATS) {
    parsed = parse(trimmed, fmt, new Date());
    if (isValid(parsed)) {
      return localEndOfDay(
        parsed.getFullYear(),
        parsed.getMonth() + 1,
        parsed.getDate()
      );
    }
  }

  const native = new Date(trimmed);
  if (isValid(native) && !Number.isNaN(native.getTime())) {
    return localEndOfDay(
      native.getFullYear(),
      native.getMonth() + 1,
      native.getDate()
    );
  }

  return null;
}

/** Canonical deadline string for JSON/storage (local calendar date). */
export function deadlineToIso(value: string | null | undefined): string | null {
  const parsed = parseDeadline(value);
  if (!parsed) return null;
  const y = parsed.getFullYear();
  const m = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const d = `${parsed.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDeadlineLabel(
  value: string | null | undefined
): string | null {
  const parsed = parseDeadline(value);
  if (!parsed) return null;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Value for `<input type="date">` in local calendar terms. */
export function formatDateInputValue(
  value: string | null | undefined
): string {
  const parsed = parseDeadline(value);
  if (!parsed) return "";
  const y = parsed.getFullYear();
  const m = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const d = `${parsed.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}
