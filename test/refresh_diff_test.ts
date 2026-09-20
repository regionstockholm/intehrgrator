import { assertEquals, assert } from "@std/assert";
import {
  buildRefreshMergePrompt,
  diffSourceRefresh,
  diffTargetRefresh,
  formatRefreshReport,
  mappedSourcePathsFromExpressions,
} from "@intehrgrator/core/target/refresh_diff.ts";
import type { SchemaTreeNode, SkeletonNode } from "@intehrgrator/types/mod.ts";

function slot(
  slotId: string,
  rmType: string,
  mandatory = true,
): SkeletonNode {
  return {
    slotId,
    blockType: "element",
    rmType,
    label: slotId,
    kind: "value",
    mandatory,
    children: [],
  };
}

Deno.test("target refresh warns when a mapped slot disappears and keeps new-mandatory notes", () => {
  const previous: SkeletonNode[] = [
    slot("comp/language", "CODE_PHRASE"),
    slot("comp/systolic", "DV_QUANTITY"),
  ];
  const next: SkeletonNode[] = [
    slot("comp/language", "DV_TEXT"),
    slot("comp/diastolic", "DV_QUANTITY"),
  ];
  const report = diffTargetRefresh({
    previousSkeleton: previous,
    nextSkeleton: next,
    mappedSlotIds: ["comp/language", "comp/systolic"],
    previousFilename: "old.opt",
    nextFilename: "new.opt",
  });
  assertEquals(report.kind, "target");
  assertEquals(report.warnings.map((w) => w.kind).sort(), ["new-slot", "removed-slot", "type-change"]);
  assert(report.warnings.some((w) => w.path === "comp/systolic" && w.kind === "removed-slot"));
  assert(report.warnings.some((w) => w.path === "comp/language" && w.kind === "type-change"));
  assert(report.warnings.some((w) => w.path === "comp/diastolic" && w.kind === "new-slot"));
});

Deno.test("source refresh warns on mapped paths that left the schema", () => {
  const previous: SchemaTreeNode = {
    name: "root",
    path: "$",
    type: "object",
    children: [
      { name: "systolic", path: "$.systolic", type: "number", children: [] },
      { name: "gone", path: "$.gone", type: "string", children: [] },
    ],
  };
  const next: SchemaTreeNode = {
    name: "root",
    path: "$",
    type: "object",
    children: [
      { name: "systolic", path: "$.systolic", type: "number", children: [] },
      { name: "pulse", path: "$.pulse", type: "number", children: [] },
    ],
  };
  const report = diffSourceRefresh({
    previousTree: previous,
    nextTree: next,
    mappedPaths: ["$.systolic", "$.gone"],
    previousFilename: "old.json",
    nextFilename: "new.json",
  });
  assertEquals(report.kind, "source");
  assert(report.warnings.some((w) => w.kind === "removed-path" && w.path === "$.gone"));
  assert(report.warnings.some((w) => w.kind === "new-path" && w.path === "$.pulse"));
  assertEquals(report.warnings.some((w) => w.path === "$.systolic"), false);
});

Deno.test("source refresh treats JSON root $ as not covering child paths", () => {
  const previous: SchemaTreeNode = {
    name: "root",
    path: "$",
    type: "object",
    children: [{ name: "gone", path: "$.gone", type: "string", children: [] }],
  };
  const next: SchemaTreeNode = {
    name: "root",
    path: "$",
    type: "object",
    children: [{ name: "pulse", path: "$.pulse", type: "number", children: [] }],
  };
  const report = diffSourceRefresh({
    previousTree: previous,
    nextTree: next,
    mappedPaths: ["$.gone"],
    previousFilename: "old.json",
    nextFilename: "new.json",
  });
  assert(report.warnings.some((w) => w.kind === "removed-path" && w.path === "$.gone"));
  assertEquals(report.warnings.some((w) => w.path === "$"), false);
});

Deno.test("mappedSourcePathsFromExpressions pulls quoted paths", () => {
  assertEquals(
    mappedSourcePathsFromExpressions(['xpathNumber("$.systolic")', "maps_get(\"defaults\", \"language\")"]),
    ["$.systolic"],
  );
});

Deno.test("refresh merge prompt names both files and asks for suggestions JSON", () => {
  const report = diffTargetRefresh({
    previousSkeleton: [slot("a", "DV_TEXT")],
    nextSkeleton: [],
    mappedSlotIds: ["a"],
    previousFilename: "a.opt",
    nextFilename: "b.opt",
    previousContent: "<old/>",
    nextContent: "<new/>",
  });
  const prompt = buildRefreshMergePrompt(report);
  assert(prompt.includes("a.opt"));
  assert(prompt.includes("b.opt"));
  assert(prompt.includes("intehrgrator-suggestions"));
  assert(prompt.includes("<old/>"));
  assertEquals(formatRefreshReport(report).includes("warning"), true);
});
