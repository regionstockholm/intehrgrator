/**
 * Migrate a legacy Handlebars Template tab string onto the Blockly canvas as
 * Conversion start → Text document → run handlebars script.
 */
import type { Workspace } from "blockly/core";
import { Blockly } from "../../blockly/blockly_core.ts";
import { initBlocklyGenerators } from "../../blockly/mod.ts";
import {
  attachStartToInstanceRoot,
  ensureConversionStartBlock,
} from "../../blockly/conversion_start_canvas.ts";
import {
  findInstanceRootUnderStart,
  TEXT_DOCUMENT_BLOCK_TYPE,
  walkProductStack,
} from "../../blockly/instance_root.ts";
import {
  TEXT_CODE_BLOCK_TYPE,
  TEXT_HANDLEBARS_BLOCK_TYPE,
} from "../../blockly/blocks/text_blocks.ts";
import { runWithoutBlocklyEvents } from "../../blockly/blockly_events.ts";

let generatorsReady = false;

function ensureGenerators(): void {
  if (generatorsReady) return;
  initBlocklyGenerators();
  generatorsReady = true;
}

function workspaceHasHandlebarsProduct(workspace: Workspace): boolean {
  let found = false;
  walkProductStack(workspace, (block) => {
    if (block.type === TEXT_HANDLEBARS_BLOCK_TYPE) found = true;
  });
  return found;
}

function buildHandlebarsProductStack(workspace: Workspace, template: string): void {
  const textCode = workspace.newBlock(TEXT_CODE_BLOCK_TYPE);
  textCode.setFieldValue("handlebars", "LANG");
  textCode.setFieldValue(template, "TEXT");

  const contextMap = workspace.newBlock("maps_create_empty");

  const render = workspace.newBlock(TEXT_HANDLEBARS_BLOCK_TYPE);
  render.getInput("SCRIPT")?.connection?.connect(textCode.outputConnection!);
  render.getInput("CONTEXT")?.connection?.connect(contextMap.outputConnection!);

  const document = workspace.newBlock(TEXT_DOCUMENT_BLOCK_TYPE);
  document.getInput("VALUE")?.connection?.connect(render.outputConnection!);

  attachStartToInstanceRoot(workspace, document);
}

export function migrateHandlebarsTemplateOntoCanvas(
  state: unknown,
  template: string,
): unknown {
  const trimmed = template.trim();
  if (!trimmed) return state;

  ensureGenerators();
  const workspace = new Blockly.Workspace();
  try {
    let changed = false;
    runWithoutBlocklyEvents(() => {
      if (state && typeof state === "object") {
        Blockly.serialization.workspaces.load(
          JSON.parse(JSON.stringify(state)) as Record<string, unknown>,
          workspace,
        );
      }
      if (workspaceHasHandlebarsProduct(workspace)) return;

      const existingRoot = findInstanceRootUnderStart(workspace);
      if (existingRoot && existingRoot.type !== TEXT_DOCUMENT_BLOCK_TYPE) return;

      if (existingRoot?.type === TEXT_DOCUMENT_BLOCK_TYPE) {
        const value = existingRoot.getInputTargetBlock("VALUE");
        if (value?.type === TEXT_HANDLEBARS_BLOCK_TYPE) return;
        if (!value) {
          const textCode = workspace.newBlock(TEXT_CODE_BLOCK_TYPE);
          textCode.setFieldValue("handlebars", "LANG");
          textCode.setFieldValue(trimmed, "TEXT");
          const contextMap = workspace.newBlock("maps_create_empty");
          const render = workspace.newBlock(TEXT_HANDLEBARS_BLOCK_TYPE);
          render.getInput("SCRIPT")?.connection?.connect(textCode.outputConnection!);
          render.getInput("CONTEXT")?.connection?.connect(contextMap.outputConnection!);
          existingRoot.getInput("VALUE")?.connection?.connect(render.outputConnection!);
          changed = true;
          return;
        }
        return;
      }

      ensureConversionStartBlock(workspace);
      buildHandlebarsProductStack(workspace, trimmed);
      changed = true;
    });
    return changed ? Blockly.serialization.workspaces.save(workspace) : state;
  } finally {
    workspace.dispose();
  }
}
