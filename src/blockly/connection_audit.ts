/**
 * Blockly connection audit — snap matrix checks and save/reload verification.
 * Shared by unit tests, UI test API, and Agent/MCP tools.
 */

import { Blockly } from "./blockly_core.ts";
import { initBlocklyGenerators } from "./mod.ts";
import {
  configureElementValueSlot,
  dvFieldInputName,
  restoreAllElementValueSlots,
  rmAttributeInputName,
  RM_SPECIALIZATION_INPUT,
  syncRmAttributeInputs,
} from "./blocks/rm_blocks.ts";
import { LOGIC_LIST_RESTRICTION_BLOCK } from "./blocks/logic_blocks.ts";
import {
  applyInstanceRootCap,
  CONVERSION_START_TYPE,
  INSTANCE_ROOT_CONNECTION,
} from "./instance_root.ts";
import {
  XML_ATTRIBUTES_INPUT,
  XML_ATTRIBUTE_TYPE,
  XML_CHILDREN_INPUT,
  XML_ELEMENT_TYPE,
  XML_TEXT_INPUT,
} from "../core/xml_shape.ts";

export type SnapCase = {
  label: string;
  expect: boolean;
  connect: (ws: Blockly.Workspace) => [
    Blockly.Connection | null | undefined,
    Blockly.Connection | null | undefined,
  ];
};

export type AuditFailure = {
  kind: "matrix" | "connected" | "round_trip";
  label: string;
  detail?: string;
};

export type ConnectionAuditReport = {
  ok: boolean;
  matrix: { passed: number; failed: number; total: number };
  connected: { passed: number; failed: number; total: number };
  roundTrip: { passed: number; failed: number; total: number };
  failures: AuditFailure[];
};

let blocksReady = false;

export function ensureConnectionAuditBlocks(): void {
  if (blocksReady) return;
  initBlocklyGenerators();
  blocksReady = true;
}

export function canConnectSnap(
  workspace: Blockly.Workspace,
  a: Blockly.Connection | null | undefined,
  b: Blockly.Connection | null | undefined,
  isDrag = false,
): boolean {
  if (!a || !b) return false;
  return workspace.connectionChecker.canConnect(a, b, isDrag);
}

function stmtPrev(type: string, ws: Blockly.Workspace): Blockly.Connection | null {
  return ws.newBlock(type).previousConnection;
}

function valueOut(type: string, ws: Blockly.Workspace): Blockly.Connection | null {
  return ws.newBlock(type).outputConnection;
}

function inputConn(
  block: Blockly.Block,
  inputName: string,
): Blockly.Connection | null | undefined {
  return block.getInput(inputName)?.connection;
}

