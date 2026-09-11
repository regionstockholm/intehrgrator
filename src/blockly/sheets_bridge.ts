import type { SheetDocument } from "../core/sheets/types.ts";

export type GridFocusHandler = (name: string, opts?: { highlight?: boolean }) => void;

let sheetsProvider: (() => SheetDocument[]) | null = null;

/** Workbench supplies the project-owned Sheet / Decision table documents. */
export function setWorkspaceSheetsProvider(provider: (() => SheetDocument[]) | null): void {
  sheetsProvider = provider;
}

export function workspaceSheets(): SheetDocument[] {
  return sheetsProvider?.() ?? [];
}

export function workspaceSheet(name: string): SheetDocument | undefined {
  return workspaceSheets().find((s) => s.name === name);
}
