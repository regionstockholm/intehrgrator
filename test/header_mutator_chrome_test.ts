/**
 * Header cogwheel + type glyph sit on the far right of mutator blocks;
 * the default top-left MutatorIcon is not the visible control.
 */
import { assert, assertEquals } from "@std/assert";
import * as enMsg from "blockly/msg/en";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { initBlocklyGenerators } from "@intehrgrator/blockly/mod.ts";
import { BLOCK_OUT_EMOJI_FIELD } from "@intehrgrator/blockly/rm_type_emoji.ts";
import { MUTATOR_COG_FIELD } from "@intehrgrator/blockly/mouth_layout.ts";
import {
  blockHasMutator,
  getCogwheelAnchorLocation,
} from "@intehrgrator/blockly/dynamic_mutator.ts";
import { MAPS_CREATE_WITH } from "@intehrgrator/core/defaults/extract.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  const anyMod = enMsg as { default?: Record<string, string> } & Record<string, string>;
  const table = anyMod.default && typeof anyMod.default === "object" ? anyMod.default : anyMod;
  Blockly.setLocale(table);
  initBlocklyGenerators();
  ready = true;
}

function headerFieldNames(block: Blockly.Block): string[] {
  const header = block.getInput("HEADER") ??
    block.inputList.find((input) => input.fieldRow.some((f) => f.name === "NAME")) ??
    block.inputList.find((input) =>
      !input.connection && input.fieldRow.some((f) => f.name === MUTATOR_COG_FIELD)
    );
  return (header?.fieldRow ?? []).map((f) => String(f.name ?? f.getText?.() ?? ""));
}

function assertTrailingChrome(block: Blockly.Block, label: string): void {
  const names = headerFieldNames(block);
  const cog = names.lastIndexOf(MUTATOR_COG_FIELD);
  assert(cog >= 0, `${label} has a header cogwheel, names=${names.join(",")}`);
  const glyph = names.lastIndexOf(BLOCK_OUT_EMOJI_FIELD);
  if (glyph >= 0) {
    assertEquals(names.at(-1), BLOCK_OUT_EMOJI_FIELD, `${label} type glyph is last`);
    assert(cog < glyph, `${label} cog sits left of the type glyph`);
  } else {
    assertEquals(names.at(-1), MUTATOR_COG_FIELD, `${label} cog is last without a glyph`);
  }
  const firstChrome = names.findIndex((n) => n === MUTATOR_COG_FIELD || n === BLOCK_OUT_EMOJI_FIELD);
  assert(firstChrome > 0, `${label} title stays left of trailing chrome, names=${names.join(",")}`);
}

Deno.test("known mutator blocks put cogwheel and type glyph after the title", () => {
  ensure();
  const ws = new Blockly.Workspace();
  const types = [
    "text_join",
    "lists_create_with",
    MAPS_CREATE_WITH,
    "default_context_map",
    "composition",
    "dv_quantity",
    "xml_document",
    "procedures_defreturn",
    "procedures_defnoreturn",
  ];
  for (const type of types) {
    assert(Blockly.Blocks[type], `${type} is registered`);
    const block = ws.newBlock(type);
    assert(blockHasMutator(block), `${type} owns a mutator`);
    assertTrailingChrome(block, type);
  }
  ws.dispose();
});

Deno.test("every canvas mutator block gets a far-right header cogwheel", () => {
  ensure();
  const ws = new Blockly.Workspace();
  const missing: string[] = [];
  const skipped: string[] = [];
  for (const type of Object.keys(Blockly.Blocks).sort()) {
    let block: Blockly.Block;
    try {
      block = ws.newBlock(type);
    } catch {
      skipped.push(type);
      continue;
    }
    if (!blockHasMutator(block)) continue;
    const names = headerFieldNames(block);
    if (!names.includes(MUTATOR_COG_FIELD)) missing.push(`${type} names=${names.join(",")}`);
    else {
      const cog = names.lastIndexOf(MUTATOR_COG_FIELD);
      const glyph = names.lastIndexOf(BLOCK_OUT_EMOJI_FIELD);
      if (glyph >= 0 && cog > glyph) missing.push(`${type} cog after glyph`);
      if (names.at(-1) !== MUTATOR_COG_FIELD && names.at(-1) !== BLOCK_OUT_EMOJI_FIELD) {
        missing.push(`${type} chrome not last names=${names.join(",")}`);
      }
    }
  }
  ws.dispose();
  assertEquals(missing, [], `mutator blocks missing far-right cog: ${missing.join(" | ")}`);
});

