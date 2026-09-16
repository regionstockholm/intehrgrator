/**
 * Snap matrix from openEHR RM (BMM): every registered parent mouth × child type.
 * Expected outcomes come from rm_expected_snap.ts, not from Blockly setCheck.
 */
import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { initBlocklyGenerators } from "@intehrgrator/blockly/mod.ts";
import {
  configureElementValueSlot,
  dvFieldInputName,
  EXTRA_RM_CONTAINERS,
  isRmContainerBlockType,
} from "@intehrgrator/blockly/blocks/rm_blocks.ts";
import {
  blockTypeForRm,
  dataValueLeafTypes,
  isSubtypeOf,
} from "@intehrgrator/core/rm_meta.ts";
import {
  evaluateDvFieldSnapMatrix,
  evaluateIndependentSnapMatrix,
  evaluateRmBmmSnapMatrix,
  evaluateSchemaSnapMatrix,
  evaluateXmlSnapMatrix,
} from "@intehrgrator/blockly/connection_audit.ts";
import { blocklyCheckForDv, flattenBlocklyCheck } from "@intehrgrator/blockly/block_checks.ts";
import {
  PRIMITIVE_EXPR_BLOCKS,
  RM_SNAP_PARENT_TYPES,
} from "@intehrgrator/blockly/rm_expected_snap.ts";
import { getTargetFormatHandler } from "@intehrgrator/core/target/mod.ts";

const EXPR_BLOCKS = PRIMITIVE_EXPR_BLOCKS;

let ready = false;
function ensure(): void {
  if (ready) return;
  initBlocklyGenerators();
  ready = true;
}

function canConnect(
  ws: Blockly.Workspace,
  a: Blockly.Connection | null | undefined,
  b: Blockly.Connection | null | undefined,
): boolean {
  if (!a || !b) return false;
  return ws.connectionChecker.canConnect(a, b, false);
}

Deno.test("flattenBlocklyCheck unwraps nested list-slot checks", () => {
  assertEquals(flattenBlocklyCheck(["DV_IDENTIFIER", "Array"]), ["DV_IDENTIFIER", "Array"]);
  assertEquals(flattenBlocklyCheck([["DV_IDENTIFIER"], "Array"]), ["DV_IDENTIFIER", "Array"]);
  assertEquals(flattenBlocklyCheck([["DV_TEXT", "DV_CODED_TEXT"], "Array"]), [
    "DV_TEXT",
    "DV_CODED_TEXT",
    "Array",
  ]);
});

Deno.test("blocklyCheckForDv includes concrete subtypes of abstract DV slots", () => {
  assertEquals(blocklyCheckForDv("DV_QUANTITY"), ["DV_QUANTITY"]);
  const encapsulated = flattenBlocklyCheck(blocklyCheckForDv("DV_ENCAPSULATED"));
  assert(encapsulated.includes("DV_ENCAPSULATED"));
  assert(encapsulated.includes("DV_MULTIMEDIA"));
  assert(encapsulated.includes("DV_PARSABLE"));
});

Deno.test("RM BMM snap matrix: every registered mouth accepts subtypes and rejects siblings", () => {
  ensure();
  const ws = new Blockly.Workspace();
  try {
    const result = evaluateRmBmmSnapMatrix(ws);
    assertEquals(
      result.failures,
      [],
      `${result.failed} mismatches:\n${result.failures.slice(0, 40).map((f) => `${f.label}: ${f.detail}`).join("\n")}`,
    );
    assert(result.total > 500, `expected a dense matrix, got ${result.total} pairs`);
  } finally {
    ws.dispose();
  }
});

Deno.test("typed ELEMENT.value accepts configured DV family and rejects other DV shells", () => {
  ensure();
  const ws = new Blockly.Workspace();
  try {
    for (const dv of ["DV_QUANTITY", "DV_TEXT", "DV_BOOLEAN", "DV_ENCAPSULATED"] as const) {
      const element = ws.newBlock("element");
      configureElementValueSlot(element, dv);
      const slot = element.getInput("VALUE")?.connection;
      for (const leaf of dataValueLeafTypes()) {
        const shell = ws.newBlock(blockTypeForRm(leaf));
        const expected = leaf === dv || isSubtypeOf(leaf, dv) ||
          (dv === "DV_TEXT" && leaf === "DV_CODED_TEXT");
        const actual = canConnect(ws, slot, shell.outputConnection);
        assertEquals(
          actual,
          expected,
          `ELEMENT.value[${dv}] ← ${leaf} expected ${expected} got ${actual}`,
        );
        shell.dispose(false);
      }
      const number = ws.newBlock("math_number");
      assertEquals(
        canConnect(ws, slot, number.outputConnection),
        false,
        `ELEMENT.value[${dv}] must reject raw math_number`,
      );
      number.dispose(false);
      element.dispose(false);
    }
  } finally {
    ws.dispose();
  }
});

