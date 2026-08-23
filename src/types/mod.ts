export const MODEL_VERSION = 2;

/** Conversion script language. Deliberately separate from Target instance format. */
export type ExportTarget = "typescript" | "java" | "handlebars" | "xquery";

/** Structure produced by a conversion. */
export type TargetFormatId =
  | "openehr-template"
  | "json-schema"
  | "xml-schema"
  | "free-form";

export interface MappingSlot {
  slotId: string;
  rmType: string;
  expression: string;
  returnType: string;
  label?: string;
  mandatory?: boolean;
}

export interface OptionalRmInsertion {
  attachmentSlotId: string;
  rmType: string;
  attributeName: string;
}

export interface MappingLoop {
  attachSlotId: string;
  varName: string;
  /** Absolute source path of the iterated nodes (e.g. `$.measurements`). */
  path: string;
}

export interface MappingModel {
  modelVersion: number;
  /** Target definition id. Kept as `templateId` for bundle compatibility. */
  templateId: string;
  targetFormat?: TargetFormatId;
  slots: MappingSlot[];
  optionalRm: OptionalRmInsertion[];
  /** Repeatable source→target iteration (`for_each_source` / `[*]` paths). */
  loops?: MappingLoop[];
}

export type SkeletonNodeKind = "container" | "value";

export interface SkeletonNode {
  slotId: string;
  blockType: string;
  rmType: string;
  label: string;
  archetypeNodeId?: string;
  /** Template id prefix used in slot paths. */
  archetypeId?: string;
  /** openEHR archetype id owning this node's at-code terminology. */
  archetypeRef?: string;
  /** Short archetype name for at-code disambiguation in the UI. */
  archetypeShortName?: string;
  kind: SkeletonNodeKind;
  /** RM attribute on the parent object this node occupies (e.g. data, items, value). */
  rmAttribute?: string;
  mandatory: boolean;
  silentMandatory?: boolean;
  fixedValue?: string;
  fixedFields?: Record<string, string>;
  /** Format-native target path (JSON Pointer, XML path, or openEHR slot path). */
  targetPath?: string;
  /** Compact target cardinality, e.g. `1`, `0..1`, `0..*`, `1..*`. */
  multiplicity?: string;
  /** Cardinality of the parent attribute slot this node occupies. */
  slotCardinality?: string;
  children: SkeletonNode[];
  attachmentPoint?: string;
}

export interface AttachmentOption {
  rmType: string;
  attributeName: string;
  label: string;
  cardinality: { min: number; max: number | null };
}

export interface SchemaTreeNode {
  path: string;
  name: string;
  type: string;
  value?: unknown;
  /** Compact cardinality, e.g. `1`, `0..1`, `0..*`, `1..*`. */
  multiplicity?: string;
  children: SchemaTreeNode[];
}

/**
 * Source payload format id. It is intentionally open so registered adapters
 * do not require widening a union in every caller.
 */
export type SourceFormatId = string;

export interface ExampleInstance {
  id: string;
  filename: string;
  format: SourceFormatId;
  content: string;
}

export interface ClinicalModelFileset {
  sourceUrl?: string;
  rootPath: string;
  files: Array<{ path: string; content: string }>;
}

export interface ProjectSettings {
  exportTarget: ExportTarget;
  theme: "karolinska";
  validationStrict: boolean;
  autoscroll: boolean;
  autoplay: boolean;
}

export interface ProjectBundle {
  version: number;
  projectId: string;
  appVersion: string;
  createdAt: string;
  updatedAt: string;
  /** Legacy v1 openEHR target field; read during migration. */
  template: {
    filename: string;
    templateId: string;
    content: string;
    skeleton: SkeletonNode[];
  } | null;
  target?: {
    format: TargetFormatId;
    filename: string;
    targetId: string;
    content: string;
    skeleton: SkeletonNode[];
    fileset?: ClinicalModelFileset;
  } | null;
  sourceSchema: {
    filename: string;
    format?: SourceFormatId;
    content: string;
    tree: SchemaTreeNode[];
  } | null;
  examples: ExampleInstance[];
  activeExampleId: string | null;
  mapping: {
    blocklyState: unknown;
    model: MappingModel;
    /** User-authored Kintegrate-compatible conversion template. */
    handlebarsTemplate?: string;
  };
  settings: ProjectSettings;
  /** Recent schema / example / target URLs (including GitHub .t.json closures). */
  urlHistory?: {
    schema: string[];
    example: string[];
    target: string[];
  };
  aiAssist?: {
    lastPrompt?: string;
    lastImportReport?: string;
  };
}

export interface TestResult {
  ok: boolean;
  /** Format-neutral conversion result. */
  output?: unknown;
  /** @deprecated compatibility alias for openEHR-era callers. */
  composition?: unknown;
  error?: string;
  warnings: string[];
}

/** Blockly JSON fragment allowed in AI suggestion envelopes (version 2). */
export interface SuggestionBlock {
  type: string;
  fields?: Record<string, string | number | boolean>;
  inputs?: Record<string, { block?: SuggestionBlock; shadow?: SuggestionBlock }>;
  extraState?: unknown;
}

export interface SuggestionEnvelope {
  format: "intehrgrator-suggestions";
  version: "2";
  target: {
    format: TargetFormatId | string;
    targetId: string;
  };
  /** Repeatable source→target iteration (`for_each_source` only). */
  loops?: Array<{
    attachSlotId: string;
    block: SuggestionBlock;
    note?: string;
  }>;
  suggestions: Array<{
    slotId: string;
    block: SuggestionBlock;
    /** When set, `block` EXPRESSION is relative to that loop VAR's PATH. */
    loopVar?: string;
    note?: string;
  }>;
}

export interface ImportSuggestionsReport {
  applied: number;
  skipped: number;
  errors: string[];
  /** Validated `loops[]` entries; the canvas wraps `attachSlotId` with `for_each_source`. */
  loopsAccepted: number;
}

export const DEFAULT_SETTINGS: ProjectSettings = {
  exportTarget: "typescript",
  theme: "karolinska",
  validationStrict: true,
  autoscroll: true,
  autoplay: false,
};
