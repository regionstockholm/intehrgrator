/**
 * Target Format Handler seam.
 *
 * A Target Format describes the data structure produced by a conversion.
 * Export dialects (TypeScript, Java, Handlebars) are separate adapters.
 */
import { XMLParser } from "fast-xml-parser";
import type {
  ClinicalModelFileset,
  SchemaTreeNode,
  SkeletonNode,
  TargetFormatId,
} from "../../types/mod.ts";
import {
  generateSkeleton,
  generateSkeletonFromWebTemplate,
  collectAllSlotIds,
  isRepeatingMultiplicity,
} from "../skeleton/generate_skeleton.ts";
import { loadJsonSchema } from "../source/schema_loader.ts";
import { isWebTemplateJson } from "ehrtslib/serialization/simplified/mod.ts";

export interface TargetDefinition {
  format: TargetFormatId;
  filename: string;
  targetId: string;
  content: string;
  skeleton: SkeletonNode[];
  /** Fetched GitHub `.t.json` + ADL closure for round-trip restore without GitHub. */
  fileset?: ClinicalModelFileset;
}

export interface TargetRenderRequest {
  definition: TargetDefinition;
  slotValues: Readonly<Record<string, unknown>>;
}

export interface TargetFormatHandler {
  readonly id: TargetFormatId;
  load(filename: string, content: string): TargetDefinition;
  render(request: TargetRenderRequest): unknown;
}

const handlers = new Map<TargetFormatId, TargetFormatHandler>();

export function registerTargetFormatHandler(handler: TargetFormatHandler): void {
  handlers.set(handler.id, handler);
}

export function getTargetFormatHandler(format: TargetFormatId): TargetFormatHandler {
  const handler = handlers.get(format);
  if (!handler) throw new Error(`Unsupported target format: ${format}`);
  return handler;
}

export function listTargetFormatIds(): TargetFormatId[] {
  return [...handlers.keys()];
}

export function detectTargetFormat(filename: string, content = ""): TargetFormatId {
  const lower = filename.toLowerCase();
  if (/\.(hbs|handlebars|txt|md|html|csv)$/.test(lower)) return "free-form";
  if (lower.endsWith(".xsd")) return "xml-schema";
  if (/\.(opt|opt2|adl|adls|t\.json)$/.test(lower)) return "openehr-template";
  if (lower.endsWith(".xml")) {
    return /<(?:\w+:)?schema\b/.test(content) ? "xml-schema" : "openehr-template";
  }
  if (lower.endsWith(".json") || content.trimStart().startsWith("{")) {
    try {
      if (isWebTemplateJson(JSON.parse(content) as unknown)) return "openehr-template";
    } catch {
      // The chosen handler reports malformed content.
    }
    return "json-schema";
  }
  return "free-form";
}

registerTargetFormatHandler({
  id: "openehr-template",
  load(filename, content) {
    if (content.trimStart().startsWith("{")) {
      const generated = generateSkeletonFromWebTemplate(content);
      return {
        format: "openehr-template",
        filename,
        targetId: generated.templateId,
        content,
        skeleton: generated.skeleton,
      };
    }
    const generated = generateSkeleton(content);
    return {
      format: "openehr-template",
      filename,
      targetId: generated.templateId,
      content,
      skeleton: generated.skeleton,
    };
  },
  render({ definition, slotValues }) {
    const roots = definition.skeleton
      .map((node) => renderOpenEhrNode(node, slotValues))
      .filter((value) => value !== undefined);
    return roots.length === 1 ? roots[0] : roots;
  },
});

registerTargetFormatHandler({
  id: "json-schema",
  load(filename, content) {
    const document = JSON.parse(content) as Record<string, unknown>;
    const targetId = typeof document.$id === "string"
      ? document.$id
      : typeof document.title === "string"
      ? document.title
      : stripExtension(filename);
    const tree = loadJsonSchema(content, targetId);
    return {
      format: "json-schema",
      filename,
      targetId,
      content,
      skeleton: [schemaTreeToSkeleton(tree, targetId, "json-schema", true)],
    };
  },
  render({ definition, slotValues }) {
    const root = definition.skeleton[0];
    return root ? renderGenericNode(root, slotValues) : {};
  },
});

registerTargetFormatHandler({
  id: "xml-schema",
  load(filename, content) {
    const parsed = parseXmlSchema(content, stripExtension(filename));
    return {
      format: "xml-schema",
      filename,
      targetId: parsed.targetId,
      content,
      skeleton: [parsed.root],
    };
  },
  render({ definition, slotValues }) {
    const root = definition.skeleton[0];
    return root ? renderXmlNode(root, slotValues) : "";
  },
});

