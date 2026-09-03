/** Parse JSON that may be wrapped in a prose header (example .txt dumps). */
export function parseJsonDocument(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch (first) {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        throw first;
      }
    }
    throw first;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFlatBag(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Object.keys(value).some((key) =>
    key.includes("|") || key.startsWith("ctx/") || key.includes("/")
  );
}

/**
 * Production Go mappings execute `{ Parameters, Data }` where Data is openEHR FLAT.
 * Source queries use the FLAT keys, so unwrap that envelope when present.
 */
export function unwrapExecuteEnvelope(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.Data)) return value;
  if (isFlatBag(value.Data)) return value.Data;
  return value;
}

export function executeEnvelopeParameters(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value) || !isRecord(value.Parameters)) return undefined;
  if (!isRecord(value.Data) || !isFlatBag(value.Data)) return undefined;
  return value.Parameters;
}
