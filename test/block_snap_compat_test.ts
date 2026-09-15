/**
 * Table-driven Blockly snap compatibility: blocks that should connect can,
 * and mismatched types are rejected by the connection checker.
 */
import { assert, assertEquals } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { attachStartToInstanceRoot, initBlocklyGenerators } from "@intehrgrator/blockly/mod.ts";
import { blocklyCheckForDv } from "@intehrgrator/blockly/block_checks.ts";
import {
  configureElementValueSlot,
  dvFieldInputName,
  rmAttributeInputName,
  syncRmAttributeInputs,
} from "@intehrgrator/blockly/blocks/rm_blocks.ts";
import { applyInstanceRootCap, INSTANCE_ROOT_CONNECTION } from "@intehrgrator/blockly/instance_root.ts";
import {
  blockTypeForRm,
  dataValueLeafTypes,
  primaryMappingAttribute,
} from "@intehrgrator/core/rm_meta.ts";
import {
  LOGIC_LIST_RESTRICTION_BLOCK,
  LISTS_SET_OPERATION_BLOCK,
} from "@intehrgrator/blockly/blocks/logic_blocks.ts";
import { MAPS_CREATE_WITH } from "@intehrgrator/core/defaults/extract.ts";
import {
  XML_ATTRIBUTE_CHECK,
  XML_ATTRIBUTE_TYPE,
  XML_ATTRIBUTES_INPUT,
  XML_CDATA_TYPE,
  XML_CHILDREN_INPUT,
  XML_DOCUMENT_TYPE,
  XML_ELEMENT_TYPE,
  XML_ROOT_INPUT,
  XML_TEXT_INPUT,
  XML_TEXT_TYPE,
} from "@intehrgrator/core/xml_shape.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  initBlocklyGenerators();
  ready = true;
}

function canSnap(
  workspace: Blockly.Workspace,
  parent: Blockly.Connection,
  child: Blockly.Connection,
): boolean {
  return workspace.connectionChecker.canConnect(parent, child, false);
}

function assertSnap(
  workspace: Blockly.Workspace,
  parent: Blockly.Connection,
  child: Blockly.Connection,
  expected: boolean,
  label: string,
): void {
  assertEquals(canSnap(workspace, parent, child), expected, label);
  if (!expected) return;
  parent.connect(child);
  parent.disconnect();
}

type SnapCase = {
  label: string;
  shouldConnect: boolean;
  run: (workspace: Blockly.Workspace) => {
    parent: Blockly.Connection;
    child: Blockly.Connection;
  };
};

function runSnapCases(workspace: Blockly.Workspace, cases: SnapCase[]): void {
  for (const { label, shouldConnect, run } of cases) {
    const { parent, child } = run(workspace);
    assertSnap(workspace, parent, child, shouldConnect, label);
  }
}

function valueOutput(workspace: Blockly.Workspace, type: string): Blockly.Connection {
  const block = workspace.newBlock(type);
  assert(block.outputConnection, `${type} must have an output`);
  return block.outputConnection;
}

function statementPrevious(workspace: Blockly.Workspace, type: string): Blockly.Connection {
  const block = workspace.newBlock(type);
  assert(block.previousConnection, `${type} must have a previous statement`);
  return block.previousConnection;
}

Deno.test("RM CONTENT_ITEM mouths accept entry types and reject structural items", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  try {
    const composition = workspace.newBlock("composition");
    const content = composition.getInput(rmAttributeInputName("content"))!.connection!;

    const accept = ["section", "observation", "evaluation", "instruction", "action", "admin_entry"];
    const reject = ["element", "cluster", "history", "item_tree", "event"];

    runSnapCases(workspace, [
      ...accept.map((type) => ({
        label: `${type} → composition.content`,
        shouldConnect: true,
        run: () => ({ parent: content, child: statementPrevious(workspace, type) }),
      })),
      ...reject.map((type) => ({
        label: `${type} must not snap into composition.content`,
        shouldConnect: false,
        run: () => ({ parent: content, child: statementPrevious(workspace, type) }),
      })),
    ]);
  } finally {
    workspace.dispose();
  }
});

