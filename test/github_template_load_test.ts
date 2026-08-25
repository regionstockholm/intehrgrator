import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import {
  DEFAULT_GITHUB_TEMPLATE_URL,
  isGitHubClinicalModelUrl,
  loadGitHubClinicalModel,
} from "@intehrgrator/core/clinical_model/github_template.ts";
import { WorkbenchController } from "@intehrgrator/workbench/controller.ts";
import type { HostAdapter } from "@intehrgrator/host/mod.ts";
import type { LoadableProjectEntry, StoredProjectRecord } from "@intehrgrator/core/persistence/mod.ts";
import { mockGithubFetch } from "./github_mock.ts";

const EXAMPLES_VENDOR = join(
  import.meta.dirname!,
  "..",
  "vendor",
  "openEHR-model-examples",
);

async function mockSimpleDiagnoseGithubFetch(): Promise<typeof fetch> {
  const pack = "local/theme-packs/simple-diagnose-and-vitals";
  const tjsonPath = `${pack}/simple-diagnose-and-vitals.t.json`;
  const files: Record<string, string> = {
    [tjsonPath]: await Deno.readTextFile(join(EXAMPLES_VENDOR, pack, "simple-diagnose-and-vitals.t.json")),
  };
  const archetypesRoot = join(EXAMPLES_VENDOR, "local/archetypes");
  for await (const entry of Deno.readDir(archetypesRoot)) {
    if (entry.isDirectory) {
      await collectArchetypeFiles(join(archetypesRoot, entry.name), `local/archetypes/${entry.name}`, files);
    } else if (entry.name.endsWith(".adl") || entry.name.endsWith(".adls")) {
      files[`local/archetypes/${entry.name}`] = await Deno.readTextFile(
        join(archetypesRoot, entry.name),
      );
    }
  }
  return mockGithubFetch(files);
}

async function collectArchetypeFiles(
  dir: string,
  prefix: string,
  files: Record<string, string>,
): Promise<void> {
  for await (const entry of Deno.readDir(dir)) {
    const path = `${prefix}/${entry.name}`;
    if (entry.isDirectory) {
      await collectArchetypeFiles(join(dir, entry.name), path, files);
    } else if (entry.name.endsWith(".adl") || entry.name.endsWith(".adls")) {
      files[path] = await Deno.readTextFile(join(dir, entry.name));
    }
  }
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

Deno.test("isGitHubClinicalModelUrl accepts blob and raw .t.json / .opt links", () => {
  assertEquals(isGitHubClinicalModelUrl(DEFAULT_GITHUB_TEMPLATE_URL), true);
  assertEquals(
    isGitHubClinicalModelUrl(
      "https://raw.githubusercontent.com/org/repo/main/local/templates/bp.opt",
    ),
    true,
  );
  assertEquals(isGitHubClinicalModelUrl("https://example.test/bp.opt"), false);
  assertEquals(
    isGitHubClinicalModelUrl("https://github.com/org/repo/blob/main/README.md"),
    false,
  );
});

Deno.test("loadGitHubClinicalModel fetches an OPT from GitHub and builds a skeleton", async () => {
  const opt = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
  );
  const url = "https://github.com/org/repo/blob/main/templates/blood_pressure.opt";
  const loaded = await loadGitHubClinicalModel(url, {
    fetch: mockGithubFetch({ "templates/blood_pressure.opt": opt }),
  });
  assertEquals(loaded.fetched, 1);
  assertEquals(loaded.filename, "blood_pressure.opt");
  assert(loaded.templateId.includes("blood_pressure"));
  assert(loaded.skeleton.length > 0);
  assertStringIncludes(loaded.optXml, "template");
  assertEquals(loaded.fileset.files.some((f) => f.path.endsWith("blood_pressure.opt")), true);
  const wt = JSON.parse(loaded.webTemplateJson) as { templateId?: string; tree?: unknown };
  assert(wt.tree, "web template JSON should include a tree for schema load");
});

Deno.test("loadGitHubClinicalModel resolves differential .t.json overlay parent names", async () => {
  try {
    await Deno.stat(EXAMPLES_VENDOR);
  } catch {
    console.warn("skip: vendor/openEHR-model-examples missing (run deno task vendor)");
    return;
  }
  const url =
    "https://github.com/Ehrlibs/openEHR-model-examples/blob/main/local/theme-packs/simple-diagnose-and-vitals/simple-diagnose-and-vitals.t.json";
  const loaded = await loadGitHubClinicalModel(url, {
    fetch: await mockSimpleDiagnoseGithubFetch(),
  });
  assert(loaded.fetched > 1, "overlay parents should expand the GitHub closure");
  assertStringIncludes(loaded.filename, "simple-diagnose-and-vitals");
  const wt = JSON.parse(loaded.webTemplateJson) as {
    tree?: { rmType?: string; name?: string; children?: unknown[] };
  };
  assert(wt.tree, "expected web template tree");
  const names: string[] = [];
  const walk = (node: { name?: string; rmType?: string; children?: unknown[] }) => {
    if (node.name) names.push(node.name);
    for (const child of node.children ?? []) {
      walk(child as { name?: string; rmType?: string; children?: unknown[] });
    }
  };
  walk(wt.tree);
  assert(
    names.includes("Problem/Diagnosis"),
    `expected parent archetype ontology labels, got: ${names.slice(0, 12).join(", ")}`,
  );
  assert(
    !names.some((name) => /^at\d/.test(name)),
    "differential overlays should not collapse to bare at-codes when parents are fetched",
  );
});

Deno.test("controller openTemplateFromUrl uses GitHub clinical-model closure for .opt blob URLs", async () => {
  const opt = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
  );
  const url = "https://github.com/org/repo/blob/main/templates/blood_pressure.opt";
  const controller = new WorkbenchController(stubHost(), {
    githubFetch: mockGithubFetch({ "templates/blood_pressure.opt": opt }),
  });
  await controller.openTemplateFromUrl(url);
  const state = controller.getState();
  assert(state.templateId.includes("blood_pressure"));
  assert(state.skeleton.length > 0);
  assertStringIncludes(state.statusMessage, "GitHub template");
});

Deno.test("controller loadSchemaFromUrl uses GitHub clinical-model closure for schema", async () => {
  const opt = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
  );
  const url = "https://github.com/org/repo/blob/main/templates/blood_pressure.opt";
  const controller = new WorkbenchController(stubHost(), {
    githubFetch: mockGithubFetch({ "templates/blood_pressure.opt": opt }),
  });
  await controller.loadSchemaFromUrl(url);
  const state = controller.getState();
  assertEquals(state.schemaError, null);
  assert(state.schemaTree);
  assertEquals(state.schemaFormat, "openehr-web-template");
});
