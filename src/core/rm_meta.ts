/**
 * Thin consumer facade over ehrtslib BMM-backed RM attribute introspection.
 * OPT/UI attachment policy stays here — not in ehrtslib.
 */
import {
  attributesFor,
  hasRmType,
  isAbstractType,
  isDataValueType as ehrtsIsDataValueType,
  isSubtypeOf,
  subtypesOf,
  type RmAttributeMeta,
} from "ehrtslib/meta/mod.ts";
import type { AttachmentOption } from "../types/mod.ts";

export {
  attributesFor,
  hasRmType,
  isAbstractType,
  isSubtypeOf,
  subtypesOf,
  type RmAttributeMeta,
};

const PRIMITIVE_RM_TYPES = new Set([
  "String",
  "Boolean",
  "Integer",
  "Integer64",
  "Real",
  "Double",
  "Byte",
  "Octet",
  "Character",
  "URI",
]);

/** Unwrap `List<T>` / `DV_INTERVAL<T>` → inner type name for class checks. */
export function baseRmTypeName(typeName: string): string {
  const list = typeName.match(/^List<(.+)>$/);
  if (list) return baseRmTypeName(list[1]!);
  const generic = typeName.match(/^([A-Z][A-Z0-9_]*)<(.+)>$/);
  if (generic) return generic[1]!;
  return typeName;
}

export function isPrimitiveRmType(typeName: string): boolean {
  return PRIMITIVE_RM_TYPES.has(baseRmTypeName(typeName));
}

export function isDataValueType(rmType: string): boolean {
  if (ehrtsIsDataValueType(rmType)) return true;
  // CODE_PHRASE is not under DATA_VALUE but is a common leaf in coded text
  return rmType === "CODE_PHRASE";
}

/** Concrete DATA_VALUE leaves for toolbox / shell registration. */
export function dataValueLeafTypes(): string[] {
  return subtypesOf("DATA_VALUE", { concreteOnly: true });
}

/** Blockly block type for an RM class, e.g. DV_QUANTITY → dv_quantity. */
export function blockTypeForRm(rmType: string): string {
  return rmType.toLowerCase();
}

export function mandatoryAttributes(rmType: string): RmAttributeMeta[] {
  return attributesFor(rmType).filter((a) => a.mandatory);
}

export function optionalAttributes(rmType: string): RmAttributeMeta[] {
  return attributesFor(rmType).filter((a) => !a.mandatory);
}

/**
 * Prefer `value`, then `magnitude`, else first mandatory primitive —
 * the field Click-to-Map fills on a DATA_VALUE shell.
 */
export function primaryMappingAttribute(rmType: string): RmAttributeMeta | null {
  const attrs = attributesFor(rmType);
  const primitives = attrs.filter((a) => isPrimitiveRmType(a.typeName));
  return primitives.find((a) => a.name === "value") ??
    primitives.find((a) => a.name === "magnitude") ??
    primitives.find((a) => a.mandatory) ??
    primitives[0] ??
    null;
}

/**
 * Whether an RM attribute is a value slot (CODE_PHRASE / DATA_VALUE / primitive)
 * rather than a nested structural statement (content, composer, context, …).
 */
export function isRmValueAttribute(parentRmType: string, attrName: string): boolean {
  const meta = attributesFor(parentRmType).find((a) => a.name === attrName);
  if (!meta) return false;
  const base = baseRmTypeName(meta.typeName);
  return isPrimitiveRmType(base) || isDataValueType(base);
}

export function blocklyCheckForPrimitiveType(typeName: string): string | null {
  switch (baseRmTypeName(typeName)) {
    case "String":
    case "URI":
    case "Character":
      return "String";
    case "Integer":
    case "Integer64":
    case "Real":
    case "Double":
    case "Byte":
      return "Number";
    case "Boolean":
      return "Boolean";
    default:
      return null;
  }
}

export interface AttachmentContext {
  presentAttributes: Set<string>;
  templateConstrained: Set<string>;
}

/**
 * Optional RM structures for the `+` picker.
 * Policy: non-primitive, non-DATA_VALUE class attributes (feeder_audit, links, …).
 */
export function getValidAttachments(
  parentType: string,
  context: AttachmentContext,
): AttachmentOption[] {
  const options: AttachmentOption[] = [];

  for (const attr of attributesFor(parentType)) {
    if (attr.mandatory) continue;
    if (context.presentAttributes.has(attr.name)) continue;
    if (context.templateConstrained.has(attr.name)) continue;

    const base = baseRmTypeName(attr.typeName);
    if (isPrimitiveRmType(base)) continue;
    if (ehrtsIsDataValueType(base)) continue;
    if (!hasRmType(base) && !hasRmType(attr.typeName.split("<")[0]!)) {
      // Still allow known structural names even if meta uses generics
      if (!isStructuralAttachmentType(base)) continue;
    }

    options.push({
      rmType: base,
      attributeName: attr.name,
      label: humanizeAttr(attr.name),
      cardinality: { ...attr.multiplicity },
    });
  }

  return options.sort((a, b) => a.label.localeCompare(b.label));
}

function isStructuralAttachmentType(rmType: string): boolean {
  return [
    "FEEDER_AUDIT",
    "FEEDER_AUDIT_DETAILS",
    "LINK",
    "PARTICIPATION",
    "PARTY_IDENTIFIED",
    "PARTY_RELATED",
    "PARTY_PROXY",
    "PARTY_SELF",
    "EVENT_CONTEXT",
    "ARCHETYPED",
    "ITEM_STRUCTURE",
    "ITEM_TREE",
    "ITEM_LIST",
    "ITEM_TABLE",
    "ITEM_SINGLE",
    "HISTORY",
    "UID_BASED_ID",
  ].includes(rmType);
}

function humanizeAttr(name: string): string {
  return name
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