Deno.test("RM ITEM mouths accept element/cluster and reject content entries", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  try {
    const cluster = workspace.newBlock("cluster");
    syncRmAttributeInputs(cluster, "CLUSTER", ["items"]);
    const items = cluster.getInput(rmAttributeInputName("items"))!.connection!;

    runSnapCases(workspace, [
      {
        label: "element → cluster.items",
        shouldConnect: true,
        run: () => ({ parent: items, child: statementPrevious(workspace, "element") }),
      },
      {
        label: "cluster → cluster.items",
        shouldConnect: true,
        run: () => ({ parent: items, child: statementPrevious(workspace, "cluster") }),
      },
      {
        label: "observation must not snap into cluster.items",
        shouldConnect: false,
        run: () => ({ parent: items, child: statementPrevious(workspace, "observation") }),
      },
      {
        label: "section must not snap into cluster.items",
        shouldConnect: false,
        run: () => ({ parent: items, child: statementPrevious(workspace, "section") }),
      },
    ]);
  } finally {
    workspace.dispose();
  }
});

Deno.test("RM EVENT mouths accept event subtypes and reject unrelated blocks", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  try {
    const history = workspace.newBlock("history");
    syncRmAttributeInputs(history, "HISTORY", ["events"]);
    const events = history.getInput(rmAttributeInputName("events"))!.connection!;

    runSnapCases(workspace, [
      ...["event", "point_event", "interval_event"].map((type) => ({
        label: `${type} → history.events`,
        shouldConnect: true,
        run: () => ({ parent: events, child: statementPrevious(workspace, type) }),
      })),
      {
        label: "element must not snap into history.events",
        shouldConnect: false,
        run: () => ({ parent: events, child: statementPrevious(workspace, "element") }),
      },
      {
        label: "observation must not snap into history.events",
        shouldConnect: false,
        run: () => ({ parent: events, child: statementPrevious(workspace, "observation") }),
      },
    ]);
  } finally {
    workspace.dispose();
  }
});

Deno.test("RM ITEM_STRUCTURE mouths accept concrete structures and reject entries", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  try {
    const event = workspace.newBlock("event");
    syncRmAttributeInputs(event, "EVENT", ["data"]);
    const data = event.getInput(rmAttributeInputName("data"))!.connection!;

    runSnapCases(workspace, [
      ...["item_tree", "item_list", "item_table", "item_single"].map((type) => ({
        label: `${type} → event.data`,
        shouldConnect: true,
        run: () => ({ parent: data, child: statementPrevious(workspace, type) }),
      })),
      {
        label: "observation must not snap into event.data",
        shouldConnect: false,
        run: () => ({ parent: data, child: statementPrevious(workspace, "observation") }),
      },
      {
        label: "element must not snap into event.data",
        shouldConnect: false,
        run: () => ({ parent: data, child: statementPrevious(workspace, "element") }),
      },
    ]);
  } finally {
    workspace.dispose();
  }
});

Deno.test("typed ELEMENT.value slots accept matching DV shells and reject others", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  try {
    const dvTypes = dataValueLeafTypes().filter((t) => Blockly.Blocks[blockTypeForRm(t)]);
    assert(dvTypes.length > 0, "expected registered DV shells");

    for (const rmType of dvTypes) {
      const element = workspace.newBlock("element");
      configureElementValueSlot(element, rmType);
      const slot = element.getInput("VALUE")!.connection!;
      const matching = workspace.newBlock(blockTypeForRm(rmType));
      assertSnap(
        workspace,
        slot,
        matching.outputConnection!,
        true,
        `${blockTypeForRm(rmType)} → ELEMENT.value (${rmType})`,
      );

      const mismatch = dvTypes.find((other) => other !== rmType && blocklyCheckForDv(other) !== blocklyCheckForDv(rmType));
      if (!mismatch) continue;
      const wrong = workspace.newBlock(blockTypeForRm(mismatch));
      assertSnap(
        workspace,
        slot,
        wrong.outputConnection!,
        false,
        `${blockTypeForRm(mismatch)} must not snap into ELEMENT.value (${rmType})`,
      );
    }

    const qtyElement = workspace.newBlock("element");
    configureElementValueSlot(qtyElement, "DV_QUANTITY");
    const qtySlot = qtyElement.getInput("VALUE")!.connection!;
    assertSnap(workspace, qtySlot, valueOutput(workspace, "text"), false, "text must not snap into DV_QUANTITY value");
    assertSnap(
      workspace,
      qtySlot,
      valueOutput(workspace, "math_number"),
      false,
      "math_number must not snap into DV_QUANTITY value shell",
    );
  } finally {
    workspace.dispose();
  }
});

