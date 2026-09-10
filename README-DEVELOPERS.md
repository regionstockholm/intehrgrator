# intEHRgrator — developers

End users start at [README.md](README.md) and the [tutorial](docs/TUTORIAL.md). This page is clone-and-build, Deno tasks, domain docs, and AI-agent setup.

## Why Deno

This is a **Deno-based TypeScript** project (not Node/npm as the toolchain). Deno runs TypeScript directly, owns `deno.json` tasks and the import map, and compiles the desktop app (`deno desktop`). Node and `pnpm` may exist on a machine; do not add an npm workflow.

Install the current stable Deno: [Deno installation](https://docs.deno.com/runtime/getting_started/installation/). `deno --version` should be 2.x (2.9+ for `deno task desktop`).

Go 1.22+ is required **only** to rebuild the vendored Go `text/template` WASM (`deno task wasm:go-template`). Ordinary lint/test/run/build do not need Go.

## Clone and run

```bash
git clone https://github.com/regionstockholm/intehrgrator.git
cd intehrgrator
deno task vendor   # ehrtslib + openEHR-model-examples → vendor/
deno task test     # unit tests (no browser)
deno task build    # static site → dist/
deno task dev      # http://localhost:5173
```

`deno task vendor` always checks out **ehrtslib `origin/main`**, so upstream module moves fail tests instead of shipping a stale pin.

## Deno tasks

Defined in [`deno.json`](deno.json) `tasks`. Purposes:

| Task | Purpose |
| --- | --- |
| `vendor` | Clone/update ehrtslib and example models into `vendor/` |
| `test` | Deno unit tests (`test/`, ignores `test/ui`) |
| `test:ui` | Playwright Click-to-Map / Test Run — [UI_TESTING.md](docs/UI_TESTING.md) |
| `lint` | `deno lint` on `src`, `test`, `scripts` |
| `check` | `deno check` on `src`, `web/main.ts`, `scripts` |
| `build` | Bundle Web Shell to `dist/` (copies `docs/` and `examples/` into the site) |
| `dev` | Serve `dist/` (default port 5173) |
| `desktop` | Build + open a native window (`127.0.0.1`, Agent API on) |
| `compile:desktop` | Cross-compile Windows / Linux AppImage / macOS into `dist/release/` |
| `compile:ehrtslib` | Helper around the ehrtslib compile path |
| `mcp` | Stdio **MCP** server ([AGENT_WORKFLOW.md](docs/AGENT_WORKFLOW.md)) |
| `release` | Version bump, tag, push; Actions publish desktop + frozen Pages `/v…/` |
| `wasm:go-template` | Rebuild `web/wasm/go_texttemplate.wasm` + `wasm_exec.js` |
| `setup:better-forms` | Optional licensed Better Form renderer (never committed) |
| `convert:kintegrate-hbs` | Kintegrate Handlebars → Blockly helper |

```bash
deno task release -- --version 0.8.0
deno task release -- --current
```

GitHub Pages: push to `main` deploys the cutting-edge site root. `deno task release` also publishes an immutable `/v<x>/` copy. Repo setting: **Settings → Pages → Source = GitHub Actions**.

## Domain docs (read these)

| File | Role |
| --- | --- |
| [CONTEXT.md](CONTEXT.md) | Glossary — use these terms; do not invent synonyms |
| [docs/adr/](docs/adr/) | Architecture Decision Records |
| [docs/agents/domain.md](docs/agents/domain.md) | How skills consume the glossary and ADRs |

Product roadmap: [docs/ROADMAP.md](docs/ROADMAP.md). Live design notes: [docs/design/](docs/design/), [docs/architecture/](docs/architecture/). Deferred ideas: [docs/future/](docs/future/). Doc index: [docs/README.md](docs/README.md).

Superseded prompts, v1 PRDs, and old chunk checklists: [docs/historical-archive/](docs/historical-archive/). **Do not implement from the archive.** New specs belong in GitHub Issues (and ADRs when a decision sticks).

## AI-assisted development

Matt Pocock engineering skills ship in this repo so Cloud Agents and a laptop Cursor install see the same set:

- Cursor: [`.cursor/skills/`](.cursor/skills/)
- `npx skills` lockfile copy: [`.agents/skills/`](.agents/skills/)

Router: **`/ask-matt`**. Usual path for a new idea: **`/grill-with-docs`** → **`/to-spec`** → **`/to-tickets`** → **`/implement`** (that last skill drives **`/tdd`**). Bugs: **`/triage`** or **`/diagnosing-bugs`**. Mapping work with the desktop app open: **intehrgrator-mapping** skill ([GitHub](https://github.com/regionstockholm/intehrgrator/tree/main/.cursor/skills/intehrgrator-mapping)).

Refresh the Matt Pocock set:

```bash
npx skills@latest add mattpocock/skills --agent cursor --skill '*' --yes --copy
```

Lowercase `--agent cursor`. Use `--skill '*'` or repeat `--skill <name>` (comma-separated lists are not supported).

Always-on agent notes: [AGENTS.md](AGENTS.md) (DeepWiki, Deno preference, Cloud Agent image). Issue tracker conventions: [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md). Triage labels: [docs/agents/triage-labels.md](docs/agents/triage-labels.md). GitHub’s contributing pointer is [CONTRIBUTING.md](CONTRIBUTING.md).

### MCP connections worth enabling

| Server | Use |
| --- | --- |
| [DeepWiki](https://deepwiki.com/) | GitHub-repo questions (ehrtslib, Blockly, fontoxpath, …). Tools: `read_wiki_structure`, `read_wiki_contents`, `ask_question`. |
| [openEHR Assistant](https://github.com/cadasto/openehr-assistant-plugin) | CKM search, spec lookup, AQL/ADL guidance |
| **intEHRgrator** (`deno task mcp`) | Live mapping on a running **desktop** session — [tutorial appendix](docs/TUTORIAL.md#appendix-a--desktop-agent-api-and-mcp) |

Prefer primary docs and these MCPs over training-data guesses for library APIs.

## Before you open a pull request

```bash
deno task lint
deno task test
deno task check
```

Playwright (`deno task test:ui`) needs a built `dist/` — [UI_TESTING.md](docs/UI_TESTING.md). CI on `main` and `cursor/**` runs `vendor` → `test` → `build`.

## Layout

| Path | Role |
| --- | --- |
| `src/core/` | OPT skeleton, Mapping Model, spec, source query, codegen, persistence, AI |
| `src/blockly/` | openEHR Blockly blocks + generators |
| `src/workbench/` | UI controller, tree views, CodeMirror |
| `src/ui/` | Shared dialogs (Help, …) |
| `src/host/` | `HostAdapter` + browser implementation |
| `src/desktop/` | `deno desktop` entry: local HTTP + native window |
| `src/agent/` | Agent API HTTP + MCP stdio |
| `src/ui_test/` | Workbench Test API types / helpers |
| `web/` | HTML/CSS entry; bundled to `dist/` |
| `test/` | Deno unit tests + OPT fixtures |
| `test/ui/` | Playwright UI tests |
| `examples/` | Example Sets catalog and fixtures |

## Libraries

- [ErikSundvall/ehrtslib](https://github.com/ErikSundvall/ehrtslib) — openEHR TypeScript (RM, Test Run)
- [Ehrlibs/openEHR-model-examples](https://github.com/Ehrlibs/openEHR-model-examples) — demo archetypes/templates (`deno task vendor`)
- [openEHR/archie](https://github.com/openEHR/archie) — openEHR Java (export target)
- [FontoXML/fontoxpath](https://github.com/FontoXML/fontoxpath) — XPath 3.1 on JSON/XML sources
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) — openEHR RM XML (aligned with ehrtslib)

**RM Blockly coverage:** `PARTY_IDENTIFIED` / `PARTY_RELATED` include `name`, `identifiers`, and `external_ref`. Full Demographics product scope is not implemented.
