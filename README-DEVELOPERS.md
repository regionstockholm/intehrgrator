# intEHRgrator — Developer guide

Technical setup and architecture pointers for contributors and AI-assisted development.

**End-user docs:** [README.md](README.md) · [docs/TUTORIAL.md](docs/TUTORIAL.md)

## Prerequisites

- **[Deno](https://docs.deno.com/runtime/getting_started/installation/)** 2.9+ — the project runtime, task runner, test runner, and desktop packager. We use Deno instead of Node/npm for installs, linting, testing, and builds.
- **Go 1.22+** (optional) — only to rebuild the vendored Go `text/template` WASM (`deno task wasm:go-template`).
- **Playwright** (optional) — installed automatically by `deno task test:ui` for browser tests.

```bash
git clone https://github.com/regionstockholm/intehrgrator.git
cd intehrgrator
deno task vendor   # clone/update ehrtslib + examples into vendor/
```

## Deno tasks

| Task | Purpose |
|------|---------|
| `deno task vendor` | Refresh `vendor/ehrtslib` and example archetypes from upstream |
| `deno task dev` | Build and serve on `http://localhost:5173` |
| `deno task build` | Static site → `dist/` (+ desktop www staging) |
| `deno task test` | Unit tests (`test/`, parallel, no browser) |
| `deno task test:ui` | Playwright UI tests — see [docs/UI_TESTING.md](docs/UI_TESTING.md) |
| `deno task lint` | `deno lint` on `src`, `test`, `scripts` |
| `deno task check` | Type-check TypeScript sources |
| `deno task desktop` | Build + run native window (`deno desktop`) |
| `deno task compile:desktop` | Platform binaries → `dist/release/` |
| `deno task mcp` | Stdio MCP server for IDE agents |
| `deno task release -- --version X.Y.Z` | Bump, tag, push; CI publishes desktop + pinned Pages |
| `deno task wasm:go-template` | Rebuild Go template WASM in `web/wasm/` |
| `deno task setup:better-forms` | Licensed Better Form renderer assets (not committed) |

### GitHub Pages

Every push to `main` deploys the bleeding-edge web shell. `deno task release` also publishes an immutable copy under `/vX.Y/` and updates [versions.json](https://regionstockholm.github.io/intehrgrator/versions.json).

CI checks out **ehrtslib `origin/main`** via `vendor`, so upstream module changes fail tests instead of shipping stale pins.

## Repository layout

| Path | Role |
|------|------|
| `src/core/` | Mapping Model, codegen, persistence, AI prompt/import |
| `src/blockly/` | openEHR blocks, VMS profile, generators |
| `src/workbench/` | UI controller, trees, CodeMirror, mapping spec |
| `src/host/` | `HostAdapter` seam (web + VS Code webview) |
| `src/desktop/` | `deno desktop` entry, Agent API HTTP server |
| `src/agent/` | MCP stdio server |
| `web/` | HTML/CSS entry; bundled to `dist/bundle.js` |
| `test/` | Deno unit tests + fixtures |
| `test/ui/` | Playwright tests (Workbench Test API) |
| `docs/adr/` | Architecture Decision Records |
| `docs/design/` | Design investigations |
| `docs/planning/` | v1 implementation task list (archived chunks in `docs/historical-archive/`) |
| `docs/historical-archive/` | Superseded drafts |

## Architecture docs

| Topic | Document |
|-------|----------|
| **Glossary** (canonical terms) | [CONTEXT.md](CONTEXT.md) |
| **ADRs** (decisions) | [docs/adr/](docs/adr/) |
| UI layout & interactions | [docs/UI_ARCHITECTURE.md](docs/UI_ARCHITECTURE.md) |
| Blockly blocks & generators | [docs/BLOCKLY_INTEGRATION.md](docs/BLOCKLY_INTEGRATION.md) |
| Mapping spec & sync | [docs/MAPPING_SPECIFICATION.md](docs/MAPPING_SPECIFICATION.md) |
| Source formats & XPath | [docs/SOURCE_FORMATS.md](docs/SOURCE_FORMATS.md) · [docs/SOURCE_QUERY.md](docs/SOURCE_QUERY.md) |
| Project persistence | [docs/PROJECT_PERSISTENCE.md](docs/PROJECT_PERSISTENCE.md) |
| AI suggestion format | [docs/AI_SUGGESTION_FORMAT.md](docs/AI_SUGGESTION_FORMAT.md) |
| Agent / MCP workflow | [docs/AGENT_WORKFLOW.md](docs/AGENT_WORKFLOW.md) |
| UI testing | [docs/UI_TESTING.md](docs/UI_TESTING.md) |
| Planning | [GitHub Issues](https://github.com/regionstockholm/intehrgrator/issues) — see [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md) |
| Archived roadmap | [docs/historical-archive/ROADMAP.md](docs/historical-archive/ROADMAP.md) |
| Deferred ideas | [docs/future/](docs/future/) |

## AI-assisted development

### Agent instructions

- **[AGENTS.md](AGENTS.md)** — documentation sources, Deno toolchain, issue tracker, domain docs.
- **[docs/agents/](docs/agents/)** — issue tracker conventions, triage labels, domain modelling.

### Skills (Matt Pocock engineering skills)

The repo ships [Matt Pocock skills](https://github.com/mattpocock/skills) in `.cursor/skills/` and `.agents/skills/` for Cursor and other agents:

```bash
npx skills@latest add mattpocock/skills --agent cursor --skill '*' --yes --copy
```

Useful skills for this project:

| Skill | When |
|-------|------|
| `domain-modeling` | Editing CONTEXT.md or ADRs |
| `implement` / `tdd` | Feature work test-first |
| `diagnosing-bugs` | Hard bugs with runtime evidence |
| `code-review` | Reviewing diffs against standards and spec |
| `triage` | GitHub issue triage |
| `research` | Primary-source investigation |

Project-specific:

| Skill | When |
|-------|------|
| `intehrgrator-mapping` | Driving mappings via desktop Agent API / MCP |

Refresh project skills from the lockfile in `.agents/skills/` when upstream changes.

### Recommended MCP servers

| Server | Purpose |
|--------|---------|
| **DeepWiki** | ehrtslib, archie, openEHR repos — `read_wiki_structure`, `ask_question` |
| **openEHR assistant** | Archetypes, templates, terminology, spec lookup |
| **intEHRgrator** (local) | `deno task mcp` against a running desktop session |

Configure MCP in `.cursor/mcp.json` (see [docs/AGENT_WORKFLOW.md](docs/AGENT_WORKFLOW.md) for the desktop URL).

### Issue tracker

GitHub Issues via `gh`. Conventions: [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md). Triage labels: [docs/agents/triage-labels.md](docs/agents/triage-labels.md).

## Libraries

- [ehrtslib](https://github.com/ErikSundvall/ehrtslib) — openEHR TypeScript (vendored via `deno task vendor`)
- [openEHR-model-examples](https://github.com/Ehrlibs/openEHR-model-examples) — demo templates
- [fontoxpath](https://github.com/FontoXML/fontoxpath) — source XPath evaluation
- [Blockly 11](https://developers.google.com/blockly) + [CodeMirror 6](https://codemirror.net/)
