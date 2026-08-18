/**
 * Project Blockly workspace JSON into a dense, line-numbered Mapping Specification.
 * Coordinates and other layout chrome are omitted from the text; kept in `info` for ⓘ.
 */

export type SpecLineKind =
  | "header"
  | "container"
  | "value"
  | "source_query"
  | "dv"
  | "other";

export interface SpecEditableField {
  field: "EXPRESSION" | "RETURN_TYPE";
  value: string;
}

export interface SpecLine {
  kind: SpecLineKind;
  indent: number;
  /** Stable Blockly block id when this line maps to a block. */
  blockId?: string;
  type: string;
  label: string;
  /** One-line summary shown in the widget chrome. */
  summary: string;
  editable?: SpecEditableField[];
  /** Hidden details for the info balloon (x/y, raw fields, etc.). */
  info: Record<string, unknown>;
}

export interface SpecProjection {
  text: string;
  lines: SpecLine[];
}

interface BlocklyBlockJson {
  type?: string;
  id?: string;
  x?: number;
  y?: number;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: BlocklyBlockJson; shadow?: BlocklyBlockJson }>;
  next?: { block?: BlocklyBlockJson };
  extraState?: unknown;
  icons?: unknown;
}

interface BlocklyWorkspaceJson {
  blocks?: {
    languageVersion?: number;
    blocks?: BlocklyBlockJson[];
  };
  variables?: unknown;
}

const DV_PREFIX = "dv_";

export function projectBlocklyState(state: unknown): SpecProjection {
  const lines: SpecLine[] = [];
  lines.push({
    kind: "header",
    indent: 0,
    type: "header",
    label: "Mapping Specification",
    summary: "Blockly projection · layout chrome omitted · ⓘ for details",
    info: {
      note: "Canonical state remains ProjectBundle.mapping.blocklyState (includes x/y).",
    },
  });

  if (state == null || typeof state !== "object") {
    lines.push({
      kind: "other",
      indent: 0,
      type: "empty",
      label: "(empty workspace)",
      summary: "",
      info: {},
    });
    return toProjection(lines);
  }

  const workspace = state as BlocklyWorkspaceJson;
  const roots = workspace.blocks?.blocks ?? [];
  if (!roots.length) {
    lines.push({
      kind: "other",
      indent: 0,
      type: "empty",
      label: "(no blocks)",
      summary: "",
      info: { languageVersion: workspace.blocks?.languageVersion },
    });
    return toProjection(lines);
  }

  for (const root of roots) {
    walkBlock(root, 0, lines);
  }
  return toProjection(lines);
}

function walkBlock(block: BlocklyBlockJson, indent: number, lines: SpecLine[]): void {
  const type = block.type ?? "unknown";
  const fields = block.fields ?? {};
  const kind = classify(type);
  const label = pickLabel(type, fields);
  const editable = editableFields(type, fields);
  const info = collectInfo(block);

  lines.push({
    kind,
    indent,
    blockId: typeof block.id === "string" ? block.id : undefined,
    type,
    label,
    summary: buildSummary(kind, type, fields, label),
    editable: editable.length ? editable : undefined,
    info,
  });

  if (block.inputs) {
    for (const [inputName, input] of Object.entries(block.inputs)) {
      const child = input?.block ?? input?.shadow;
      if (!child) continue;
      // Skip nesting wrapper noise in the summary tree — still walk children.
      void inputName;
      walkBlock(child, indent + 1, lines);
    }
  }
  if (block.next?.block) {
    walkBlock(block.next.block, indent, lines);
  }
}

function classify(type: string): SpecLineKind {
  if (type === "source_query") return "source_query";
  if (type === "element" || type === "target_value") return "value";
  if (type === "target_structure" || type.startsWith("rm_")) return "container";
  if (type.startsWith(DV_PREFIX) || type.startsWith("DV_")) return "dv";
  if (
    [
      "composition",
      "observation",
      "evaluation",
      "instruction",
      "action",
      "admin_entry",
      "section",
      "cluster",
      "item_tree",
      "item_list",
      "item_single",
      "item_table",
      "event",
      "point_event",
      "interval_event",
      "history",
    ].includes(type)
  ) {
    return "container";
  }
  return "other";
}

function pickLabel(type: string, fields: Record<string, unknown>): string {
  for (const key of ["NAME", "LABEL", "VAR", "TEXT"]) {
    const value = fields[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  const rm = fields["RM_TYPE"] ?? fields["TARGET_TYPE"];
  if (typeof rm === "string" && rm) return rm;
  return type;
}

function editableFields(
  type: string,
  fields: Record<string, unknown>,
): SpecEditableField[] {
  if (type !== "source_query") return [];
  return [
    {
      field: "RETURN_TYPE",
      value: typeof fields["RETURN_TYPE"] === "string" ? fields["RETURN_TYPE"] : "string",
    },
    {
      field: "EXPRESSION",
      value: typeof fields["EXPRESSION"] === "string" ? fields["EXPRESSION"] : "",
    },
  ];
}

function buildSummary(
  kind: SpecLineKind,
  type: string,
  fields: Record<string, unknown>,
  label: string,
): string {
  const rm = typeof fields["RM_TYPE"] === "string"
    ? fields["RM_TYPE"]
    : typeof fields["TARGET_TYPE"] === "string"
    ? fields["TARGET_TYPE"]
    : "";
  const slot = typeof fields["SLOT_ID"] === "string" ? fields["SLOT_ID"] : "";
  if (kind === "source_query") {
    const expr = typeof fields["EXPRESSION"] === "string" ? fields["EXPRESSION"] : "";
    const ret = typeof fields["RETURN_TYPE"] === "string" ? fields["RETURN_TYPE"] : "string";
    return `${ret} · ${expr}`;
  }
  if (kind === "value" || kind === "container" || kind === "dv") {
    return [label !== type ? label : "", rm && rm !== label ? rm : "", slot ? `slot ${shortSlot(slot)}` : ""]
      .filter(Boolean)
      .join(" · ");
  }
  return label !== type ? label : "";
}

function shortSlot(slotId: string): string {
  const parts = slotId.split("/");
  return parts.length <= 2 ? slotId : `…/${parts.slice(-2).join("/")}`;
}

function collectInfo(block: BlocklyBlockJson): Record<string, unknown> {
  const info: Record<string, unknown> = {};
  if (block.id) info.id = block.id;
  if (block.type) info.type = block.type;
  if (typeof block.x === "number") info.x = block.x;
  if (typeof block.y === "number") info.y = block.y;
  if (block.fields && Object.keys(block.fields).length) info.fields = block.fields;
  if (block.extraState !== undefined) info.extraState = block.extraState;
  if (block.inputs) info.inputNames = Object.keys(block.inputs);
  return info;
}

function toProjection(lines: SpecLine[]): SpecProjection {
  const text = lines
    .map((line) => {
      const pad = "  ".repeat(line.indent);
      const parts = [line.type];
      if (line.summary) parts.push(line.summary);
      else if (line.label && line.label !== line.type) parts.push(line.label);
      return `${pad}${parts.join(" · ")}`;
    })
    .join("\n");
  return { text, lines };
}