Deno.test("DV primitive field sockets accept matching expression types only", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  try {
    const qty = workspace.newBlock("dv_quantity");
    const magnitude = qty.getInput(dvFieldInputName("magnitude"))!.connection!;
    assertSnap(workspace, magnitude, valueOutput(workspace, "math_number"), true, "math_number → DV_QUANTITY.magnitude");
    assertSnap(workspace, magnitude, valueOutput(workspace, "source_query_number"), true, "source_query_number → magnitude");
    assertSnap(workspace, magnitude, valueOutput(workspace, "text"), false, "text must not snap into magnitude");
    assertSnap(workspace, magnitude, valueOutput(workspace, "logic_boolean"), false, "boolean must not snap into magnitude");

    const boolShell = workspace.newBlock("dv_boolean");
    const boolValue = boolShell.getInput(dvFieldInputName("value"))!.connection!;
    assertSnap(workspace, boolValue, valueOutput(workspace, "logic_boolean"), true, "logic_boolean → DV_BOOLEAN.value");
    assertSnap(workspace, boolValue, valueOutput(workspace, "source_query_boolean"), true, "source_query_boolean → DV_BOOLEAN.value");
    assertSnap(workspace, boolValue, valueOutput(workspace, "math_number"), false, "math_number must not snap into DV_BOOLEAN.value");
  } finally {
    workspace.dispose();
  }
});

Deno.test("PARTY_PROXY slots accept party blocks and reject unrelated outputs", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  try {
    const composition = workspace.newBlock("composition");
    const composer = composition.getInput(rmAttributeInputName("composer"))!.connection!;

    for (const type of ["party_self", "party_identified", "party_related", "party_proxy"]) {
      assertSnap(
        workspace,
        composer,
        valueOutput(workspace, type),
        true,
        `${type} → composition.composer`,
      );
    }
    assertSnap(workspace, composer, valueOutput(workspace, "text"), false, "text must not snap into composer");
    assertSnap(workspace, composer, valueOutput(workspace, "party_ref"), false, "party_ref must not snap into composer");

    const context = workspace.newBlock("event_context");
    syncRmAttributeInputs(context, "EVENT_CONTEXT", ["health_care_facility"]);
    const facility = context.getInput(rmAttributeInputName("health_care_facility"))!.connection!;
    assertSnap(workspace, facility, valueOutput(workspace, "party_identified"), true, "party_identified → health_care_facility");
    assertSnap(workspace, facility, valueOutput(workspace, "party_self"), false, "party_self must not snap into health_care_facility");
  } finally {
    workspace.dispose();
  }
});

Deno.test("CODE_PHRASE and term_pick snap into composition language/territory/category", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  try {
    const composition = workspace.newBlock("composition");
    const language = composition.getInput(rmAttributeInputName("language"))!.connection!;
    const category = composition.getInput(rmAttributeInputName("category"))!.connection!;

    assertSnap(workspace, language, valueOutput(workspace, "code_phrase"), true, "code_phrase → language");
    assertSnap(workspace, language, valueOutput(workspace, "term_pick"), true, "term_pick → language");
    assertSnap(workspace, language, valueOutput(workspace, "text"), false, "text must not snap into language");

    assertSnap(workspace, category, valueOutput(workspace, "term_pick"), true, "term_pick → category");
    assertSnap(workspace, category, valueOutput(workspace, "dv_coded_text"), true, "dv_coded_text → category");
    assertSnap(workspace, category, valueOutput(workspace, "dv_quantity"), false, "dv_quantity must not snap into category");
  } finally {
    workspace.dispose();
  }
});

