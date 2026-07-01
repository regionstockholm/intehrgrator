import { parseTemplateInput } from "ehrtslib/enhanced/parser/mod.ts";
import type { SkeletonNode } from "../../types/mod.ts";
import {
  blockTypeForRm,
  isDataValueType,
  LOCATABLE_TYPES,
  mandatoryAttributesFor,
  returnTypeForDv,
} from "../rm_mandatory.ts";

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

  const templateId = opt.template_id?.value ?? opt.archetype_id?.value ?? "unknown";
  const lang = opt.original_language?.code_string ?? "en";
  const terms = (opt.ontology?.term_definitions?.[lang] ?? opt.ontology?.term_definition ?? {}) as Record<
    string,
    { text?: unknown }
  >;

  const root = walkComplex(
    opt.definition,
    templateId,
    "",
    terms,
  );

  return {
    templateId,
    skeleton: root ? [root] : [],
    warnings: parsed.warnings,
  };
}

function walkComplex(
  cObj: AmObject,
  archetypeId: string,
  path: string,
  terms: Record<string, { text?: unknown }>,
): SkeletonNode | null {
  const rmType = cObj.rm_type_name ?? "ITEM_TREE";
  const nodeId = cObj.node_id as string | undefined;
  const slotPath = path || "/";
  const label = termLabel(terms, nodeId) ?? nodeId ?? rmType;
  const blockType = blockTypeForRm(rmType);

  if (isDataValueType(rmType)) {
    return {
      slotId: `${archetypeId}${slotPath}/value`,
      blockType: blockTypeForRm(rmType),
      rmType,
      label,
      archetypeNodeId: nodeId,
      archetypeId,
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
    const childNodes = walkAttribute(attr, archetypeId, `${slotPath}/${attrName}`, terms);
    children.push(...childNodes);
  }

  for (const attrName of mandatoryAttributesFor(rmType)) {
    if (presentAttrs.has(attrName)) continue;
    const silent = buildSilentMandatoryNode(
      rmType,
      attrName,
      archetypeId,
      `${slotPath}/${attrName}`,
      terms,
      nodeId,
    );
    if (silent) children.push(silent);
  }

  return {
    slotId: `${archetypeId}${slotPath}`,
    blockType,
    rmType,
    label,
    archetypeNodeId: nodeId,
    archetypeId,
    kind: "container",
    mandatory: isMandatory(cObj),
    children,
    attachmentPoint: slotPath,
  };
}

function walkAttribute(
  attr: AmObject,
  archetypeId: string,
  path: string,
  terms: Record<string, { text?: unknown }>,
): SkeletonNode[] {
  const children = (attr.children ?? []) as AmObject[];
  const nodes: SkeletonNode[] = [];

  for (const child of children) {
    const isComplex = child.attributes != null || child.rm_type_name === "ELEMENT" ||
      !String(child.rm_type_name ?? "").startsWith("DV_");
    if (isComplex && child.attributes) {
      const node = walkComplex(
        child,
        archetypeId,
        `${path}/${child.node_id ?? child.rm_type_name}`,
        terms,
      );
      if (node) nodes.push(node);
    } else {
      const rmType = child.rm_type_name ?? "DV_TEXT";
      const nodeId = child.node_id as string | undefined;
      nodes.push({
        slotId: `${archetypeId}${path}/${nodeId ?? "value"}/value`,
        blockType: blockTypeForRm(rmType),
        rmType,
        label: termLabel(terms, nodeId) ?? nodeId ?? rmType,
        archetypeNodeId: nodeId,
        archetypeId,
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
  archetypeId: string,
  path: string,
  terms: Record<string, { text?: unknown }>,
  parentNodeId?: string,
): SkeletonNode | null {
  const attrRmType = silentMandatoryRmType(parentRmType, attrName);
  if (!attrRmType) return null;

  if (isDataValueType(attrRmType) || attrRmType.startsWith("DV_")) {
    return {
      slotId: `${archetypeId}${path}/value`,
      blockType: blockTypeForRm(attrRmType),
      rmType: attrRmType,
      label: attrName,
      archetypeId,
      kind: "value",
      mandatory: true,
      silentMandatory: true,
      children: [],
    };
  }

  const childSlots: SkeletonNode[] = [];
  for (const nested of mandatoryAttributesFor(attrRmType)) {
    const nestedNode = buildSilentMandatoryNode(
      attrRmType,
      nested,
      archetypeId,
      `${path}/${nested}`,
      terms,
    );
    if (nestedNode) childSlots.push(nestedNode);
  }

  return {
    slotId: `${archetypeId}${path}`,
    blockType: blockTypeForRm(attrRmType),
    rmType: attrRmType,
    label: attrName,
    archetypeNodeId: parentNodeId,
    archetypeId,
    kind: "container",
    mandatory: true,
    silentMandatory: true,
    children: childSlots,
    attachmentPoint: path,
  };
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

function termLabel(terms: Record<string, { text?: unknown }>, nodeId?: string): string | undefined {
  if (!nodeId) return undefined;
  const raw = terms[nodeId]?.text ?? terms[nodeId.replace(/^at/, "at")]?.text;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "value" in (raw as Record<string, unknown>)) {
    return String((raw as Record<string, unknown>).value);
  }
  return undefined;
}

function extractFixedFields(cObj: AmObject): Record<string, string> | undefined {
  const fields: Record<string, string> = {};
  const codeList = cObj.code_list as Array<{ code?: string }> | undefined;
  if (codeList?.[0]?.code) fields.defining_code = codeList[0].code;
  const list = cObj.list as string[] | undefined;
  if (list?.length === 1) fields.value = list[0];
  return Object.keys(fields).length ? fields : undefined;
}

export function collectValueSlots(nodes: SkeletonNode[]): SkeletonNode[] {
  const out: SkeletonNode[] = [];
  for (const node of nodes) {
    if (node.kind === "value") out.push(node);
    out.push(...collectValueSlots(node.children));
  }
  return out;
}

export function slotReturnType(node: Pick<SkeletonNode, "rmType">): string {
  return returnTypeForDv(node.rmType);
}
