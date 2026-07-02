import type { SchemaTreeNode, SkeletonNode } from "../types/mod.ts";

const SKELETON_INDENT_PX = 10;

export function renderSchemaTree(
  container: HTMLElement,
  node: SchemaTreeNode,
  onSelect: (path: string) => void,
): void {
  container.innerHTML = "";
  container.appendChild(buildTreeNode(node, onSelect, 0));
}

function buildTreeNode(
  node: SchemaTreeNode,
  onSelect: (path: string) => void,
  depth: number,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "tree-row";
  row.style.paddingLeft = `${depth * 12}px`;
  const label = document.createElement("span");
  label.className = "tree-label";
  label.textContent = node.value !== undefined
    ? `${node.name}  ${formatValue(node.value)}`
    : `${node.name}  ${node.type}`;
  label.draggable = true;
  label.addEventListener("click", () => onSelect(node.path));
  label.addEventListener("dragstart", (e) => {
    e.dataTransfer?.setData("text/plain", node.path);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
  });
  row.appendChild(label);

  const wrap = document.createElement("div");
  wrap.appendChild(row);
  for (const child of node.children) {
    wrap.appendChild(buildTreeNode(child, onSelect, depth + 1));
  }
  return wrap;
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

export function renderSkeletonList(
  container: HTMLElement,
  skeleton: SkeletonNode[],
  onArm: (slotId: string) => void,
  listeningSlotId: string | null,
  mappedSlots: Set<string>,
): void {
  container.innerHTML = "";
  const tree = document.createElement("ul");
  tree.className = "skeleton-tree";
  for (const node of skeleton) {
    const branch = buildSkeletonBranch(node, onArm, listeningSlotId, mappedSlots, 0);
    if (branch) tree.appendChild(branch);
  }
  if (!tree.childElementCount) {
    container.textContent = "No value slots.";
    return;
  }
  container.appendChild(tree);
}

function buildSkeletonBranch(
  node: SkeletonNode,
  onArm: (slotId: string) => void,
  listeningSlotId: string | null,
  mappedSlots: Set<string>,
  depth: number,
): HTMLElement | null {
  if (node.kind === "value") {
    return buildValueSlotItem(node, onArm, listeningSlotId, mappedSlots, depth);
  }

  const childBranches = node.children
    .map((child) => buildSkeletonBranch(child, onArm, listeningSlotId, mappedSlots, depth + 1))
    .filter((el): el is HTMLElement => el !== null);
  if (childBranches.length === 0) return null;

  const li = document.createElement("li");
  li.className = "skeleton-tree-node skeleton-branch";

  const row = document.createElement("div");
  row.className = "skeleton-tree-row";
  row.style.paddingRight = `${depth * SKELETON_INDENT_PX}px`;

  const label = document.createElement("span");
  label.className = "skeleton-branch-label truncate-suffix";
  label.textContent = node.label;
  label.title = node.slotId;
  row.appendChild(label);
  li.appendChild(row);

  const childList = document.createElement("ul");
  childList.className = "skeleton-tree-children";
  for (const child of childBranches) childList.appendChild(child);
  li.appendChild(childList);
  return li;
}

function buildValueSlotItem(
  node: SkeletonNode,
  onArm: (slotId: string) => void,
  listeningSlotId: string | null,
  mappedSlots: Set<string>,
  depth: number,
): HTMLElement {
  const li = document.createElement("li");
  li.className = "skeleton-tree-node slot-item";
  const mapped = mappedSlots.has(node.slotId);
  if (node.mandatory && !mapped) li.classList.add("unmapped-mandatory");
  if (mapped) li.classList.add("mapped");
  if (listeningSlotId === node.slotId) li.classList.add("listening");

  const row = document.createElement("div");
  row.className = "skeleton-tree-row";
  row.style.paddingRight = `${depth * SKELETON_INDENT_PX}px`;

  const label = document.createElement("span");
  label.className = "slot-label truncate-suffix";
  label.textContent = node.label;
  label.title = node.slotId;

  const rmType = document.createElement("span");
  rmType.className = "slot-rm-type";
  rmType.textContent = node.rmType;
  rmType.title = node.slotId;

  row.append(label, rmType);
  li.appendChild(row);
  li.addEventListener("click", () => onArm(node.slotId));
  return li;
}
