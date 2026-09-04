/**
 * Help text for Blockly openEHR class/attribute chrome and schema docs.
 * openEHR prose/URLs come from ehrtslib's optional `spec` package (not the root barrel).
 */
import {
  attributeSpec,
  classSpec,
  hasClassSpec,
  type SpecAttributeRow,
  type SpecClassRow,
} from "ehrtslib/spec/mod.ts";

export type SpecHelpLink = {
  label: string;
  href: string;
};

export type SpecHelpContent = {
  title: string;
  subtitle?: string;
  links: SpecHelpLink[];
  body: string;
};

/** True when BMM/spec tables know this RM (or AM/BASE/…) class name. */
export function hasRmClassHelp(rmType: string): boolean {
  return Boolean(rmType && hasClassSpec(rmType));
}

export function rmClassHelp(rmType: string): SpecHelpContent | null {
  if (!rmType) return null;
  const row = classSpec(rmType, { component: "RM" }) ?? classSpec(rmType);
  if (!row) return null;
  return classRowToHelp(row);
}

export function rmAttributeHelp(
  className: string,
  attributeName: string,
): SpecHelpContent | null {
  if (!className || !attributeName) return null;
  const cls = classSpec(className, { component: "RM" }) ?? classSpec(className);
  const attr = attributeSpec(className, attributeName, { component: "RM" }) ??
    attributeSpec(className, attributeName);
  if (!attr?.documentation?.trim()) return null;
  return attributeRowToHelp(cls, attr, className);
}

/** Free-text help for JSON Schema `description` / XSD `xs:documentation`. */
export function documentationHelp(
  title: string,
  body: string,
  links: SpecHelpLink[] = [],
): SpecHelpContent | null {
  const text = body.trim();
  if (!text) return null;
  return {
    title: title.trim() || "Documentation",
    links,
    body: text,
  };
}

function classRowToHelp(row: SpecClassRow): SpecHelpContent {
  const links: SpecHelpLink[] = [];
  if (row.specHtmlUrl) {
    links.push({ label: "Specification (HTML)", href: row.specHtmlUrl });
  }
  if (row.specMarkdownUrl) {
    links.push({ label: "Specification (Markdown)", href: row.specMarkdownUrl });
  }
  return {
    title: row.name,
    subtitle: row.component ? `${row.component} class` : undefined,
    links,
    body: (row.documentation ?? "").trim() || "No BMM documentation text for this class.",
  };
}

function attributeRowToHelp(
  cls: SpecClassRow | undefined,
  attr: SpecAttributeRow,
  className: string,
): SpecHelpContent {
  const links: SpecHelpLink[] = [];
  if (cls?.specHtmlUrl) {
    links.push({ label: `${cls.name} class (HTML)`, href: cls.specHtmlUrl });
  }
  if (cls?.specMarkdownUrl) {
    links.push({ label: `${cls.name} class (Markdown)`, href: cls.specMarkdownUrl });
  }
  return {
    title: `${cls?.name ?? className}.${attr.name}`,
    subtitle: "RM attribute",
    links,
    body: attr.documentation.trim(),
  };
}
