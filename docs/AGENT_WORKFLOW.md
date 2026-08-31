# Agent workflow (IDE + desktop)

Golden path: **IDE + intEHRgrator desktop side-by-side**. An AI agent calls the **localhost Agent API** while you watch the Blockly canvas update.

Fallback when MCP/API is unavailable: read **mapping spec** (Blockly JSON) or **generated conversion script** from export — downstream only, not round-trip authoring.

## Desktop Agent API

Enabled by default on the desktop app (`deno task desktop`). Disable with `INTEHR_AGENT_API=0`.

Base URL: `http://127.0.0.1:<port>/api/v1/`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| GET | `/snapshot` | Revision, templateId, mapped counts, test status |
| GET | `/bundle` | Full `ProjectBundle` + revision |
| PUT | `/bundle` | Load bundle (`If-Match` revision optional) |
| POST | `/import-suggestions` | Apply `intehrgrator-suggestions` JSON (body = text) |
| POST | `/build-prompt` | Copy AI Prompt markdown |
| POST | `/map-slot` | `{ slotId, path, format? }` |
| POST | `/run-test` | Conversion Test Run |
| PUT | `/blockly` | Replace workspace JSON (escape hatch) |
| POST | `/optional-rm/add` | `{ parentSlotId, rmType, attributeName }` |
| POST | `/optional-rm/remove` | `{ parentSlotId, attributeName }` |
| POST | `/undo` / `/redo` | Service-level undo stack |

Mutating requests accept **`If-Match: <revision>`** from the last snapshot. On conflict the API returns **409**.

The UI polls `/api/v1/snapshot` and reloads the bundle when revision changes (live canvas sync).

## MCP (stdio)

```bash
deno task mcp
```

Set **`INTEHR_AGENT_URL=http://127.0.0.1:<port>`** to proxy tools to a running desktop session (recommended). Without it, MCP embeds a headless `WorkbenchService` (file/bundle workflow).

Cursor example (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "intehrgrator": {
      "command": "deno",
      "args": ["run", "-A", "src/agent/mcp_stdio.ts"],
      "env": { "INTEHR_AGENT_URL": "http://127.0.0.1:8765" }
    }
  }
}
```

Tools: `get_snapshot`, `build_prompt`, `import_suggestions`, `map_slot`, `run_test`, `undo`, `redo`.

## Response format for LLMs

Always use [AI_SUGGESTION_FORMAT.md](./AI_SUGGESTION_FORMAT.md) version 2 (`intehrgrator-suggestions` fence). Prefer **`import_suggestions`** / MCP over hand-editing Blockly JSON.

## Related

- [AI_SUGGESTION_FORMAT.md](./AI_SUGGESTION_FORMAT.md)
- [UI_TESTING.md](./UI_TESTING.md) — browser Test API (`?testMode=1`) for Playwright only
