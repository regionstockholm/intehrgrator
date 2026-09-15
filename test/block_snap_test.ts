import { assertEquals } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import {
  configureElementValueSlot,
  dvFieldInputName,
  rmAttributeInputName,
  RM_SPECIALIZATION_INPUT,
  syncRmAttributeInputs,
} from "@intehrgrator/blockly/blocks/rm_blocks.ts";
import { LOGIC_LIST_RESTRICTION_BLOCK } from "@intehrgrator/blockly/blocks/logic_blocks.ts";
import {
  applyInstanceRootCap,
  CONVERSION_START_TYPE,
  INSTANCE_ROOT_CONNECTION,
} from "@intehrgrator/blockly/instance_root.ts";
import {
  XML_ATTRIBUTES_INPUT,
  XML_ATTRIBUTE_TYPE,
  XML_CHILDREN_INPUT,
  XML_ELEMENT_TYPE,
  XML_TEXT_INPUT,
} from "@intehrgrator/core/xml_shape.ts";
import {
  assertSnapCases,
  createSnapWorkspace,
  type SnapCase,
} from "./block_snap_helpers.ts";

function stmtPrev(type: string, workspace: Blockly.Workspace): Blockly.Connection | null {
  return workspace.newBlock(type).previousConnection;
}

function valueOut(type: string, workspace: Blockly.Workspace): Blockly.Connection | null {
  return workspace.newBlock(type).outputConnection;
}

function inputConn(
  block: Blockly.Block,
  inputName: string,
): Blockly.Connection | null | undefined {
  return block.getInput(inputName)?.connection;
}

Deno.test("RM statement mouths accept valid nests and reject wrong families", () => {
  const ws = createSnapWorkspace();
  try {
    const composition = ws.newBlock("composition");
    const content = inputConn(composition, rmAttributeInputName("content"));

    const cluster = ws.newBlock("cluster");
    syncRmAttributeInputs(cluster, "CLUSTER", ["items"]);
    const items = inputConn(cluster, rmAttributeInputName("items"));

    const observation = ws.newBlock("observation");
    syncRmAttributeInputs(observation, "OBSERVATION", ["data"]);
    const data = inputConn(observation, rmAttributeInputName("data"));

    const history = ws.newBlock("history");
    syncRmAttributeInputs(history, "HISTORY", ["events"]);
    const events = inputConn(history, rmAttributeInputName("events"));

    assertSnapCases(ws, [
      { label: "SECTION nests in composition.content", a: content, b: stmtPrev("section", ws), expect: true },
      { label: "OBSERVATION nests in composition.content", a: content, b: stmtPrev("observation", ws), expect: true },
      { label: "EVALUATION nests in composition.content", a: content, b: stmtPrev("evaluation", ws), expect: true },
      { label: "INSTRUCTION nests in composition.content", a: content, b: stmtPrev("instruction", ws), expect: true },
      { label: "ACTION nests in composition.content", a: content, b: stmtPrev("action", ws), expect: true },
      { label: "ADMIN_ENTRY nests in composition.content", a: content, b: stmtPrev("admin_entry", ws), expect: true },
      { label: "CLUSTER nests in cluster.items", a: items, b: stmtPrev("cluster", ws), expect: true },
      { label: "ELEMENT nests in cluster.items", a: items, b: stmtPrev("element", ws), expect: true },
      { label: "HISTORY nests in observation.data", a: data, b: stmtPrev("history", ws), expect: true },
      { label: "EVENT nests in history.events", a: events, b: stmtPrev("event", ws), expect: true },
      { label: "ITEM_TREE nests in observation.data via HISTORY slot", a: data, b: stmtPrev("item_tree", ws), expect: false },
      { label: "CLUSTER rejected from composition.content", a: content, b: stmtPrev("cluster", ws), expect: false },
      { label: "SECTION rejected from cluster.items", a: items, b: stmtPrev("section", ws), expect: false },
      { label: "EVENT rejected from composition.content", a: content, b: stmtPrev("event", ws), expect: false },
      { label: "OBSERVATION rejected from history.events", a: events, b: stmtPrev("observation", ws), expect: false },
      { label: "COMPOSITION rejected from cluster.items", a: items, b: stmtPrev("composition", ws), expect: false },
    ]);
  } finally {
    ws.dispose();
  }
});

