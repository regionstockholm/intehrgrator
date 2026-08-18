import { assertEquals } from "@std/assert";
import {
  forgetUrl,
  listUrlHistory,
  rememberUrl,
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

Deno.test("forgetUrl removes one history entry", () => {
  const storage = memoryStorage();
  rememberUrl("target", "https://example.test/one.opt", storage);
  rememberUrl("target", "https://example.test/two.opt", storage);
  forgetUrl("target", "https://example.test/one.opt", storage);
  assertEquals(listUrlHistory("target", storage), ["https://example.test/two.opt"]);
  storage.removeItem(urlHistoryKey("target"));
  assertEquals(listUrlHistory("target", storage), []);
});
