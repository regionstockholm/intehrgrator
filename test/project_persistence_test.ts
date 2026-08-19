import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { WorkbenchController } from "@intehrgrator/workbench/controller.ts";
import type { HostAdapter } from "@intehrgrator/host/mod.ts";
import {
  AUTOSAVE_STORAGE_KEY,
  exportBundle,
  importBundle,
  type LoadableProjectEntry,
  type StoredProjectRecord,
} from "@intehrgrator/core/persistence/mod.ts";
import { rememberUrl } from "@intehrgrator/host/url_history.ts";
import type { ProjectBundle } from "@intehrgrator/types/mod.ts";

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

interface MemoryHost extends HostAdapter {
  saves: Map<string, StoredProjectRecord>;
  exported: { filename: string; bytes: Uint8Array } | null;
}

function memoryHost(overrides: Partial<HostAdapter> = {}): MemoryHost {
  const saves = new Map<string, StoredProjectRecord>();
  const host: MemoryHost = {
    saves,
    exported: null,
    pickTextFile: async () => null,
    pickTextFilesFromDirectory: async () => null,
    pickBinaryFile: async () => {
      if (!host.exported) return null;
      return { name: host.exported.filename, bytes: host.exported.bytes };
    },
    downloadText: () => {},
    downloadBytes: (filename, bytes) => {
      host.exported = { filename, bytes };
    },
    copyToClipboard: async () => {},
    readClipboard: async () => "",
    saveAutosave: async (bundle) => {
      saves.set(AUTOSAVE_STORAGE_KEY, {
        storageKey: AUTOSAVE_STORAGE_KEY,
        kind: "autosave",
        displayName: "Autosave",
        savedAt: new Date().toISOString(),
        bundle,
      });
    },
    saveManualSave: async (bundle, displayName) => {
      const storageKey = `manual:test`;
      saves.set(storageKey, {
        storageKey,
        kind: "manual",
        displayName,
        savedAt: new Date().toISOString(),
        bundle,
      });
    },
    loadStoredProjectRecord: async (storageKey) => saves.get(storageKey) ?? null,
    listLoadableProjects: async () => {
      const entries: LoadableProjectEntry[] = [];
      for (const record of saves.values()) {
        entries.push({
          storageKey: record.storageKey,
          kind: record.kind,
          displayName: record.displayName,
          savedAt: record.savedAt,
        });
      }
      return entries;
    },
    resolveAppUrl: (path) => path,
    fetchTextUrl: () => Promise.reject(new Error("fetchTextUrl not stubbed")),
    ...overrides,
  };
  return host;
}

async function loadBpWorkspace(controller: WorkbenchController): Promise<void> {
  const opt = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
  );
  const schema = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "ui", "bp_source_schema.json"),
  );
  const example = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "ui", "bp_example.json"),
  );
  controller.loadTemplateContent("blood_pressure.opt", opt);
  controller.loadSchemaContent("bp_source_schema.json", schema);
  controller.addExampleContent("bp_example.json", example);
}

Deno.test("autosave writes a distinct IndexedDB slot and clears dirty", async () => {
  const host = memoryHost();
  const storage = memoryStorage();
  const controller = new WorkbenchController(host, {
    urlStorage: storage,
    autosaveDebounceMs: 0,
  });
  await loadBpWorkspace(controller);
  assertEquals(controller.getSaveStatus().dirty, true);
  await controller.flushAutosave();
  assertEquals(controller.getSaveStatus().dirty, false);
  assert(controller.getSaveStatus().label.startsWith("autosaved at"));
  const record = host.saves.get(AUTOSAVE_STORAGE_KEY);
  assert(record, "autosave record should exist");
  assertEquals(record.kind, "autosave");
  assert(record.bundle.template?.templateId.includes("blood_pressure"));
  assertEquals(record.bundle.sourceSchema?.filename, "bp_source_schema.json");
  assertEquals(record.bundle.examples.length, 1);
});

Deno.test("Save as / Load Project round-trip restores workspace and URL history", async () => {
  const host = memoryHost();
  const storage = memoryStorage();
  const controller = new WorkbenchController(host, { urlStorage: storage });
  await loadBpWorkspace(controller);
  rememberUrl("schema", "https://example.test/schema.json", storage);
  rememberUrl("target", "https://github.com/org/repo/blob/main/bp.t.json", storage);
  rememberUrl("example", "https://example.test/inst.json", storage);

  await controller.saveProjectAs("BP mapping");
  assertEquals(controller.getSaveStatus().dirty, false);

  const entries = await controller.listLoadableProjects();
  const manual = entries.find((e) => e.kind === "manual");
  assert(manual);

  controller.newProject();
  assertEquals(controller.getState().templateId, "");
  assertEquals(controller.getState().schemaTree, null);

  await controller.loadStoredProject(manual.storageKey);
  const restored = controller.getState();
  assert(restored.templateId.includes("blood_pressure"));
  assertEquals(restored.schemaFilename, "bp_source_schema.json");
  assertEquals(restored.examples.length, 1);
  assertEquals(restored.urlHistory.schema, ["https://example.test/schema.json"]);
  assertEquals(restored.urlHistory.target, [
    "https://github.com/org/repo/blob/main/bp.t.json",
  ]);
  assertEquals(restored.urlHistory.example, ["https://example.test/inst.json"]);
});

Deno.test("Export / Import Project round-trip includes URL history", async () => {
  const host = memoryHost();
  const storage = memoryStorage();
  const controller = new WorkbenchController(host, { urlStorage: storage });
  await loadBpWorkspace(controller);
  rememberUrl("schema", "https://example.test/from-github.t.json", storage);

  controller.exportProject();
  assert(host.exported);
  const bundle = importBundle(host.exported.bytes);
  assertEquals(bundle.urlHistory?.schema, ["https://example.test/from-github.t.json"]);

  controller.newProject();
  await controller.importProject();
  const state = controller.getState();
  assert(state.templateId.includes("blood_pressure"));
  assertEquals(state.urlHistory.schema, ["https://example.test/from-github.t.json"]);
  assertStringIncludes(state.statusMessage, "imported");
});

Deno.test("New Project clears workspace but exportBundle of a prior save stays intact", async () => {
  const host = memoryHost();
  const controller = new WorkbenchController(host, { autosaveDebounceMs: 0 });
  await loadBpWorkspace(controller);
  await controller.saveProjectAs("keep-me");
  const saved = host.saves.get("manual:test")!.bundle;

  controller.newProject();
  const empty = controller.getState();
  assertEquals(empty.templateId, "");
  assertEquals(empty.skeleton.length, 0);
  assertEquals(empty.examples.length, 0);
  assertEquals(empty.saveStatus.dirty, false);

  assert(saved.template?.content.includes("blood_pressure") || saved.template?.templateId);
  const roundTrip: ProjectBundle = importBundle(exportBundle(saved));
  assertEquals(roundTrip.projectId, saved.projectId);
});

Deno.test("URL load records GitHub template URLs into project-scoped history", async () => {
  const host = memoryHost({
    fetchTextUrl: async (url) => {
      const schema = await Deno.readTextFile(
        join(import.meta.dirname!, "fixtures", "ui", "bp_source_schema.json"),
      );
      return { name: "bp.json", text: schema };
    },
  });
  const storage = memoryStorage();
  const controller = new WorkbenchController(host, { urlStorage: storage });
  await controller.loadSchemaFromUrl("https://example.test/bp.json");
  assertEquals(controller.getState().urlHistory.schema, ["https://example.test/bp.json"]);
});