/** Expected snap outcomes for core block families (positive and negative). */
export function snapMatrixCases(): SnapCase[] {
  return [
    {
      label: "SECTION nests in composition.content",
      expect: true,
      connect: (ws) => [
        inputConn(ws.newBlock("composition"), rmAttributeInputName("content")),
        stmtPrev("section", ws),
      ],
    },
    {
      label: "CLUSTER rejected from composition.content",
      expect: false,
      connect: (ws) => [
        inputConn(ws.newBlock("composition"), rmAttributeInputName("content")),
        stmtPrev("cluster", ws),
      ],
    },
    {
      label: "HISTORY nests in observation.data",
      expect: true,
      connect: (ws) => {
        const observation = ws.newBlock("observation");
        syncRmAttributeInputs(observation, "OBSERVATION", ["data"]);
        return [inputConn(observation, rmAttributeInputName("data")), stmtPrev("history", ws)];
      },
    },
    {
      label: "EVENT rejected from composition.content",
      expect: false,
      connect: (ws) => [
        inputConn(ws.newBlock("composition"), rmAttributeInputName("content")),
        stmtPrev("event", ws),
      ],
    },
    {
      label: "DV_QUANTITY shell in configured quantity slot",
      expect: true,
      connect: (ws) => {
        const element = ws.newBlock("element");
        configureElementValueSlot(element, "DV_QUANTITY");
        return [inputConn(element, "VALUE"), valueOut("dv_quantity", ws)];
      },
    },
    {
      label: "DV_TEXT rejected from quantity slot",
      expect: false,
      connect: (ws) => {
        const element = ws.newBlock("element");
        configureElementValueSlot(element, "DV_QUANTITY");
        return [inputConn(element, "VALUE"), valueOut("dv_text", ws)];
      },
    },
    {
      label: "Raw math_number rejected from element.VALUE",
      expect: false,
      connect: (ws) => {
        const element = ws.newBlock("element");
        configureElementValueSlot(element, "DV_QUANTITY");
        return [inputConn(element, "VALUE"), valueOut("math_number", ws)];
      },
    },
    {
      label: "PARTY_SELF rejected from health_care_facility",
      expect: false,
      connect: (ws) => {
        const context = ws.newBlock("event_context");
        syncRmAttributeInputs(context, "EVENT_CONTEXT", ["health_care_facility"]);
        return [
          inputConn(context, rmAttributeInputName("health_care_facility")),
          valueOut("party_self", ws),
        ];
      },
    },
    {
      label: "source_query_number in magnitude field",
      expect: true,
      connect: (ws) => {
        const shell = ws.newBlock("dv_quantity");
        return [inputConn(shell, dvFieldInputName("magnitude")), valueOut("source_query_number", ws)];
      },
    },
    {
      label: "composition chains under Conversion start",
      expect: true,
      connect: (ws) => {
        const start = ws.newBlock(CONVERSION_START_TYPE);
        const composition = ws.newBlock("composition");
        applyInstanceRootCap(composition);
        return [start.nextConnection, composition.previousConnection];
      },
    },
    {
      label: "OBSERVATION rejected from Conversion start",
      expect: false,
      connect: (ws) => [ws.newBlock(CONVERSION_START_TYPE).nextConnection, stmtPrev("observation", ws)],
    },
    {
      label: "for_each_source chains under Conversion start",
      expect: true,
      connect: (ws) => [
        ws.newBlock(CONVERSION_START_TYPE).nextConnection,
        stmtPrev("for_each_source", ws),
      ],
    },
    {
      label: "xml_attribute stacks in attributes mouth",
      expect: true,
      connect: (ws) => {
        const el = ws.newBlock(XML_ELEMENT_TYPE);
        return [inputConn(el, XML_ATTRIBUTES_INPUT), stmtPrev(XML_ATTRIBUTE_TYPE, ws)];
      },
    },
    {
      label: "composition rejected from xml_element children",
      expect: false,
      connect: (ws) => {
        const el = ws.newBlock(XML_ELEMENT_TYPE);
        return [inputConn(el, XML_CHILDREN_INPUT), stmtPrev("composition", ws)];
      },
    },
    {
      label: "logic_boolean in PRED slot",
      expect: true,
      connect: (ws) => {
        const block = ws.newBlock(LOGIC_LIST_RESTRICTION_BLOCK);
        return [inputConn(block, "PRED"), valueOut("logic_boolean", ws)];
      },
    },
    {
      label: "math_number rejected from PRED slot",
      expect: false,
      connect: (ws) => {
        const block = ws.newBlock(LOGIC_LIST_RESTRICTION_BLOCK);
        return [inputConn(block, "PRED"), valueOut("math_number", ws)];
      },
    },
    {
      label: "String literal rejected from handlebars context",
      expect: false,
      connect: (ws) => {
        const block = ws.newBlock("text_handlebars");
        return [inputConn(block, "CONTEXT"), valueOut("text", ws)];
      },
    },
    {
      label: "PARTY_REF rejected from PARTY_PROXY kind slot",
      expect: false,
      connect: (ws) => {
        const proxy = ws.newBlock("party_proxy");
        return [inputConn(proxy, RM_SPECIALIZATION_INPUT), valueOut("party_ref", ws)];
      },
    },
  ];
}

export function runSnapMatrixAudit(
  workspace: Blockly.Workspace,
  cases: SnapCase[] = snapMatrixCases(),
): { passed: number; failed: number; total: number; failures: AuditFailure[] } {
  let passed = 0;
  let failed = 0;
  const failures: AuditFailure[] = [];
  for (const testCase of cases) {
    const [a, b] = testCase.connect(workspace);
    const actual = canConnectSnap(workspace, a, b, false);
    if (actual === testCase.expect) {
      passed++;
    } else {
      failed++;
      failures.push({
        kind: "matrix",
        label: testCase.label,
        detail: `expected ${testCase.expect}, got ${actual}`,
      });
    }
  }
  return { passed, failed, total: cases.length, failures };
}

