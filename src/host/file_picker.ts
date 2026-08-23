import type { UrlHistoryKind } from "./url_history.ts";

/** Distinct remembered folders for file pickers (schema vs examples vs target). */
export type FilePickerKind = UrlHistoryKind | "project" | "mapping";

export function filePickerId(kind?: FilePickerKind): string | undefined {
  return kind ? `intehrgrator-${kind}` : undefined;
}

/** File extensions from an `<input accept>` string (ignores MIME types). */
export function acceptToExtensions(accept?: string): string[] {
  if (!accept) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of accept.split(",")) {
    const token = part.trim().toLowerCase();
    if (!token.startsWith(".")) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

export function acceptToPickerTypes(
  accept?: string,
): Array<{ description?: string; accept: Record<string, string[]> }> | undefined {
  const extensions = acceptToExtensions(accept);
  if (!extensions.length) return undefined;
  return [{
    description: "Supported files",
    accept: { "application/octet-stream": extensions },
  }];
}

export function acceptToVscodeFilters(accept?: string): Record<string, string[]> | undefined {
  const extensions = acceptToExtensions(accept).map((ext) => ext.slice(1));
  if (!extensions.length) return undefined;
  return { "Supported files": extensions };
}
