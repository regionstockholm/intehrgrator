import type { SchemaTreeNode, SkeletonNode } from "../types/mod.ts";

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
  const ul = document.createElement("ul");
  ul.className = "skeleton-list";
  for (const node of flattenSlots(skeleton)) {
    if (node.kind !== "value") continue;
    const li = document.createElement("li");
    li.className = "slot-item";
    if (node.mandatory && !mappedSlots.has(node.slotId)) li.classList.add("unmapped-mandatory");
    if (listeningSlotId === node.slotId) li.classList.add("listening");
    li.textContent = `${node.label} :: ${node.rmType}`;
    li.title = node.slotId;
    li.addEventListener("click", () => onArm(node.slotId));
    ul.appendChild(li);
  }
  container.appendChild(ul);
}

function flattenSlots(nodes: SkeletonNode[]): SkeletonNode[] {
  const out: SkeletonNode[] = [];
  for (const n of nodes) {
    out.push(n);
    out.push(...flattenSlots(n.children));
  }
  return out;
}
