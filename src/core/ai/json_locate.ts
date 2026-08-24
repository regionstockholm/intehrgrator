/**
 * Find a JSON Pointer / JSON-path span in source text so the import dialog
 * can highlight the failing property.
 */

export function jsonPathToPointer(path: string): string {
  if (!path || path === "$") return "";
  const trimmed = path.startsWith("$") ? path.slice(1) : path;
  const segments: string[] = [];
  let i = 0;
  while (i < trimmed.length) {
    const ch = trimmed[i];
    if (ch === "." || ch === "/") {
      i++;
      continue;
    }
    if (ch === "[") {
      const close = trimmed.indexOf("]", i + 1);
      if (close < 0) break;
      segments.push(trimmed.slice(i + 1, close));
      i = close + 1;
      continue;
    }
    let end = i;
    while (end < trimmed.length && !".[/".includes(trimmed[end]!)) end++;
    if (end > i) segments.push(trimmed.slice(i, end));
    i = end;
  }
  return segments.map((s) => `/${s.replace(/~/g, "~0").replace(/\//g, "~1")}`).join("");
}

export function jsonPointerToDotPath(pointer: string): string {
  const raw = pointer.startsWith("#") ? pointer.slice(1) : pointer;
  if (!raw || raw === "/") return "$";
  let path = "$";
  for (const segment of raw.split("/").slice(1)) {
    const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");
    if (/^\d+$/.test(key)) path += `[${key}]`;
    else path += `.${key}`;
  }
  return path;
}

/** Locate the JSON object/array region inside raw paste (fence or whole text). */
export function jsonBodySpan(text: string): { start: number; text: string } | null {
  const tagged = /```intehrgrator-suggestions\s*/.exec(text);
  if (tagged) {
    const start = tagged.index + tagged[0].length;
    const endFence = text.indexOf("```", start);
    const body = (endFence >= 0 ? text.slice(start, endFence) : text.slice(start)).trim();
    const rel = text.indexOf(body, start);
    return rel >= 0 ? { start: rel, text: body } : { start, text: body };
  }
  const jsonFence = /```json\s*/.exec(text);
  if (jsonFence) {
    const start = jsonFence.index + jsonFence[0].length;
    const endFence = text.indexOf("```", start);
    const body = (endFence >= 0 ? text.slice(start, endFence) : text.slice(start)).trim();
    const rel = text.indexOf(body, start);
    return rel >= 0 ? { start: rel, text: body } : { start, text: body };
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return { start: first, text: text.slice(first, last + 1) };
  }
  return null;
}

/**
 * Highlight a schema issue in pasted JSON. Prefers a quoted token from the
 * message (unexpected key / invalid enum value), then the last path segment.
 */
export function locateIssueInText(
  source: string,
  path: string,
  message: string,
): { start: number; end: number } | null {
  const body = jsonBodySpan(source);
  const haystack = body?.text ?? source;
  const offset = body?.start ?? 0;

  const quoted = [...message.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
  for (const token of quoted) {
    if (token.length < 2) continue;
    const needle = JSON.stringify(token);
    const idx = haystack.indexOf(needle);
    if (idx >= 0) {
      return { start: offset + idx, end: offset + idx + needle.length };
    }
  }

  const last = path.split(/[.[\]]+/).filter((s) => s && s !== "$").pop();
  if (last && !/^\d+$/.test(last)) {
    const needle = JSON.stringify(last);
    const idx = haystack.indexOf(needle);
    if (idx >= 0) {
      return { start: offset + idx, end: offset + idx + needle.length };
    }
  }
  if (body) return { start: body.start, end: body.start + body.text.length };
  return null;
}
