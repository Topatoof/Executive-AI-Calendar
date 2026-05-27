export function parseModelJson<T = unknown>(raw: string): T {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = normalizeJsonLike(fenced?.[1] ?? trimmed);

  try {
    return JSON.parse(candidate) as T;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(normalizeJsonLike(candidate.slice(start, end + 1))) as T;
    }
    throw new Error("Model did not return valid JSON");
  }
}

function normalizeJsonLike(value: string): string {
  return value
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/,\s*([}\]])/g, "$1");
}