Deno.test("primitive RM / DV field slots accept matching expressions only", () => {
  ensure();
  const ws = new Blockly.Workspace();
  try {
    const qty = ws.newBlock("dv_quantity");
    const magnitude = qty.getInput(dvFieldInputName("magnitude"))?.connection;
    const units = qty.getInput(dvFieldInputName("units"))?.connection;
    for (const expr of EXPR_BLOCKS) {
      const block = ws.newBlock(expr.type);
      assertEquals(
        canConnect(ws, magnitude, block.outputConnection),
        expr.check === "Number",
        `dv_quantity.magnitude ← ${expr.type}`,
      );
      assertEquals(
        canConnect(ws, units, block.outputConnection),
        expr.check === "String",
        `dv_quantity.units ← ${expr.type}`,
      );
      block.dispose(false);
    }

    const phrase = ws.newBlock("code_phrase");
    const code = phrase.getInput(dvFieldInputName("code_string"))?.connection;
    const text = ws.newBlock("text");
    const num = ws.newBlock("math_number");
    assertEquals(canConnect(ws, code, text.outputConnection), true);
    assertEquals(canConnect(ws, code, num.outputConnection), false);
  } finally {
    ws.dispose();
  }
});

Deno.test("BMM snap parent list covers every registered RM container type", () => {
  ensure();
  const listed = new Set<string>(RM_SNAP_PARENT_TYPES);
  const ws = new Blockly.Workspace();
  try {
    const missing: string[] = [];
    for (const type of Object.keys(Blockly.Blocks)) {
      if (!isRmContainerBlockType(type) && type !== "party_ref") continue;
      const block = ws.newBlock(type);
      const rm = String(block.getFieldValue("RM_TYPE") || type).toUpperCase();
      block.dispose(false);
      if (!listed.has(rm)) missing.push(`${type} (${rm})`);
    }
    for (const rm of EXTRA_RM_CONTAINERS) {
      if (!listed.has(rm)) missing.push(`EXTRA_RM_CONTAINERS ${rm}`);
    }
    assertEquals(missing, [], `registered RM types missing from BMM matrix:\n${missing.join("\n")}`);
  } finally {
    ws.dispose();
  }
});

Deno.test("XML / Conversion-start / DV-field snap matrices follow documented rules", () => {
  ensure();
  const ws = new Blockly.Workspace();
  try {
    const xml = evaluateXmlSnapMatrix(ws);
    assertEquals(
      xml.failures,
      [],
      `XML mismatches:\n${xml.failures.slice(0, 40).map((f) => `${f.label}: ${f.detail}`).join("\n")}`,
    );
    assert(xml.total > 30, `expected a dense XML matrix, got ${xml.total}`);

    const independent = evaluateIndependentSnapMatrix(ws);
    assertEquals(
      independent.failures,
      [],
      `${independent.failed} independent mismatches:\n${
        independent.failures.slice(0, 40).map((f) => `${f.label}: ${f.detail}`).join("\n")
      }`,
    );
    assert(independent.total > 600, `expected a dense independent matrix, got ${independent.total}`);

    const dv = evaluateDvFieldSnapMatrix(ws);
    assertEquals(
      dv.failures,
      [],
      `DV field mismatches:\n${dv.failures.slice(0, 40).map((f) => `${f.label}: ${f.detail}`).join("\n")}`,
    );
    assert(dv.total > 40, `expected many DV field probes, got ${dv.total}`);
  } finally {
    ws.dispose();
  }
});

Deno.test("TakeCare XSD schema mouths match specForChild, not live setCheck", () => {
  ensure();
  const xsd = Deno.readTextFileSync(
    join(import.meta.dirname!, "fixtures/TakeCare/TakeCare-CasenoteWrite-edit01.xsd"),
  );
  const target = getTargetFormatHandler("xml-schema").load(
    "TakeCare-CasenoteWrite-edit01.xsd",
    xsd,
  );
  const ws = new Blockly.Workspace();
  try {
    const result = evaluateSchemaSnapMatrix(ws, target.skeleton);
    assertEquals(
      result.failures,
      [],
      `${result.failed} schema mismatches:\n${
        result.failures.slice(0, 40).map((f) => `${f.label}: ${f.detail}`).join("\n")
      }`,
    );
    assert(result.total > 40, `expected a dense schema matrix, got ${result.total}`);
  } finally {
    ws.dispose();
  }
});
