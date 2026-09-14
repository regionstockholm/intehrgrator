import { assertEquals } from "@std/assert";
import {
  injectXmlnsOnOpenTag,
  wrapXmlCdata,
  xmlDeclarationLine,
} from "@intehrgrator/core/xml_shape.ts";

Deno.test("xmlDeclarationLine emits version, encoding, and optional standalone", () => {
  assertEquals(
    xmlDeclarationLine({ version: "1.0", encoding: "UTF-8" }),
    `<?xml version="1.0" encoding="UTF-8"?>`,
  );
  assertEquals(
    xmlDeclarationLine({ version: "1.1", encoding: "ISO-8859-1", standalone: "yes" }),
    `<?xml version="1.1" encoding="ISO-8859-1" standalone="yes"?>`,
  );
});

Deno.test("wrapXmlCdata splits the CDATA terminator", () => {
  assertEquals(wrapXmlCdata("hello"), "<![CDATA[hello]]>");
  assertEquals(wrapXmlCdata("a]]>b"), "<![CDATA[a]]]]><![CDATA[>b]]>");
});

Deno.test("injectXmlnsOnOpenTag adds xmlns to the start tag", () => {
  assertEquals(
    injectXmlnsOnOpenTag("<Note>", [{ prefix: "tc", uri: "urn:take" }]),
    `<Note xmlns:tc="urn:take">`,
  );
  assertEquals(
    injectXmlnsOnOpenTag("<Note/>", [{ prefix: "", uri: "urn:def" }]),
    `<Note xmlns="urn:def"/>`,
  );
});
