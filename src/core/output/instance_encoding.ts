/**
 * Serialize a converted openEHR instance with the Instance encoding on that root.
 */
import * as rm from "ehrtslib/openehr_rm.ts";
import { JsonCanonicalSerializer, JsonConfigurableDeserializer } from "ehrtslib/serialization/json/mod.ts";
import { TypeRegistry } from "ehrtslib/serialization/common/type_registry.ts";
import { XmlSerializer } from "ehrtslib/serialization/xml/mod.ts";
import {
  parseWebTemplate,
  serializeToFlatJson,
  serializeToStructuredJson,
  type WebTemplate,
} from "ehrtslib/serialization/simplified/mod.ts";
import type { InstanceEncoding, OpenEhrInstanceShape } from "../../types/mod.ts";
import {
  DEFAULT_INSTANCE_ENCODING,
  isInstanceEncoding,
  isJsonFamilyEncoding,
} from "../../types/mod.ts";
import { jsonDeserializationConfigForMode } from "./json_deserialize_config.ts";

export const INSTANCE_ENCODING_FIELD = "INSTANCE_ENCODING";

let rmTypeRegistryReady = false;

function ensureRmTypeRegistry(): void {
  if (rmTypeRegistryReady) return;
  TypeRegistry.registerModule(rm as Record<string, unknown>);
  rmTypeRegistryReady = true;
}

export function parseInstanceEncoding(value: unknown): InstanceEncoding {
  const raw = typeof value === "string" ? value : "";
  return isInstanceEncoding(raw) ? raw : DEFAULT_INSTANCE_ENCODING;
}

export function preferredInstanceEncoding(
  model: { instanceEncodings?: readonly InstanceEncoding[] },
): InstanceEncoding {
  return model.instanceEncodings?.[0] ?? DEFAULT_INSTANCE_ENCODING;
}

/** XQuery JSON vs XML switch derived from a persisted Instance encoding. */
export function instanceShapeForEncoding(encoding: InstanceEncoding): OpenEhrInstanceShape {
  return encoding === "canonical-xml" ? "xml" : "json";
}

export function juxtaposeFragments(fragments: readonly string[]): string {
  return fragments.join("");
}

export function parseWebTemplateJson(json: string | undefined): WebTemplate | undefined {
  const trimmed = json?.trim();
  if (!trimmed) return undefined;
  try {
    return parseWebTemplate(JSON.parse(trimmed) as unknown);
  } catch {
    return undefined;
  }
}

export interface SerializeInstanceOptions {
  prettyPrint?: boolean;
  webTemplate?: WebTemplate;
  webTemplateJson?: string;
}

function asRmInstance(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;
  if (typeof (value as { _type?: unknown })._type !== "string" &&
    typeof (value as { rmType?: unknown }).rmType !== "string"
  ) {
    const ctor = (value as { constructor?: { name?: string } }).constructor?.name;
    if (ctor && ctor !== "Object" && ctor !== "Array") return value;
  }
  if (typeof (value as { _type?: unknown })._type === "string") {
    ensureRmTypeRegistry();
    const deserializer = new JsonConfigurableDeserializer(jsonDeserializationConfigForMode("hybrid"));
    return deserializer.deserialize(JSON.stringify(value));
  }
  return value;
}

export function serializeInstance(
  value: unknown,
  encoding: InstanceEncoding = DEFAULT_INSTANCE_ENCODING,
  options: SerializeInstanceOptions = {},
): string {
  if (value == null) return "";
  if (typeof value === "string") {
    if (encoding === "canonical-json" && options.prettyPrint) {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    }
    return value;
  }

  if (encoding === "canonical-json") {
    try {
      const json = new JsonCanonicalSerializer().serialize(value);
      const parsed = JSON.parse(json) as unknown;
      return options.prettyPrint ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed);
    } catch {
      return options.prettyPrint ? JSON.stringify(value, null, 2) : JSON.stringify(value);
    }
  }

  const rmInstance = asRmInstance(value);
  if (encoding === "canonical-xml") {
    ensureRmTypeRegistry();
    return new XmlSerializer({ prettyPrint: options.prettyPrint ?? true }).serialize(rmInstance);
  }

  const webTemplate = options.webTemplate ?? parseWebTemplateJson(options.webTemplateJson);
  if (!webTemplate) {
    throw new Error(
      `${encoding} Instance encoding needs a Web Template on the openEHR target`,
    );
  }
  if (encoding === "flat-json") {
    return serializeToFlatJson(rmInstance, webTemplate, { prettyPrint: options.prettyPrint });
  }
  return serializeToStructuredJson(rmInstance, webTemplate, { prettyPrint: options.prettyPrint });
}

/** Test Run display: parsed JSON object for a single JSON-family root; string otherwise. */
export function formatTestRunPayload(
  payload: string,
  encoding: InstanceEncoding,
  stacked: boolean,
): unknown {
  if (stacked || !isJsonFamilyEncoding(encoding)) return payload;
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return payload;
  }
}
