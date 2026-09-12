/**
 * Helpers for `xml_document` declaration fields and namespace extraState.
 */
import type { Block } from "blockly/core";

export interface XmlNamespaceDecl {
  prefix: string;
  uri: string;
}

export interface XmlDocumentExtraState {
  version?: string;
  encoding?: string;
  standalone?: "" | "yes" | "no";
  attributes?: Array<{ name: string; value: string }>;
}

export function readXmlDocumentExtraState(block: Block): XmlDocumentExtraState {
  const raw = (block as Block & { extraState_?: XmlDocumentExtraState }).extraState_;
  return {
    version: String(block.getFieldValue("VERSION") ?? raw?.version ?? "1.0"),
    encoding: String(block.getFieldValue("ENCODING") ?? raw?.encoding ?? "UTF-8"),
    standalone: normalizeStandalone(block.getFieldValue("STANDALONE") ?? raw?.standalone),
    attributes: Array.isArray(raw?.attributes) ? raw!.attributes! : [],
  };
}

export function writeXmlDocumentExtraState(
  block: Block,
  state: XmlDocumentExtraState,
): void {
  (block as Block & { extraState_?: XmlDocumentExtraState }).extraState_ = state;
}

export function xmlDocumentNamespaceAttrs(block: Block): XmlNamespaceDecl[] {
  const attrs = readXmlDocumentExtraState(block).attributes ?? [];
  return attrs
    .filter((attr) => attr.name.startsWith("xmlns"))
    .map((attr) => {
      const name = attr.name;
      if (name === "xmlns") return { prefix: "", uri: attr.value };
      if (name.startsWith("xmlns:")) {
        return { prefix: name.slice("xmlns:".length), uri: attr.value };
      }
      return { prefix: name, uri: attr.value };
    });
}

export function namespaceAttrsToExtraAttributes(
  namespaces: XmlNamespaceDecl[],
): Array<{ name: string; value: string }> {
  return namespaces.map((ns) => ({
    name: ns.prefix ? `xmlns:${ns.prefix}` : "xmlns",
    value: ns.uri,
  }));
}

function normalizeStandalone(value: unknown): "" | "yes" | "no" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "yes" || raw === "no") return raw;
  return "";
}
