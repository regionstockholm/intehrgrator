import type { SchemaTreeNode, SkeletonNode, SourceFormatId } from "../types/mod.ts";
import { isAutoFixedValueSlot } from "../core/rm_mandatory.ts";
import { canonicalSyncPath, isSourceFormatId } from "../core/source/mod.ts";

const SKELETON_INDENT_PX = 10;

/** Custom MIME for Source Pane → value-slot drag-and-drop mapping. */
export const SOURCE_DRAG_MIME = "application/x-intehrgrator-source";

export interface SourceDragPayload {
  path: string;
  format: SourceFormatId;
  origin: "schema" | "instance";
}

export function parseSourceDragPayload(dt: DataTransfer | null): SourceDragPayload | null {
  if (!dt) return null;
  const raw = dt.getData(SOURCE_DRAG_MIME) || dt.getData("text/plain");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SourceDragPayload>;
    if (parsed.path && typeof parsed.format === "string" && isSourceFormatId(parsed.format)) {
      return {
        path: parsed.path,
        format: parsed.format,
        origin: parsed.origin === "schema" || parsed.origin === "instance"
          ? parsed.origin
          : "instance",
      };
    }
  } catch {
    // plain path fallback (legacy / Playwright text-only drops)
  }
  if (raw.startsWith("$") || raw.startsWith("/")) {
    return { path: raw, format: "json", origin: "instance" };
  }
  return null;
}

export interface TreeHighlightState {
  /** Canonical sync path shared across schema and instance trees. */
  syncPath: string | null;
  /** Which tree initiated the highlight (`schema` | `instance`). */
  origin: "schema" | "instance" | null;
}

export interface SchemaTreeRenderOptions {
  onHighlight?: (syncPath: string | null, origin: "schema" | "instance") => void;
}

export function applyTreeHighlights(
  schemaPane: HTMLElement,
  instancePane: HTMLElement,
  state: TreeHighlightState,
): void {
  for (const [pane, paneOrigin] of [
    [schemaPane, "schema"],
    [instancePane, "instance"],
  ] as const) {
    for (const row of pane.querySelectorAll<HTMLElement>(".tree-row")) {
      row.classList.remove("highlighted", "synced");
      if (!state.syncPath) continue;
      if (row.dataset.syncPath === state.syncPath) {
        row.classList.add(state.origin === paneOrigin ? "highlighted" : "synced");
      }
    }
  }
}

export function renderSchemaTree(
  container: HTMLElement,
  node: SchemaTreeNode,
  onSelect: (path: string) => void,
  options: SchemaTreeRenderOptions = {},
): void {
  container.classList.add("schema-tree");
  container.classList.remove("instance-tree");
  container.innerHTML = "";
  container.appendChild(buildSchemaNode(node, onSelect, options, 0));
}

export function renderInstanceTree(
  container: HTMLElement,
  node: SchemaTreeNode,
  onSelect: (path: string) => void,
  options: SchemaTreeRenderOptions = {},
  format: SourceFormatId = "json",
): void {
  container.classList.add("instance-tree");
  container.classList.remove("schema-tree");
  container.innerHTML = "";
  container.appendChild(buildInstanceNode(node, onSelect, options, 0, format));
}

function buildSchemaNode(
  node: SchemaTreeNode,
  onSelect: (path: string) => void,
  options: SchemaTreeRenderOptions,
  depth: number,
): HTMLElement {
  const syncPath = canonicalSyncPath(node.path);
  const row = createTreeRow(node.path, syncPath, depth);

  const label = document.createElement("span");
  label.className = "tree-label tree-label-schema";
  const meta = document.createElement("span");
  meta.className = "tree-meta";
  meta.textContent = formatSchemaMeta(node);
  label.append(document.createTextNode(node.name), meta);
  attachTreeInteractions(label, node.path, syncPath, "schema", "json", onSelect, options);
  row.appendChild(label);

  const wrap = document.createElement("div");
  wrap.appendChild(row);
  for (const child of node.children) {
    wrap.appendChild(buildSchemaNode(child, onSelect, options, depth + 1));
  }
  return wrap;
}

