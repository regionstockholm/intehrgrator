import { cloneSheet, normalizeSheet } from "../sheets/model.ts";
import type { SheetDocument } from "../sheets/types.ts";
import {
  asWorkspaceJson,
  findProcedureDef,
  listProcedureDefNames,
  procedureHasReturn,
  procedureParamNames,
  referencedGridNames,
  renameGridInState,
  renameProcedureInState,
  uniqueIdentifier,
} from "./blockly_json.ts";
import {
  FUNCTION_BUNDLE_KIND,
  FUNCTION_BUNDLE_VERSION,
  type FunctionBundle,
  type FunctionClashPolicy,
  type FunctionClashReport,
} from "./types.ts";

export function parseFunctionBundle(text: string): FunctionBundle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `Function bundle is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return functionBundleFromUnknown(parsed);
}

export function functionBundleFromUnknown(value: unknown): FunctionBundle {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Function bundle must be a JSON object");
  }
  const raw = value as Record<string, unknown>;
  if (raw.kind !== FUNCTION_BUNDLE_KIND) {
    throw new Error(`Unsupported Function bundle kind: ${String(raw.kind)}`);
  }
  if (raw.version !== FUNCTION_BUNDLE_VERSION) {
    throw new Error(`Unsupported Function bundle version: ${String(raw.version)}`);
  }
  const name = requiredString(raw.name, "name");
  const description = typeof raw.description === "string" ? raw.description : "";
  const parameters = stringArray(raw.parameters, "parameters");
  const decisionTables = stringArray(raw.decisionTables, "decisionTables");
  if (!raw.blocklyState || typeof raw.blocklyState !== "object" || Array.isArray(raw.blocklyState)) {
    throw new Error("Function bundle is missing blocklyState");
  }
  const sheets = parseSheets(raw.sheets);
  const def = findProcedureDef(raw.blocklyState, name);
  if (!def) {
    throw new Error(`Function bundle blocklyState has no definition named "${name}"`);
  }
  const params = parameters.length ? parameters : procedureParamNames(def);
  const hasReturn = typeof raw.hasReturn === "boolean"
    ? raw.hasReturn
    : procedureHasReturn(def.type);
  return {
    kind: FUNCTION_BUNDLE_KIND,
    version: FUNCTION_BUNDLE_VERSION,
    name,
    description,
    parameters: params,
    hasReturn,
    returns: optionalString(raw.returns),
    locale: optionalString(raw.locale),
    decisionTables: decisionTables.length ? decisionTables : referencedGridNames(raw.blocklyState),
    blocklyState: raw.blocklyState as Record<string, unknown>,
    sheets,
  };
}

export function serializeFunctionBundle(bundle: FunctionBundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

export function functionBundleFilename(name: string): string {
  const safe = name.trim().replace(/[^A-Za-z0-9._-]+/g, "-") || "function";
  return `${safe}.intehr-function.json`;
}

export function functionBundleClashes(
  workspaceState: unknown,
  existingSheets: SheetDocument[],
  bundle: FunctionBundle,
): FunctionClashReport {
  const functions = listProcedureDefNames(workspaceState).includes(bundle.name)
    ? [bundle.name]
    : [];
  const existing = new Set(existingSheets.map((sheet) => sheet.name));
  const sheets = bundle.sheets.map((sheet) => sheet.name).filter((name) => existing.has(name));
  return { functions, sheets };
}

export function applyClashPolicy(
  workspaceState: unknown,
  existingSheets: SheetDocument[],
  bundle: FunctionBundle,
  policy: FunctionClashPolicy,
): { bundle: FunctionBundle; clashes: FunctionClashReport; warnings: string[] } {
  const clashes = functionBundleClashes(workspaceState, existingSheets, bundle);
  if (!clashes.functions.length && !clashes.sheets.length) {
    return { bundle, clashes, warnings: [] };
  }
  if (policy === "replace") {
    return { bundle, clashes, warnings: clashWarnings(clashes) };
  }
  const next = structuredClone(bundle) as FunctionBundle;
  const warnings: string[] = [];
  const state = asWorkspaceJson(next.blocklyState);
  if (clashes.functions.length) {
    const taken = new Set(listProcedureDefNames(workspaceState));
    const renamed = uniqueIdentifier(next.name, taken);
    renameProcedureInState(state, next.name, renamed);
    warnings.push(`Renamed Function "${bundle.name}" to "${renamed}" (name already on the canvas).`);
    next.name = renamed;
  }
  const takenSheets = new Set(existingSheets.map((sheet) => sheet.name));
  for (const clash of clashes.sheets) {
    const renamed = uniqueIdentifier(clash, takenSheets);
    takenSheets.add(renamed);
    for (const sheet of next.sheets) {
      if (sheet.name === clash) sheet.name = renamed;
    }
    next.decisionTables = next.decisionTables.map((name) => name === clash ? renamed : name);
    renameGridInState(state, clash, renamed);
    warnings.push(
      `Renamed Decision table "${clash}" to "${renamed}" (name already in the project).`,
    );
  }
  next.blocklyState = state as Record<string, unknown>;
  return { bundle: next, clashes, warnings };
}

function clashWarnings(clashes: FunctionClashReport): string[] {
  return [
    ...clashes.functions.map((name) => `Replacing canvas Function "${name}".`),
    ...clashes.sheets.map((name) => `Replacing Decision table "${name}".`),
  ];
}

function parseSheets(value: unknown): SheetDocument[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Function bundle sheets must be an array");
  return value.map((item, i) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Function bundle sheets[${i}] must be an object`);
    }
    return cloneSheet(normalizeSheet(item as SheetDocument));
  });
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Function bundle ${path} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function stringArray(value: unknown, path: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`Function bundle ${path} must be an array of strings`);
  return value.map((item, i) => {
    if (typeof item !== "string" || !item.trim()) {
      throw new Error(`Function bundle ${path}[${i}] must be a non-empty string`);
    }
    return item.trim();
  });
}
