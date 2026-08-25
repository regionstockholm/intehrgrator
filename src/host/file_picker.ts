import type { UrlHistoryKind } from "./url_history.ts";

/** Distinct remembered folders for file pickers (schema vs examples vs target). */
export type FilePickerKind = UrlHistoryKind | "project" | "mapping" | "defaults";

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

/**
 * Chromium `showOpenFilePicker` types: Windows IFileDialog unions the given
 * extensions with whatever the OS registered for the MIME key. Mapping
 * everything to `application/octet-stream` therefore also lists `.exe`,
 * `.com`, and `.bin`. Use real (or unregistered vendor) MIME types instead.
 *
 * FSA only allows a single suffix (`.json`, not `.blockly.json`).
 */
export function acceptToPickerTypes(
  accept?: string,
): Array<{ description?: string; accept: Record<string, string[]> }> | undefined {
  const grouped = new Map<string, string[]>();
  const seenExt = new Set<string>();
  for (const raw of acceptToExtensions(accept)) {
    const ext = fsaExtension(raw);
    if (!ext || seenExt.has(ext)) continue;
    seenExt.add(ext);
    const mime = mimeForFsaExtension(ext);
    const list = grouped.get(mime) ?? [];
    list.push(ext);
    grouped.set(mime, list);
  }
  if (!grouped.size) return undefined;
  return [{
    description: "Supported files",
    accept: Object.fromEntries(grouped),
  }];
}

/** Last `.suffix` only; must match Chromium's `/^\.[a-z0-9]+$/i` rule. */
function fsaExtension(ext: string): string | undefined {
  const lastDot = ext.lastIndexOf(".");
  if (lastDot < 0) return undefined;
  const simple = lastDot === 0 ? ext : ext.slice(lastDot);
  return /^\.[a-z0-9]+$/i.test(simple) ? simple.toLowerCase() : undefined;
}

function mimeForFsaExtension(ext: string): string {
  switch (ext) {
    case ".json":
      return "application/json";
    case ".xml":
    case ".xsd":
    case ".opt":
    case ".opt2":
      return "application/xml";
    case ".html":
      return "text/html";
    case ".csv":
      return "text/csv";
    case ".md":
      return "text/markdown";
    case ".txt":
    case ".adl":
    case ".adls":
      return "text/plain";
    case ".hbs":
    case ".handlebars":
      return "text/x-handlebars-template";
    case ".zip":
    case ".intehrgrator":
      return "application/zip";
    default:
      return "application/x-intehrgrator";
  }
}

export function acceptToVscodeFilters(accept?: string): Record<string, string[]> | undefined {
  const extensions = acceptToExtensions(accept).map((ext) => ext.slice(1));
  if (!extensions.length) return undefined;
  return { "Supported files": extensions };
}
