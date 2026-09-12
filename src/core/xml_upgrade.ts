/**
 * Rewrite saved Blockly JSON so ad-hoc `xml_element` stacks match the split
 * mouths (attributes / text / children). Idempotent.
 */
import {
  XML_ATTRIBUTE_TYPE,
  XML_ATTRIBUTES_INPUT,
  XML_CDATA_TYPE,
  XML_CHILDREN_INPUT,
  XML_ELEMENT_TYPE,
  XML_TEXT_INPUT,
  XML_TEXT_TYPE,
} from "./xml_shape.ts";

interface BlockInput {
  block?: BlockNode;
  shadow?: BlockNode;
}

interface BlockNode {
  type?: string;
  inputs?: Record<string, BlockInput>;
  next?: { block?: BlockNode };
  extraState?: { childGroups?: string[] };
}

export function upgradeXmlBlocklyState<T>(state: T): T {
  if (!state || typeof state !== "object") return state;
  const root = state as { blocks?: { blocks?: unknown[] } };
  const blocks = root.blocks?.blocks;
  if (!Array.isArray(blocks)) return state;
  for (const block of blocks) upgradeXmlBlockNode(block);
  return state;
}

function upgradeXmlBlockNode(node: unknown): void {
  if (!node || typeof node !== "object") return;
  const block = node as BlockNode;
  if (block.type === XML_ELEMENT_TYPE) splitXmlElementInputs(block);
  if (block.inputs) {
    for (const input of Object.values(block.inputs)) {
      if (input?.block) upgradeXmlBlockNode(input.block);
      if (input?.shadow) upgradeXmlBlockNode(input.shadow);
    }
  }
  if (block.next?.block) upgradeXmlBlockNode(block.next.block);
}

function splitXmlElementInputs(block: BlockNode): void {
  const head = block.inputs?.[XML_CHILDREN_INPUT]?.block;
  if (!head) return;
  const chain = chainToArray(head);
  const hasLegacy = chain.some((item) =>
    item.type === XML_ATTRIBUTE_TYPE || item.type === XML_TEXT_TYPE || item.type === XML_CDATA_TYPE
  );
  if (!hasLegacy) return;

  const attrs: BlockNode[] = [];
  const texts: BlockNode[] = [];
  const rest: BlockNode[] = [];
  for (const item of chain) {
    if (item.type === XML_ATTRIBUTE_TYPE) attrs.push(item);
    else if (item.type === XML_TEXT_TYPE || item.type === XML_CDATA_TYPE) texts.push(item);
    else rest.push(item);
  }

  block.inputs = block.inputs ?? {};
  if (attrs.length && !block.inputs[XML_ATTRIBUTES_INPUT]?.block) {
    block.inputs[XML_ATTRIBUTES_INPUT] = arrayToChain(attrs)!;
  }
  if (texts.length && !block.inputs[XML_TEXT_INPUT]?.block && !block.inputs[XML_TEXT_INPUT]?.shadow) {
    block.inputs[XML_TEXT_INPUT] = textInputFromLegacy(texts[0]!);
  }
  const children = arrayToChain(rest);
  if (children) block.inputs[XML_CHILDREN_INPUT] = children;
  else delete block.inputs[XML_CHILDREN_INPUT];

  const groups = new Set(block.extraState?.childGroups ?? []);
  groups.add("attributes");
  groups.add("children");
  block.extraState = { ...(block.extraState ?? {}), childGroups: [...groups] };
}

function textInputFromLegacy(node: BlockNode): BlockInput {
  if (node.type === XML_TEXT_TYPE && node.inputs?.VALUE) return node.inputs.VALUE;
  return { block: node };
}

function chainToArray(head: BlockNode): BlockNode[] {
  const out: BlockNode[] = [];
  let current: BlockNode | undefined = head;
  while (current) {
    const next = current.next?.block;
    delete current.next;
    out.push(current);
    current = next;
  }
  return out;
}

function arrayToChain(nodes: BlockNode[]): BlockInput | undefined {
  if (!nodes.length) return undefined;
  for (let i = 0; i < nodes.length - 1; i++) {
    nodes[i]!.next = { block: nodes[i + 1] };
  }
  return { block: nodes[0] };
}
