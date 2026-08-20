# Deferred: Integrated In-App AI Assist

**Status:** Not in v1 web shell. v1 uses copy-paste AI assist per [AI_SUGGESTION_FORMAT.md](../AI_SUGGESTION_FORMAT.md).

## Idea

Call AI APIs directly from the app to suggest mappings without copy-paste. Natural fit for the **VS Code extension** (Language Model API) and optionally a configured endpoint in web Settings later.

## v1 substitute: Copy-Paste AI Assist

- **Copy AI Prompt** — generates markdown prompt with target/source origins (file or URI), delivery mode (inline multipart / attach checklist / URI browse), slot manifest (`valueType`), and link to `AI_SUGGESTION_FORMAT.md`
- **Import Suggestions** — parses `intehrgrator-suggestions` JSON version 2 (Blockly block subset)

## When to integrate natively

| Host | Mechanism |
|------|-----------|
| VS Code extension | `vscode.lm` Language Model API; suggest for selected slot or full unmapped manifest |
| Web (later) | User-configured API key + endpoint in Settings; same suggestion format internally |

## Migration path

Integrated AI should emit the same `intehrgrator-suggestions` JSON internally before applying — one import/application code path for copy-paste and native modes.

## Related

- [AI_SUGGESTION_FORMAT.md](../AI_SUGGESTION_FORMAT.md)
- [UI_ARCHITECTURE.md](../UI_ARCHITECTURE.md)
