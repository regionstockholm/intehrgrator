import type { SheetDocument } from "../sheets/types.ts";

export const FUNCTION_BUNDLE_KIND = "intehrgrator-function";
export const FUNCTION_BUNDLE_VERSION = 1;

/** Portable JSON for one Blockly Function plus the Decision tables it uses. */
export interface FunctionBundle {
  kind: typeof FUNCTION_BUNDLE_KIND;
  version: typeof FUNCTION_BUNDLE_VERSION;
  name: string;
  description: string;
  parameters: string[];
  /** Blockly output check when the definition returns a value (`procedures_defreturn`). */
  returns?: string;
  locale?: string;
  decisionTables: string[];
  /** Workspace fragment: the definition (and any Decision table declaration chips). */
  blocklyState: Record<string, unknown>;
  sheets: SheetDocument[];
}

export interface FunctionLibraryEntry {
  id: string;
  name: string;
  title: string;
  description: string;
  file: string;
  locale?: string;
  parameters?: string[];
  returns?: string;
  decisionTables?: string[];
}

export interface FunctionLibraryCatalog {
  version: 1;
  catalogUrl: string;
  functions: FunctionLibraryEntry[];
}

export type FunctionClashPolicy = "rename" | "replace";

export interface FunctionClashReport {
  functions: string[];
  sheets: string[];
}

export interface MergeFunctionResult {
  name: string;
  renamedFrom?: string;
  sheets: SheetDocument[];
  clashes: FunctionClashReport;
  warnings: string[];
}
