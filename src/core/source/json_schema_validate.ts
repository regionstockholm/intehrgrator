/**
 * Interpretive JSON Schema subset used when a Source Schema is a JSON Schema
 * document. Covers type/required/additionalProperties plus value keywords
 * (enum, minimum/maximum, pattern, format) that the structural tree walk
 * cannot see.
 *
 * fast-xml-parser's XMLValidator only checks well-formed XML — it does not
 * validate against XSD or JSON Schema, so JSON instances use this path.
 */

import { appendJsonPath } from "./schema_loader.ts";

type JsonSchemaObject = Record<string, unknown>;

export interface JsonSchemaIssue {
  path: string;
  message: string;
}

export function validateJsonAgainstJsonSchema(
  instance: unknown,
  schema: JsonSchemaObject,
  path = "$",
): JsonSchemaIssue[] {
  const issues: JsonSchemaIssue[] = [];
  collect(instance, schema, path, issues);
  return issues;
}

function collect(
  instance: unknown,
  schema: JsonSchemaObject,
  path: string,
  issues: JsonSchemaIssue[],
): void {
  const typeSpec = schema.type;
  if (typeof typeSpec === "string") {
    if (!matchesType(instance, typeSpec)) {
      issues.push({
        path,
        message: `Type mismatch: expected ${typeSpec}, got ${describeType(instance)}`,
      });
      return;
    }
  } else if (Array.isArray(typeSpec)) {
    const allowed = typeSpec.filter((t): t is string => typeof t === "string");
    if (allowed.length && !allowed.some((t) => matchesType(instance, t))) {
      issues.push({
        path,
        message: `Type mismatch: expected ${allowed.join("|")}, got ${describeType(instance)}`,
      });
      return;
    }
  }

  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => jsonEqual(candidate, instance))) {
    const allowed = schema.enum.map(formatValue).join(", ");
    issues.push({
      path,
      message: `${formatValue(instance)} is not one of the allowed values: ${allowed}`,
    });
  }

  if ("const" in schema && !jsonEqual(schema.const, instance)) {
    issues.push({
      path,
      message: `Value ${formatValue(instance)} does not match required const ${formatValue(schema.const)}`,
    });
  }

  if (typeof instance === "number") {
    if (typeof schema.minimum === "number" && instance < schema.minimum) {
      issues.push({
        path,
        message: `Value ${instance} is below minimum ${schema.minimum}`,
      });
    }
    if (typeof schema.maximum === "number" && instance > schema.maximum) {
      issues.push({
        path,
        message: `Value ${instance} is above maximum ${schema.maximum}`,
      });
    }
    if (typeof schema.exclusiveMinimum === "number" && instance <= schema.exclusiveMinimum) {
      issues.push({
        path,
        message: `Value ${instance} is not above exclusive minimum ${schema.exclusiveMinimum}`,
      });
    }
    if (typeof schema.exclusiveMaximum === "number" && instance >= schema.exclusiveMaximum) {
      issues.push({
        path,
        message: `Value ${instance} is not below exclusive maximum ${schema.exclusiveMaximum}`,
      });
    }
  }

  if (typeof instance === "string") {
    const length = [...instance].length;
    if (typeof schema.minLength === "number" && length < schema.minLength) {
      issues.push({
        path,
        message: `String length ${length} is below minLength ${schema.minLength}`,
      });
    }
    if (typeof schema.maxLength === "number" && length > schema.maxLength) {
      issues.push({
        path,
        message: `String length ${length} is above maxLength ${schema.maxLength}`,
      });
    }
    if (typeof schema.pattern === "string") {
      try {
        if (!new RegExp(schema.pattern, "u").test(instance)) {
          issues.push({
            path,
            message: `Value ${formatValue(instance)} does not match pattern ${schema.pattern}`,
          });
        }
      } catch {
        // Invalid schema pattern — skip rather than fail the load.
      }
    }
    if (schema.format === "date-time" && !isRfc3339DateTime(instance)) {
      issues.push({
        path,
        message: `Value ${formatValue(instance)} is not a valid date-time`,
      });
    }
  }

  if (Array.isArray(instance)) {
    if (typeof schema.minItems === "number" && instance.length < schema.minItems) {
      issues.push({
        path,
        message: `Array length ${instance.length} is below minItems ${schema.minItems}`,
      });
    }
    if (typeof schema.maxItems === "number" && instance.length > schema.maxItems) {
      issues.push({
        path,
        message: `Array length ${instance.length} is above maxItems ${schema.maxItems}`,
      });
    }
    const items = schema.items;
    if (items && typeof items === "object" && !Array.isArray(items)) {
      for (let i = 0; i < instance.length; i++) {
        collect(instance[i], items as JsonSchemaObject, `${path}[${i + 1}]`, issues);
      }
    }
    return;
  }

  if (!isRecord(instance)) return;

  const props = isRecord(schema.properties) ? schema.properties as Record<string, JsonSchemaObject> : {};
  const required = Array.isArray(schema.required) ? schema.required.map(String) : [];
  for (const key of required) {
    if (!Object.hasOwn(instance, key)) {
      issues.push({
        path: appendJsonPath(path, key),
        message: `Required field missing: ${key}`,
      });
    }
  }

  const additional = schema.additionalProperties;
  for (const [key, value] of Object.entries(instance)) {
    const childPath = appendJsonPath(path, key);
    const childSchema = props[key];
    if (childSchema) {
      collect(value, childSchema, childPath, issues);
      continue;
    }
    if (additional === false) {
      issues.push({
        path: childPath,
        message: `Not in schema: ${key}`,
      });
    } else if (isRecord(additional)) {
      collect(value, additional, childPath, issues);
    }
  }
}

function matchesType(value: unknown, type: string): boolean {
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "object") return isRecord(value);
  if (type === "array") return Array.isArray(value);
  if (type === "null") return value === null;
  if (type === "string") return typeof value === "string";
  if (type === "boolean") return typeof value === "boolean";
  return false;
}

function describeType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number" && Number.isInteger(value)) return "integer";
  return typeof value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isRfc3339DateTime(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}
