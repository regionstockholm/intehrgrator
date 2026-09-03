import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { dirname, fromFileUrl, join } from "@std/path";
import { WorkbenchController } from "@intehrgrator/workbench/controller.ts";
import {
  parseExampleSetCatalog,
  resolveCatalogUri,
} from "@intehrgrator/core/example_sets/mod.ts";
import type { HostAdapter } from "@intehrgrator/host/mod.ts";
import type { LoadableProjectEntry, StoredProjectRecord } from "@intehrgrator/core/persistence/mod.ts";

const root = join(dirname(fromFileUrl(import.meta.url)), "..");
const examplesDir = join(root, "examples");
const catalogBase = "https://app.test/examples/example-sets.json";

function stubHost(overrides: Partial<HostAdapter> = {}): HostAdapter {
  return {
    pickTextFile: () => Promise.resolve(null),
    pickTextFilesFromDirectory: () => Promise.resolve(null),
    pickBinaryFile: () => Promise.resolve(null),
    downloadText: () => {},
    downloadBytes: () => {},
    copyToClipboard: () => Promise.resolve(),
    readClipboard: () => Promise.resolve(""),
    saveAutosave: () => Promise.resolve(),
    saveManualSave: () => Promise.resolve(),
    loadStoredProjectRecord: () => Promise.resolve(null as StoredProjectRecord | null),
    listLoadableProjects: () => Promise.resolve([] as LoadableProjectEntry[]),
    resolveAppUrl: (path) => `https://app.test/${path}`,
    fetchTextUrl: () => Promise.reject(new Error("fetchTextUrl not stubbed")),
    ...overrides,
  };
}

async function readExample(rel: string): Promise<string> {
  return await Deno.readTextFile(join(examplesDir, rel));
}

async function dummyFiles(): Promise<Record<string, { name: string; text: string }>> {
  const files: Record<string, { name: string; text: string }> = {
    [catalogBase]: {
      name: "example-sets.json",
      text: await readExample("example-sets.json"),
    },
  };
  const parts = [
    "dummy-json-vitals/source.schema.json",
    "dummy-json-vitals/instance-1.json",
    "dummy-json-vitals/instance-2.json",
    "dummy-json-vitals/target.schema.json",
    "dummy-json-vitals/mapping.blockly.json",
    "dummy-json-vitals/defaults.map.json",
    "patient-reported-chemotherapy-symptoms/mapping/mapping.blockly.json",
    "patient-reported-chemotherapy-symptoms/defaults.map.json",
    "patient-reported-chemotherapy-symptoms/source-instance/1. Ex.composition.txt",
    "patient-reported-chemotherapy-symptoms/source-instance/2. Ex.composition (Empty).txt",
    "patient-reported-chemotherapy-symptoms/source-instance/3. Ex.composition (Full).txt",
    "patient-reported-chemotherapy-symptoms/source-instance/4. Ex.composition.txt",
    "patient-reported-chemotherapy-symptoms/source-instance/5. Ex.composition.txt",
  ];
  for (const part of parts) {
    const url = new URL(part, "https://app.test/examples/").href;
    files[url] = { name: part.split("/").pop()!, text: await readExample(part) };
  }
  return files;
}

Deno.test("parseExampleSetCatalog resolves relative URIs against the catalog URL", async () => {
  const text = await readExample("example-sets.json");
  const catalog = parseExampleSetCatalog(text, catalogBase);
  assertEquals(catalog.sets.length, 4);
  const vitals = catalog.sets[0]!;
  assertEquals(vitals.id, "dummy-json-vitals");
  assertEquals(vitals.mapping, undefined);
  assertEquals(vitals.defaults, undefined);
  assertEquals(
    vitals.source.schema,
    "https://app.test/examples/dummy-json-vitals/source.schema.json",
  );
  assertEquals(vitals.source.instances.length, 2);
  const mapped = catalog.sets[1]!;
  assertEquals(
    mapped.mapping,
    "https://app.test/examples/dummy-json-vitals/mapping.blockly.json",
  );
  assertEquals(
    mapped.defaults,
    "https://app.test/examples/dummy-json-vitals/defaults.map.json",
  );
  const chemo = catalog.sets.find((set) => set.id === "chemo-symptoms-flat-to-tc-xml");
  if (!chemo) throw new Error("expected chemo example set");
  assertEquals(chemo.source.schema, undefined);
  assertEquals(chemo.target, undefined);
  assertEquals(chemo.source.instances.length, 5);
  assertEquals(
    chemo.mapping,
    "https://app.test/examples/patient-reported-chemotherapy-symptoms/mapping/mapping.blockly.json",
  );
});