Deno.test("RM value slots accept typed shells and reject mismatches", () => {
  const ws = createSnapWorkspace();
  try {
    const elementQty = ws.newBlock("element");
    configureElementValueSlot(elementQty, "DV_QUANTITY");
    const qtySlot = inputConn(elementQty, "VALUE");

    const elementText = ws.newBlock("element");
    configureElementValueSlot(elementText, "DV_TEXT");
    const textSlot = inputConn(elementText, "VALUE");

    const genericElement = ws.newBlock("element");
    const genericSlot = inputConn(genericElement, "VALUE");

    const composition = ws.newBlock("composition");
    const composer = inputConn(composition, rmAttributeInputName("composer"));
    const category = inputConn(composition, rmAttributeInputName("category"));
    const language = inputConn(composition, rmAttributeInputName("language"));

    const context = ws.newBlock("event_context");
    syncRmAttributeInputs(context, "EVENT_CONTEXT", ["health_care_facility"]);
    const facility = inputConn(context, rmAttributeInputName("health_care_facility"));

    const qtyShell = ws.newBlock("dv_quantity");
    const textShell = ws.newBlock("dv_text");
    const magnitude = inputConn(qtyShell, dvFieldInputName("magnitude"));

    assertSnapCases(ws, [
      { label: "DV_QUANTITY shell in configured quantity slot", a: qtySlot, b: valueOut("dv_quantity", ws), expect: true },
      { label: "DV_TEXT shell in configured text slot", a: textSlot, b: valueOut("dv_text", ws), expect: true },
      { label: "Generic DATA_VALUE shell before configure", a: genericSlot, b: valueOut("dv_quantity", ws), expect: true },
      { label: "DV_TEXT rejected from quantity slot", a: qtySlot, b: valueOut("dv_text", ws), expect: false },
      { label: "DV_QUANTITY rejected from text slot", a: textSlot, b: valueOut("dv_quantity", ws), expect: false },
      { label: "Raw math_number rejected from element.VALUE", a: qtySlot, b: valueOut("math_number", ws), expect: false },
      { label: "Raw text literal rejected from element.VALUE", a: textSlot, b: valueOut("text", ws), expect: false },
      { label: "Statement block rejected from element.VALUE", a: qtySlot, b: stmtPrev("observation", ws), expect: false },
      { label: "PARTY_IDENTIFIED in composer slot", a: composer, b: valueOut("party_identified", ws), expect: true },
      { label: "PARTY_SELF in composer slot", a: composer, b: valueOut("party_self", ws), expect: true },
      { label: "term_pick in category slot", a: category, b: valueOut("term_pick", ws), expect: true },
      { label: "code_phrase in language slot", a: language, b: valueOut("code_phrase", ws), expect: true },
      { label: "PARTY_IDENTIFIED in health_care_facility", a: facility, b: valueOut("party_identified", ws), expect: true },
      { label: "PARTY_SELF rejected from health_care_facility", a: facility, b: valueOut("party_self", ws), expect: false },
      { label: "source_query_number in magnitude field", a: magnitude, b: valueOut("source_query_number", ws), expect: true },
      { label: "source_query string rejected from magnitude field", a: magnitude, b: valueOut("source_query", ws), expect: false },
      { label: "math_number accepted in magnitude field", a: magnitude, b: valueOut("math_number", ws), expect: true },
    ]);
  } finally {
    ws.dispose();
  }
});

Deno.test("PARTY_PROXY specialization accepts concrete kinds only", () => {
  const ws = createSnapWorkspace();
  try {
    const proxy = ws.newBlock("party_proxy");
    const kind = inputConn(proxy, RM_SPECIALIZATION_INPUT);

    assertSnapCases(ws, [
      { label: "PARTY_SELF in PARTY_PROXY kind slot", a: kind, b: valueOut("party_self", ws), expect: true },
      { label: "PARTY_IDENTIFIED in PARTY_PROXY kind slot", a: kind, b: valueOut("party_identified", ws), expect: true },
      { label: "PARTY_RELATED in PARTY_PROXY kind slot", a: kind, b: valueOut("party_related", ws), expect: true },
      { label: "PARTY_REF rejected from PARTY_PROXY kind slot", a: kind, b: valueOut("party_ref", ws), expect: false },
      { label: "code_phrase rejected from PARTY_PROXY kind slot", a: kind, b: valueOut("code_phrase", ws), expect: false },
    ]);
  } finally {
    ws.dispose();
  }
});

