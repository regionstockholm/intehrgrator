/**
 * Single product loop: `for_each_list`. Source-node iteration is the same block
 * with a `source_query*` plugged into LIST (issue #130).
 */
import type { Block } from "blockly/core";
import { isSourceQueryBlockType } from "./source_query.ts";

export const FOR_EACH_LIST_BLOCK = "for_each_list";
/** Retired Blockly type; migrated to `for_each_list` + `source_query_node`. */
export const FOR_EACH_SOURCE_LEGACY = "for_each_source";

/** Blockly checks allowed on the loop `in` socket. */
export const LOOP_LIST_CHECK: string[] = ["Array", "Source"];

export function isLoopBlockType(type: string): boolean {
  return type === FOR_EACH_LIST_BLOCK || type === FOR_EACH_SOURCE_LEGACY;
}

/** Absolute source path when LIST is a source query (source-node grain). */
export function sourcePathFromLoopList(block: Block): string | null {
  const list = block.getInputTargetBlock("LIST");
  if (!list || !isSourceQueryBlockType(list.type)) return null;
  return String(list.getFieldValue("EXPRESSION") ?? "");
}
