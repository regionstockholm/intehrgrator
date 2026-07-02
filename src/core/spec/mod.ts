import type { MappingModel, SkeletonNode } from "../../types/mod.ts";
import { applyExpressionEdit } from "../mapping_model/mod.ts";

function indent(level: number): string {
  return "  ".repeat(level);
}

export function toSpec(model: MappingModel, skeleton: SkeletonNode[]): string {
  const lines: string[] = [`@template ${model.templateId}`, ""];
  const slotMap = new Map(model.slots.map((s) => [s.slotId, s]));

  for (const root of skeleton) {
    renderNode(root, 0, lines, slotMap, model);
  }

  return lines.join("\n").trimEnd() + "\n";
}

function renderNode(
  node: SkeletonNode,
  level: number,
  lines: string[],
  slotMap: Map<string, { expression: string }>,
  model: MappingModel,
): void {
  const pad = indent(level);
  if (node.kind === "value") {
    const expr = slotMap.get(node.slotId)?.expression;
    lines.push(
      `${pad}element ${node.label} :: ${node.rmType} {  # slotId: ${node.slotId}`,
    );
    if (expr) lines.push(`${pad}  = ${expr}`);
    else lines.push(`${pad}  = `);
    lines.push(`${pad}}`);
    return;
  }

  const archetypeSuffix = node.archetypeId && node.archetypeNodeId
    ? ` ${node.archetypeId}`
    : "";
  lines.push(`${pad}${node.blockType}${archetypeSuffix} {  # ${node.rmType}`);
  if (node.fixedFields) {
    for (const [k, v] of Object.entries(node.fixedFields)) {
      lines.push(`${pad}  ${k} = ${JSON.stringify(v)}  # read-only`);
    }
  }

  const optionalHere = model.optionalRm.filter((o) =>
    o.attachmentSlotId === node.slotId
  );
  for (const opt of optionalHere) {
    lines.push(`${pad}  + ${opt.rmType} ${opt.attributeName}  # optional RM`);
  }

  for (const child of node.children) {
    renderNode(child, level + 1, lines, slotMap, model);
  }
  lines.push(`${pad}}`);
}

export function applySpecExpressionLineEdit(
  model: MappingModel,
  specText: string,
  line: number,
  newExpression: string,
): MappingModel {
  const lines = specText.split("\n");
  const target = lines[line];
  if (!target?.includes("= ")) {
    throw new Error("Only expression lines may be edited in the Mapping Specification");
  }
  const slotMatch = lines.slice(0, line + 1).reverse().find((l) => l.includes("# slotId:"));
  const slotId = slotMatch?.match(/slotId:\s*(\S+)/)?.[1];
  if (!slotId) throw new Error("Could not resolve slotId for expression line");
  return applyExpressionEdit(model, slotId, newExpression.trim());
}

export function findSpecLineForSlot(specText: string, slotId: string): number | null {
  const lines = specText.split("\n");
  let currentSlot: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const slotInComment = lines[i].match(/slotId:\s*(\S+)/);
    if (slotInComment) currentSlot = slotInComment[1];
    if (currentSlot === slotId && lines[i].includes("= ")) return i;
  }
  return null;
}
