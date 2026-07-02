/**
 * Blockly resolves as CJS default export under Deno tests and as a namespace under esbuild.
 * This shim exposes a single Blockly object in both environments.
 */
import * as BlocklyNamespace from "blockly/core";

// deno-lint-ignore no-explicit-any
const ns = BlocklyNamespace as any;

function resolveBlockly(): typeof BlocklyNamespace {
  if (ns.Blocks) return ns;
  if (ns.default?.Blocks) return ns.default;
  return ns.default ?? ns;
}

export const Blockly = resolveBlockly();

export function blocksRegistry(): typeof Blockly.Blocks {
  return Blockly.Blocks;
}
