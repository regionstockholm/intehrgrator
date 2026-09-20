# In-app and copy-paste AI assist

**Status:** Web Shell has optional **Call AI** (OpenAI-compatible chat completions, credentials in localStorage). Copy-paste and IDE/MCP remain first-class. Richer native assist (VS Code Language Model API) is still deferred.

## Web Shell

- **Copy prompt** — markdown prompt with target/source origins, delivery mode, slot manifest, link to `AI_SUGGESTION_FORMAT.md`
- **Call AI** — POST that prompt; default toolbar action when credentials exist
- **AI credentials…** — endpoint, API key, model. Never stored in the Project Bundle. CORS-friendly proxies may be required.
- **Import Suggestions** — parses `intehrgrator-suggestions` JSON version 2 (same path as Call AI)
- Target/source **refresh** reports offer Copy merge prompt / Call AI; detached Blockly stays

## When to integrate more natively

| Host | Mechanism |
|------|-----------|
| VS Code extension | `vscode.lm` Language Model API; suggest for selected slot or full unmapped manifest |
| Web | Already: user-configured endpoint + key; same suggestion format internally |

## Migration path

Integrated AI should emit the same `intehrgrator-suggestions` JSON internally before applying — one import/application code path for copy-paste and native modes.

## Related

- [AI_SUGGESTION_FORMAT.md](../AI_SUGGESTION_FORMAT.md)
- [UI_ARCHITECTURE.md](../UI_ARCHITECTURE.md)
