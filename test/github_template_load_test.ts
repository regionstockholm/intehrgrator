import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import {
  DEFAULT_GITHUB_TEMPLATE_URL,
  isGitHubClinicalModelUrl,
  loadGitHubClinicalModel,
} from "@intehrgrator/core/clinical_model/github_template.ts";
import { WorkbenchController } from "@intehrgrator/workbench/controller.ts";
import type { TaskProgress } from "@intehrgrator/workbench/task_progress.ts";
import type { HostAdapter } from "@intehrgrator/host/mod.ts";
import type { LoadableProjectEntry, StoredProjectRecord } from "@intehrgrator/core/persistence/mod.ts";
import { mockGithubFetch } from "./github_mock.ts";

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

function subscribeTaskProgress(controller: WorkbenchController): TaskProgress[] {
  const snapshots: TaskProgress[] = [];
  controller.subscribe(() => {
    const progress = controller.getState().taskProgress;
    if (progress) snapshots.push(structuredClone(progress));
  });
  return snapshots;
}

Deno.test("openTemplateFromUrl GitHub load reports parse/fetch/scaffold substeps", async () => {
  const opt = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
  );
  const url = "https://github.com/org/repo/blob/main/templates/blood_pressure.opt";
  const controller = new WorkbenchController(stubHost(), {
    githubFetch: mockGithubFetch({ "templates/blood_pressure.opt": opt }),
  });
  const snapshots = subscribeTaskProgress(controller);
  await controller.openTemplateFromUrl(url);
  assert(snapshots.length > 0, "expected taskProgress during GitHub template load");
  const ids = snapshots[0]!.steps.map((s) => s.id);
  for (const id of ["parse-url", "index-tree", "fetch", "parse", "resolve", "scaffold", "generate"]) {
    assert(ids.includes(id), ids.join(","));
  }
  assert(snapshots.some((p) => p.steps.some((s) => s.state === "waiting")));
  assert(snapshots.some((p) => p.steps.some((s) => s.state === "running")));
  assert(snapshots.some((p) => p.steps.some((s) => s.state === "finished")));
  assertEquals(controller.getState().taskProgress, null);
});

Deno.test("loadSchemaFromUrl GitHub load reports parse/analyse/scaffold substeps", async () => {
  const opt = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
  );
  const url = "https://github.com/org/repo/blob/main/templates/blood_pressure.opt";
  const controller = new WorkbenchController(stubHost(), {
    githubFetch: mockGithubFetch({ "templates/blood_pressure.opt": opt }),
  });
  const snapshots = subscribeTaskProgress(controller);
  await controller.loadSchemaFromUrl(url);
  assert(snapshots.length > 0, "expected taskProgress during GitHub schema load");
  const ids = snapshots[0]!.steps.map((s) => s.id);
  for (const id of ["parse-url", "index-tree", "fetch", "parse", "resolve", "scaffold"]) {
    assert(ids.includes(id), ids.join(","));
  }
  assertEquals(ids.includes("generate"), false);
  assert(snapshots.some((p) => p.steps.some((s) => s.state === "running")));
  assertEquals(controller.getState().taskProgress, null);
});
