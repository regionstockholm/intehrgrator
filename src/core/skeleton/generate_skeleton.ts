import { parseTemplateInput } from "ehrtslib/parser/mod.ts";
import {
  parseWebTemplate,
  webTemplateToOpt,
} from "ehrtslib/serialization/simplified/mod.ts";
import type { SkeletonNode } from "../../types/mod.ts";
import {
  blockTypeForRm,
  isAutoFixedValueSlot,
  isDataValueType,
  LOCATABLE_TYPES,
  mandatoryAttributesFor,
  returnTypeForDv,
} from "../rm_mandatory.ts";
import { withRmConstrainedFields } from "../rm_terminology.ts";
import { isSubtypeOf } from "../rm_meta.ts";
import {
  archetypeShortName,
  buildArchetypeTermsIndex,
  compositionArchetypeRef,
  lookupTermText,
  mergedOntologyTerms,
  resolveOptLanguage,
  type TermBag,
} from "./template_terms.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AmObject = any;

export interface GenerateSkeletonResult {
  templateId: string;
  skeleton: SkeletonNode[];
  warnings: string[];
}

export function generateSkeleton(optSource: string): GenerateSkeletonResult {
  const parsed = parseTemplateInput(optSource);
  const opt = parsed.operationalTemplate as AmObject;
  if (!opt?.definition) {
    throw new Error("Could not parse operational template from input");
  }
  const generated = generateSkeletonFromOperational(opt, optSource);
  return {
    ...generated,
    warnings: [...parsed.warnings, ...generated.warnings],
  };
}

/** Convert a Web Template JSON document to the same OPERATIONAL_TEMPLATE walker. */
export function generateSkeletonFromWebTemplate(
  source: string | unknown,
): GenerateSkeletonResult {
  const webTemplate = parseWebTemplate(source);
  const opt = webTemplateToOpt(webTemplate) as AmObject;
  const generated = generateSkeletonFromOperational(opt);
  return {
    ...generated,
    templateId: generated.templateId !== "unknown"
      ? generated.templateId
      : webTemplate.templateId,
  };
}

/** Walk an already-resolved OPERATIONAL_TEMPLATE (OPT XML, flattened .t.json, …). */
export function generateSkeletonFromOperational(
  opt: AmObject,
  optSource = "",
): GenerateSkeletonResult {
  if (!opt?.definition) {
    throw new Error("Could not parse operational template from input");
  }

  const templateId = opt.template_id?.value ?? opt.archetype_id?.value ?? "unknown";
  const lang = resolveOptLanguage(opt);
  const fallbackTerms = mergedOntologyTerms(opt, lang);
  const archetypeTerms = optSource ? buildArchetypeTermsIndex(optSource) : new Map();
  const rootArchetypeRef = (optSource ? compositionArchetypeRef(optSource) : undefined) ??
    (opt.definition?.archetype_ref as string | undefined) ??
    Object.keys(archetypeTerms)[0];

  const root = walkComplex(
    opt.definition,
    templateId,
    rootArchetypeRef,
    "",
    fallbackTerms,
    archetypeTerms,
  );

  return {
    templateId,
    skeleton: root ? [root] : [],
    warnings: [],
  };
}

