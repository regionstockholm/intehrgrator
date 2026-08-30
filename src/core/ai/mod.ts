/**
 * Copy-paste AI assist: build external prompts and import suggestion envelopes.
 * Response format: docs/AI_SUGGESTION_FORMAT.md (version 2).
 */

import type {
  ImportSuggestionsReport,
  MappingLoop,
  MappingModel,
  SchemaIssue,
  SkeletonNode,
  SuggestionBlock,
  SuggestionEnvelope,
  TargetFormatId,
} from "../../types/mod.ts";
import { applyExpressionEdit } from "../mapping_model/mod.ts";
import { collectValueSlots, collectRepeatableContainers } from "../skeleton/generate_skeleton.ts";
import { validateExpressionSource } from "../expression/mod.ts";
import { Validator, type Schema } from "@cfworker/json-schema";
import { SUGGESTION_FORMAT_SCHEMA } from "./suggestion_schema.ts";
import { jsonPointerToDotPath } from "./json_locate.ts";

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
  "source_query_node",
  "variables_get",
  "text",
  "text_code",
  "text_handlebars",
  "maps_create_with",
  "maps_create_empty",
  "maps_get",
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
    const base = loopPath.replace(/\[\*\]$/, "");
    return `${base}[*].${rel.replace(/^\//, "")}`;
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
    `The JSON must validate against: ${schemaUrlFromFormatDoc(options.formatDocUrl)}`,
    "",
  );

  if (options.targetFormat === "openehr-template") {
    sections.push(...openEhrReferenceSections(options.formatDocUrl));
  }

  sections.push(
    "## Slot manifest",
    "```json",
    JSON.stringify(manifest, null, 2),
    "```",
    "",
  );

  const repeatable = collectRepeatableContainers(options.skeleton).map((s) => ({
    slotId: s.slotId,
    valueType: s.rmType,
    label: s.label,
    multiplicity: s.multiplicity,
  }));
  if (repeatable.length) {
    sections.push(
      "## Repeatable containers",
      "Copy `attachSlotId` from this list. One `for_each_source` loop per repeating container.",
      "```json",
      JSON.stringify(repeatable, null, 2),
      "```",
      "",
    );
  }

  sections.push(...deliverySections(options.delivery, options.artifacts));
  sections.push(
    "",
    "## Block examples",
    "Value slots only — no RM containers or DV shells in suggestions. Prefer maps for code/terminology translation.",
    "",
    "**Terminology translation (ICD-10 → SNOMED CT)** — `maps_get` with dynamic key from source (named map on canvas, e.g. `icd10_snomed`):",
    "```json",
    JSON.stringify({
      slotId: "{targetId}{path/to/code_string/value}",
      block: {
        type: "maps_get",
        fields: { NAME: "icd10_snomed" },
        inputs: {
          KEY: {
            block: {
              type: "source_query",
              fields: { EXPRESSION: "$.diagnosis.icd10" },
            },
          },
        },
      },
      note: "I10→38341003, E11→44054006, …",
    }, null, 2),
    "```",
    "",
    "**Defaults** — target scaffold often pre-wires `maps_get(\"defaults\", …)` for language/territory; omit unless the user asked to override.",
    "",
    "**Party identity `name` slot** (DV_TEXT value leaf):",
    "```json",
    JSON.stringify({
      slotId: "{targetId}{path/to/composer/name/value}",
      block: {
        type: "source_query",
        fields: { EXPRESSION: "$.patient.name" },
      },
    }, null, 2),
    "```",
    "",
    "**Repeating container** — put `for_each_source` in top-level `loops[]`; child slots use `loopVar` + relative `EXPRESSION` (see Repeatable containers list).",
    "",
    "## Instruction",
    "Return exactly one `intehrgrator-suggestions` fenced JSON block. Copy each `slotId` from the slot manifest. Prefer `source_query*` blocks with fontoxpath in `EXPRESSION`. Use `maps_get` / `maps_create_with` for terminology and code translation. Scaffold generation often wires Defaults Map slots already — skip them unless the user requested different defaults. For repeating `multiplicity` (`0..*` / `1..*`), emit `loops` with `for_each_source` and child suggestions with matching `loopVar` + relative `EXPRESSION` (do not join onto PATH). Do not map source quantities onto ordinal/score fields unless the source is already that score. Leave unmatched slots out rather than inventing a mapping.",
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

function openEhrReferenceSections(_formatDocUrl: string): string[] {
  return [
    "## openEHR references",
    "When the target is an openEHR template, use authoritative sources — do not invent RM paths, archetype ids, or terminology codes.",
    "",
    "- **openehr-assistant MCP** (recommended): archetype/template lookup, terminology resolution, spec digests, and ADL/AQL guidance. Install the [openEHR Assistant Plugin](https://github.com/cadasto/openehr-assistant-plugin) in your AI environment when possible.",
    "- **ehrtslib (DeepWiki)**: https://deepwiki.com/ErikSundvall/ehrtslib",
    "- **ehrtslib (GitHub)**: https://github.com/ErikSundvall/ehrtslib",
    "- **openEHR specifications**: https://specifications.openehr.org/",
    "- **openEHR specs (AI index)**: https://specifications.openehr.org/llms.txt",
    "",
  ];
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

export interface ParseSuggestionsOptions {
  /** Used when the AI omitted `target` (common in chat replies). */
  fallbackTarget?: { format: string; targetId: string };
}

const BLOCK_TYPE_ALIASES: Record<string, string> = {
  source_query_string: "source_query",
  source_query_text: "source_query",
};

/** Blockly serialization noise AIs often include; strip rather than reject. */
const IGNORED_BLOCK_KEYS = new Set([
  "id",
  "x",
  "y",
  "mutation",
  "icons",
  "enabled",
  "inline",
  "collapsed",
  "deletable",
  "movable",
  "editable",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True when clipboard/paste looks like a suggestion envelope, not a Copy AI Prompt. */
export function looksLikeSuggestionsPayload(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("# intEHRgrator")) return false;
  try {
    const parsed = extractSuggestionsJson(trimmed);
    return isRecord(parsed) && Array.isArray(parsed.suggestions);
  } catch {
    return false;
  }
}

export function extractSuggestionsJson(text: string): unknown {
  const trimmed = text.trim();
  const tagged = trimmed.match(/```intehrgrator-suggestions\s*([\s\S]*?)```/);
  if (tagged?.[1]) return JSON.parse(tagged[1].trim());

  const jsonFence = trimmed.match(/```json\s*([\s\S]*?)```/);
  if (jsonFence?.[1]) {
    const inner = JSON.parse(jsonFence[1].trim());
    if (isRecord(inner) && Array.isArray(inner.suggestions)) return inner;
  }

  if (trimmed.startsWith("{")) return JSON.parse(trimmed);

  throw new Error("No suggestion JSON found (expected an object or intehrgrator-suggestions fence)");
}

const SCHEMA_WRAPPERS = new Set([
  "A subschema had errors.",
  "Items did not match schema.",
]);

const EXTRA_BLOCK_KEYS = new Set(["mutation", "id", "x", "y", "icons", "enabled", "inline", "collapsed"]);

function pointerLeaf(pointer: string): string {
  const parts = pointer.replace(/^#/, "").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

function keepSchemaError(keyword: string | undefined, pointer: string, raw: string): boolean {
  if (!keyword) return false;
  if (SCHEMA_WRAPPERS.has(raw)) return false;
  if (/^Property "[^"]+" does not match schema\.$/.test(raw)) return false;
  if (keyword === "required" || keyword === "enum" || keyword === "const") return true;
  const extra = /Property "([^"]+)" does not match additional properties schema/.exec(raw)?.[1]
    ?? (keyword === "false" ? pointerLeaf(pointer) : undefined);
  if (extra && EXTRA_BLOCK_KEYS.has(extra)) return true;
  if (/^#\/suggestions\/\d+\/(attachSlotId|for_each_source|suggestions)$/.test(pointer)) return true;
  return false;
}

/** Validate extracted JSON against docs/AI_SUGGESTION_FORMAT.schema.json. */
export function validateSuggestionEnvelope(instance: unknown): SchemaIssue[] {
  const validator = new Validator(SUGGESTION_FORMAT_SCHEMA as Schema, "2020-12", false);
  const result = validator.validate(instance);
  if (result.valid) return [];

  const issues: SchemaIssue[] = [];
  const seen = new Set<string>();
  for (const error of result.errors) {
    if (!keepSchemaError(error.keyword, error.instanceLocation, error.error)) continue;
    const path = jsonPointerToDotPath(error.instanceLocation);
    const message = explainSuggestionSchemaIssue(path, error.error, error.keyword, error.instanceLocation);
    const key = `${path}|${message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push({ path, message, keyword: error.keyword });
  }
  return collapseSchemaIssues(issues);
}

function collapseSchemaIssues(issues: SchemaIssue[]): SchemaIssue[] {
  const nestedParents = new Set<string>();
  const out: SchemaIssue[] = [];
  const hasMutationLeaf = issues.some((issue) => issue.path.endsWith(".mutation"));
  for (const issue of issues) {
    const nested = /^(.*suggestions\[\d+\])\.(attachSlotId|for_each_source|suggestions)$/.exec(issue.path);
    if (nested) {
      const parent = nested[1]!;
      if (nestedParents.has(parent)) continue;
      nestedParents.add(parent);
      out.push({
        path: parent,
        keyword: issue.keyword,
        message:
          `${parent}: nested loops are not allowed here. Put repeating work in top-level loops[] with for_each_source { VAR, PATH }, and child fills in suggestions[] with matching loopVar.`,
      });
      continue;
    }
    if (hasMutationLeaf && issue.path.endsWith(".block") && issue.message.includes("mutation")) {
      continue;
    }
    out.push(issue);
  }
  return out;
}

export function explainSuggestionSchemaIssue(
  path: string,
  raw: string,
  keyword?: string,
  pointer = "",
): string {
  const extra = /Property "([^"]+)" does not match additional properties schema/.exec(raw)?.[1]
    ?? pointerLeaf(pointer);

  if (EXTRA_BLOCK_KEYS.has(extra)) {
    return `${path}: unexpected "${extra}". Blocks allow only type, fields, inputs, extraState.`;
  }
  if (/^#\/suggestions\/\d+\/(attachSlotId|for_each_source|suggestions)$/.test(pointer)) {
    return `${path}: nested loops are not allowed here. Put repeating work in top-level loops[] with for_each_source { VAR, PATH }, and child fills in suggestions[] with matching loopVar.`;
  }
  if (keyword === "enum" || /does not match any of/i.test(raw)) {
    if (/\.type$/.test(path)) {
      return `${path}: invalid block type. Use source_query, source_query_number, source_query_boolean, source_query_node, text, text_code, text_handlebars, maps_get, or maps_create_* (not source_query_string). Loops use for_each_source only in loops[].`;
    }
  }
  if (keyword === "const") {
    if (path === "$.format") return `${path}: format must be the string "intehrgrator-suggestions".`;
    if (path === "$.version") return `${path}: version must be the string "2" (not the number 2).`;
  }
  if (keyword === "required" || /required property/i.test(raw)) {
    const cleaned = raw.replace(/^Instance does not have required property/, "Missing required property");
    if (path === "$") {
      return `${path}: ${cleaned} Envelope requires format, version, target, and suggestions.`;
    }
    return `${path}: ${cleaned}`;
  }
  return `${path}: ${raw}`;
}

export interface FollowUpOptions {
  formatDocUrl: string;
  schemaUrl: string;
  payload: string;
  schemaIssues: SchemaIssue[];
  errors: string[];
}

/** Markdown the user can paste back into the AI chat to request a corrected envelope. */
export function formatImportFollowUp(options: FollowUpOptions): string {
  const lines: string[] = [
    "The previous `intehrgrator-suggestions` JSON did not validate. Please return exactly one corrected fenced block tagged `intehrgrator-suggestions` (version `\"2\"`).",
    "",
    `Format: ${options.formatDocUrl}`,
    `JSON Schema: ${options.schemaUrl}`,
    "",
    "### Errors",
  ];
  const issues = [
    ...options.schemaIssues.map((issue) => `- \`${issue.path}\`: ${issue.message}`),
    ...options.errors.map((err) => `- ${err}`),
  ];
  if (!issues.length) issues.push("- (no structured errors)");
  lines.push(...issues);
  lines.push(
    "",
    "Fix every error. Copy each `slotId` / `attachSlotId` from the original prompt. Put repeating source nodes in top-level `loops[]` (`for_each_source` with `VAR` + `PATH`); child mappings use `loopVar` and a **relative** `EXPRESSION`. Do not emit `mutation`, `id`, `x`, `y`, or `source_query_string` (use `source_query` for strings).",
    "",
    "### Previous payload",
    "```json",
    options.payload.trim(),
    "```",
  );
  return lines.join("\n");
}

export function schemaUrlFromFormatDoc(formatDocUrl: string): string {
  return formatDocUrl.replace(/AI_SUGGESTION_FORMAT\.md/i, "AI_SUGGESTION_FORMAT.schema.json");
}

export function parseSuggestionsPayload(
  text: string,
  options: ParseSuggestionsOptions = {},
): SuggestionEnvelope {
  const parsed = extractSuggestionsJson(text);
  return normalizeSuggestionEnvelope(parsed, options.fallbackTarget);
}

function normalizeSuggestionEnvelope(
  raw: unknown,
  fallbackTarget?: { format: string; targetId: string },
): SuggestionEnvelope {
  if (!isRecord(raw)) throw new Error("Suggestions payload must be a JSON object");
  if (raw.format != null && raw.format !== "intehrgrator-suggestions") {
    throw new Error("Invalid format field");
  }
  const version = String(raw.version ?? "");
  if (version !== "2") {
    throw new Error(`Unsupported version: ${raw.version} (expected "2")`);
  }
  if (!Array.isArray(raw.suggestions)) {
    throw new Error("Missing suggestions array");
  }

  const targetRaw = isRecord(raw.target) ? raw.target : {};
  const targetId = String(targetRaw.targetId ?? fallbackTarget?.targetId ?? "");
  const targetFormat = String(targetRaw.format ?? fallbackTarget?.format ?? "");
  if (!targetId || !targetFormat) {
    throw new Error("Missing target.targetId or target.format");
  }

  const { loops, suggestions } = flattenSuggestionGroups(raw);
  return {
    format: "intehrgrator-suggestions",
    version: "2",
    target: { format: targetFormat, targetId },
    ...(loops.length ? { loops } : {}),
    suggestions,
  };
}

type RawLoop = NonNullable<SuggestionEnvelope["loops"]>[number];
type RawSuggestion = SuggestionEnvelope["suggestions"][number];

/**
 * AIs often nest `for_each_source` groups inside `suggestions[]` instead of
 * emitting top-level `loops[]`. Flatten that into the documented shape.
 */
function flattenSuggestionGroups(raw: Record<string, unknown>): {
  loops: RawLoop[];
  suggestions: RawSuggestion[];
} {
  const loops: RawLoop[] = [];
  const suggestions: RawSuggestion[] = [];

  if (Array.isArray(raw.loops)) {
    for (const item of raw.loops) {
      if (!isRecord(item)) continue;
      const attachSlotId = String(item.attachSlotId ?? "");
      const block = coerceLoopBlock(item);
      if (attachSlotId && block) loops.push({ attachSlotId, block, note: optionalNote(item.note) });
    }
  }

  collectSuggestionItems(raw.suggestions, loops, suggestions, undefined);
  return { loops, suggestions };
}

function collectSuggestionItems(
  items: unknown,
  loops: RawLoop[],
  suggestions: RawSuggestion[],
  inheritedLoopVar: string | undefined,
): void {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (!isRecord(item)) continue;
    const nested = Array.isArray(item.suggestions) ? item.suggestions : null;
    const attachSlotId = typeof item.attachSlotId === "string" ? item.attachSlotId : "";
    if (attachSlotId && nested) {
      const loopVar = String(item.loopVar ?? "item");
      const block = coerceLoopBlock(item);
      if (block) loops.push({ attachSlotId, block, note: optionalNote(item.note) });
      collectSuggestionItems(nested, loops, suggestions, loopVar);
      continue;
    }
    if (typeof item.slotId === "string" && isRecord(item.block)) {
      suggestions.push({
        slotId: item.slotId,
        block: sanitizeBlock(item.block) as SuggestionBlock,
        loopVar: typeof item.loopVar === "string" ? item.loopVar : inheritedLoopVar,
        note: optionalNote(item.note),
      });
    }
  }
}

function coerceLoopBlock(item: Record<string, unknown>): SuggestionBlock | null {
  if (isRecord(item.block) && item.block.type === "for_each_source") {
    return sanitizeBlock(item.block) as SuggestionBlock;
  }
  if (isRecord(item.for_each_source) && item.for_each_source.type === "for_each_source") {
    return sanitizeBlock(item.for_each_source) as SuggestionBlock;
  }
  const path = typeof item.for_each_source === "string"
    ? item.for_each_source
    : typeof item.PATH === "string"
    ? item.PATH
    : "";
  if (!path) return null;
  const varName = String(item.loopVar ?? "item");
  return { type: "for_each_source", fields: { VAR: varName, PATH: path } };
}

function optionalNote(note: unknown): string | undefined {
  return typeof note === "string" ? note : undefined;
}

function sanitizeBlock(raw: Record<string, unknown>): Record<string, unknown> {
  const type = BLOCK_TYPE_ALIASES[String(raw.type ?? "")] ?? String(raw.type ?? "");
  const out: Record<string, unknown> = { type };
  if (isRecord(raw.fields)) out.fields = raw.fields;
  if (raw.extraState !== undefined) out.extraState = raw.extraState;
  if (isRecord(raw.inputs)) {
    const inputs: Record<string, unknown> = {};
    for (const [name, input] of Object.entries(raw.inputs)) {
      if (!isRecord(input)) continue;
      const next: Record<string, unknown> = {};
      if (isRecord(input.block)) next.block = sanitizeBlock(input.block);
      if (isRecord(input.shadow)) next.shadow = sanitizeBlock(input.shadow);
      inputs[name] = next;
    }
    out.inputs = inputs;
  }
  return out;
}

/** Collapse `templateId//path` (AI separator) onto `templateId/path` (skeleton ids). */
export function resolveKnownSlotId(slotId: string, knownSlotIds: Set<string>): string | null {
  if (knownSlotIds.has(slotId)) return slotId;
  const collapsed = collapseSlashes(slotId);
  if (knownSlotIds.has(collapsed)) return collapsed;
  for (const known of knownSlotIds) {
    if (collapseSlashes(known) === collapsed) return known;
  }
  return null;
}

function collapseSlashes(slotId: string): string {
  return slotId.replace(/\/{2,}/g, "/");
}

/** `$item?pulse` / `$item.pulse` → `pulse` when `loopVar` is `item`. */
export function rewriteLoopRelativePath(expr: string, loopVar: string): string {
  const trimmed = expr.trim();
  if (!loopVar) return trimmed;
  const escaped = loopVar.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (trimmed === `$${loopVar}`) return ".";
  const lookup = new RegExp(`^\\$${escaped}\\?`);
  if (lookup.test(trimmed)) return trimmed.replace(lookup, "");
  const dotted = new RegExp(`^\\$${escaped}\\.`);
  if (dotted.test(trimmed)) return trimmed.replace(dotted, "");
  return trimmed;
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
    schemaIssues: [],
  };

  const loopPaths = new Map<string, string>();
  const acceptedLoops: MappingLoop[] = [];
  for (const loop of payload.loops ?? []) {
    const attachSlotId = resolveKnownSlotId(loop.attachSlotId, knownSlotIds) ?? loop.attachSlotId;
    try {
      const block = sanitizeBlock(loop.block as unknown as Record<string, unknown>) as SuggestionBlock;
      validateLoopEntry(block);
      if (!knownSlotIds.has(attachSlotId)) {
        throw new Error(`Unknown attachSlotId: ${loop.attachSlotId}`);
      }
      const varName = String(block.fields?.VAR ?? "");
      const path = String(block.fields?.PATH ?? "");
      if (!varName || !path) throw new Error("for_each_source requires VAR and PATH");
      const existingPath = loopPaths.get(varName);
      if (existingPath && existingPath !== path) {
        throw new Error(`Duplicate loop VAR: ${varName} with a different PATH`);
      }
      loopPaths.set(varName, path);
      acceptedLoops.push({ attachSlotId, varName, path });
      report.loopsAccepted++;
    } catch (e) {
      report.skipped++;
      report.errors.push(
        `loop ${loop.attachSlotId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  if (acceptedLoops.length) {
    const kept = (model.loops ?? []).filter(
      (existing) => !acceptedLoops.some((loop) => loop.attachSlotId === existing.attachSlotId),
    );
    next = { ...next, loops: [...kept, ...acceptedLoops] };
  }

  for (const suggestion of payload.suggestions) {
    const slotId = resolveKnownSlotId(suggestion.slotId, knownSlotIds);
    if (!slotId) {
      report.skipped++;
      report.errors.push(`Unknown slotId: ${suggestion.slotId}`);
      continue;
    }
    let expression: string;
    try {
      const block = sanitizeBlock(suggestion.block as unknown as Record<string, unknown>) as SuggestionBlock;
      if (block.type === "for_each_source") {
        throw new Error("for_each_source belongs in loops[], not suggestions[].block");
      }
      if (suggestion.loopVar && !loopPaths.has(suggestion.loopVar)) {
        throw new Error(`Unknown loopVar: ${suggestion.loopVar}`);
      }
      const rewrite = suggestion.loopVar
        ? (xpath: string) => rewriteLoopRelativePath(xpath, suggestion.loopVar!)
        : undefined;
      expression = suggestionBlockToExpression(block, rewrite);
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
    const meta = slotMeta?.get(slotId);
    next = applyExpressionEdit(next, slotId, expression, meta);
    report.applied++;
  }

  return { model: next, report };
}

/** Convert a v2 Blockly suggestion fragment into a Mapping Model expression string. */
export function suggestionBlockToExpression(
  block: SuggestionBlock,
  rewriteSourcePath?: (xpath: string) => string,
): string {
  const clean = sanitizeBlock(block as unknown as Record<string, unknown>) as SuggestionBlock;
  validateBlockShape(clean);
  const expr = blockJsonToExpression(clean, rewriteSourcePath);
  if (!expr) throw new Error(`Unsupported or empty block type: ${clean.type}`);
  return expr;
}

function validateLoopEntry(block: SuggestionBlock): void {
  if (!block || block.type !== "for_each_source") {
    throw new Error("loops[].block must be type for_each_source");
  }
  if (block.inputs?.DO?.block) {
    throw new Error("Leave for_each_source DO empty; put value fills in suggestions[]");
  }
}

function validateBlockShape(block: SuggestionBlock, depth = 0): void {
  if (depth > 12) throw new Error("Block tree too deep");
  if (!block || typeof block !== "object") throw new Error("Invalid block");
  const type = BLOCK_TYPE_ALIASES[block.type] ?? block.type;
  if (typeof type !== "string" || !VALUE_BLOCK_TYPES.has(type)) {
    throw new Error(`Disallowed block type: ${String(block?.type)}`);
  }
  for (const key of Object.keys(block)) {
    if (IGNORED_BLOCK_KEYS.has(key)) continue;
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
    case "source_query_boolean":
    case "source_query_node": {
      let xpath = String(fields.EXPRESSION ?? "");
      if (rewriteSourcePath) xpath = rewriteSourcePath(xpath);
      const fn = block.type === "source_query_number"
        ? "xpathNumber"
        : block.type === "source_query_boolean"
        ? "xpathBoolean"
        : block.type === "source_query_node"
        ? "xpathNode"
        : "xpathString";
      return `${fn}(${JSON.stringify(xpath)})`;
    }
    case "variables_get": {
      const name = String(fields.VAR ?? "item");
      return `var(${JSON.stringify(name)})`;
    }
    case "text":
    case "text_code":
      return JSON.stringify(textFieldValue(fields));
    case "text_handlebars": {
      const script = child("SCRIPT")
        ? blockJsonToExpression(child("SCRIPT")!, rewriteSourcePath)
        : '""';
      const context = child("CONTEXT")
        ? blockJsonToExpression(child("CONTEXT")!, rewriteSourcePath)
        : "map()";
      return `handlebars(${script ?? '""'}, ${context ?? "map()"})`;
    }
    case "maps_create_empty":
      return "map()";
    case "maps_create_with": {
      const itemCount = Number(
        (block.extraState as { itemCount?: number } | undefined)?.itemCount ?? 0,
      );
      const parts: string[] = [];
      for (let i = 0; i < itemCount; i++) {
        parts.push(JSON.stringify(String(fields[`KEY${i}`] ?? "")));
        const val = child(`VAL${i}`);
        parts.push(val ? blockJsonToExpression(val, rewriteSourcePath) ?? "null" : "null");
      }
      return `map(${parts.join(", ")})`;
    }
    case "maps_get": {
      const name = String(fields.NAME ?? "defaults");
      const key = child("KEY")
        ? blockJsonToExpression(child("KEY")!, rewriteSourcePath)
        : '""';
      return `maps_get(${JSON.stringify(name)}, ${key ?? '""'})`;
    }
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

function textFieldValue(fields: Record<string, unknown>): string {
  const text = fields.TEXT;
  if (typeof text === "string") return text;
  if (text && typeof text === "object" && typeof (text as { text?: unknown }).text === "string") {
    return (text as { text: string }).text;
  }
  return "";
}
