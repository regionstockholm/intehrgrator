/**
 * Copy-paste AI assist: build external prompts and import suggestion envelopes.
 * Response format: docs/AI_SUGGESTION_FORMAT.md (version 2).
 */

import type {
  ImportSuggestionsReport,
  MappingModel,
  SkeletonNode,
  SuggestionBlock,
  SuggestionEnvelope,
  TargetFormatId,
} from "../../types/mod.ts";
import { applyExpressionEdit } from "../mapping_model/mod.ts";
import { collectValueSlots } from "../skeleton/generate_skeleton.ts";
import { validateExpressionSource } from "../expression/mod.ts";

export type AiArtifactDelivery = "attach" | "inline" | "uri";

export type AiArtifactRole = "target" | "source-schema" | "example" | "target-fileset";

export interface AiPromptArtifact {
  role: AiArtifactRole;
  filename: string;
  format: string;
  content: string;
  /** Present when loaded from a URL (or GitHub clinical-model root). */
  originUrl?: string;
}

export interface BuildPromptOptions {
  scope: "full" | "slot";
  slotId?: string;
  targetId: string;
  targetFormat: TargetFormatId | string;
  targetFilename: string;
  skeleton: SkeletonNode[];
  model: MappingModel;
  formatDocUrl: string;
  delivery: AiArtifactDelivery;
  artifacts: AiPromptArtifact[];
  sourceFormat?: string;
  activeExampleFilename?: string;
}

const VALUE_BLOCK_TYPES = new Set([
  "source_query",
  "source_query_number",
  "source_query_boolean",
  "variables_get",
  "text",
  "math_number",
  "logic_boolean",
  "text_trim",
  "text_join",
  "math_arithmetic",
  "logic_ternary",
]);

const MULTIPART_BOUNDARY = "intehrgrator-part";

function isAbsoluteSourcePath(expr: string): boolean {
  return expr.startsWith("$") || expr.startsWith("/");
}