registerTargetFormatHandler({
  id: "free-form",
  load(filename, content) {
    const targetId = stripExtension(filename) || "free-form";
    return {
      format: "free-form",
      filename,
      targetId,
      content,
      skeleton: [],
    };
  },
  render({ definition }) {
    return definition.content;
  },
});

function schemaTreeToSkeleton(
  node: SchemaTreeNode,
  targetId: string,
  format: TargetFormatId,
  root = false,
): SkeletonNode {
  const children = node.children.map((child) =>
    schemaTreeToSkeleton(child, targetId, format)
  );
  const kind = children.length || node.type === "object" || node.type === "array"
    ? "container"
    : "value";
  return {
    slotId: `${targetId}:${node.path}`,
    targetPath: node.path,
    blockType: kind === "container" ? "target_structure" : "target_value",
    rmType: node.type,
    label: node.name,
    rmAttribute: root ? undefined : node.name.replace(/\[\*\]$/, ""),
    kind,
    mandatory: node.multiplicity === "1" || node.multiplicity === "1..*",
    multiplicity: node.multiplicity,
    children,
  };
}

function parseXmlSchema(content: string, fallbackId: string): {
  targetId: string;
  root: SkeletonNode;
} {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    removeNSPrefix: true,
  });
  const document = parser.parse(content) as Record<string, unknown>;
  const schema = asRecord(document.schema);
  if (!schema) throw new Error("Invalid XML Schema: missing xs:schema");
  const rootElement = arrayOf(schema.element)[0];
  if (!rootElement) throw new Error("Invalid XML Schema: no root xs:element");
  const rootName = stringAttr(rootElement, "@name") || fallbackId;
  return {
    targetId: stringAttr(schema, "@targetNamespace") || rootName,
    root: xsdElementToSkeleton(rootElement, rootName, `/${rootName}`, true),
  };
}

function xsdElementToSkeleton(
  element: Record<string, unknown>,
  fallbackName: string,
  path: string,
  root = false,
): SkeletonNode {
  const name = stringAttr(element, "@name") || fallbackName;
  const complex = asRecord(element.complexType);
  const sequence = asRecord(complex?.sequence) ?? asRecord(complex?.all) ??
    asRecord(complex?.choice);
  const childElements = arrayOf(sequence?.element);
  const children = childElements.map((child) => {
    const childName = stringAttr(child, "@name") || typeLocalName(stringAttr(child, "@ref")) || "element";
    return xsdElementToSkeleton(child, childName, `${path}/${childName}`);
  });
  const min = Number(stringAttr(element, "@minOccurs") || (root ? "1" : "1"));
  const maxToken = stringAttr(element, "@maxOccurs") || "1";
  const max = maxToken === "unbounded" ? null : Number(maxToken);
  const multiplicity = max === 1 ? (min > 0 ? "1" : "0..1") : (min > 0 ? "1..*" : "0..*");
  const kind = children.length || complex ? "container" : "value";
  const type = typeLocalName(stringAttr(element, "@type")) || (kind === "container" ? "complexType" : "string");
  return {
    slotId: `${root ? name : path}:${path}`,
    targetPath: path,
    blockType: kind === "container" ? "target_structure" : "target_value",
    rmType: type,
    label: name,
    rmAttribute: root ? undefined : name,
    kind,
    mandatory: min > 0,
    multiplicity,
    children,
  };
}

function renderGenericNode(
  node: SkeletonNode,
  values: Readonly<Record<string, unknown>>,
): unknown {
  if (node.kind === "value") return values[node.slotId] ?? fixedValue(node);
  if (node.rmType === "array") {
    const item = node.children[0] ? renderGenericNode(node.children[0], values) : undefined;
    return item === undefined ? [] : [item];
  }
  const result: Record<string, unknown> = {};
  for (const child of node.children) {
    const value = renderGenericNode(child, values);
    if (value !== undefined) result[child.rmAttribute ?? child.label] = value;
  }
  return result;
}

function renderOpenEhrNode(
  node: SkeletonNode,
  values: Readonly<Record<string, unknown>>,
): unknown {
  if (
    node.kind === "container" &&
    isRepeatingMultiplicity(node.multiplicity)
  ) {
    const count = repeatingInstanceCount(node, values);
    if (count > 1) {
      const copies: unknown[] = [];
      for (let i = 0; i < count; i++) {
        const one = renderOpenEhrNodeOnce(node, indexSlotValues(values, i, node));
        if (one !== undefined) copies.push(one);
      }
      return copies;
    }
  }
  return renderOpenEhrNodeOnce(node, values);
}

