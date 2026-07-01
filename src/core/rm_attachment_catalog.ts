import type { AttachmentOption } from "../../types/mod.ts";

/**
 * RM-valid optional child attachments derived from openEHR RM (BMM-aligned).
 * Used by the `+` picker for optional RM insertion.
 */
const RM_ATTACHMENTS: Record<string, AttachmentOption[]> = {
  COMPOSITION: [
    { rmType: "EVENT_CONTEXT", attributeName: "context", label: "Event context", cardinality: { min: 0, max: 1 } },
    { rmType: "FEEDER_AUDIT", attributeName: "feeder_audit", label: "Feeder audit", cardinality: { min: 0, max: 1 } },
    { rmType: "LINK", attributeName: "links", label: "Link", cardinality: { min: 0, max: null } },
  ],
  OBSERVATION: [
    { rmType: "HISTORY", attributeName: "state", label: "State", cardinality: { min: 0, max: 1 } },
    { rmType: "ITEM_STRUCTURE", attributeName: "protocol", label: "Protocol", cardinality: { min: 0, max: 1 } },
    { rmType: "FEEDER_AUDIT", attributeName: "feeder_audit", label: "Feeder audit", cardinality: { min: 0, max: 1 } },
    { rmType: "LINK", attributeName: "links", label: "Link", cardinality: { min: 0, max: null } },
    { rmType: "PARTICIPATION", attributeName: "other_participations", label: "Participation", cardinality: { min: 0, max: null } },
  ],
  EVALUATION: [
    { rmType: "ITEM_STRUCTURE", attributeName: "protocol", label: "Protocol", cardinality: { min: 0, max: 1 } },
    { rmType: "FEEDER_AUDIT", attributeName: "feeder_audit", label: "Feeder audit", cardinality: { min: 0, max: 1 } },
    { rmType: "LINK", attributeName: "links", label: "Link", cardinality: { min: 0, max: null } },
  ],
  INSTRUCTION: [
    { rmType: "ITEM_STRUCTURE", attributeName: "protocol", label: "Protocol", cardinality: { min: 0, max: 1 } },
    { rmType: "FEEDER_AUDIT", attributeName: "feeder_audit", label: "Feeder audit", cardinality: { min: 0, max: 1 } },
    { rmType: "LINK", attributeName: "links", label: "Link", cardinality: { min: 0, max: null } },
  ],
  ACTION: [
    { rmType: "ITEM_STRUCTURE", attributeName: "protocol", label: "Protocol", cardinality: { min: 0, max: 1 } },
    { rmType: "FEEDER_AUDIT", attributeName: "feeder_audit", label: "Feeder audit", cardinality: { min: 0, max: 1 } },
    { rmType: "LINK", attributeName: "links", label: "Link", cardinality: { min: 0, max: null } },
  ],
  CLUSTER: [
    { rmType: "FEEDER_AUDIT", attributeName: "feeder_audit", label: "Feeder audit", cardinality: { min: 0, max: 1 } },
    { rmType: "LINK", attributeName: "links", label: "Link", cardinality: { min: 0, max: null } },
  ],
  ELEMENT: [
    { rmType: "FEEDER_AUDIT", attributeName: "feeder_audit", label: "Feeder audit", cardinality: { min: 0, max: 1 } },
    { rmType: "LINK", attributeName: "links", label: "Link", cardinality: { min: 0, max: null } },
  ],
  SECTION: [
    { rmType: "FEEDER_AUDIT", attributeName: "feeder_audit", label: "Feeder audit", cardinality: { min: 0, max: 1 } },
    { rmType: "LINK", attributeName: "links", label: "Link", cardinality: { min: 0, max: null } },
  ],
  HISTORY: [
    { rmType: "FEEDER_AUDIT", attributeName: "feeder_audit", label: "Feeder audit", cardinality: { min: 0, max: 1 } },
  ],
  FEEDER_AUDIT: [
    { rmType: "FEEDER_AUDIT_DETAILS", attributeName: "originating_system_audit", label: "Originating system audit", cardinality: { min: 0, max: 1 } },
    { rmType: "FEEDER_AUDIT_DETAILS", attributeName: "feeder_system_audit", label: "Feeder system audit", cardinality: { min: 0, max: 1 } },
  ],
};

const INHERITANCE: Record<string, string[]> = {
  OBSERVATION: ["ENTRY"],
  EVALUATION: ["ENTRY"],
  INSTRUCTION: ["ENTRY"],
  ACTION: ["ENTRY"],
  ADMIN_ENTRY: ["ENTRY"],
};

export interface AttachmentContext {
  presentAttributes: Set<string>;
  templateConstrained: Set<string>;
}

export function getValidAttachments(
  parentType: string,
  context: AttachmentContext,
): AttachmentOption[] {
  const options: AttachmentOption[] = [];
  const types = [parentType, ...(INHERITANCE[parentType] ?? [])];

  for (const type of types) {
    for (const opt of RM_ATTACHMENTS[type] ?? []) {
      if (context.presentAttributes.has(opt.attributeName)) continue;
      if (context.templateConstrained.has(opt.attributeName)) continue;
      if (options.some((o) => o.attributeName === opt.attributeName)) continue;
      options.push(opt);
    }
  }

  return options.sort((a, b) => a.label.localeCompare(b.label));
}