function buildInstanceNode(
  node: SchemaTreeNode,
  onSelect: (path: string) => void,
  options: SchemaTreeRenderOptions,
  depth: number,
  format: SourceFormatId,
): HTMLElement {
  const syncPath = canonicalSyncPath(node.path);
  const row = createTreeRow(node.path, syncPath, depth);

  const label = document.createElement("span");
  label.className = "tree-label tree-label-instance";
  label.textContent = node.value !== undefined
    ? `${node.name}  ${formatValue(node.value)}`
    : node.name;
  attachTreeInteractions(label, node.path, syncPath, "instance", format, onSelect, options);
  row.appendChild(label);

  const wrap = document.createElement("div");
  wrap.appendChild(row);
  for (const child of node.children) {
    wrap.appendChild(buildInstanceNode(child, onSelect, options, depth + 1, format));
  }
  return wrap;
}

function createTreeRow(path: string, syncPath: string, depth: number): HTMLElement {
  const row = document.createElement("div");
  row.className = "tree-row";
  row.style.paddingLeft = `${depth * 12}px`;
  row.dataset.path = path;
  row.dataset.syncPath = syncPath;
  return row;
}

function attachTreeInteractions(
  label: HTMLSpanElement,
  path: string,
  syncPath: string,
  origin: "schema" | "instance",
  format: SourceFormatId,
  onSelect: (path: string) => void,
  options: SchemaTreeRenderOptions,
): void {
  label.draggable = true;
  label.addEventListener("click", () => {
    options.onHighlight?.(syncPath, origin);
    onSelect(path);
  });
  label.addEventListener("mouseenter", () => options.onHighlight?.(syncPath, origin));
  label.addEventListener("mouseleave", () => options.onHighlight?.(null, origin));
  label.addEventListener("dragstart", (e) => {
    const payload: SourceDragPayload = { path, format, origin };
    const json = JSON.stringify(payload);
    e.dataTransfer?.setData(SOURCE_DRAG_MIME, json);
    e.dataTransfer?.setData("text/plain", json);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
  });
}

function formatSchemaMeta(node: SchemaTreeNode): string {
  const parts = [node.type];
  if (node.multiplicity) parts.push(`[${node.multiplicity}]`);
  return `  ${parts.join(" ")}`;
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
  onDropSource?: (slotId: string, payload: SourceDragPayload) => void,
): void {
  container.innerHTML = "";
  const tree = document.createElement("ul");
  tree.className = "skeleton-tree";
  for (const node of skeleton) {
    const branch = buildSkeletonBranch(
      node,
      onArm,
      listeningSlotId,
      mappedSlots,
      0,
      onDropSource,
    );
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
  onDropSource?: (slotId: string, payload: SourceDragPayload) => void,
): HTMLElement | null {
  if (node.kind === "value") {
    if (isAutoFixedValueSlot(node)) return null;
    return buildValueSlotItem(node, onArm, listeningSlotId, mappedSlots, depth, onDropSource);
  }

  const childBranches = node.children
    .map((child) =>
      buildSkeletonBranch(child, onArm, listeningSlotId, mappedSlots, depth + 1, onDropSource)
    )
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
  onDropSource?: (slotId: string, payload: SourceDragPayload) => void,
): HTMLElement {
  const li = document.createElement("li");
  li.className = "skeleton-tree-node slot-item";
  li.dataset.slotId = node.slotId;
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

  if (onDropSource) {
    li.addEventListener("dragenter", (e) => {
      e.preventDefault();
      li.classList.add("drop-target");
    });
    li.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      li.classList.add("drop-target");
    });
    li.addEventListener("dragleave", (e) => {
      if (e.relatedTarget instanceof Node && li.contains(e.relatedTarget)) return;
      li.classList.remove("drop-target");
    });
    li.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      li.classList.remove("drop-target");
      const payload = parseSourceDragPayload(e.dataTransfer);
      if (payload) onDropSource(node.slotId, payload);
    });
  }
  return li;
}
