# Go template is a codegen-only Conversion script language

Go `text/template` is a Conversion script language whose output is generated from the entire Blockly Mapping Model — not authored in a Template tab. Handlebars retains its Authored Template tab for Kintegrate compatibility; Go template does not get one.

`generate(model, "go-template", { blocklyState, skeleton })` walks the **Instance root** under **Conversion start**, the same seam as TypeScript canvas codegen: RM/openEHR trees (ITS-JSON text, not ehrtslib constructors), JSON Schema / `json_object`, XML Schema / `xml_element`, and **Text document**. `for_each_source` becomes `range`. Floating `text_code` LANG=`go-template` helpers that contain `define` are prepended (chemo `cleanAndQuoteFreeTextInput`). A JSON-state walker remains as fallback when the canvas cannot be loaded.

**Considered:** giving Go template the same dual surface as Handlebars (Authored Template tab + codegen). Rejected because the existing Go mapping scripts (FLAT→TakeCare XML) are a reference, not the intEHRgrator authoring path. The Blockly canvas is the editing surface; `text_code` (language = Go Template) nests **VMS-Go** snippets inside XML text nodes when needed ([ADR 0009](0009-verifiable-template-dialects.md)). A future Blockly→Handlebars or XQuery codegen adapter may follow the same canvas-walker pattern.