Deno.test("procedures_callreturn has no mutator cog (call sites are not mutators)", () => {
  ensure();
  const ws = new Blockly.Workspace();
  const call = ws.newBlock("procedures_callreturn");
  assertEquals(blockHasMutator(call), false);
  assertEquals(call.getField(MUTATOR_COG_FIELD), null);
  ws.dispose();
});

Deno.test("dropdown-only list blocks do not get a fake mutator cogwheel", () => {
  ensure();
  const ws = new Blockly.Workspace();
  for (const type of ["lists_getIndex", "lists_getSublist", "lists_split", "text_charAt", "math_number_property"]) {
    const block = ws.newBlock(type);
    assertEquals(blockHasMutator(block), false, `${type} is not a MutatorIcon block`);
    assertEquals(block.getField(MUTATOR_COG_FIELD), null, `${type} has no header cog`);
  }
  ws.dispose();
});

Deno.test("lists_create_with title lives on HEADER, not a second dummy row of icons", () => {
  ensure();
  const ws = new Blockly.Workspace();
  const list = ws.newBlock("lists_create_with") as Blockly.Block & {
    itemCount_: number;
    updateShape_: () => void;
  };
  const headerText = list.getInput("HEADER")?.fieldRow.map((f) => f.getText?.() ?? "").join(" ") ??
    "";
  assert(
    /create list with/i.test(headerText) || headerText.length > 0,
    `expected title on HEADER, got ${JSON.stringify(headerText)}`,
  );
  assertEquals(list.getInput("HEADER")?.fieldRow.some((f) => f.name === MUTATOR_COG_FIELD), true);
  assertEquals(
    list.getInput("ADD0")?.fieldRow.some((f) => f.name === MUTATOR_COG_FIELD) ?? false,
    false,
  );

  list.itemCount_ = 0;
  list.updateShape_();
  assert(list.getField(MUTATOR_COG_FIELD), "empty list keeps header cog");
  assertEquals(list.getInput("EMPTY"), null, "empty title moved off the EMPTY dummy");
  ws.dispose();
});

Deno.test("maps_create_with header ends with cog then Map glyph", () => {
  ensure();
  const ws = new Blockly.Workspace();
  const map = ws.newBlock(MAPS_CREATE_WITH);
  const names = headerFieldNames(map);
  assertEquals(names.at(-2), MUTATOR_COG_FIELD);
  assertEquals(names.at(-1), BLOCK_OUT_EMOJI_FIELD);
  ws.dispose();
});

Deno.test("mutator bubble anchors on the header cog, not the block origin", () => {
  ensure();
  const ws = new Blockly.Workspace();
  const block = ws.newBlock("procedures_defreturn");
  const svg = block as Blockly.Block & {
    getRelativeToSurfaceXY: () => { x: number; y: number };
    getHeightWidth: () => { width: number; height: number };
  };
  svg.getRelativeToSurfaceXY = () => ({ x: 10, y: 20 });
  svg.getHeightWidth = () => ({ width: 220, height: 48 });
  const anchor = getCogwheelAnchorLocation(svg as unknown as import("blockly/core").BlockSvg);
  assert(anchor.x > 10, `anchor x ${anchor.x} should sit toward the right of the block`);
  assert(anchor.x >= 10 + 220 - 18 - 1, `anchor x ${anchor.x} should use the block's right edge fallback`);
  ws.dispose();
});