function walkComplex(
  cObj: AmObject,
  templateId: string,
  archetypeRef: string | undefined,
  path: string,
  fallbackTerms: TermBag,
  archetypeTerms: Map<string, TermBag>,
): SkeletonNode | null {
  const rmType = cObj.rm_type_name ?? "ITEM_TREE";
  const nodeId = cObj.node_id as string | undefined;
  const slotPath = path || "/";
  const nodeArchetypeRef = (cObj.archetype_ref as string | undefined) ?? archetypeRef;
  const terms = termsForArchetype(nodeArchetypeRef, fallbackTerms, archetypeTerms);
  const label = lookupTermText(terms, nodeId) ?? nodeId ?? rmType;
  const blockType = blockTypeForRm(rmType);
  const archetypeCtx = nodeArchetypeRef
    ? { archetypeRef: nodeArchetypeRef, archetypeShortName: archetypeShortName(nodeArchetypeRef) }
    : {};

  if (isDataValueType(rmType)) {
    return {
      slotId: `${templateId}${slotPath}/value`,
      blockType: blockTypeForRm(rmType),
      rmType,
      label,
      archetypeNodeId: nodeId,
      archetypeId: templateId,
      ...archetypeCtx,
      kind: "value",
      mandatory: isMandatory(cObj),
      children: [],
      fixedFields: extractFixedFields(cObj),
    };
  }

  const children: SkeletonNode[] = [];
  const presentAttrs = new Set<string>();

  for (const attr of (cObj.attributes ?? []) as AmObject[]) {
    const attrName = attr.rm_attribute_name as string | undefined;
    if (!attrName) continue;
    presentAttrs.add(attrName);
    const childNodes = walkAttribute(
      attr,
      templateId,
      nodeArchetypeRef,
      `${slotPath}/${attrName}`,
      fallbackTerms,
      archetypeTerms,
    );
    for (const child of childNodes) {
      child.rmAttribute = attrName;
      applyRmConstrainedFields(child, rmType);
      children.push(child);
    }
  }

  for (const attrName of mandatoryAttributesFor(rmType)) {
    if (presentAttrs.has(attrName)) continue;
    const silent = buildSilentMandatoryNode(
      rmType,
      attrName,
      templateId,
      nodeArchetypeRef,
      `${slotPath}/${attrName}`,
      terms,
    );
    if (silent) {
      silent.rmAttribute = attrName;
      children.push(silent);
    }
  }

  return {
    slotId: `${templateId}${slotPath}`,
    blockType,
    rmType,
    label,
    archetypeNodeId: nodeId,
    archetypeId: templateId,
    ...archetypeCtx,
    kind: "container",
    mandatory: isMandatory(cObj),
    children,
    attachmentPoint: slotPath,
  };
}

function walkAttribute(
  attr: AmObject,
  templateId: string,
  archetypeRef: string | undefined,
  path: string,
  fallbackTerms: TermBag,
  archetypeTerms: Map<string, TermBag>,
): SkeletonNode[] {
  const children = (attr.children ?? []) as AmObject[];
  const nodes: SkeletonNode[] = [];

  for (const child of children) {
    const childArchetypeRef = (child.archetype_ref as string | undefined) ?? archetypeRef;
    const terms = termsForArchetype(childArchetypeRef, fallbackTerms, archetypeTerms);
    const isComplex = child.attributes != null || child.rm_type_name === "ELEMENT" ||
      !String(child.rm_type_name ?? "").startsWith("DV_");
    if (isComplex && child.attributes) {
      const node = walkComplex(
        child,
        templateId,
        childArchetypeRef,
        `${path}/${child.node_id ?? child.rm_type_name}`,
        fallbackTerms,
        archetypeTerms,
      );
      if (node) nodes.push(node);
    } else {
      const rmType = child.rm_type_name ?? "DV_TEXT";
      const nodeId = child.node_id as string | undefined;
      const archetypeCtx = childArchetypeRef
        ? {
          archetypeRef: childArchetypeRef,
          archetypeShortName: archetypeShortName(childArchetypeRef),
        }
        : {};
      nodes.push({
        slotId: `${templateId}${path}/${nodeId ?? "value"}/value`,
        blockType: blockTypeForRm(rmType),
        rmType,
        label: lookupTermText(terms, nodeId) ?? nodeId ?? rmType,
        archetypeNodeId: nodeId,
        archetypeId: templateId,
        rmAttribute: attr.rm_attribute_name as string | undefined,
        ...archetypeCtx,
        kind: "value",
        mandatory: isMandatory(child),
        children: [],
        fixedFields: extractFixedFields(child),
      });
    }
  }

  return nodes;
}

function buildSilentMandatoryNode(
  parentRmType: string,
  attrName: string,
  templateId: string,
  archetypeRef: string | undefined,
  path: string,
  terms: TermBag,
): SkeletonNode | null {
  const attrRmType = silentMandatoryRmType(parentRmType, attrName);
  if (!attrRmType) return null;
  const node = buildNodeForRmType(
    attrRmType,
    templateId,
    archetypeRef,
    path,
    lookupTermText(terms, attrName) ?? attrName,
    terms,
  );
  node.rmAttribute = attrName;
  node.mandatory = true;
  node.silentMandatory = true;
  applyRmConstrainedFields(node, parentRmType);
  return node;
}

