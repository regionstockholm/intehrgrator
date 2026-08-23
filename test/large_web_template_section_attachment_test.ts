import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import type { SkeletonNode } from "@intehrgrator/types/mod.ts";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import {
  loadSkeletonIntoWorkspace,
} from "@intehrgrator/blockly/skeleton_loader.ts";
import { registerRmBlocks } from "@intehrgrator/blockly/blocks/rm_blocks.ts";
import { registerExpressionBlocks } from "@intehrgrator/blockly/blocks/expression_blocks.ts";
import { generateSkeletonFromWebTemplate } from "@intehrgrator/core/skeleton/generate_skeleton.ts";

async function readWebTemplateText(path: string): Promise<string | null> {
  try {
    const txt = await Deno.readTextFile(path);
    const start = txt.indexOf("{");
    return start >= 0 ? txt.slice(start) : txt;
  } catch {
    return null;
  }
}

const bigWt = await (async () => {
  const candidates = [
    join(
      import.meta.dirname!,
      "..",
      "uploads",
      "Accident_report_including_vital_signs.sv.wt-0.json",
    ),
    join(
      import.meta.dirname!,
      "..",
      "vendor",
      "openEHR-model-examples",
      "local",
      "theme-packs",
      "sport-event-details",
      "templates",
      "Accident report including vital signs.sv.wt.json",
    ),
    "C:\\Users\\fbpf\\.cursor\\projects\\c-lokalt-dev-intehrgrator\\uploads\\Accident_report_including_vital_signs.sv.wt-0.json",
  ];
  for (const path of candidates) {
    const txt = await readWebTemplateText(path);
    if (txt) return txt;
  }
  return null;
})();

let blocksReady = false;
function ensureBlocks(): void {
  if (blocksReady) return;
  registerRmBlocks();
  registerExpressionBlocks();
  blocksReady = true;
}

function blockCountByType(nodes: SkeletonNode[]): Map<string, number> {
  const m = new Map<string, number>();
  const walk = (n: SkeletonNode) => {
    m.set(n.blockType, (m.get(n.blockType) ?? 0) + 1);
    for (const c of n.children) walk(c);
  };
  for (const n of nodes) walk(n);
  return m;
}

Deno.test({
  name: "Large Web Template: SECTION blocks attach to COMPOSITION (no free-floating)",
  ignore: !bigWt,
  fn() {
  ensureBlocks();
  const { skeleton } = generateSkeletonFromWebTemplate(bigWt!);
  const workspace = new Blockly.Workspace();

  loadSkeletonIntoWorkspace(
    workspace,
    skeleton,
    createEmptyModel("t"),
    null,
  );

  const tops = workspace.getTopBlocks(false);
  const topSectionCount = tops.filter((b) => b.type === "section").length;
  assertEquals(topSectionCount, 0);

  const sectionBlocks = workspace
    .getAllBlocks(false)
    .filter((b) => b.type === "section");
  assert(sectionBlocks.length > 0, "expected at least one SECTION block");

  for (const s of sectionBlocks) {
    assert(
      s.getParent() !== null,
      "SECTION blocks should be nested under a parent statement chain",
    );
  }

  // Sanity check: skeleton contains section nodes too.
  const byType = blockCountByType(skeleton);
  assert(byType.get("section") !== undefined);

  workspace.dispose();
  },
});

