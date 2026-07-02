import type { SchemaTreeNode } from "../../types/mod.ts";

type JsonSchemaObject = Record<string, unknown>;

export function loadJsonSchema(content: string, rootName = "root"): SchemaTreeNode {
  const data = JSON.parse(content);
  if (isJsonSchemaDocument(data)) {
    return jsonSchemaToTree(data, rootName, "$");
  }
  return inferSchemaTree(data, rootName, "$");
}

export function inferSchemaFromInstance(content: string, rootName = "root"): SchemaTreeNode {
  const data = JSON.parse(content);
  return instanceToSchemaTree(data, rootName, "$");
}

export function loadXmlSchemaFromInstance(xml: string, rootName = "root"): SchemaTreeNode {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Invalid XML");
  }
  return xmlNodeToSchema(doc.documentElement, rootName, `/${doc.documentElement.tagName}`);
}

/** Normalize tree paths so schema (`$.a.b`) and instance (`$.a.b` / `$[1]`) can be matched. */
export function canonicalSyncPath(path: string): string {
  let normalized = path.startsWith("$") ? path : `$.${path.replace(/^\./, "")}`;
  normalized = normalized.replace(/\//g, ".");
  normalized = normalized.replace(/\[\d+\]/g, "[*]");
  normalized = normalized.replace(/\.+/g, ".");
  return normalized;
}

export function findNodeBySyncPath(
  root: SchemaTreeNode,
  syncPath: string,
): SchemaTreeNode | null {
  if (canonicalSyncPath(root.path) === syncPath) return root;
  for (const child of root.children) {
    const found = findNodeBySyncPath(child, syncPath);
    if (found) return found;
  }
  return null;
}

function isJsonSchemaDocument(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const o = value as JsonSchemaObject;
  if (typeof o.$schema === "string") return true;
  if (o.properties && typeof o.properties === "object") return true;
  if (o.type === "object" && o.properties) return true;
  if (o.type === "array" && o.items) return true;
  return false;
}

function jsonSchemaToTree(
  schema: JsonSchemaObject,
  name: string,
  path: string,
  parentRequired?: Set<string>,
): SchemaTreeNode {
  const resolved = resolveSchema(schema);
  const type = schemaType(resolved);
  const multiplicity = schemaMultiplicity(resolved, name, parentRequired);

  if (type === "array") {
    const items = resolved.items;
    const itemSchema = Array.isArray(items) ? items[0] : items;
    const children = itemSchema && typeof itemSchema === "object"
      ? [jsonSchemaToTree(itemSchema as JsonSchemaObject, `${name}[*]`, `${path}[*]`)]
      : [];
    return { path, name, type: "array", multiplicity, children };
  }

  if (type === "object" || resolved.properties) {
    const props = (resolved.properties ?? {}) as Record<string, JsonSchemaObject>;
    const required = new Set(
      Array.isArray(resolved.required) ? resolved.required.map(String) : [],
    );
    const children = Object.entries(props).map(([key, prop]) =>
      jsonSchemaToTree(prop, key, `${path}.${key}`, required)
    );
    return { path, name, type: "object", multiplicity, children };
  }

  return { path, name, type, multiplicity, children: [] };
}

function resolveSchema(schema: JsonSchemaObject): JsonSchemaObject {
  if (schema.$ref && typeof schema.$ref === "string") {
    // Unresolved refs fall back to the ref token as type hint.
    const refName = schema.$ref.split("/").pop() ?? "ref";
    return { type: refName };
  }
  if (Array.isArray(schema.type)) {
    const preferred = schema.type.find((t) => t !== "null") ?? schema.type[0];
    return { ...schema, type: preferred };
  }
  return schema;
}

function schemaType(schema: JsonSchemaObject): string {
  if (typeof schema.type === "string") return schema.type;
  if (schema.properties) return "object";
  if (schema.items) return "array";
  if (Array.isArray(schema.enum) && schema.enum.length) {
    return typeof schema.enum[0] === "number" ? "number" : "string";
  }
  return "unknown";
}

function schemaMultiplicity(
  schema: JsonSchemaObject,
  name: string,
  parentRequired?: Set<string>,
): string {
  if (schema.type === "array" || schema.items) {
    const min = typeof schema.minItems === "number" ? schema.minItems : 0;
    const max = typeof schema.maxItems === "number" ? schema.maxItems : null;
    if (min >= 1 && max === 1) return "1";
    if (min >= 1 && max === null) return "1..*";
    if (min === 0 && max === 1) return "0..1";
    return "0..*";
  }
  if (parentRequired) {
    return parentRequired.has(name) ? "1" : "0..1";
  }
  return "1";
}

function inferSchemaTree(value: unknown, name: string, path: string): SchemaTreeNode {
  if (Array.isArray(value)) {
    const sample = value[0];
    return {
      path,
      name,
      type: "array",
      multiplicity: value.length > 1 ? "1..*" : "0..*",
      children: sample !== undefined
        ? [inferSchemaTree(sample, `${name}[*]`, `${path}[*]`)]
        : [],
    };
  }
  if (value !== null && typeof value === "object") {
    const children = Object.entries(value as Record<string, unknown>).map(([k, v]) =>
      inferSchemaTree(v, k, `${path}.${k}`)
    );
    return { path, name, type: "object", multiplicity: "1", children };
  }
  return {
    path,
    name,
    type: typeof value,
    multiplicity: "1",
    children: [],
  };
}

function instanceToSchemaTree(value: unknown, name: string, path: string): SchemaTreeNode {
  if (Array.isArray(value)) {
    return {
      path,
      name,
      type: "array",
      children: value.map((item, i) =>
        instanceToSchemaTree(item, `[${i}]`, `${path}[${i + 1}]`)
      ),
    };
  }
  if (value !== null && typeof value === "object") {
    const children = Object.entries(value as Record<string, unknown>).map(([k, v]) =>
      instanceToSchemaTree(v, k, `${path}.${k}`)
    );
    return { path, name, type: "object", children };
  }
  return { path, name, type: typeof value, value, children: [] };
}

function xmlNodeToSchema(el: Element, name: string, path: string): SchemaTreeNode {
  const children: SchemaTreeNode[] = [];
  const seen = new Set<string>();
  for (const child of el.children) {
    if (seen.has(child.tagName)) continue;
    seen.add(child.tagName);
    children.push(xmlNodeToSchema(child, child.tagName, `${path}/${child.tagName}`));
  }
  const text = el.textContent?.trim();
  return {
    path,
    name,
    type: children.length ? "element" : "string",
    value: children.length ? undefined : text,
    children,
  };
}

export function pathToFontoxpath(schemaPath: string, format: "json" | "xml"): string {
  if (format === "xml") {
    return schemaPath.startsWith("/") ? schemaPath : `/${schemaPath}`;
  }
  if (schemaPath.startsWith("$")) return schemaPath;
  if (schemaPath.startsWith("/")) {
    const parts = schemaPath.split("/").filter(Boolean);
    return parts.reduce((acc, part) => {
      if (part.startsWith("[") && part.endsWith("]")) return `${acc}${part}`;
      return `${acc}/${part}`;
    }, "$");
  }
  return `$.${schemaPath.replace(/^\./, "")}`;
}
