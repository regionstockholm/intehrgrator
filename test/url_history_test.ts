import { assertEquals } from "@std/assert";
import {
  forgetUrl,
  listUrlHistory,
  rememberUrl,
  restoreUrlHistory,
  snapshotUrlHistory,
  urlHistoryKey,
} from "@intehrgrator/host/url_history.ts";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key) {
      return map.get(key) ?? null;
    },
    key(index) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key) {
      map.delete(key);
    },
    setItem(key, value) {
      map.set(key, value);
    },
  };
}

Deno.test("rememberUrl stores most-recent-first and moves duplicates to front", () => {
  const storage = memoryStorage();
  rememberUrl("schema", "https://example.test/a.json", storage);
  rememberUrl("schema", "https://example.test/b.json", storage);
  rememberUrl("schema", "https://example.test/a.json", storage);
  assertEquals(listUrlHistory("schema", storage), [
    "https://example.test/a.json",
    "https://example.test/b.json",
  ]);
  assertEquals(listUrlHistory("example", storage), []);
});

Deno.test("schema, example, and target URL histories stay isolated", () => {
  const storage = memoryStorage();
  rememberUrl("schema", "https://example.test/schema.json", storage);
  rememberUrl("example", "https://example.test/instance.json", storage);
  rememberUrl("target", "https://example.test/bp.opt", storage);
  assertEquals(listUrlHistory("schema", storage), ["https://example.test/schema.json"]);
  assertEquals(listUrlHistory("example", storage), ["https://example.test/instance.json"]);
  assertEquals(listUrlHistory("target", storage), ["https://example.test/bp.opt"]);
});

Deno.test("forgetUrl removes one history entry", () => {
  const storage = memoryStorage();
  rememberUrl("target", "https://example.test/one.opt", storage);
  rememberUrl("target", "https://example.test/two.opt", storage);
  forgetUrl("target", "https://example.test/one.opt", storage);
  assertEquals(listUrlHistory("target", storage), ["https://example.test/two.opt"]);
  storage.removeItem(urlHistoryKey("target"));
  assertEquals(listUrlHistory("target", storage), []);
});

Deno.test("snapshot and restore round-trip URL histories used in project bundles", () => {
  const storage = memoryStorage();
  rememberUrl("schema", "https://github.com/org/repo/blob/main/a.t.json", storage);
  rememberUrl("target", "https://example.test/bp.opt", storage);
  const snap = snapshotUrlHistory(storage);
  const other = memoryStorage();
  restoreUrlHistory(snap, other);
  assertEquals(listUrlHistory("schema", other), [
    "https://github.com/org/repo/blob/main/a.t.json",
  ]);
  assertEquals(listUrlHistory("target", other), ["https://example.test/bp.opt"]);
  assertEquals(listUrlHistory("example", other), []);
});
