# Agent workflow (IDE + desktop)

Golden path: **IDE + intEHRgrator desktop side-by-side**. An AI agent calls the **localhost Agent API** while you watch the Blockly canvas update. Open **Open observer** (formerly Open canvas) for the live agent legend and **attributed history timeline** (scrub, destructive rollback, patch-undo prompts).

Fallback when MCP/API is unavailable: read **mapping spec** (Blockly JSON) or **generated conversion script** from export — downstream only, not round-trip authoring.

## Desktop Agent API

Enabled by default on the desktop app (`deno task desktop`). Disable with `INTEHR_AGENT_API=0`.

Base URL: `http://127.0.0.1:<port>/api/v1/`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| GET | `/snapshot` | Revision, templateId, mapped counts, test status, active agent count |
| GET | `/bundle` | Full `ProjectBundle` + revision |
| GET | `/history` | Attributed semantic timeline (`entries[]` with actor, kind, summary, bundles) |
| GET | `/history/:seq/preview` | Read-only bundle at history seq |
| GET | `/activity` | Latest agent highlight + registered agents |
| POST | `/register-agent` | `{ agentId?, displayName?, color? }` → assigned id/name/colour |
| PUT | `/bundle` | Load bundle (`If-Match` revision optional) |
| POST | `/ui-commit` | UI semantic commit `{ bundle, summary, kind? }` |
| POST | `/import-suggestions` | Apply `intehrgrator-suggestions` JSON (body = text) |
| POST | `/build-prompt` | Copy AI Prompt markdown |
| POST | `/patch-prompt` | `{ targetSeq }` → prompt for **patch undo** (`intehrgrator-suggestions` v2) |
| POST | `/map-slot` | `{ slotId, path, format? }` |
| POST | `/run-test` | Conversion Test Run |
| PUT | `/blockly` | Replace workspace JSON (escape hatch) |
| POST | `/optional-rm/add` | `{ parentSlotId, rmType, attributeName }` |
| POST | `/optional-rm/remove` | `{ parentSlotId, attributeName }` |
| POST | `/undo` | `{ scope?: global \| user \| agent }` |
| POST | `/redo` | Redo service history |
| POST | `/restore-at` | `{ seq, mode?: view \| destructive }` — timeline scrub / rollback |
| POST | `/export-discarded` | `{ entries: [{ afterBundle }] }` → `.intehrgrator` zip of discarded branch tip |

Mutating requests accept **`If-Match: <revision>`** from the last snapshot. On conflict the API returns **409** with current revision.

Pass agent identity on mutations: headers **`X-Agent-Id`**, **`X-Agent-Name`**, optional **`X-Agent-Color`** (after `register-agent`).

The UI polls `/api/v1/snapshot` and reloads the bundle when revision changes (live canvas sync). Pure block **x/y** drags do not append history; structural / expression changes do.

### Multi-agent presence

1. MCP **`register_agent`** at session start — desktop returns **name + colour**.
2. Mutations carry agent headers for **attributed history**.
3. **Open observer** popup: agent legend + **history timeline** (scrub, destructive rollback with optional **download discarded branch**, copy **patch-undo** prompt).
4. Main canvas: subtle **pulse** on touched slots; optional **Follow agent** checkbox pans to agent edits (default off).

### Patch undo (best-effort)

`POST /patch-prompt` or MCP **`build_patch_prompt`** returns a prompt that asks the LLM for strict **`intehrgrator-suggestions` version 2** JSON — not free text. Apply the response via **`import_suggestions`**. The result is a new history entry (undoable).

### History retention

- **Desktop:** set `INTEHR_HISTORY_PATH` to append metadata lines to disk alongside the project.
- **Web:** history is in-memory; purge-old UX deferred — avoid unbounded sessions on long-lived tabs.

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

Tools: `register_agent`, `get_snapshot`, `get_history`, `get_activity`, `build_prompt`, `build_patch_prompt`, `import_suggestions`, `map_slot`, `run_test`, `restore_at`, `undo`, `redo`.

## Response format for LLMs

Always use [AI_SUGGESTION_FORMAT.md](./AI_SUGGESTION_FORMAT.md) version 2 (`intehrgrator-suggestions` fence). Prefer **`import_suggestions`** / MCP over hand-editing Blockly JSON. Patch undo responses must use the same envelope.

## Related

- [AI_SUGGESTION_FORMAT.md](./AI_SUGGESTION_FORMAT.md)
- [UI_TESTING.md](./UI_TESTING.md) — browser Test API (`?testMode=1`) for Playwright only
- [tasks/DESIGN-multi-agent-undo-crdt.md](../tasks/DESIGN-multi-agent-undo-crdt.md)
