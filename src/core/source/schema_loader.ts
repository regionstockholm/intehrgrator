import type { SchemaTreeNode } from "../../types/mod.ts";

export function loadJsonSchema(content: string, rootName = "root"): SchemaTreeNode {
  const data = JSON.parse(content);
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

function inferSchemaTree(value: unknown, name: string, path: string): SchemaTreeNode {
  if (Array.isArray(value)) {
    const sample = value[0];
    return {
      path,
      name,
      type: "array",
      children: sample !== undefined
        ? [inferSchemaTree(sample, `${name}[*]`, `${path}[*]`)]
        : [],
    };
  }
  if (value !== null && typeof value === "object") {
    const children = Object.entries(value as Record<string, unknown>).map(([k, v]) =>
      inferSchemaTree(v, k, `${path}.${k}`)
    );
    return { path, name, type: "object", children };
  }
  return { path, name, type: typeof value, value, children: [] };
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
      instanceToSchemaTree(v, k, `${path}/${k}`)
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