/** Every live connection on the canvas must still pass canConnect. */
export function auditLiveConnections(
  workspace: Blockly.Workspace,
): { passed: number; failed: number; total: number; failures: AuditFailure[] } {
  let passed = 0;
  let failed = 0;
  const failures: AuditFailure[] = [];

  for (const block of workspace.getAllBlocks(false)) {
    for (const input of block.inputList) {
      const parentConn = input.connection;
      const child = parentConn?.targetBlock();
      if (!parentConn || !child) continue;
      const childConn = child.outputConnection ?? child.previousConnection;
      if (!childConn) continue;
      if (canConnectSnap(workspace, parentConn, childConn, false)) {
        passed++;
      } else {
        failed++;
        failures.push({
          kind: "connected",
          label: `${block.type}.${input.name} → ${child.type}`,
          detail: `check=${JSON.stringify(parentConn.getCheck())} output=${JSON.stringify(childConn.getCheck())}`,
        });
      }
    }
    const next = block.nextConnection;
    const nextBlock = next?.targetBlock();
    if (next && nextBlock?.previousConnection) {
      if (canConnectSnap(workspace, next, nextBlock.previousConnection, false)) {
        passed++;
      } else {
        failed++;
        failures.push({
          kind: "connected",
          label: `${block.type}.next → ${nextBlock.type}`,
          detail: `check=${JSON.stringify(next.getCheck())} prev=${JSON.stringify(nextBlock.previousConnection.getCheck())}`,
        });
      }
    }
  }

  return { passed, failed, total: passed + failed, failures };
}

function buildRoundTripFixture(workspace: Blockly.Workspace): void {
  const composition = workspace.newBlock("composition");
  const section = workspace.newBlock("section");
  inputConn(composition, rmAttributeInputName("content"))!.connect(section.previousConnection!);

  const element = workspace.newBlock("element");
  element.setFieldValue("DV_QUANTITY", "RM_TYPE");
  configureElementValueSlot(element, "DV_QUANTITY");
  const shell = workspace.newBlock("dv_quantity");
  inputConn(element, "VALUE")!.connect(shell.outputConnection!);
  const src = workspace.newBlock("source_query_number");
  inputConn(shell, dvFieldInputName("magnitude"))!.connect(src.outputConnection!);

  const start = workspace.newBlock(CONVERSION_START_TYPE);
  applyInstanceRootCap(composition);
  start.nextConnection!.connect(composition.previousConnection!);

  const xmlDoc = workspace.newBlock("xml_document");
  applyInstanceRootCap(xmlDoc);
  const xmlEl = workspace.newBlock(XML_ELEMENT_TYPE);
  inputConn(xmlDoc, "TARGET_root")!.connect(xmlEl.previousConnection!);
  const attr = workspace.newBlock(XML_ATTRIBUTE_TYPE);
  inputConn(xmlEl, XML_ATTRIBUTES_INPUT)!.connect(attr.previousConnection!);
  inputConn(xmlEl, XML_TEXT_INPUT)!.connect(workspace.newBlock("xml_text").outputConnection!);
}

