import { assert, assertEquals } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import {
  collapsedHtmlForBlock,
  shortArchetypeLabel,
} from "@intehrgrator/blockly/collapsed_preview.ts";
import { initBlocklyGenerators } from "@intehrgrator/blockly/mod.ts";
import {
  composeOptionalRmExtras,
  connectExpressionToDataValueShell,
  dvFieldInputName,
  optionalRmInputName,
  rmAttributeInputName,
} from "@intehrgrator/blockly/blocks/rm_blocks.ts";
import { XML_ELEMENT_TYPE } from "@intehrgrator/core/xml_shape.ts";
import { createSourceQueryBlock } from "@intehrgrator/blockly/source_query.ts";
import { configureTermPick } from "@intehrgrator/blockly/blocks/term_pick.ts";
import {
  termPickDropdownOptions,
  termSetById,
} from "@intehrgrator/core/openehr_term_catalog.ts";
import { labelForPickValue } from "@intehrgrator/ui/searchable_pick.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  initBlocklyGenerators();
  ready = true;
}

function connectStatement(
  parent: Blockly.Block,
  inputName: string,
  child: Blockly.Block,
): void {
  const conn = parent.getInput(inputName)?.connection ??
    parent.getInput(optionalRmInputName(inputName.replace(/^ATTR_|^OPT_/, "")))?.connection;
  assert(conn, `missing input ${inputName}`);
  assert(child.previousConnection, `${child.type} has no previous connection`);
  conn.connect(child.previousConnection);
}

function connectValue(
  parent: Blockly.Block,
  inputName: string,
  child: Blockly.Block,
): void {
  const conn = parent.getInput(inputName)?.connection;
  assert(conn, `missing input ${inputName}`);
  assert(child.outputConnection, `${child.type} has no output connection`);
  conn.connect(child.outputConnection);
}

function buildRespirationTree(workspace: Blockly.Workspace): {
  observation: Blockly.Block;
  event: Blockly.Block;
  element: Blockly.Block;
  quantity: Blockly.Block;
} {
  const observation = workspace.newBlock("observation");
  observation.setFieldValue(
    "openEHR-EHR-OBSERVATION.respiration.v2",
    "ARCHETYPE_NODE_ID",
  );
  observation.setFieldValue("respiration", "ARCHETYPE_CTX");

  const history = workspace.newBlock("history");
  history.setFieldValue("at0001", "ARCHETYPE_NODE_ID");
  connectStatement(observation, rmAttributeInputName("data"), history);

  const event = workspace.newBlock("event");
  event.setFieldValue("at0002", "ARCHETYPE_NODE_ID");
  connectStatement(history, rmAttributeInputName("events"), event);

  const tree = workspace.newBlock("item_tree");
  tree.setFieldValue("at0003", "ARCHETYPE_NODE_ID");
  composeOptionalRmExtras(tree, ["items"]);
  connectStatement(event, rmAttributeInputName("data"), tree);

  const element = workspace.newBlock("element");
  element.setFieldValue("at0004", "ARCHETYPE_NODE_ID");
  connectStatement(tree, optionalRmInputName("items"), element);

  const quantity = workspace.newBlock("dv_quantity");
  connectValue(element, "VALUE", quantity);

  const mag = workspace.newBlock("math_number");
  mag.setFieldValue("18", "NUM");
  connectValue(quantity, dvFieldInputName("magnitude"), mag);

  const units = workspace.newBlock("text");
  units.setFieldValue("/min", "TEXT");
  connectValue(quantity, dvFieldInputName("units"), units);

  const when = workspace.newBlock("dv_date_time");
  const whenValue = workspace.newBlock("text");
  whenValue.setFieldValue("2026-08-02T10:10:00Z", "TEXT");
  connectValue(when, dvFieldInputName("value"), whenValue);
  connectValue(event, rmAttributeInputName("time"), when);

  return { observation, event, element, quantity };
}

Deno.test("shortArchetypeLabel keeps concept.version from a full archetype id", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const observation = workspace.newBlock("observation");
  observation.setFieldValue(
    "openEHR-EHR-OBSERVATION.respiration.v2",
    "ARCHETYPE_NODE_ID",
  );
  assertEquals(shortArchetypeLabel(observation), "respiration.v2");
  workspace.dispose();
});

Deno.test("collapsed openEHR preview is ZipEHR-style one-liner with glyphs and values", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const { observation } = buildRespirationTree(workspace);
  const html = collapsedHtmlForBlock(observation);

  assert(html.includes("data-glyph=\"👀\""), html);
  assert(html.includes("respiration.v2"), html);
  assert(html.includes("data-glyph=\"🌳\""), html);
  assert(html.includes("data-glyph=\"EVENT\""), html);
  assert(html.includes("data-glyph=\"🔹\""), html);
  assert(html.includes("data-glyph=\"🌡️\""), html);
  assert(html.includes("data-glyph=\"№\""), html);
  assert(html.includes(">18<"), html);
  assert(html.includes("data-glyph=\"◌\""), html);
  assert(html.includes(">/min<"), html);
  assert(html.includes("data-glyph=\"📅⌚\""), html);
  assert(html.includes("2026-08-02T10:10:00Z"), html);
  const visible = html.replace(/<[^>]+>/g, " ");
  assert(!visible.includes("openEHR-EHR-OBSERVATION"), "full archetype id is not visible text");
  assert(!visible.includes("SLOT_ID"), html);
  workspace.dispose();
});