/** Join loop PATH + relative child steps for import into Mapping Model expressions. */
export function joinLoopPath(loopPath: string, relative: string): string {
  const rel = relative.replace(/^\.\//, "").replace(/^\./, "");
  if (!rel) return loopPath;
  if (isAbsoluteSourcePath(rel)) return rel;
  if (loopPath.startsWith("$")) {
    if (rel.startsWith("[")) return `${loopPath}${rel}`;
    return `${loopPath}/${rel.replace(/^\//, "")}`;
  }
  if (loopPath.startsWith("/")) {
    return `${loopPath.replace(/\/$/, "")}/${rel.replace(/^\//, "")}`;
  }
  return `${loopPath}/${rel}`;
}

export function buildPrompt(options: BuildPromptOptions): string {
  const valueSlots = collectValueSlots(options.skeleton);
  const mapped = new Set(options.model.slots.filter((s) => s.expression).map((s) => s.slotId));
  const inScope = valueSlots.filter((s) => {
    if (options.scope === "slot") return s.slotId === options.slotId;
    return !mapped.has(s.slotId);
  });

  const manifest = inScope.map((s) => ({
    slotId: s.slotId,
    valueType: s.rmType,
    label: s.label,
    ...(s.targetPath ? { targetPath: s.targetPath } : {}),
    ...(s.multiplicity ? { multiplicity: s.multiplicity } : {}),
    ...(s.archetypeNodeId ? { archetypeNodeId: s.archetypeNodeId } : {}),
  }));

  const targetLabel = formatTargetTask(options.targetFormat);
  const sections: string[] = [
    "# intEHRgrator mapping assist",
    "",
    "## Task",
    `Map source data to ${targetLabel} conforming to the loaded target definition.`,
    "",
    "## Target",
    `- format: \`${options.targetFormat}\``,
    `- targetId: \`${options.targetId}\``,
    `- filename: \`${options.targetFilename || "(none)"}\``,
    "",
    "## Source",
    options.sourceFormat
      ? `- schema format: \`${options.sourceFormat}\``
      : "- (no source schema loaded)",
    options.activeExampleFilename
      ? `- active example: \`${options.activeExampleFilename}\``
      : "- (no active example)",
    "",
    `## Scope: \`${options.scope}\``,
  ];
  if (options.slotId) sections.push(`- slotId: \`${options.slotId}\``);

  sections.push(
    "",
    "## Response format",
    `Respond with exactly one fenced JSON block tagged \`intehrgrator-suggestions\` per: ${options.formatDocUrl}`,
    "Use version `\"2\"` with Blockly `block` fragments (not JS-shaped xpath wrappers).",
    "",
    "## Slot manifest",
    "```json",
    JSON.stringify(manifest, null, 2),
    "```",
    "",
  );

  sections.push(...deliverySections(options.delivery, options.artifacts));
  sections.push(
    "",
    "## Instruction",
    "Return exactly one `intehrgrator-suggestions` fenced JSON block. Copy each `slotId` from the slot manifest. Prefer `source_query*` blocks with fontoxpath in `EXPRESSION`. For repeating `multiplicity` (`0..*` / `1..*`), emit `loops` with `for_each_source` and child suggestions with matching `loopVar` + relative `EXPRESSION`.",
  );

  if (options.delivery === "inline") {
    const parts = options.artifacts.filter((a) => a.content.length > 0);
    if (parts.length) {
      sections.push("", formatMultipart(parts));
    }
  }

  return sections.filter((line, i, arr) => !(line === "" && arr[i - 1] === "")).join("\n");
}

function formatTargetTask(format: string): string {
  switch (format) {
    case "openehr-template":
      return "an openEHR Composition";
    case "json-schema":
      return "a JSON document";
    case "xml-schema":
      return "an XML document";
    case "free-form":
      return "a free-form text / Handlebars output";
    default:
      return `instances of target format \`${format}\``;
  }
}

function deliverySections(
  delivery: AiArtifactDelivery,
  artifacts: AiPromptArtifact[],
): string[] {
  if (!artifacts.length) {
    return ["## Artifacts", "No source/target files are loaded yet."];
  }

  if (delivery === "inline") {
    return [
      "## Artifact delivery: inline multipart",
      "File bodies are appended below as multipart parts (`--intehrgrator-part`). Do not ask the user to upload files.",
      ...artifactSummaryLines(artifacts),
    ];
  }

  if (delivery === "uri") {
    const browsable = artifacts.filter((a) => a.originUrl);
    const local = artifacts.filter((a) => !a.originUrl);
    const out: string[] = [
      "## Artifact delivery: browse URIs",
      "Fetch each URL below and use the response body as that artifact. Do not ask the user to upload these files.",
      "",
      "## Browse URIs",
    ];
    if (browsable.length) {
      for (const a of browsable) {
        out.push(`- ${roleLabel(a)}: ${a.originUrl}`);
      }
    } else {
      out.push("- (none — no URI-loaded artifacts)");
    }
    if (local.length) {
      out.push("", "## Attachments (no URI — upload these)");
      for (const a of local) {
        out.push(`- ${roleLabel(a)}: \`${a.filename}\``);
      }
    }
    return out;
  }

  // attach
  const out: string[] = [
    "## Artifact delivery: attach in chat",
    "Attach these files to the chat before answering. URIs below are for context only — do not assume you can fetch them.",
    "",
    "## Attachments",
  ];
  for (const a of artifacts) {
    const origin = a.originUrl ? `\n  (loaded from \`${a.originUrl}\`)` : "";
    out.push(`- ${roleLabel(a)}: \`${a.filename}\`${origin}`);
  }
  return out;
}

function artifactSummaryLines(artifacts: AiPromptArtifact[]): string[] {
  return [
    "",
    "### Parts included",
    ...artifacts.map((a) => {
      const origin = a.originUrl ? ` · origin ${a.originUrl}` : "";
      return `- ${roleLabel(a)}: \`${a.filename}\`${origin}`;
    }),
  ];
}

function roleLabel(a: AiPromptArtifact): string {
  return `${a.role} (\`${a.format}\`)`;
}

export function formatMultipart(artifacts: AiPromptArtifact[]): string {
  const chunks: string[] = [];
  for (const a of artifacts) {
    chunks.push(`--${MULTIPART_BOUNDARY}`);
    chunks.push(`Content-Type: ${mimeForFilename(a.filename)}; charset=utf-8`);
    chunks.push(`Content-Disposition: attachment; filename="${escapeFilename(a.filename)}"`);
    chunks.push(`X-Intehrgrator-Role: ${a.role}`);
    if (a.originUrl) chunks.push(`X-Intehrgrator-Origin: ${a.originUrl}`);
    chunks.push("");
    chunks.push(a.content);
  }
  chunks.push(`--${MULTIPART_BOUNDARY}--`);
  return chunks.join("\n");
}

export function mimeForFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".json") || lower.endsWith(".wt.json") || lower.endsWith(".t.json")) {
    return "application/json";
  }
  if (
    lower.endsWith(".xml") || lower.endsWith(".opt") || lower.endsWith(".opt2") ||
    lower.endsWith(".xsd")
  ) {
    return "application/xml";
  }
  if (lower.endsWith(".adl") || lower.endsWith(".adls")) return "text/plain";
  if (lower.endsWith(".hbs") || lower.endsWith(".handlebars")) return "text/x-handlebars";
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".csv")) return "text/csv";
  return "text/plain";
}