export function auditRoundTripReload(
  workspace: Blockly.Workspace,
): { passed: number; failed: number; total: number; failures: AuditFailure[] } {
  buildRoundTripFixture(workspace);
  const beforeCount = countConnections(workspace);
  const saved = Blockly.serialization.workspaces.save(workspace);
  workspace.clear();
  Blockly.serialization.workspaces.load(saved, workspace);
  restoreAllElementValueSlots(workspace);

  const failures: AuditFailure[] = [];
  let passed = 0;
  const checks = [
    {
      label: "ELEMENT.value keeps DV_QUANTITY check after reload",
      ok: () => {
        const element = workspace.getAllBlocks(false).find((b) => b.type === "element");
        const valueCheck = element?.getInput("VALUE")?.connection?.getCheck();
        return Array.isArray(valueCheck)
          ? valueCheck.includes("DV_QUANTITY")
          : valueCheck === "DV_QUANTITY";
      },
      detail: () => {
        const element = workspace.getAllBlocks(false).find((b) => b.type === "element");
        return JSON.stringify(element?.getInput("VALUE")?.connection?.getCheck());
      },
    },
    {
      label: "connections survive Blockly JSON reload",
      ok: () => countConnections(workspace) >= beforeCount,
      detail: () => `before=${beforeCount} after=${countConnections(workspace)}`,
    },
  ];

  for (const check of checks) {
    if (check.ok()) {
      passed++;
    } else {
      failures.push({
        kind: "round_trip",
        label: check.label,
        detail: check.detail(),
      });
    }
  }

  const live = auditLiveConnections(workspace);
  passed += live.passed;
  failures.push(...live.failures.map((f) => ({ ...f, kind: "round_trip" as const })));

  const total = checks.length + live.total;
  const failed = failures.length;
  return { passed: total - failed, failed, total, failures };
}

function countConnections(workspace: Blockly.Workspace): number {
  let n = 0;
  for (const block of workspace.getAllBlocks(false)) {
    for (const input of block.inputList) {
      if (input.connection?.isConnected()) n++;
    }
    if (block.nextConnection?.isConnected()) n++;
  }
  return n;
}

export function runConnectionAudit(
  workspace: Blockly.Workspace,
  options?: { includeMatrix?: boolean; includeRoundTrip?: boolean },
): ConnectionAuditReport {
  restoreAllElementValueSlots(workspace);
  const includeMatrix = options?.includeMatrix ?? true;
  const includeRoundTrip = options?.includeRoundTrip ?? true;

  const matrix = includeMatrix
    ? runSnapMatrixAudit(workspace)
    : { passed: 0, failed: 0, total: 0, failures: [] as AuditFailure[] };
  const connected = auditLiveConnections(workspace);

  let roundTrip = { passed: 0, failed: 0, total: 0, failures: [] as AuditFailure[] };
  if (includeRoundTrip) {
    const rtWs = new Blockly.Workspace();
    try {
      roundTrip = auditRoundTripReload(rtWs);
    } finally {
      rtWs.dispose();
    }
  }

  const failures = [...matrix.failures, ...connected.failures, ...roundTrip.failures];
  return {
    ok: failures.length === 0,
    matrix: { passed: matrix.passed, failed: matrix.failed, total: matrix.total },
    connected: { passed: connected.passed, failed: connected.failed, total: connected.total },
    roundTrip: { passed: roundTrip.passed, failed: roundTrip.failed, total: roundTrip.total },
    failures,
  };
}

export function auditBlocklyState(
  blocklyState: unknown,
  options?: { includeMatrix?: boolean; includeRoundTrip?: boolean },
): ConnectionAuditReport {
  ensureConnectionAuditBlocks();
  const workspace = new Blockly.Workspace();
  try {
    if (blocklyState && typeof blocklyState === "object") {
      Blockly.serialization.workspaces.load(
        blocklyState as Record<string, unknown>,
        workspace,
      );
    }
    return runConnectionAudit(workspace, options);
  } finally {
    workspace.dispose();
  }
}

/** Human-readable summary for MCP / Agent API responses. */
export function formatConnectionAuditReport(report: ConnectionAuditReport): string {
  if (report.ok) {
    return [
      "All block connection checks passed.",
      `Matrix: ${report.matrix.passed}/${report.matrix.total}`,
      `Live: ${report.connected.passed}/${report.connected.total}`,
      `Round-trip: ${report.roundTrip.passed}/${report.roundTrip.total}`,
    ].join(" ");
  }
  const lines = report.failures.slice(0, 20).map((f) => `- [${f.kind}] ${f.label}${f.detail ? `: ${f.detail}` : ""}`);
  return [
    `Connection audit failed (${report.failures.length} issue(s)).`,
    `Matrix: ${report.matrix.passed}/${report.matrix.total}`,
    `Live: ${report.connected.passed}/${report.connected.total}`,
    `Round-trip: ${report.roundTrip.passed}/${report.roundTrip.total}`,
    ...lines,
  ].join("\n");
}
