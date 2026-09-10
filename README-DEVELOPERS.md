# intEHRgrator — developer guide

TypeScript integration workbench: Blockly mapping editor, `ehrtslib` for openEHR, `fontoxpath` for source queries, Deno toolchain. Ships as a static **Web Shell** (GitHub Pages), **desktop** binary (`deno desktop`), and (planned) VS Code webview host.

End-user docs: [README.md](README.md) · [docs/TUTORIAL.md](docs/TUTORIAL.md)

## Why Deno

This repo uses [Deno](https://docs.deno.com/) for install, lint, test, bundle, and desktop packaging — not Node/npm. Deno runs TypeScript directly, resolves dependencies from `deno.json`, and provides `deno task` for scripts.

**Install Deno:** https://docs.deno.com/runtime/getting_started/installation/ (2.9+ required for `deno desktop`).

```bash
deno --version   # should be ≥ 2.9
```

## Quick start

```bash
git clone https://github.com/regionstockholm/intehrgrator.git
cd intehrgrator
deno task vendor   # clone/update ehrtslib + examples into vendor/
deno task test     # unit tests (no browser)
deno task build    # static site → dist/
deno task dev      # serve dist/ at http://localhost:5173
```

Open `http://localhost:5173` or `dist/index.html` after build.

### Deno tasks

| Task | Purpose |
|------|---------|
| `vendor` | Refresh `vendor/ehrtslib` and example models from upstream |
| `test` | Unit tests under `test/` (parallel, no browser) |
| `test:ui` | Playwright UI tests — Click-to-Map + Test Run ([UI_TESTING.md](docs/UI_TESTING.md)) |
| `lint` | `deno lint` on `src`, `test`, `scripts` |
| `check` | Type-check TypeScript sources |
| `build` | Bundle web app + stage desktop `www/` |
| `dev` | Local static server with rebuild |
| `desktop` | Build + run native window (`deno desktop`) |
| `compile:desktop` | Platform release binaries → `dist/release/` |
| `compile:ehrtslib` | Build ehrtslib for vendored workflows |
| `release` | Version bump, tag, push; CI publishes Pages + desktop |
| `mcp` | Stdio MCP server for Agent API ([AGENT_WORKFLOW.md](docs/AGENT_WORKFLOW.md)) |
| `wasm:go-template` | Rebuild Go `text/template` WASM (needs Go 1.22+) |
| `setup:better-forms` | Optional Better Form Renderer assets (licensed) |
| `convert:kintegrate-hbs` | Kintegrate Handlebars → Blockly migration helper |

CI on every push to `main`: `vendor` → `test` → `build`. Desktop and versioned GitHub Pages paths are published on release (`deno task release`).

## Repository layout

| Path | Role |
|------|------|
| `src/core/` | Mapping model, spec, codegen, persistence, AI prompt |
| `src/blockly/` | openEHR blocks, VMS profile, generators |
| `src/workbench/` | UI controller, trees, CodeMirror |
| `src/host/` | `HostAdapter` (web IndexedDB, future VS Code) |
| `src/desktop/` | Desktop entry: local HTTP + native window |
| `src/agent/` | Agent API service + MCP stdio |
| `web/` | HTML/CSS entry → `dist/bundle.js` |
| `test/` | Deno unit tests + fixtures |
| `test/ui/` | Playwright tests |
| `docs/adr/` | Architecture Decision Records |
| `docs/planning/` | PRDs and implementation task lists |
| `docs/design/` | Design investigations |
| `CONTEXT.md` | Domain glossary (single source of terminology) |

## Architecture docs

| Topic | Document |
|-------|----------|
| Glossary | [CONTEXT.md](CONTEXT.md) |
| UI layout | [docs/UI_ARCHITECTURE.md](docs/UI_ARCHITECTURE.md) |
| Blockly | [docs/BLOCKLY_INTEGRATION.md](docs/BLOCKLY_INTEGRATION.md) |
| Mapping spec | [docs/MAPPING_SPECIFICATION.md](docs/MAPPING_SPECIFICATION.md) |
| Source formats | [docs/SOURCE_FORMATS.md](docs/SOURCE_FORMATS.md) |
| Persistence | [docs/PROJECT_PERSISTENCE.md](docs/PROJECT_PERSISTENCE.md) |
| Agent / MCP | [docs/AGENT_WORKFLOW.md](docs/AGENT_WORKFLOW.md) |
| ADRs | [docs/adr/](docs/adr/) |
| Roadmap | [docs/ROADMAP.md](docs/ROADMAP.md) |
| Deferred ideas | [docs/future/](docs/future/) |

ADRs record *why* a decision was made; the glossary records *what we call things*.

## AI-assisted development

### Agent instructions

- **[AGENTS.md](AGENTS.md)** — rules for Cloud Agents and coding assistants in this repo
- **[docs/agents/](docs/agents/)** — issue tracker, triage labels, domain doc layout

### Matt Pocock skills (recommended workflow)

Engineering skills ship in `.cursor/skills/` and `.agents/skills/`. Refresh from upstream:

```bash
npx skills@latest add mattpocock/skills --agent cursor --skill '*' --yes --copy
```

Useful flows for this project:

| Skill | When |
|-------|------|
| `domain-modeling` | Editing CONTEXT.md or ADRs |
| `implement` / `tdd` | Feature work test-first |
| `triage` | Incoming GitHub issues |
| `diagnosing-bugs` | Hard regressions |
| `code-review` | Pre-merge review |
| `setup-matt-pocock-skills` | First-time tracker/label setup |

Project-specific: **[intehrgrator-mapping](.cursor/skills/intehrgrator-mapping/SKILL.md)** for Agent API / MCP mapping sessions.

### MCP connections

| MCP | Purpose |
|-----|---------|
| **intehrgrator** (`deno task mcp`) | Drive desktop workbench from IDE |
| **openehr assistant** | Archetypes, templates, terminology, specs |
| **DeepWiki** | ehrtslib, archie, and other GitHub library docs |

### DeepWiki

Prefer DeepWiki MCP (`ask_question`, `read_wiki_contents`) over guessing library behaviour. See [AGENTS.md](AGENTS.md#documentation-guidance).

## GitHub Pages and releases

- **Bleeding edge:** `https://regionstockholm.github.io/intehrgrator/`
- **Pinned versions:** listed in [`versions.json`](https://regionstockholm.github.io/intehrgrator/versions.json) (e.g. `…/v0.7/`)
- **Desktop binaries:** [Releases](https://github.com/regionstockholm/intehrgrator/releases)

```bash
deno task release -- --version 0.8.0   # bump, tag, push
deno task release -- --current         # tag version already in deno.json
```

## Contributing

1. Open an issue or pick an existing one.
2. Branch from `main`, run `deno task test` (and `test:ui` for UI changes).
3. Keep terminology aligned with [CONTEXT.md](CONTEXT.md).
4. Add or update ADRs when making architectural choices.

Historical brainstorming: [docs/historical-archive/](docs/historical-archive/)
