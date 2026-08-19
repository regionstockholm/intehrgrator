export type UrlHistoryKind = "schema" | "example" | "target";

export type UrlHistorySnapshot = Record<UrlHistoryKind, string[]>;

const HISTORY_KINDS: UrlHistoryKind[] = ["schema", "example", "target"];

const STORAGE_PREFIX = "intehrgrator:url-history:";
const MAX_ENTRIES = 15;

export function urlHistoryKey(kind: UrlHistoryKind): string {
  return `${STORAGE_PREFIX}${kind}`;
}

export function listUrlHistory(kind: UrlHistoryKind, storage: Storage): string[] {
  try {
    const raw = storage.getItem(urlHistoryKey(kind));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return [];
  }
}

/** Most-recent-first. Existing entries are moved to the front. */
export function rememberUrl(kind: UrlHistoryKind, url: string, storage: Storage): void {
  const trimmed = url.trim();
  if (!trimmed) return;
  const next = [trimmed, ...listUrlHistory(kind, storage).filter((item) => item !== trimmed)]
    .slice(0, MAX_ENTRIES);
  write(kind, next, storage);
}

export function forgetUrl(kind: UrlHistoryKind, url: string, storage: Storage): void {
  write(kind, listUrlHistory(kind, storage).filter((item) => item !== url), storage);
}

export function replaceUrlHistory(kind: UrlHistoryKind, urls: string[], storage: Storage): void {
  const next = urls.filter((item) => typeof item === "string" && item.trim().length > 0)
    .slice(0, MAX_ENTRIES);
  write(kind, next, storage);
}

export function snapshotUrlHistory(storage: Storage): UrlHistorySnapshot {
  return {
    schema: listUrlHistory("schema", storage),
    example: listUrlHistory("example", storage),
    target: listUrlHistory("target", storage),
  };
}

export function restoreUrlHistory(snapshot: UrlHistorySnapshot | undefined, storage: Storage): void {
  if (!snapshot) return;
  for (const kind of HISTORY_KINDS) {
    replaceUrlHistory(kind, snapshot[kind] ?? [], storage);
  }
}

function write(kind: UrlHistoryKind, urls: string[], storage: Storage): void {
  try {
    storage.setItem(urlHistoryKey(kind), JSON.stringify(urls));
  } catch {
    // quota / private mode
  }
}
