/**
 * Mirrors ehrtslib enhanced/generation/rm_instance_generator.ts MANDATORY_RM_ATTRIBUTES.
 * intEHRgrator consumes this list for Template Skeleton silent-mandatory fields.
 */
export const MANDATORY_RM_ATTRIBUTES: Record<string, string[]> = {
  LOCATABLE: ["archetype_node_id", "name"],
  COMPOSITION: ["language", "territory", "category", "composer"],
  EVENT_CONTEXT: ["start_time", "setting"],
  ENTRY: ["language", "encoding", "subject"],
  OBSERVATION: ["data"],
  EVALUATION: ["data"],
  ADMIN_ENTRY: ["data"],
  INSTRUCTION: ["narrative"],
  ACTION: ["time", "ism_transition", "description"],
  ACTIVITY: ["description", "action_archetype_id"],
  HISTORY: ["origin", "events"],
  EVENT: ["time", "data"],
  POINT_EVENT: ["time", "data"],
  INTERVAL_EVENT: ["time", "data", "math_function"],
  CLUSTER: ["items"],
};

/** RM-mandatory LOCATABLE attrs filled from template/at-code at export — not source-mapped. */
export const AUTO_FIXED_LOCATABLE_ATTRS = new Set(["archetype_node_id", "name"]);

export function isAutoFixedValueSlot(node: {
  label: string;
  silentMandatory?: boolean;
}): boolean {
  return node.silentMandatory === true &&
    AUTO_FIXED_LOCATABLE_ATTRS.has(node.label);
}

export const LOCATABLE_TYPES = new Set([
  "COMPOSITION",
  "SECTION",
  "OBSERVATION",
  "EVALUATION",
  "INSTRUCTION",
  "ACTION",
  "ADMIN_ENTRY",
  "CLUSTER",
  "ELEMENT",
  "ITEM_TREE",
  "ITEM_LIST",
  "ITEM_TABLE",
  "ITEM_SINGLE",
  "HISTORY",
  "EVENT",
  "POINT_EVENT",
  "INTERVAL_EVENT",
  "ACTIVITY",
]);

export function mandatoryAttributesFor(rmType: string): string[] {
  const attrs = new Set<string>();
  for (const [type, names] of Object.entries(MANDATORY_RM_ATTRIBUTES)) {
    if (rmType === type || inheritsFrom(rmType, type)) {
      for (const name of names) attrs.add(name);
    }
  }
  return [...attrs];
}

const INHERITANCE: Record<string, string> = {
  SECTION: "LOCATABLE",
  OBSERVATION: "ENTRY",
  EVALUATION: "ENTRY",
  INSTRUCTION: "ENTRY",
  ACTION: "ENTRY",
  ADMIN_ENTRY: "ENTRY",
  ENTRY: "LOCATABLE",
  CLUSTER: "LOCATABLE",
  ELEMENT: "LOCATABLE",
  ITEM_TREE: "ITEM_STRUCTURE",
  ITEM_LIST: "ITEM_STRUCTURE",
  ITEM_TABLE: "ITEM_STRUCTURE",
  ITEM_SINGLE: "ITEM_STRUCTURE",
  POINT_EVENT: "EVENT",
  INTERVAL_EVENT: "EVENT",
  EVENT: "LOCATABLE",
  HISTORY: "LOCATABLE",
  ACTIVITY: "LOCATABLE",
  COMPOSITION: "LOCATABLE",
};

function inheritsFrom(child: string, ancestor: string): boolean {
  let current: string | undefined = child;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    if (current === ancestor) return true;
    seen.add(current);
    current = INHERITANCE[current];
  }
  return false;
}

export function isDataValueType(rmType: string): boolean {
  return rmType.startsWith("DV_") || rmType === "CODE_PHRASE";
}

export function blockTypeForRm(rmType: string): string {
  const map: Record<string, string> = {
    COMPOSITION: "composition",
    SECTION: "section",
    OBSERVATION: "observation",
    EVALUATION: "evaluation",
    INSTRUCTION: "instruction",
    ACTION: "action",
    ADMIN_ENTRY: "admin_entry",
    CLUSTER: "cluster",
    ELEMENT: "element",
    ITEM_TREE: "item_tree",
    ITEM_LIST: "item_list",
    ITEM_TABLE: "item_table",
    ITEM_SINGLE: "item_single",
    HISTORY: "history",
    POINT_EVENT: "point_event",
    INTERVAL_EVENT: "interval_event",
    EVENT: "event",
    EVENT_CONTEXT: "event_context",
    ACTIVITY: "activity",
    FEEDER_AUDIT: "feeder_audit",
    PARTICIPATION: "participation",
    PARTY_IDENTIFIED: "party_identified",
    LINK: "link",
    DV_TEXT: "dv_text",
    DV_CODED_TEXT: "dv_coded_text",
    DV_QUANTITY: "dv_quantity",
    DV_DATE_TIME: "dv_date_time",
    DV_BOOLEAN: "dv_boolean",
    DV_COUNT: "dv_count",
    DV_ORDINAL: "dv_ordinal",
    DV_PROPORTION: "dv_proportion",
    DV_DURATION: "dv_duration",
    DV_URI: "dv_uri",
    DV_IDENTIFIER: "dv_identifier",
    CODE_PHRASE: "code_phrase",
  };
  return map[rmType] ?? rmType.toLowerCase();
}

export function returnTypeForDv(rmType: string): string {
  switch (rmType) {
    case "DV_TEXT":
    case "DV_CODED_TEXT":
    case "DV_URI":
    case "DV_EHR_URI":
    case "DV_DATE":
    case "DV_TIME":
    case "DV_DATE_TIME":
    case "DV_DURATION":
    case "CODE_PHRASE":
      return "string";
    case "DV_QUANTITY":
    case "DV_COUNT":
    case "DV_INTEGER":
    case "DV_PROPORTION":
    case "DV_ORDINAL":
      return "number";
    case "DV_BOOLEAN":
      return "boolean";
    default:
      return "string";
  }
}
