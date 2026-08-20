/**
 * RM-fixed terminology identifiers for CODE_PHRASE / DV_CODED_TEXT attributes.
 *
 * Source: openEHR RM invariants (Language_valid, Territory_valid, Encoding_valid,
 * Category_validity) and ehrtslib `RMInstanceGenerator.generateDefaultValue`.
 *
 * @see openehr://guides/specs/rm-ehr
 * @see https://specifications.openehr.org/releases/RM/development/ehr.html
 */
import { isSubtypeOf } from "./rm_meta.ts";

/** External terminology_id strings required by the RM for a parent.attribute. */
const TERMINOLOGY_BY_ATTRIBUTE: Record<string, Record<string, string>> = {
  COMPOSITION: {
    language: "ISO_639-1",
    territory: "ISO_3166-1",
    category: "openehr",
  },
  ENTRY: {
    language: "ISO_639-1",
    encoding: "IANA_character-sets",
  },
  EVENT_CONTEXT: {
    setting: "openehr",
  },
  INTERVAL_EVENT: {
    math_function: "openehr",
  },
  ISM_TRANSITION: {
    current_state: "openehr",
    transition: "openehr",
  },
  PARTY_RELATED: {
    relationship: "openehr",
  },
  PARTICIPATION: {
    function: "openehr",
    mode: "openehr",
  },
};

const INHERITED_PARENTS: Array<[ancestor: string, tableKey: string]> = [
  ["ENTRY", "ENTRY"],
];

/**
 * Terminology_id the RM already constrains for `parentRmType.attributeName`.
 * Undefined when the attribute's code system is not fixed by the RM.
 */
export function rmConstrainedTerminologyId(
  parentRmType: string,
  attributeName: string,
): string | undefined {
  const own = TERMINOLOGY_BY_ATTRIBUTE[parentRmType]?.[attributeName];
  if (own) return own;
  for (const [ancestor, tableKey] of INHERITED_PARENTS) {
    if (parentRmType === ancestor || isSubtypeOf(parentRmType, ancestor)) {
      const inherited = TERMINOLOGY_BY_ATTRIBUTE[tableKey]?.[attributeName];
      if (inherited) return inherited;
    }
  }
  return undefined;
}

/** Merge RM terminology_id into skeleton `fixedFields` when the parent attribute is RM-bound. */
export function withRmConstrainedFields(
  fields: Record<string, string> | undefined,
  parentRmType: string,
  attributeName: string,
): Record<string, string> | undefined {
  const terminologyId = rmConstrainedTerminologyId(parentRmType, attributeName);
  if (!terminologyId) return fields;
  if (fields?.terminology_id) return fields;
  return { ...fields, terminology_id: terminologyId };
}
