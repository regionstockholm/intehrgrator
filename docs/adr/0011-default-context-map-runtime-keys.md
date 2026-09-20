# Default context map: runtime keys vs scaffold targets

- Status: accepted (not implemented; [design spec](../design/default-context-map.md), #158 blocked by #159)
- Date: 2026-09-20
- Extends: [ADR 0002](0002-convert-time-defaults.md)

A **default context map** is the unique canvas block that *is* the convert-time defaults table — not a **Map** plugged into a **Defaults block**. Each **entry** has three fields: a simple **runtime key**, one or more **scaffold targets** (RM/schema paths and wildcards, authoring-only), and a nested Blockly **value**. Generated Conversion Scripts still take a `defaults` argument and resolve `maps_get("defaults", runtimeKey)` at convert time (ADR 0002 stands). Scaffold paths never appear in that argument.

Scaffolding **joins** **Default point**s by matching **scaffold targets** with the #157 engine (most-specific wins; optional RM insert when a target matches). That apply is a discrete act (joint confirm, explicit Apply, or later target refresh). Changing a **value** is live via `maps_get`. Picking another saved map does not rebuild the **Product stack**.

**Considered:** keeping path/wildcard strings as the convert-time keys (#157 factory); a Decision table or Sheet for the wiring; a sidecar table plus a plugged `maps_create_with`; dual-read of old map JSON. Rejected: pipelines cannot be asked for `*.language`; Decision tables hold cell text, not nested RM values; two artefacts drift; there are no external users, so in-repo examples convert in the same change.

Root `CONTEXT.md` still describes the shipped plugged-Map model until #158 lands. Replacement glossary text: [CONTEXT-default-context-map-proposed.md](../design/CONTEXT-default-context-map-proposed.md).
