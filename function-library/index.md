# Function library

Reusable **Blockly Functions** (`procedures_defreturn` plus any Decision tables they call). Mapping Specification fragments — not Conversion script helpers.

Load with MCP / Agent API `list_function_library` then `load_function` (`clash`: `rename` default, or `replace`). Web Shell: **Functions**. Call the Function from a Target value slot; do not `put_blockly` the whole canvas.

| id | name | locale | params | returns | Decision tables | what |
|----|------|--------|--------|---------|-----------------|------|
| `join_swedish` | `join_swedish` | sv | `names` | String | JoinNames | `A, B och C` (FIRST snippets; not `join_list`) |
| `join_oxford` | `join_oxford` | en | `names` | String | JoinOxford | `A, B, and C` Oxford comma (FIRST snippets; not `join_list`) |

Catalog: `function-library/catalog.json`. Files: `*.intehr-function.json`. When a contribution issue is accepted, follow [`AGENTS.md`](AGENTS.md).