Deno.test("source, map, logic, and handlebars sockets enforce typed checks", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  try {
    const handlebars = workspace.newBlock("text_handlebars");
    const script = handlebars.getInput("SCRIPT")!.connection!;
    const context = handlebars.getInput("CONTEXT")!.connection!;

    assertSnap(workspace, script, valueOutput(workspace, "text"), true, "text → handlebars SCRIPT");
    assertSnap(workspace, script, valueOutput(workspace, "math_number"), false, "math_number must not snap into SCRIPT");
    assertSnap(workspace, context, valueOutput(workspace, "maps_create_with"), true, "map → handlebars CONTEXT");
    assertSnap(workspace, context, valueOutput(workspace, "source_query_node"), true, "source node → handlebars CONTEXT");
    assertSnap(workspace, context, valueOutput(workspace, "text"), false, "text must not snap into handlebars CONTEXT");

    const restriction = workspace.newBlock(LOGIC_LIST_RESTRICTION_BLOCK);
    const list = restriction.getInput("LIST")!.connection!;
    const pred = restriction.getInput("PRED")!.connection!;
    assertSnap(workspace, list, valueOutput(workspace, "lists_create_with"), true, "array → list restriction LIST");
    assertSnap(workspace, list, valueOutput(workspace, "source_query_node"), true, "source node → list restriction LIST");
    assertSnap(workspace, list, valueOutput(workspace, "text"), false, "text must not snap into LIST");
    assertSnap(workspace, pred, valueOutput(workspace, "logic_boolean"), true, "boolean → list restriction PRED");
    assertSnap(workspace, pred, valueOutput(workspace, "math_number"), false, "math_number must not snap into PRED");

    const setOp = workspace.newBlock(LISTS_SET_OPERATION_BLOCK);
    const a = setOp.getInput("A")!.connection!;
    assertSnap(workspace, a, valueOutput(workspace, "maps_keys"), true, "maps_keys → set operation A");
    assertSnap(workspace, a, valueOutput(workspace, "logic_boolean"), false, "boolean must not snap into set operation");

    const mapGet = workspace.newBlock("maps_get");
    const key = mapGet.getInput("KEY")!.connection!;
    assertSnap(workspace, key, valueOutput(workspace, "text"), true, "text → maps_get KEY");
    assertSnap(workspace, key, valueOutput(workspace, "math_number"), false, "math_number must not snap into maps_get KEY");

    const defaults = workspace.newBlock("defaults_block");
    const defaultsMap = defaults.getInput("MAP")!.connection!;
    const createMap = workspace.newBlock(MAPS_CREATE_WITH);
    assertSnap(workspace, defaultsMap, createMap.outputConnection!, true, "map → defaults MAP");
    assertSnap(workspace, defaultsMap, valueOutput(workspace, "text"), false, "text must not snap into defaults MAP");
  } finally {
    workspace.dispose();
  }
});

Deno.test("JSON and XML target blocks enforce structure/value separation", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  try {
    const jsonObject = workspace.newBlock("json_object");
    const jsonChild = workspace.newBlock("json_value");
    const jsonPrev = jsonChild.previousConnection!;
    const jsonNext = jsonObject.nextConnection!;
    assertSnap(workspace, jsonNext, jsonPrev, true, "json_value chains under json_object");

    const jsonBool = workspace.newBlock("json_boolean");
    const boolSlot = jsonBool.getInput("VALUE")!.connection!;
    assertSnap(workspace, boolSlot, valueOutput(workspace, "logic_boolean"), true, "boolean → json_boolean VALUE");
    assertSnap(workspace, boolSlot, valueOutput(workspace, "text"), false, "text must not snap into json_boolean VALUE");

    const element = workspace.newBlock(XML_ELEMENT_TYPE);
    const attrs = element.getInput(XML_ATTRIBUTES_INPUT)!.connection!;
    const children = element.getInput(XML_CHILDREN_INPUT)!.connection!;
    const textSlot = element.getInput(XML_TEXT_INPUT)!.connection!;

    assertSnap(workspace, attrs, statementPrevious(workspace, XML_ATTRIBUTE_TYPE), true, "xml_attribute → attributes");
    assertSnap(workspace, attrs, statementPrevious(workspace, XML_ELEMENT_TYPE), false, "xml_element must not stack in attributes");
    assertSnap(workspace, children, statementPrevious(workspace, XML_ELEMENT_TYPE), true, "xml_element → children");
    assertSnap(workspace, children, statementPrevious(workspace, XML_ATTRIBUTE_TYPE), false, "xml_attribute must not stack in children");
    assertSnap(workspace, textSlot, valueOutput(workspace, XML_TEXT_TYPE), true, "xml_text → element text");
    assertSnap(workspace, textSlot, valueOutput(workspace, XML_CDATA_TYPE), true, "xml_cdata → element text");
    assertSnap(workspace, textSlot, valueOutput(workspace, "math_number"), false, "math_number must not snap into xml text");

    const doc = workspace.newBlock(XML_DOCUMENT_TYPE);
    const root = doc.getInput(XML_ROOT_INPUT)!.connection!;
    assertSnap(workspace, root, statementPrevious(workspace, XML_ELEMENT_TYPE), true, "xml_element → document root");
    assertSnap(workspace, root, statementPrevious(workspace, XML_ATTRIBUTE_TYPE), false, "xml_attribute must not be document root");
  } finally {
    workspace.dispose();
  }
});

