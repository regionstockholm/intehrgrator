import { parseTemplateInput } from "ehrtslib/parser/mod.ts";
import {
  parseWebTemplate,
  webTemplateToOpt,
} from "ehrtslib/serialization/simplified/mod.ts";
import {
  applyOperationalTemplateTermScopes,
  type TermScopeMeta,
} from "ehrtslib/generation/term_scope.ts";
import type { AllowedValue, SkeletonNode } from "../../types/mod.ts";
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
  buildWebTemplateTermsIndex,
  compositionArchetypeRef,
  liveArchetypeTermsIndex,
  locatableNodeLabel,
  lookupTermText,
  mergedOntologyTerms,
  mergeTermMaps,
  nameFallbackOf,
  publicArchetypeRef,
  resolveOptLanguage,
  TEMPLATE_ROOT_TERM_SCOPE,
  termBagsRecord,
  termScopeOf,
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
  const generated = generateSkeletonFromOperational(
    opt,
    "",
    buildWebTemplateTermsIndex(webTemplate),
  );
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
  extraArchetypeTerms?: Map<string, TermBag>,
): GenerateSkeletonResult {
  if (!opt?.definition) {
    throw new Error("Could not parse operational template from input");
  }

  const templateId = opt.template_id?.value ?? opt.archetype_id?.value ?? "unknown";
  const lang = resolveOptLanguage(opt);
  applyOperationalTemplateTermScopes(opt, lang);
  const fallbackTerms = mergedOntologyTerms(opt, lang);
  const archetypeTerms = mergeTermMaps(
    optSource ? buildArchetypeTermsIndex(optSource) : undefined,
    liveArchetypeTermsIndex(opt, lang),
    extraArchetypeTerms,
  );
  const archetypeTermRecord = termBagsRecord(archetypeTerms);
  const rootArchetypeRef = (optSource ? compositionArchetypeRef(optSource) : undefined) ??
    (opt.definition?.archetype_ref as string | undefined) ??
    (extraArchetypeTerms?.has(TEMPLATE_ROOT_TERM_SCOPE) ? TEMPLATE_ROOT_TERM_SCOPE : undefined) ??
    [...archetypeTerms.keys()][0];

  const root = walkComplex(
    opt.definition,
    templateId,
    rootArchetypeRef,
    "",
    fallbackTerms,
    archetypeTermRecord,
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
  archetypeTerms: Record<string, TermBag>,
): SkeletonNode | null {
  const rmType = cObj.rm_type_name ?? "ITEM_TREE";
  const { nodeId, nameHint } = splitAqlStyleNodeId(cObj.node_id as string | undefined);
  const slotPath = path || "/";
  const nodeArchetypeRef = publicArchetypeRef(
    termScopeOf(cObj as TermScopeMeta & { archetype_ref?: string }, archetypeRef),
  );
  const terms = termsForArchetype(nodeArchetypeRef, fallbackTerms, archetypeTerms);
  const label = nameHint || locatableNodeLabel(
    nodeId,
    rmType,
    nodeArchetypeRef ?? archetypeRef,
    nameFallbackOf(cObj as TermScopeMeta & { node_id?: string; archetype_ref?: string }),
    fallbackTerms,
    archetypeTerms,
  );
  const blockType = blockTypeForRm(rmType);
  const archetypeCtx = nodeArchetypeRef
    ? { archetypeRef: nodeArchetypeRef, archetypeShortName: archetypeShortName(nodeArchetypeRef) }
    : {};
  const multiplicity = multiplicityOfAm(cObj);
  const mandatory = isMandatory(cObj);

  if (isDataValueType(rmType)) {
    const allowedValues = extractAllowedValues(cObj, terms);
    return {
      slotId: `${templateId}${slotPath}/value`,
      blockType: blockTypeForRm(rmType),
      rmType,
      label,
      archetypeNodeId: nodeId,
      archetypeId: templateId,
      ...archetypeCtx,
      kind: "value",
      mandatory,
      multiplicity,
      children: [],
      fixedFields: extractFixedFields(cObj),
      ...(allowedValues.length ? { allowedValues } : {}),
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
      nodeArchetypeRef ?? archetypeRef,
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

  if (rmType === "ELEMENT") {
    for (const child of children) {
      if (child.kind === "value" && isDataValueType(child.rmType)) {
        if (!child.label || child.label === child.rmType) child.label = label;
        if (!child.archetypeNodeId) child.archetypeNodeId = nodeId;
      }
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
    mandatory,
    multiplicity,
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
  archetypeTerms: Record<string, TermBag>,
): SkeletonNode[] {
  const children = (attr.children ?? []) as AmObject[];
  const nodes: SkeletonNode[] = [];

  for (const child of children) {
    const childArchetypeRef = publicArchetypeRef(
      termScopeOf(child as TermScopeMeta & { archetype_ref?: string }, archetypeRef),
    ) ?? archetypeRef;
    const rmType = child.rm_type_name ?? "DV_TEXT";
    const { nodeId, nameHint } = splitAqlStyleNodeId(child.node_id as string | undefined);
    const isDv = isDataValueType(rmType);
    if (!isDv || child.attributes) {
      const node = walkComplex(
        child,
        templateId,
        childArchetypeRef,
        `${path}/${pathNodeSegment(nodeId, rmType)}`,
        fallbackTerms,
        archetypeTerms,
      );
      if (node) nodes.push(node);
    } else {
      const archetypeCtx = childArchetypeRef
        ? {
          archetypeRef: childArchetypeRef,
          archetypeShortName: archetypeShortName(childArchetypeRef),
        }
        : {};
      const terms = termsForArchetype(childArchetypeRef, fallbackTerms, archetypeTerms);
      const allowedValues = extractAllowedValues(child, terms);
      nodes.push({
        slotId: `${templateId}${path}/${nodeId ?? "value"}/value`,
        blockType: blockTypeForRm(rmType),
        rmType,
        label: nameHint || locatableNodeLabel(
          nodeId,
          rmType,
          childArchetypeRef,
          nameFallbackOf(child as TermScopeMeta & { node_id?: string; archetype_ref?: string }),
          fallbackTerms,
          archetypeTerms,
        ),
        archetypeNodeId: nodeId,
        archetypeId: templateId,
        rmAttribute: attr.rm_attribute_name as string | undefined,
        ...archetypeCtx,
        kind: "value",
        mandatory: isMandatory(child),
        multiplicity: multiplicityOfAm(child),
        children: [],
        fixedFields: extractFixedFields(child),
        ...(allowedValues.length ? { allowedValues } : {}),
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
  archetypeTerms: Record<string, TermBag>,
): TermBag {
  if (archetypeRef && archetypeTerms[archetypeRef]) {
    return archetypeTerms[archetypeRef]!;
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

const AQL_NAME_PRED = /^(.*),'([^']+)'$/;

/** Split Better/AQL-style node ids such as `at0002,'Injury'` or `openEHR-EHR-SECTION.adhoc.v1,'Vital signs'`. */
export function splitAqlStyleNodeId(nodeId?: string): { nodeId?: string; nameHint?: string } {
  if (!nodeId) return {};
  const match = AQL_NAME_PRED.exec(nodeId);
  if (match) return { nodeId: match[1], nameHint: match[2] };
  return { nodeId };
}

function pathNodeSegment(nodeId: string | undefined, rmType: string): string {
  return nodeId || rmType;
}

export function multiplicityOfAm(cObj: AmObject): string | undefined {
  const occ = cObj?.occurrences ?? cObj?.existence;
  if (!occ) return undefined;
  const lower = Number(occ.lower ?? 0);
  const unbounded = occ.upper_unbounded === true ||
    occ._upper_unbounded === true ||
    occ._upper_unbounded?.value === true;
  const upperRaw = occ.upper ?? occ._upper;
  const upper = unbounded || upperRaw == null ? null : Number(upperRaw);
  if (upper == null || Number.isNaN(upper) || upper < 0) {
    return lower > 0 ? "1..*" : "0..*";
  }
  if (upper === 1) return lower > 0 ? "1" : "0..1";
  return `${lower}..${upper}`;
}

export function isRepeatingMultiplicity(multiplicity?: string): boolean {
  return Boolean(multiplicity && multiplicity.includes("*"));
}

export function collectRepeatableContainers(nodes: SkeletonNode[]): SkeletonNode[] {
  const out: SkeletonNode[] = [];
  for (const node of nodes) {
    if (node.kind === "container" && isRepeatingMultiplicity(node.multiplicity)) {
      out.push(node);
    }
    out.push(...collectRepeatableContainers(node.children));
  }
  return out;
}

export function collectAllSlotIds(nodes: SkeletonNode[]): string[] {
  const out: string[] = [];
  for (const node of nodes) {
    out.push(node.slotId);
    out.push(...collectAllSlotIds(node.children));
  }
  return out;
}

export function findSkeletonTrail(nodes: SkeletonNode[], slotId: string): SkeletonNode[] {
  function walk(node: SkeletonNode, trail: SkeletonNode[]): SkeletonNode[] | null {
    const next = [...trail, node];
    if (node.slotId === slotId) return next;
    for (const child of node.children) {
      const hit = walk(child, next);
      if (hit) return hit;
    }
    return null;
  }
  for (const root of nodes) {
    const hit = walk(root, []);
    if (hit) return hit;
  }
  return [];
}

export function nearestRepeatingContainer(trail: SkeletonNode[]): SkeletonNode | null {
  for (let i = trail.length - 1; i >= 0; i--) {
    const node = trail[i]!;
    if (node.kind === "container" && isRepeatingMultiplicity(node.multiplicity)) return node;
  }
  return null;
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
  // A multi-value `code_list` is scaffolded as a Blockly list; only a single
  // constrained code (or assumed_value when the list is empty) is a fixed field.
  const specified = codes.length === 1 ? codes[0] : (codes.length === 0 ? assumedCodeFromAm(cObj) : undefined);
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

/**
 * Constrained coded/string choices from C_CODE_PHRASE `code_list` (including
 * nested `defining_code`) or a C_STRING `list` of more than one value.
 *
 * @see openehr://guides/archetypes/terminology — value sets on DV_CODED_TEXT
 * @see openehr://guides/archetypes/adl-idioms-cheatsheet — coded leaf
 */
function extractAllowedValues(cObj: AmObject, terms: TermBag): AllowedValue[] {
  const terminology = terminologyIdFromAm(cObj);
  const codes = codeListFromAm(cObj);
  if (codes.length > 1) {
    return codes.map((code) => ({
      code,
      label: lookupTermText(terms, code) ?? code,
      terminologyId: terminology,
    }));
  }

  for (const attr of (cObj.attributes ?? []) as AmObject[]) {
    const nestedChild = (attr.children ?? [])[0] as AmObject | undefined;
    if (!nestedChild) continue;
    const nested = extractAllowedValues(nestedChild, terms);
    if (!nested.length) continue;
    return nested.map((item) => ({
      ...item,
      terminologyId: item.terminologyId ?? terminology,
    }));
  }

  const strings = stringListFromAm(cObj);
  if (strings.length > 1) {
    return strings.map((value) => ({
      code: value,
      label: value,
      terminologyId: terminology,
    }));
  }

  return [];
}

function stringListFromAm(cObj: AmObject): string[] {
  const list = cObj.list;
  if (!Array.isArray(list) || list.length < 2) return [];
  if (!list.every((item) => typeof item === "string" || typeof item === "number")) {
    return [];
  }
  return list.map((item) => String(item)).filter(Boolean);
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
