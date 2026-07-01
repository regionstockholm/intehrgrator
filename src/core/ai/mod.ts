import type {
  ImportSuggestionsReport,
  MappingModel,
  SkeletonNode,
  SuggestionEnvelope,
} from "../../types/mod.ts";
import { applyExpressionEdit } from "../mapping_model/mod.ts";
import { collectValueSlots } from "../skeleton/generate_skeleton.ts";
import { validateExpressionSource } from "../expression/mod.ts";

export function buildPrompt(options: {
  scope: "full" | "slot";
  templateId: string;
  templateFilename: string;
  sourceFilename?: string;
  slotId?: string;
  skeleton: SkeletonNode[];
  model: MappingModel;
  formatDocUrl: string;
}): string {
  const valueSlots = collectValueSlots(options.skeleton);
  const mapped = new Set(options.model.slots.filter((s) => s.expression).map((s) => s.slotId));
  const inScope = valueSlots.filter((s) => {
    if (options.scope === "slot") return s.slotId === options.slotId;
    return !mapped.has(s.slotId);
  });

  const manifest = inScope.map((s) => ({
    slotId: s.slotId,
    rmType: s.rmType,
    archetypeNodeId: s.archetypeNodeId,
    label: s.label,
  }));

  return [
    "# intEHRgrator mapping assist",
    "",
    "## Task",
    "Map source data to an openEHR Composition conforming to the loaded OPT.",
    "",
    "## Template",
    `- templateId: \`${options.templateId}\``,
    `- filename: \`${options.templateFilename}\``,
    "",
    "## Source",
    options.sourceFilename ? `- filename: \`${options.sourceFilename}\`` : "- (no source file loaded)",
    "",
    `## Scope: \`${options.scope}\``,
    options.slotId ? `- slotId: \`${options.slotId}\`` : "",
    "",
    "## Response format",
    `Respond with exactly one fenced JSON block tagged \`intehrgrator-suggestions\` per: ${options.formatDocUrl}`,
    "",
    "## Slot manifest",
    "```json",
    JSON.stringify(manifest, null, 2),
    "```",
  ].filter(Boolean).join("\n");
}

export function parseSuggestionsPayload(text: string): SuggestionEnvelope {
  const fence = text.match(/```intehrgrator-suggestions\s*([\s\S]*?)```/);
  const raw = fence?.[1]?.trim() ?? text.trim();
  const parsed = JSON.parse(raw) as SuggestionEnvelope;
  if (parsed.format !== "intehrgrator-suggestions") {
    throw new Error("Invalid format field");
  }
  if (parsed.version !== "1") throw new Error(`Unsupported version: ${parsed.version}`);
  return parsed;
}

export function importSuggestions(
  model: MappingModel,
  payload: SuggestionEnvelope,
  knownSlotIds: Set<string>,
): { model: MappingModel; report: ImportSuggestionsReport } {
  if (payload.templateId !== model.templateId) {
    throw new Error(
      `templateId mismatch: expected ${model.templateId}, got ${payload.templateId}`,
    );
  }

  let next = model;
  const report: ImportSuggestionsReport = { applied: 0, skipped: 0, errors: [] };

  for (const suggestion of payload.suggestions) {
    if (!knownSlotIds.has(suggestion.slotId)) {
      report.skipped++;
      report.errors.push(`Unknown slotId: ${suggestion.slotId}`);
      continue;
    }
    const err = validateExpressionSource(suggestion.expression);
    if (err) {
      report.skipped++;
      report.errors.push(`${suggestion.slotId}: ${err}`);
      continue;
    }
    next = applyExpressionEdit(next, suggestion.slotId, suggestion.expression);
    report.applied++;
  }

  return { model: next, report };
}
