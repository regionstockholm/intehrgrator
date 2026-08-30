import type { JsonDeserializationConfig } from "ehrtslib/serialization/json/mod.ts";
import {
  CANONICAL_JSON_DESERIALIZE_CONFIG,
  COMPACT_JSON_DESERIALIZE_CONFIG,
  DEFAULT_JSON_DESERIALIZATION_CONFIG,
  HYBRID_JSON_DESERIALIZE_CONFIG,
  NON_STANDARD_VERY_COMPACT_JSON_DESERIALIZE_CONFIG,
} from "ehrtslib/serialization/json/mod.ts";
import type { OpenEhrJsonDeserializeMode } from "../../types/mod.ts";

export interface OpenEhrDeserializeModeOption {
  id: OpenEhrJsonDeserializeMode;
  label: string;
  title: string;
}

/** UI labels for ehrtslib `JsonDeserializationConfig` presets. */
export const OPENEHR_JSON_DESERIALIZE_MODE_OPTIONS: OpenEhrDeserializeModeOption[] = [
  {
    id: "hybrid",
    label: "Hybrid (lenient)",
    title: "Type inference with incomplete objects — suited to Mapping preview output",
  },
  {
    id: "default",
    label: "Default",
    title: "ehrtslib default deserialization (non-strict, complete objects)",
  },
  {
    id: "compact",
    label: "Compact",
    title: "Compact JSON preset with type inference",
  },
  {
    id: "canonical-strict",
    label: "Canonical strict",
    title: "ITS-JSON strict mode — every node needs _type (canonical deserializer)",
  },
  {
    id: "terse",
    label: "Terse",
    title: "Non-standard terse CODE_PHRASE strings (internal / storage format)",
  },
];

export function jsonDeserializationConfigForMode(
  mode: OpenEhrJsonDeserializeMode,
): JsonDeserializationConfig {
  switch (mode) {
    case "canonical-strict":
      return { ...CANONICAL_JSON_DESERIALIZE_CONFIG };
    case "compact":
      return { ...COMPACT_JSON_DESERIALIZE_CONFIG };
    case "hybrid":
      return { ...HYBRID_JSON_DESERIALIZE_CONFIG };
    case "terse":
      return { ...NON_STANDARD_VERY_COMPACT_JSON_DESERIALIZE_CONFIG };
    default:
      return { ...DEFAULT_JSON_DESERIALIZATION_CONFIG };
  }
}