Deno.test("INSTANCE_ROOT stack links capped product roots and rejects nested instance caps", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  try {
    const composition = workspace.newBlock("composition");
    const jsonObject = workspace.newBlock("json_object");
    applyInstanceRootCap(jsonObject);
    const xmlDoc = workspace.newBlock(XML_DOCUMENT_TYPE);
    applyInstanceRootCap(xmlDoc);

    for (const block of [composition, jsonObject, xmlDoc]) {
      const check = block.previousConnection?.getCheck();
      const ok = check === INSTANCE_ROOT_CONNECTION ||
        (Array.isArray(check) && check.includes(INSTANCE_ROOT_CONNECTION));
      assert(ok, `${block.type} should wear INSTANCE_ROOT cap`);
    }

    attachStartToInstanceRoot(workspace, composition);
    assertSnap(
      workspace,
      composition.nextConnection!,
      jsonObject.previousConnection!,
      true,
      "json_object chains after composition",
    );

    const nested = workspace.newBlock(XML_ELEMENT_TYPE);
    const nestedPrev = nested.previousConnection?.getCheck() ?? [];
    assertEquals(
      Array.isArray(nestedPrev) ? nestedPrev.includes(INSTANCE_ROOT_CONNECTION) : nestedPrev === INSTANCE_ROOT_CONNECTION,
      false,
      "nested xml_element must not wear INSTANCE_ROOT",
    );
  } finally {
    workspace.dispose();
  }
});

Deno.test("decision_table INPUTS accepts maps and rejects unrelated value types", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  try {
    const table = workspace.newBlock("decision_table");
    const inputs = table.getInput("INPUTS")!.connection!;
    const map = workspace.newBlock(MAPS_CREATE_WITH);
    assertSnap(workspace, inputs, map.outputConnection!, true, "map → decision_table INPUTS");
    assertSnap(workspace, inputs, valueOutput(workspace, "text"), false, "text must not snap into decision_table INPUTS");
    assertSnap(workspace, inputs, valueOutput(workspace, "lists_create_with"), false, "array must not snap into decision_table INPUTS");
  } finally {
    workspace.dispose();
  }
});

Deno.test("primary DV mapping fields expose checks consistent with blocklyCheckForReturnType", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  try {
    const samples: Array<{ rmType: string; good: string; bad: string }> = [
      { rmType: "DV_TEXT", good: "text", bad: "math_number" },
      { rmType: "DV_QUANTITY", good: "math_number", bad: "text" },
      { rmType: "DV_BOOLEAN", good: "logic_boolean", bad: "text" },
    ];
    for (const { rmType, good, bad } of samples) {
      const shellType = blockTypeForRm(rmType);
      if (!Blockly.Blocks[shellType]) continue;
      const shell = workspace.newBlock(shellType);
      const attr = primaryMappingAttribute(rmType);
      assert(attr, `expected primary field on ${rmType}`);
      const slot = shell.getInput(dvFieldInputName(attr.name))?.connection;
      assert(slot, `expected ${attr.name} socket on ${shellType}`);
      assertSnap(workspace, slot, valueOutput(workspace, good), true, `${good} → ${rmType}.${attr.name}`);
      assertSnap(workspace, slot, valueOutput(workspace, bad), false, `${bad} must not snap into ${rmType}.${attr.name}`);
    }
  } finally {
    workspace.dispose();
  }
});