/**
 * Skeleton node for Optional RM Insertion — same typed containers / DV shells
 * as silent-mandatory, but not marked mandatory.
 */
export function skeletonNodeForOptionalRm(
  parent: Pick<SkeletonNode, "slotId" | "archetypeId" | "archetypeRef" | "attachmentPoint">,
  rmType: string,
  attributeName: string,
): SkeletonNode {
  const templateId = parent.archetypeId ?? parent.slotId.split("/")[0] ?? "template";
  const parentPath = parent.attachmentPoint ||
    (parent.slotId.startsWith(templateId) ? parent.slotId.slice(templateId.length) : "");
  const path = `${parentPath.replace(/\/$/, "")}/${attributeName}`;
  const node = buildNodeForRmType(
    rmType,
    templateId,
    parent.archetypeRef,
    path,
    attributeName,
    {},
  );
  node.rmAttribute = attributeName;
  node.mandatory = false;
  node.silentMandatory = false;
  return node;
}

function buildNodeForRmType(
  rmType: string,
  templateId: string,
  archetypeRef: string | undefined,
  path: string,
  label: string,
  terms: TermBag,
): SkeletonNode {
  const archetypeCtx = archetypeRef
    ? { archetypeRef, archetypeShortName: archetypeShortName(archetypeRef) }
    : {};

  if (isDataValueType(rmType) || rmType.startsWith("DV_")) {
    return {
      slotId: `${templateId}${path}/value`,
      blockType: blockTypeForRm(rmType),
      rmType,
      label,
      archetypeId: templateId,
      ...archetypeCtx,
      kind: "value",
      mandatory: false,
      children: [],
    };
  }

  const childSlots: SkeletonNode[] = [];
  for (const nested of mandatoryAttributesFor(rmType)) {
    const nestedNode = buildSilentMandatoryNode(
      rmType,
      nested,
      templateId,
      archetypeRef,
      `${path}/${nested}`,
      terms,
    );
    if (nestedNode) childSlots.push(nestedNode);
  }

  return {
    slotId: `${templateId}${path}`,
    blockType: blockTypeForRm(rmType),
    rmType,
    label,
    archetypeId: templateId,
    ...archetypeCtx,
    kind: "container",
    mandatory: false,
    children: childSlots,
    attachmentPoint: path,
  };
}

function termsForArchetype(
  archetypeRef: string | undefined,
  fallbackTerms: TermBag,
  archetypeTerms: Map<string, TermBag>,
): TermBag {
  if (archetypeRef && archetypeTerms.has(archetypeRef)) {
    return archetypeTerms.get(archetypeRef)!;
  }
  return fallbackTerms;
}

function silentMandatoryRmType(parentType: string, attrName: string): string | null {
  const map: Record<string, Record<string, string>> = {
    COMPOSITION: {
      language: "CODE_PHRASE",
      territory: "CODE_PHRASE",
      category: "DV_CODED_TEXT",
      composer: "PARTY_IDENTIFIED",
      context: "EVENT_CONTEXT",
    },
    EVENT_CONTEXT: {
      start_time: "DV_DATE_TIME",
      setting: "DV_CODED_TEXT",
    },
    ENTRY: {
      language: "CODE_PHRASE",
      encoding: "CODE_PHRASE",
      subject: "PARTY_PROXY",
    },
    OBSERVATION: { data: "HISTORY" },
    EVALUATION: { data: "HISTORY" },
    ADMIN_ENTRY: { data: "ITEM_TREE" },
    INSTRUCTION: { narrative: "DV_TEXT" },
    ACTION: {
      time: "DV_DATE_TIME",
      ism_transition: "ISM_TRANSITION",
      description: "ITEM_TREE",
    },
    HISTORY: { origin: "DV_DATE_TIME", events: "EVENT" },
    EVENT: { time: "DV_DATE_TIME", data: "ITEM_TREE" },
    CLUSTER: { items: "ELEMENT" },
    LOCATABLE: {
      archetype_node_id: "DV_TEXT",
      name: "DV_TEXT",
    },
  };

  if (map[parentType]?.[attrName]) return map[parentType][attrName];
  for (const [type, attrs] of Object.entries(map)) {
    if (type === parentType) continue;
    if (isSubtypeOf(parentType, type) && attrs[attrName]) return attrs[attrName];
  }

  if (LOCATABLE_TYPES.has(parentType) && (attrName === "archetype_node_id" || attrName === "name")) {
    return "DV_TEXT";
  }

  return null;
}