Deno.test("parseExampleSetCatalog rejects a missing sets array", () => {
  try {
    parseExampleSetCatalog(JSON.stringify({ version: 1 }), catalogBase);
    throw new Error("expected parse to throw");
  } catch (err) {
    assertStringIncludes(err instanceof Error ? err.message : String(err), "sets");
  }
});

Deno.test("resolveCatalogUri keeps absolute https URIs", () => {
  assertEquals(
    resolveCatalogUri("https://example.test/schema.json", catalogBase),
    "https://example.test/schema.json",
  );
});

Deno.test("controller loads a dummy example set from catalog URIs", async () => {
  const files = await dummyFiles();
  const requested: string[] = [];
  const controller = new WorkbenchController(stubHost({
    fetchTextUrl: (url) => {
      requested.push(url);
      const file = files[url];
      if (!file) return Promise.reject(new Error(`unexpected url ${url}`));
      return Promise.resolve(file);
    },
  }));

  const catalog = await controller.loadExampleSetCatalog();
  assertEquals(catalog.sets[0]?.id, "dummy-json-vitals");
  await controller.loadExampleSet(catalog.sets[0]!);

  const state = controller.getState();
  assertEquals(state.schemaError, null);
  assertEquals(state.schemaFilename, "source.schema.json");
  assertEquals(state.examples.length, 2);
  assertEquals(state.activeExample?.filename, "instance-1.json");
  assertStringIncludes(state.statusMessage, "Dummy vitals");
  assertEquals(requested[0], catalogBase);
});

Deno.test("controller loads optional Blockly mapping from the catalog", async () => {
  const files = await dummyFiles();
  const controller = new WorkbenchController(stubHost({
    fetchTextUrl: (url) => {
      const file = files[url];
      if (!file) return Promise.reject(new Error(`unexpected url ${url}`));
      return Promise.resolve(file);
    },
  }));

  const catalog = await controller.loadExampleSetCatalog(catalogBase);
  const mapped = catalog.sets.find((set) => set.id === "dummy-json-vitals-mapped");
  if (!mapped) throw new Error("expected mapped dummy set");
  await controller.loadExampleSet(mapped);
  const state = controller.getState();
  assertEquals(state.examples.length, 1);
  assertEquals(state.blocklyState && typeof state.blocklyState, "object");
  const queued = controller.consumePendingDefaultsMap();
  assertEquals(queued && typeof queued, "object");
  assertEquals((queued as { type?: string }).type, "maps_create_with");
});

Deno.test("controller loads chemo FLAT example set without schema or target", async () => {
  const files = await dummyFiles();
  const controller = new WorkbenchController(stubHost({
    fetchTextUrl: (url) => {
      const file = files[url];
      if (!file) return Promise.reject(new Error(`unexpected url ${url}`));
      return Promise.resolve(file);
    },
  }));

  const catalog = await controller.loadExampleSetCatalog(catalogBase);
  const chemo = catalog.sets.find((set) => set.id === "chemo-symptoms-flat-to-tc-xml");
  if (!chemo) throw new Error("expected chemo example set");
  await controller.loadExampleSet(chemo);
  const state = controller.getState();
  assertEquals(state.examples.length, 5);
  assertEquals(state.blocklyState && typeof state.blocklyState, "object");
  const queued = controller.consumePendingDefaultsMap();
  assertEquals(queued && typeof queued, "object");
});

Deno.test("controller surfaces catalog fetch failure", async () => {
  const controller = new WorkbenchController(stubHost({
    fetchTextUrl: () => Promise.reject(new Error("HTTP 404")),
  }));
  await assertRejects(
    () => controller.loadExampleSetCatalog("https://example.test/missing.json"),
    Error,
    "404",
  );
  assertStringIncludes(controller.getState().statusMessage, "404");
});
