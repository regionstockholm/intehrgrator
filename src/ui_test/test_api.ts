/**
 * Workbench Test API — programmatic seam for UI / E2E tests (kintegrate formTestApi pattern).
 *
 * Exposed on `window.intehrgratorTestApi` when the Web Shell is opened with `?testMode=1`.
 * Setup helpers load fixtures without file pickers; Click-to-Map and Run Test still go through
 * real DOM / Blockly so the harness proves the Mapping Editor UI path.
 */

import type { MappingModel, SourceFormatId, TestResult } from "../types/mod.ts";

export interface BlocklyBlockSummary {
  id: string;
  type: string;
  slotId: string | null;
}

export interface WorkbenchTestSnapshot {
  templateId: string;
  listeningSlotId: string | null;
  exampleCount: number;
  activeExampleFilename: string | null;
  model: MappingModel;
  testResult: TestResult | null;
  statusMessage: string;
  autoplay: boolean;
  unmappedMandatory: number;
  blocklyBlocks: BlocklyBlockSummary[];
}

export interface IntehrgratorTestApi {
  /** Wait until Blockly inject + first render completed. */
  ready(): Promise<void>;
  loadTemplate(filename: string, content: string): void;
  loadSchema(filename: string, content: string): void;
  addExample(filename: string, content: string): void;
  armSlot(slotId: string): void;
  /** Programmatic bind (same path as Click-to-Map after Listening Mode). */
  bindFromNode(path: string, format: SourceFormatId): void;
  /** Programmatic bind to a slot (same path as drag-and-drop; skips Listening Mode). */
  mapNodeToSlot(slotId: string, path: string, format: SourceFormatId): void;
  runTest(): void;
  setAutoplay(on: boolean): void;
  getSnapshot(): WorkbenchTestSnapshot;
  /**
   * Find a Target value slot whose slotId ends with `suffix` (stable for OPT fixtures
   * where absolute slotIds are long archetype paths).
   */
  findSlotIdBySuffix(suffix: string): string | null;
}

declare global {
  interface Window {
    intehrgratorTestApi?: IntehrgratorTestApi;
  }
}

export function isTestMode(search = globalThis.location?.search ?? ""): boolean {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get("testMode") === "1";
}
