/**
 * JSON Schema instance validation via @cfworker/json-schema.
 *
 * Used when the Source Schema is a JSON Schema document and the example is JSON.
 * openEHR RM/template instance checks stay with ehrtslib; XML/XSD remains deferred.
 */

import { Validator, type Schema, type SchemaDraft } from "@cfworker/json-schema";
import { appendJsonPath } from "./schema_loader.ts";

export interface JsonSchemaIssue {
  path: string;
  message: string;
  keyword?: string;
}

const WRAPPER_ERRORS = new Set([
  "A subschema had errors.",
]);

export function validateJsonAgainstJsonSchema(
  instance: unknown,
  schema: Record<string, unknown>,
): JsonSchemaIssue[] {
  const draft = draftFromSchema(schema);
  const validator = new Validator(schema as Schema, draft, false);
  const result = validator.validate(instance);
  if (result.valid) return [];

  const issues: JsonSchemaIssue[] = [];
  for (const error of result.errors) {
    if (WRAPPER_ERRORS.has(error.error)) continue;
    if (/^Property "[^"]+" does not match schema\.$/.test(error.error)) continue;

    const path = jsonPointerToPath(error.instanceLocation);
    let message = error.error;
    if (error.error === "False boolean schema.") {
      const name = path.split(/[.[\]]+/).filter(Boolean).pop() ?? path;
      message = `Not in schema: ${name}`;
    }
    issues.push({ path, message, keyword: error.keyword });
  }
  return issues;
}

function draftFromSchema(schema: Record<string, unknown>): SchemaDraft {
  const id = typeof schema.$schema === "string" ? schema.$schema : "";
  if (id.includes("2020-12")) return "2020-12";
  if (id.includes("2019-09")) return "2019-09";
  if (id.includes("draft-07") || id.includes("/draft/07")) return "7";
  if (id.includes("draft-04") || id.includes("/draft/04")) return "4";
  return "2020-12";
}

/** Convert a JSON Pointer (`#/diastolic`, `/items/0`) to the Source Pane path (`$.diastolic`, `$.items[1]`). */
export function jsonPointerToPath(pointer: string): string {
  const raw = pointer.startsWith("#") ? pointer.slice(1) : pointer;
  if (!raw || raw === "/") return "$";
  const segments = raw.split("/").slice(1);
  let path = "$";
  for (const segment of segments) {
    const key = unescapePointer(segment);
    if (/^\d+$/.test(key)) {
      path += `[${Number(key) + 1}]`;
    } else {
      path = appendJsonPath(path, key);
    }
  }
  return path;
}

function unescapePointer(segment: string): string {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // already decoded or malformed — keep the raw segment
  }
  return decoded.replace(/~1/g, "/").replace(/~0/g, "~");
}
