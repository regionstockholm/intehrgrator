/**
 * Source Format Handler seam — adapters for JSON, XML, and (later) openEHR
 * Composition / FLAT / STRUCTURED as Source Schema.
 *
 * Callers (Click-to-Map, Test Run, codegen) go through this interface so new
 * formats do not fork schema_loader / query_runtime / controller unions.
 *
 * See docs/SOURCE_FORMATS.md and architecture review candidate 1.
 */

import type { SchemaTreeNode, SourceFormatId } from "../../types/mod.ts";
import {
  inferSchemaFromInstance,
  loadJsonSchema,
  loadXmlSchemaFromInstance,
  pathToFontoxpath,
} from "./schema_loader.ts";
import {
  createSourceContext,
  evaluate,
  type SourceContext,
} from "./query_runtime.ts";

export type { SourceFormatId };

export interface SourceFormatHandler {
  /** Format id (`json`, `xml`, or a registered extension such as `openehr-composition`). */
  readonly id: string;

  /** Parse schema content (or infer structure from a document-shaped payload). */
  loadSchema(content: string, rootName?: string): SchemaTreeNode;

  /** Parse an example instance into a tree for the Source Pane. */
  loadInstance(content: string, rootName?: string): SchemaTreeNode;

  /** Convert a tree node path into a Mapping Expression path (fontoxpath). */
  pathToExpression(schemaPath: string): string;

  /** Build a runtime context for evaluating mapping expressions. */
  createContext(content: string): SourceContext;

  /** Evaluate a mapping expression against a context. */
  evaluate(expression: string, ctx: SourceContext, returnType: string): unknown;
}

const jsonHandler: SourceFormatHandler = {
  id: "json",
  loadSchema(content, rootName = "root") {
    return loadJsonSchema(content, rootName);
  },
  loadInstance(content, rootName = "root") {
    return inferSchemaFromInstance(content, rootName);
  },
  pathToExpression(schemaPath) {
    return pathToFontoxpath(schemaPath, "json");
  },
  createContext(content) {
    return createSourceContext(content, "json");
  },
  evaluate(expression, ctx, returnType) {
    return evaluate(expression, ctx, returnType);
  },
};

const xmlHandler: SourceFormatHandler = {
  id: "xml",
  loadSchema(content, rootName = "root") {
    // v1: XSD deferred — infer structural tree from an XML document sample.
    return loadXmlSchemaFromInstance(content, rootName);
  },
  loadInstance(content, rootName = "root") {
    return loadXmlSchemaFromInstance(content, rootName);
  },
  pathToExpression(schemaPath) {
    return pathToFontoxpath(schemaPath, "xml");
  },
  createContext(content) {
    return createSourceContext(content, "xml");
  },
  evaluate(expression, ctx, returnType) {
    return evaluate(expression, ctx, returnType);
  },
};

const handlers = new Map<string, SourceFormatHandler>([
  [jsonHandler.id, jsonHandler],
  [xmlHandler.id, xmlHandler],
]);

/** Register or replace a format adapter (e.g. future `openehr-composition`). */
export function registerSourceFormatHandler(handler: SourceFormatHandler): void {
  handlers.set(handler.id, handler);
}

export function getSourceFormatHandler(format: SourceFormatId | string): SourceFormatHandler {
  const handler = handlers.get(format);
  if (!handler) {
    throw new Error(`Unsupported source format: ${format}`);
  }
  return handler;
}

export function listSourceFormatIds(): string[] {
  return [...handlers.keys()];
}

export function isSourceFormatId(value: string): value is SourceFormatId {
  return handlers.has(value);
}

/** Infer format from filename extension; defaults to JSON. */
export function detectSourceFormat(filename: string): SourceFormatId {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".xml") || lower.endsWith(".xsd")) return "xml";
  return "json";
}

export type { SourceContext };