Deno.test("Conversion start and instance roots snap only on the product stack", () => {
  const ws = createSnapWorkspace();
  try {
    const start = ws.newBlock(CONVERSION_START_TYPE);
    const startNext = start.nextConnection;

    const composition = ws.newBlock("composition");
    applyInstanceRootCap(composition);

    const jsonRoot = ws.newBlock("json_object");
    applyInstanceRootCap(jsonRoot);

    const xmlDoc = ws.newBlock("xml_document");
    applyInstanceRootCap(xmlDoc);

    assertSnapCases(ws, [
      {
        label: "composition chains under Conversion start",
        a: startNext,
        b: composition.previousConnection,
        expect: true,
      },
      {
        label: "json_object chains under Conversion start",
        a: startNext,
        b: jsonRoot.previousConnection,
        expect: true,
      },
      {
        label: "xml_document chains under Conversion start",
        a: startNext,
        b: xmlDoc.previousConnection,
        expect: true,
      },
      {
        label: "instance roots chain to each other",
        a: composition.nextConnection,
        b: jsonRoot.previousConnection,
        expect: true,
      },
      {
        label: "OBSERVATION rejected from Conversion start",
        a: startNext,
        b: stmtPrev("observation", ws),
        expect: false,
      },
      {
        label: "for_each_source chains under Conversion start",
        a: startNext,
        b: stmtPrev("for_each_source", ws),
        expect: true,
      },
      {
        label: "for_each_list chains under Conversion start",
        a: startNext,
        b: stmtPrev("for_each_list", ws),
        expect: true,
      },
    ]);

    const prevCheck = composition.previousConnection?.getCheck();
    assertEquals(
      prevCheck === INSTANCE_ROOT_CONNECTION ||
        (Array.isArray(prevCheck) && prevCheck.includes(INSTANCE_ROOT_CONNECTION)),
      true,
    );
  } finally {
    ws.dispose();
  }
});

Deno.test("XML element mouths separate attributes, text, and children", () => {
  const ws = createSnapWorkspace();
  try {
    const el = ws.newBlock(XML_ELEMENT_TYPE);
    const attrs = inputConn(el, XML_ATTRIBUTES_INPUT);
    const textIn = inputConn(el, XML_TEXT_INPUT);
    const kids = inputConn(el, XML_CHILDREN_INPUT);

    assertSnapCases(ws, [
      { label: "xml_attribute stacks in attributes mouth", a: attrs, b: stmtPrev(XML_ATTRIBUTE_TYPE, ws), expect: true },
      { label: "xml_element rejected from attributes mouth", a: attrs, b: stmtPrev(XML_ELEMENT_TYPE, ws), expect: false },
      { label: "xml_element nests in children mouth", a: kids, b: stmtPrev(XML_ELEMENT_TYPE, ws), expect: true },
      { label: "for_each_source allowed in children mouth", a: kids, b: stmtPrev("for_each_source", ws), expect: true },
      { label: "controls_if allowed in children mouth", a: kids, b: stmtPrev("controls_if", ws), expect: true },
      { label: "xml_attribute rejected from children mouth", a: kids, b: stmtPrev(XML_ATTRIBUTE_TYPE, ws), expect: false },
      { label: "composition rejected from children mouth", a: kids, b: stmtPrev("composition", ws), expect: false },
      { label: "xml_text value in text slot", a: textIn, b: valueOut("xml_text", ws), expect: true },
      { label: "xml_cdata value in text slot", a: textIn, b: valueOut("xml_cdata", ws), expect: true },
      { label: "xml_element rejected from text slot", a: textIn, b: stmtPrev(XML_ELEMENT_TYPE, ws), expect: false },
    ]);
  } finally {
    ws.dispose();
  }
});

