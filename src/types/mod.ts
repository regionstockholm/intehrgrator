export const MODEL_VERSION = 1;

export type ExportTarget = "typescript" | "java";

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

export interface MappingModel {
  modelVersion: number;
  templateId: string;
  slots: MappingSlot[];
  optionalRm: OptionalRmInsertion[];
  specText?: string;
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
  mandatory: boolean;
  silentMandatory?: boolean;
  fixedValue?: string;
  fixedFields?: Record<string, string>;
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

export interface ExampleInstance {
  id: string;
  filename: string;
  format: "json" | "xml";
  content: string;
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
  template: {
    filename: string;
    templateId: string;
    content: string;
    skeleton: SkeletonNode[];
  } | null;
  sourceSchema: {
    filename: string;
    content: string;
    tree: SchemaTreeNode[];
  } | null;
  examples: ExampleInstance[];
  activeExampleId: string | null;
  mapping: {
    blocklyState: unknown;
    model: MappingModel;
  };
  settings: ProjectSettings;
  aiAssist?: {
    lastPrompt?: string;
    lastImportReport?: string;
  };
}

export interface TestResult {
  ok: boolean;
  composition?: unknown;
  error?: string;
  warnings: string[];
}

export interface SuggestionEnvelope {
  format: "intehrgrator-suggestions";
  version: "1";
  templateId: string;
  suggestions: Array<{
    slotId: string;
    expression: string;
    note?: string;
  }>;
}

export interface ImportSuggestionsReport {
  applied: number;
  skipped: number;
  errors: string[];
}

export const DEFAULT_SETTINGS: ProjectSettings = {
  exportTarget: "typescript",
  theme: "karolinska",
  validationStrict: true,
  autoscroll: true,
  autoplay: false,
};