Deno.test("collapsed openEHR nodes carry at-code and RM type for hover", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const { observation, event, element } = buildRespirationTree(workspace);
  const html = collapsedHtmlForBlock(observation);
  assert(html.includes("data-at-code=\"at0002\""), html);
  assert(html.includes("data-rm-type=\"EVENT\""), html);
  assert(html.includes("data-at-code=\"at0004\""), html);
  assert(html.includes("data-rm-type=\"ELEMENT\""), html);
  assert(html.includes("data-at-code=\"openEHR-EHR-OBSERVATION.respiration.v2\""), html);
  assert(html.includes("data-rm-type=\"OBSERVATION\""), html);
  assertEquals(event.getFieldValue("ARCHETYPE_NODE_ID"), "at0002");
  assertEquals(element.getFieldValue("ARCHETYPE_NODE_ID"), "at0004");
  workspace.dispose();
});

Deno.test("collapsed mapping path uses the source-query colour chip", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const { quantity } = buildRespirationTree(workspace);
  const existing = quantity.getInputTargetBlock(dvFieldInputName("magnitude"));
  existing?.dispose(false);
  const query = createSourceQueryBlock(workspace, "/vitals/resp_rate", "number");
  connectExpressionToDataValueShell(quantity, query);
  const html = collapsedHtmlForBlock(quantity);
  assert(html.includes("collapsed-mapping"), html);
  assert(html.includes("/vitals/resp_rate"), html);
  assert(html.includes("#e87722") || html.includes("#E87722"), html);
  assert(!html.includes("xpathNumber"), html);
  workspace.dispose();
});

Deno.test("collapsed nested Constraint warnings stay visible", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const { observation } = buildRespirationTree(workspace);
  const html = collapsedHtmlForBlock(observation);
  assert(html.includes("collapsed-warning"), html);
  assert(html.includes("EVENT is abstract"), html);
  workspace.dispose();
});

Deno.test("collapsed generic XML uses the tag name and hides identifier bloat", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const el = workspace.newBlock(XML_ELEMENT_TYPE);
  el.setFieldValue("Patient", "NAME");
  el.setFieldValue("slot/patient", "SLOT_ID");
  const html = collapsedHtmlForBlock(el);
  assert(html.includes("Patient"), html);
  const visible = html.replace(/<[^>]+>/g, " ");
  assert(!visible.includes("slot/patient"), "SLOT_ID must not be visible text");
  assert(html.includes("data-extra"), html);
  workspace.dispose();
});

Deno.test("collapsed nodes use muted Blockly colours", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const observation = workspace.newBlock("observation");
  const html = collapsedHtmlForBlock(observation);
  assert(html.includes("--collapsed-colour:#003b49") || html.includes("--collapsed-colour:#003B49"), html);
  workspace.dispose();
});

Deno.test("collapsed map shows keys and the root of each value", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const map = workspace.newBlock("maps_create_with") as Blockly.Block & {
    itemCount_: number;
    updateShape_: () => void;
  };
  map.itemCount_ = 2;
  map.updateShape_();
  map.setFieldValue("language", "KEY0");
  map.setFieldValue("encoding", "KEY1");
  const lang = workspace.newBlock("text");
  lang.setFieldValue("en", "TEXT");
  connectValue(map, "VAL0", lang);
  const nested = workspace.newBlock("maps_create_with") as Blockly.Block & {
    itemCount_: number;
    updateShape_: () => void;
  };
  nested.itemCount_ = 1;
  nested.updateShape_();
  nested.setFieldValue("inner", "KEY0");
  connectValue(map, "VAL1", nested);
  const html = collapsedHtmlForBlock(map);
  assert(html.includes("language"), html);
  assert(html.includes("en"), html);
  assert(html.includes("encoding"), html);
  assert(html.includes("collapsed-map-pair"), html);
  const visible = html.replace(/<[^>]+>/g, " ");
  assert(!visible.includes("inner"), "nested map keys stay out of the parent preview");
  workspace.dispose();
});

Deno.test("collapsed term_pick shows the pick-list label", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const pick = workspace.newBlock("term_pick");
  const set = termSetById("openehr:setting");
  assert(set, "expected setting term set");
  const home = set.codes.find((item) => item.rubric.toLowerCase() === "home");
  assert(home, "expected home setting code");
  configureTermPick(pick, set, home.code);
  const html = collapsedHtmlForBlock(pick);
  const expected = labelForPickValue(termPickDropdownOptions(set.id), home.code);
  assert(html.includes(expected), html);
  assert(html.includes("data-glyph"), html);
  workspace.dispose();
});