Deno.test("Logic and loop blocks enforce list and boolean checks", () => {
  const ws = createSnapWorkspace();
  try {
    const restriction = ws.newBlock(LOGIC_LIST_RESTRICTION_BLOCK);
    const listIn = inputConn(restriction, "LIST");
    const predIn = inputConn(restriction, "PRED");

    const forEachList = ws.newBlock("for_each_list");
    const listValue = inputConn(forEachList, "LIST");

    const listBlock = ws.newBlock("lists_create_with") as Blockly.Block & {
      itemCount_?: number;
      updateShape_?: () => void;
    };
    listBlock.itemCount_ = 0;
    listBlock.updateShape_?.();

    assertSnapCases(ws, [
      { label: "lists_create_with in logic_list_restriction LIST", a: listIn, b: listBlock.outputConnection, expect: true },
      { label: "source_query_node in logic_list_restriction LIST", a: listIn, b: valueOut("source_query_node", ws), expect: true },
      { label: "source_query string rejected from LIST slot", a: listIn, b: valueOut("source_query", ws), expect: false },
      { label: "logic_boolean in PRED slot", a: predIn, b: valueOut("logic_boolean", ws), expect: true },
      { label: "math_number rejected from PRED slot", a: predIn, b: valueOut("math_number", ws), expect: false },
      { label: "for_each_list accepts any list value", a: listValue, b: valueOut("source_query", ws), expect: true },
      { label: "for_each_list accepts Array output", a: listValue, b: listBlock.outputConnection, expect: true },
    ]);
  } finally {
    ws.dispose();
  }
});

Deno.test("Text handlebars and JSON value blocks enforce context and type checks", () => {
  const ws = createSnapWorkspace();
  try {
    const handlebars = ws.newBlock("text_handlebars");
    const context = inputConn(handlebars, "CONTEXT");
    const script = inputConn(handlebars, "SCRIPT");

    const jsonBool = ws.newBlock("json_boolean");
    const boolValue = inputConn(jsonBool, "VALUE");

    assertSnapCases(ws, [
      { label: "Source context in text_handlebars", a: context, b: valueOut("source_query_node", ws), expect: true },
      { label: "Map context in text_handlebars", a: context, b: valueOut("maps_create_with", ws), expect: true },
      { label: "String literal rejected from handlebars context", a: context, b: valueOut("text", ws), expect: false },
      { label: "String script in text_handlebars", a: script, b: valueOut("text", ws), expect: true },
      { label: "math_number rejected from handlebars script", a: script, b: valueOut("math_number", ws), expect: false },
      { label: "logic_boolean in json_boolean VALUE", a: boolValue, b: valueOut("logic_boolean", ws), expect: true },
      { label: "math_number rejected from json_boolean VALUE", a: boolValue, b: valueOut("math_number", ws), expect: false },
      { label: "json_value accepts any nested value", a: inputConn(ws.newBlock("json_value"), "VALUE"), b: valueOut("text", ws), expect: true },
    ]);
  } finally {
    ws.dispose();
  }
});

Deno.test("Cross-format blocks do not accept openEHR RM nests", () => {
  const ws = createSnapWorkspace();
  try {
    const jsonRoot = ws.newBlock("json_object");
    applyInstanceRootCap(jsonRoot);

    const xmlEl = ws.newBlock(XML_ELEMENT_TYPE);
    const xmlKids = inputConn(xmlEl, XML_CHILDREN_INPUT);

    const cases: SnapCase[] = [
      {
        label: "openEHR composition rejected from xml_element children",
        a: xmlKids,
        b: stmtPrev("composition", ws),
        expect: false,
      },
      {
        label: "openEHR observation rejected from xml_element children",
        a: xmlKids,
        b: stmtPrev("observation", ws),
        expect: false,
      },
    ];

    const start = ws.newBlock(CONVERSION_START_TYPE);
    cases.push(
      {
        label: "openEHR observation rejected from Conversion start",
        a: start.nextConnection,
        b: stmtPrev("observation", ws),
        expect: false,
      },
      {
        label: "composition instance root accepted from Conversion start",
        a: start.nextConnection,
        b: stmtPrev("composition", ws),
        expect: true,
      },
      {
        label: "xml_element instance root accepted from Conversion start",
        a: start.nextConnection,
        b: (() => {
          const root = ws.newBlock(XML_ELEMENT_TYPE);
          applyInstanceRootCap(root);
          return root.previousConnection;
        })(),
        expect: true,
      },
    );

    assertSnapCases(ws, cases);
  } finally {
    ws.dispose();
  }
});
