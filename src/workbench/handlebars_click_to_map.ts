/**
 * Click-to-Map into a focused VMS-Hbs editor (`text_code` LANG=handlebars or
 * `text_handlebars` SCRIPT). Falls through to Listening Mode when no eligible
 * block is selected.
 */
import type { Block } from "blockly/core";
import {
  TEXT_CODE_BLOCK_TYPE,
  TEXT_HANDLEBARS_BLOCK_TYPE,
} from "../blockly/blocks/text_blocks.ts";
import { buildHandlebarsPath, buildHandlebarsTree } from "../core/output/handlebars_dialect.ts";

export function isHandlebarsInsertTarget(block: Block | null | undefined): boolean {
  if (!block) return false;
  if (block.type === TEXT_HANDLEBARS_BLOCK_TYPE) return true;
  if (block.type === TEXT_CODE_BLOCK_TYPE) {
    return String(block.getFieldValue("LANG") ?? "") === "handlebars";
  }
  return false;
}

function ensureHandlebarsScript(render: Block): Block | null {
  let script = render.getInputTargetBlock("SCRIPT");
  if (!script || script.type !== TEXT_CODE_BLOCK_TYPE) {
    script = render.workspace.newBlock(TEXT_CODE_BLOCK_TYPE);
    script.setFieldValue("handlebars", "LANG");
    script.setFieldValue("", "TEXT");
    const mouth = render.getInput("SCRIPT")?.connection;
    if (!mouth || !script.outputConnection) return null;
    mouth.connect(script.outputConnection);
  }
  return script;
}

function insertSnippet(block: Block, snippet: string): boolean {
  const field = block.getField("TEXT") as { insertAtCaret?: (text: string) => void } | null;
  if (field && typeof field.insertAtCaret === "function") {
    field.insertAtCaret(snippet);
    return true;
  }
  const current = String(block.getFieldValue("TEXT") ?? "");
  block.setFieldValue(`${current}${snippet}`, "TEXT");
  return true;
}

/**
 * Insert a VMS-Hbs path at the caret. `nested` (Shift+click) writes a
 * `#with`/`#each` tree; otherwise `{{path}}`.
 */
export function insertHandlebarsPathAtSelection(
  block: Block,
  sourcePath: string,
  nested: boolean,
): boolean {
  if (!isHandlebarsInsertTarget(block)) return false;
  const snippet = nested
    ? buildHandlebarsTree(sourcePath)
    : `{{${buildHandlebarsPath(sourcePath)}}}`;
  const target = block.type === TEXT_HANDLEBARS_BLOCK_TYPE
    ? ensureHandlebarsScript(block)
    : block;
  if (!target || target.type !== TEXT_CODE_BLOCK_TYPE) return false;
  return insertSnippet(target, snippet);
}
