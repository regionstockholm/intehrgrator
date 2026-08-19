import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { WorkbenchController } from "@intehrgrator/workbench/controller.ts";
import type { HostAdapter, PickedTextFile } from "@intehrgrator/host/mod.ts";
import type { LoadableProjectEntry, StoredProjectRecord } from "@intehrgrator/core/persistence/mod.ts";
import { mockGithubFetch } from "./github_mock.ts";

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

function stubHost(overrides: Partial<HostAdapter> = {}): HostAdapter {
  return {
    pickTextFile: async () => null,
    pickTextFilesFromDirectory: async () => null,
    pickBinaryFile: async () => null,
    downloadText: () => {},
    downloadBytes: () => {},
    copyToClipboard: async () => {},
    readClipboard: async () => "",
    saveAutosave: async () => {},
    saveManualSave: async () => {},
    loadStoredProjectRecord: async () => null as StoredProjectRecord | null,
    listLoadableProjects: async () => [] as LoadableProjectEntry[],
    resolveAppUrl: (path) => path,
    fetchTextUrl: () => Promise.reject(new Error("fetchTextUrl not stubbed")),
    ...overrides,
  };
}

Deno.test("addExamplesFromLocalDirectory loads every JSON/XML file from a folder", async () => {
  const files: PickedTextFile[] = [
    { name: "a.json", text: '{"a":1}' },
    { name: "b.xml", text: "<x/>" },
  ];
  const host = stubHost({
    pickTextFilesFromDirectory: async () => files,
  });
  const controller = new WorkbenchController(host);
  await controller.addExamplesFromLocalDirectory();
  assertEquals(controller.getState().examples.length, 2);
  assertStringIncludes(controller.getState().statusMessage, "Added 2 examples");
});

Deno.test("addExamplesFromGitHubDirectory bulk-loads instances and remembers URL", async () => {
  const downloads: Record<string, string> = {
    "cases/one.json": '{"one":1}',
    "cases/two.json": '{"two":2}',
  };
  const host = stubHost();
  const storage = memoryStorage();
  const controller = new WorkbenchController(host, {
    urlStorage: storage,
    githubFetch: mockGithubFetch(downloads),
  });
  const url = "https://github.com/org/repo/tree/main/cases";
  await controller.addExamplesFromGitHubDirectory(url);
  assertEquals(controller.getState().examples.length, 2);
  assertEquals(controller.getState().urlHistory?.example.includes(url), true);
});

Deno.test("exportMappingSpec downloads projected spec text", () => {
  let downloaded = "";
  const host = stubHost({
    downloadText: (_name, content) => {
      downloaded = content;
    },
  });
  const controller = new WorkbenchController(host);
  controller.exportMappingSpec();
  assertStringIncludes(downloaded, "Blockly projection");
  assertStringIncludes(downloaded, "empty workspace");
});