function isMandatory(cObj: AmObject): boolean {
  const occ = cObj.occurrences ?? cObj.existence;
  if (!occ) return false;
  const lower = Number(occ.lower ?? 0);
  return lower > 0;
}

function applyRmConstrainedFields(node: SkeletonNode, parentRmType: string): void {
  if (!node.rmAttribute) return;
  node.fixedFields = withRmConstrainedFields(
    node.fixedFields,
    parentRmType,
    node.rmAttribute,
  );
}

function extractFixedFields(cObj: AmObject): Record<string, string> | undefined {
  const fields: Record<string, string> = {};
  const terminology = terminologyIdFromAm(cObj);
  if (terminology) fields.terminology_id = terminology;

  const codes = codeListFromAm(cObj);
  const specified = codes.length === 1 ? codes[0] : assumedCodeFromAm(cObj);
  if (specified) {
    fields.defining_code = specified;
    fields.code_string = specified;
  }

  const list = cObj.list as string[] | undefined;
  if (list?.length === 1) fields.value = list[0]!;

  for (const attr of (cObj.attributes ?? []) as AmObject[]) {
    const attrName = attr.rm_attribute_name as string | undefined;
    const nestedChild = (attr.children ?? [])[0] as AmObject | undefined;
    if (!nestedChild) continue;
    const nested = extractFixedFields(nestedChild);
    if (!nested) continue;
    if (attrName === "defining_code") Object.assign(fields, nested);
    else if (attrName === "value" && nested.value) fields.value = nested.value;
    else if (attrName === "terminology_id" && nested.value) {
      fields.terminology_id = nested.value;
    }
  }

  return Object.keys(fields).length ? fields : undefined;
}

function terminologyIdFromAm(cObj: AmObject): string | undefined {
  const tid = cObj.terminology_id ?? cObj.terminology;
  if (typeof tid === "string" && tid) return tid;
  if (tid && typeof tid === "object") {
    const value = (tid as { value?: unknown }).value;
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

function codeListFromAm(cObj: AmObject): string[] {
  const list = cObj.code_list ?? cObj.constraint;
  if (list == null) return [];
  const arr = Array.isArray(list) ? list : [list];
  return arr.map(amCodeString).filter(Boolean);
}

/** Single constrained code, or AOM assumed_value when the template leaves a choice. */
function assumedCodeFromAm(cObj: AmObject): string | undefined {
  return amCodeString(cObj.assumed_value) || undefined;
}

function amCodeString(item: unknown): string {
  if (item == null) return "";
  if (typeof item === "string" || typeof item === "number") return String(item);
  if (typeof item !== "object") return "";
  const rec = item as {
    code?: unknown;
    code_string?: unknown;
    value?: unknown;
  };
  return amCodeString(rec.code_string) || amCodeString(rec.code) ||
    (typeof rec.value === "string" || typeof rec.value === "number"
      ? String(rec.value)
      : "");
}

export function collectValueSlots(nodes: SkeletonNode[]): SkeletonNode[] {
  const out: SkeletonNode[] = [];
  for (const node of nodes) {
    if (node.kind === "value" && !isAutoFixedValueSlot(node)) out.push(node);
    out.push(...collectValueSlots(node.children));
  }
  return out;
}

export function slotReturnType(node: Pick<SkeletonNode, "rmType">): string {
  return returnTypeForDv(node.rmType);
}
