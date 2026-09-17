/**
 * JSON Pointer (RFC 6901) helpers for JSON Schema `$ref` and validator paths.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Decode one JSON Pointer token (`~1` → `/`, `%24` → `$`). */
export function unescapeJsonPointerSegment(segment: string): string {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // already decoded or malformed — keep the raw segment
  }
  return decoded.replace(/~1/g, "/").replace(/~0/g, "~");
}

/**
 * Resolve an in-document JSON Schema `$ref` (`#/$defs/Name`, `#/definitions/Foo`).
 * External URIs (anything before `#`) are not fetched.
 */
export function resolveJsonPointer(document: unknown, ref: string): unknown {
  const hash = ref.indexOf("#");
  if (hash > 0) return undefined;
  if (hash === -1) return undefined;
  const fragment = ref.slice(hash + 1);
  if (fragment === "" || fragment === "/") return document;
  if (!fragment.startsWith("/")) return undefined;
  let current: unknown = document;
  for (const raw of fragment.split("/").slice(1)) {
    const key = unescapeJsonPointerSegment(raw);
    if (Array.isArray(current)) {
      const index = Number(key);
      if (!Number.isInteger(index) || String(index) !== key) return undefined;
      if (index < 0 || index >= current.length) return undefined;
      current = current[index];
    } else if (isRecord(current) && Object.hasOwn(current, key)) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  return current;
}