function escapeFilename(name: string): string {
  return name.replace(/["\r\n]/g, "_");
}

export function parseSuggestionsPayload(text: string): SuggestionEnvelope {
  const fence = text.match(/```intehrgrator-suggestions\s*([\s\S]*?)```/);
  const raw = fence?.[1]?.trim() ?? text.trim();
  const parsed = JSON.parse(raw) as SuggestionEnvelope;
  if (parsed.format !== "intehrgrator-suggestions") {
    throw new Error("Invalid format field");
  }
  if (parsed.version !== "2") {
    throw new Error(`Unsupported version: ${parsed.version} (expected "2")`);
  }
  if (!parsed.target?.targetId || !parsed.target?.format) {
    throw new Error("Missing target.targetId or target.format");
  }
  if (!Array.isArray(parsed.suggestions)) {
    throw new Error("Missing suggestions array");
  }
  return parsed;
}

export function importSuggestions(
  model: MappingModel,
  payload: SuggestionEnvelope,
  knownSlotIds: Set<string>,
  slotMeta?: Map<string, { rmType: string; returnType: string; label?: string; mandatory?: boolean }>,
): { model: MappingModel; report: ImportSuggestionsReport } {
  if (payload.target.targetId !== model.templateId) {
    throw new Error(
      `targetId mismatch: expected ${model.templateId}, got ${payload.target.targetId}`,
    );
  }
  if (model.targetFormat && payload.target.format !== model.targetFormat) {
    throw new Error(
      `target format mismatch: expected ${model.targetFormat}, got ${payload.target.format}`,
    );
  }

  let next = model;
  const report: ImportSuggestionsReport = {
    applied: 0,
    skipped: 0,
    errors: [],
    loopsAccepted: 0,
  };

  const loopPaths = new Map<string, string>();
  for (const loop of payload.loops ?? []) {
    try {
      validateLoopEntry(loop.block);
      if (!knownSlotIds.has(loop.attachSlotId)) {
        throw new Error(`Unknown attachSlotId: ${loop.attachSlotId}`);
      }
      const varName = String(loop.block.fields?.VAR ?? "");
      const path = String(loop.block.fields?.PATH ?? "");
      if (!varName || !path) throw new Error("for_each_source requires VAR and PATH");
      if (loopPaths.has(varName)) {
        throw new Error(`Duplicate loop VAR: ${varName}`);
      }
      loopPaths.set(varName, path);
      report.loopsAccepted++;
    } catch (e) {
      report.skipped++;
      report.errors.push(
        `loop ${loop.attachSlotId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  for (const suggestion of payload.suggestions) {
    if (!knownSlotIds.has(suggestion.slotId)) {
      report.skipped++;
      report.errors.push(`Unknown slotId: ${suggestion.slotId}`);
      continue;
    }
    let expression: string;
    try {
      if (suggestion.block.type === "for_each_source") {
        throw new Error("for_each_source belongs in loops[], not suggestions[].block");
      }
      const rewrite = suggestion.loopVar
        ? (xpath: string) => {
          const base = loopPaths.get(suggestion.loopVar!);
          if (!base) {
            throw new Error(`Unknown loopVar: ${suggestion.loopVar}`);
          }
          return isAbsoluteSourcePath(xpath) ? xpath : joinLoopPath(base, xpath);
        }
        : undefined;
      expression = suggestionBlockToExpression(suggestion.block, rewrite);
    } catch (e) {
      report.skipped++;
      report.errors.push(
        `${suggestion.slotId}: ${e instanceof Error ? e.message : String(e)}`,
      );
      continue;
    }
    const err = validateExpressionSource(expression);
    if (err) {
      report.skipped++;
      report.errors.push(`${suggestion.slotId}: ${err}`);
      continue;
    }
    const meta = slotMeta?.get(suggestion.slotId);
    next = applyExpressionEdit(next, suggestion.slotId, expression, meta);
    report.applied++;
  }

  return { model: next, report };
}

/** Convert a v2 Blockly suggestion fragment into a Mapping Model expression string. */
export function suggestionBlockToExpression(
  block: SuggestionBlock,
  rewriteSourcePath?: (xpath: string) => string,
): string {
  validateBlockShape(block);
  const expr = blockJsonToExpression(block, rewriteSourcePath);
  if (!expr) throw new Error(`Unsupported or empty block type: ${block.type}`);
  return expr;
}

function validateLoopEntry(block: SuggestionBlock): void {
  if (!block || block.type !== "for_each_source") {
    throw new Error("loops[].block must be type for_each_source");
  }
  for (const key of Object.keys(block)) {
    if (!["type", "fields", "inputs", "extraState"].includes(key)) {
      throw new Error(`Disallowed block key: ${key}`);
    }
  }
  if (block.inputs?.DO?.block) {
    throw new Error("Leave for_each_source DO empty; put value fills in suggestions[]");
  }
}

function validateBlockShape(block: SuggestionBlock, depth = 0): void {
  if (depth > 12) throw new Error("Block tree too deep");
  if (!block || typeof block !== "object") throw new Error("Invalid block");
  if (typeof block.type !== "string" || !VALUE_BLOCK_TYPES.has(block.type)) {
    throw new Error(`Disallowed block type: ${String(block?.type)}`);
  }
  for (const key of Object.keys(block)) {
    if (!["type", "fields", "inputs", "extraState"].includes(key)) {
      throw new Error(`Disallowed block key: ${key}`);
    }
  }
  if (block.inputs) {
    for (const input of Object.values(block.inputs)) {
      if (input.shadow) throw new Error("Shadow blocks are not allowed; use block");
      if (input.block) validateBlockShape(input.block, depth + 1);
    }
  }
}

function blockJsonToExpression(
  block: SuggestionBlock,
  rewriteSourcePath?: (xpath: string) => string,
): string | null {
  const fields = block.fields ?? {};
  const child = (name: string) => block.inputs?.[name]?.block ?? null;

  switch (block.type) {
    case "source_query":
    case "source_query_number":
    case "source_query_boolean": {
      let xpath = String(fields.EXPRESSION ?? "");
      if (rewriteSourcePath) xpath = rewriteSourcePath(xpath);
      const fn = block.type === "source_query_number"
        ? "xpathNumber"
        : block.type === "source_query_boolean"
        ? "xpathBoolean"
        : "xpathString";
      return `${fn}(${JSON.stringify(xpath)})`;
    }
    case "variables_get": {
      const name = String(fields.VAR ?? "item");
      return `var(${JSON.stringify(name)})`;
    }
    case "text":
      return JSON.stringify(String(fields.TEXT ?? ""));
    case "math_number":
      return String(fields.NUM ?? 0);
    case "logic_boolean":
      return fields.BOOL === "TRUE" || fields.BOOL === true ? "true" : "false";
    case "text_trim": {
      const inner = child("TEXT")
        ? blockJsonToExpression(child("TEXT")!, rewriteSourcePath)
        : '""';
      return `trim(${inner ?? '""'})`;
    }
    case "text_join": {
      const itemCount = Number(
        (block.extraState as { itemCount?: number } | undefined)?.itemCount ??
          Object.keys(block.inputs ?? {}).filter((k) => k.startsWith("ADD")).length ??
          2,
      );
      const parts: string[] = [];
      for (let i = 0; i < itemCount; i++) {
        const c = child(`ADD${i}`);
        parts.push(c ? blockJsonToExpression(c, rewriteSourcePath) ?? '""' : '""');
      }
      if (parts.length === 0) return '""';
      if (parts.length === 1) return parts[0]!;
      return `concat(${parts.join(", ")})`;
    }
    case "logic_ternary": {
      const cond = child("IF")
        ? blockJsonToExpression(child("IF")!, rewriteSourcePath)
        : "false";
      const thenV = child("THEN")
        ? blockJsonToExpression(child("THEN")!, rewriteSourcePath)
        : "null";
      const elseV = child("ELSE")
        ? blockJsonToExpression(child("ELSE")!, rewriteSourcePath)
        : "null";
      return `if(${cond}, ${thenV}, ${elseV})`;
    }
    case "math_arithmetic": {
      const a = child("A") ? blockJsonToExpression(child("A")!, rewriteSourcePath) : "0";
      const b = child("B") ? blockJsonToExpression(child("B")!, rewriteSourcePath) : "0";
      const opMap: Record<string, string> = {
        ADD: "+",
        MINUS: "-",
        MULTIPLY: "*",
        DIVIDE: "/",
      };
      const op = opMap[String(fields.OP ?? "ADD")] ?? "+";
      return `(${a} ${op} ${b})`;
    }
    default:
      return null;
  }
}
