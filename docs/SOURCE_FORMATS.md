# Source Formats (v1)

## Supported inputs

| Format | v1 | Load | Query |
|--------|-----|------|-------|
| JSON schema | ✓ | `JSON.parse` | fontoxpath (authoring / click-to-map from schema tree) |
| JSON instance | ✓ | `JSON.parse` | fontoxpath (example tabs + Test Run) |
| XML instance | ✓ | `DOMParser` | fontoxpath (example tabs + Test Run) |
| XML schema (XSD) | Deferred | — | [future/xml-schema-support.md](future/xml-schema-support.md) |

## Source Pane layout

The left pane separates **schema** from **example instances**:

| Section | Purpose | Required? |
|---------|---------|-----------|
| **Schema tree** (upper) | Structural view for authoring mappings | Optional but typical — JSON schema or structure inferred from first example |
| **Example tabs** (lower) | One or more JSON/XML instance files as tabs | Optional for authoring; **required for Test Run** |

See [UI_ARCHITECTURE.md](UI_ARCHITECTURE.md) — Source Pane.

## Query layer

All source path expressions use **fontoxpath** (XPath 3.1 / XQuery 3.1) for both JSON and XML. See [SOURCE_QUERY.md](SOURCE_QUERY.md).

Click-to-map works from **either** the schema tree or the **active example tab** tree; both insert fontoxpath expressions into `source_query` blocks.

## openEHR XML (ehrtslib alignment)

**`fast-xml-parser`** remains the library for openEHR RM XML serialization/deserialization — same as [ehrtslib](https://github.com/ErikSundvall/ehrtslib). It is **not** used for traversing user source files.

## Schema-only authoring

- Informatician can map against the **schema tree** without any example loaded.
- **Test Run** and **Autoplay** require at least one **example instance tab**; toggle stays disabled until then.
- Adding the first example via **+ Add Example** enables Test Run.

## Test Run output

Composition results are displayed as **JSON** (ehrtslib native object form). The lower Output Preview pane always reflects the **active example tab**.

## Related

- [SOURCE_QUERY.md](SOURCE_QUERY.md) — fontoxpath, typed evaluators
- [UI_ARCHITECTURE.md](UI_ARCHITECTURE.md) — Source Pane, example tabs
- [PROJECT_PERSISTENCE.md](PROJECT_PERSISTENCE.md) — multiple examples in bundle
- [CONTEXT.md](../CONTEXT.md) — Source Schema, Example Instance, Active Example