function renderOpenEhrNodeOnce(
  node: SkeletonNode,
  values: Readonly<Record<string, unknown>>,
): unknown {
  if (node.kind === "value") {
    let value = Object.hasOwn(values, node.slotId) ? values[node.slotId] : fixedValue(node);
    if (Array.isArray(value)) {
      value = value.find((item) => !isAbsentValue(item));
    }
    if (isAbsentValue(value)) return undefined;
    if (!node.rmType.startsWith("DV_") && node.rmType !== "CODE_PHRASE") return value;
    const output: Record<string, unknown> = { _type: node.rmType };
    if (node.rmType === "DV_QUANTITY") output.magnitude = value;
    else if (node.rmType === "DV_BOOLEAN") output.value = Boolean(value);
    else if (node.rmType === "DV_COUNT") output.magnitude = Number(value);
    else output.value = value;
    Object.assign(output, node.fixedFields ?? {});
    return output;
  }

  const output: Record<string, unknown> = { _type: node.rmType };
  if (node.archetypeNodeId) output.archetype_node_id = node.archetypeNodeId;
  if (node.label && node.rmType !== "COMPOSITION") {
    output.name = { _type: "DV_TEXT", value: node.label };
  }
  const grouped = new Map<string, unknown[]>();
  for (const child of node.children) {
    const value = renderOpenEhrNode(child, values);
    if (value === undefined) continue;
    const attribute = child.rmAttribute ?? child.label;
    const list = grouped.get(attribute) ?? [];
    if (Array.isArray(value) && child.kind === "container") {
      list.push(...value);
    } else {
      list.push(value);
    }
    grouped.set(attribute, list);
  }
  if (grouped.size === 0 && !node.mandatory && node.rmType !== "COMPOSITION") {
    return undefined;
  }
  for (const [attribute, valuesForAttribute] of grouped) {
    output[attribute] = shouldRenderAsArray(attribute, valuesForAttribute.length)
      ? valuesForAttribute
      : valuesForAttribute[0];
  }
  return output;
}

function repeatingInstanceCount(
  node: SkeletonNode,
  values: Readonly<Record<string, unknown>>,
): number {
  let max = 0;
  for (const slotId of collectAllSlotIds([node])) {
    const value = values[slotId];
    if (Array.isArray(value)) max = Math.max(max, value.length);
  }
  return max;
}

function indexSlotValues(
  values: Readonly<Record<string, unknown>>,
  index: number,
  subtree: SkeletonNode,
): Record<string, unknown> {
  const ids = new Set(collectAllSlotIds([subtree]));
  const out: Record<string, unknown> = { ...values };
  for (const [key, value] of Object.entries(values)) {
    if (!ids.has(key)) continue;
    if (Array.isArray(value)) out[key] = value[index];
  }
  return out;
}

function renderXmlNode(
  node: SkeletonNode,
  values: Readonly<Record<string, unknown>>,
): string {
  const name = xmlName(node.label);
  if (node.kind === "value") {
    const value = values[node.slotId] ?? fixedValue(node);
    return value === undefined ? "" : `<${name}>${escapeXml(String(value))}</${name}>`;
  }
  const body = node.children.map((child) => renderXmlNode(child, values)).join("");
  return `<${name}>${body}</${name}>`;
}

function isAbsentValue(value: unknown): boolean {
  return value === undefined || value === null ||
    (typeof value === "number" && Number.isNaN(value));
}

function fixedValue(node: SkeletonNode): unknown {
  return node.fixedValue ?? node.fixedFields?.value ?? node.fixedFields?.defining_code;
}

function shouldRenderAsArray(attribute: string, count: number): boolean {
  return count > 1 ||
    new Set(["content", "items", "events", "activities", "participations", "links"]).has(attribute);
}

function arrayOf(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  return isRecord(value) ? [value] : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringAttr(value: Record<string, unknown> | null | undefined, key: string): string {
  const item = value?.[key];
  return typeof item === "string" || typeof item === "number" ? String(item) : "";
}

function typeLocalName(value: string): string {
  return value.split(":").pop() ?? value;
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

function xmlName(value: string): string {
  const safe = value.replace(/[^A-Za-z0-9_.-]/g, "_");
  return /^[A-Za-z_]/.test(safe) ? safe : `_${safe}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
