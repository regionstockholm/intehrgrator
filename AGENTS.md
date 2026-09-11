# Instructions for AI programming agents

## Documentation guidance

- Always prefer reading and analyzing original documentation of latest version
  of libraries and projects rather than random search hits or training data
  that may be of lower quality or based on outdated versions.
- It is good to offload some tasks to external MCP (Model Context Protocol)
  you may need to ask user to add certain MCP servers to your configuration
  (please do ask user if you can not do it yourself).
- Deepwiki.com is a great source for outsourcing analysis of any project on
  github. If possible, delegate your questions about the library to the Deepwiki
  MCP server. Successful connections to the Deepwiki server has been established
  using all the methods described above, so if connection fails stop and ask
  user for help, don't try to invent other ways to call MCP servers. If you are
  a local agent (e.g. Gemini CLI), you should have direct access to the Deepwiki
  MCP tools already (configured by user), if not install that or ask user for help.
  Do NOT proceed without deepwiki access.
- The DeepWiki MCP server offers three main tools:
  1. read_wiki_structure - Get a list of documentation topics for a GitHub
     repository
  2. read_wiki_contents - View documentation about a GitHub repository
  3. ask_question - Ask any question about a GitHub repository and get an
     AI-powered, context-grounded response

## Development process guidance

Use the **Matt Pocock engineering skills** shipped in this repo (`.cursor/skills/`,
`.agents/skills/`). Refresh with:

`npx skills@latest add mattpocock/skills --agent cursor --skill '*' --yes --copy`

Pick the skill that matches the task:

| Skill | Use when |
|-------|----------|
| `domain-modeling` | Editing CONTEXT.md, ADRs, or terminology |
| `implement` | Building a feature from a spec or issue |
| `tdd` | Test-first development |
| `diagnosing-bugs` | Reproducible bugs needing runtime evidence |
| `code-review` | Reviewing changes against standards and spec |
| `triage` | GitHub issue triage |
| `research` | Primary-source investigation → markdown file |
| `prototype` | Throwaway design validation |
| `grilling` | Stress-testing a plan or decision |

Project-specific: `intehrgrator-mapping` for desktop Agent API / MCP mapping work.

For specs and design documents, use `docs/prd/` and `docs/design/`.
Planning lives in **GitHub Issues** ([docs/agents/issue-tracker.md](docs/agents/issue-tracker.md)).
Archived roadmaps and superseded drafts live in `docs/historical-archive/`.

## Development tooling guidance

- When working with Javascript or Typescript based projects prefer using Deno
  for management over using Node.js and NPM. Deno is installed in the local
  environment, but Jules and other agents running in cloud environments might
  need to install Deno in its VM before using it.
- The local environment is a Windows machine without admin privileges,
  Powershell is available. It uses [Scoop](https://scoop.sh/) for package
  installation, so base any advice on that.

## Cursor Cloud specific instructions

- Intended stack (per the PRD/prompt): a local-first TypeScript static web app
  (GitHub Pages "Web Shell") using Blockly + CodeMirror, `ehrtslib` for openEHR
  TypeScript, and `fontoxpath` for source queries; a VS Code extension follows
  later. Per repo preference, this is a **Deno-based** project (not Node/npm).
- `deno` (latest stable, 2.9.0 at setup time) is installed in the VM and on
  `PATH` via `~/.deno/env` (sourced from `~/.bashrc`). Node.js and `pnpm` also
  happen to be present but are not the intended toolchain. Use `deno` for
  install/lint/test/run/build once code exists (e.g. `deno install`,
  `deno lint`, `deno test`, `deno task <name>`).
- Once implementation begins and a `deno.json`/`deno.jsonc` (or `package.json`)
  appears, the startup update script already runs `deno install` to fetch
  dependencies. Until then it is a no-op.
- Go 1.22+ is on PATH in this Cloud Agent image. It is only needed to rebuild
  the vendored Go `text/template` WASM (`deno task wasm:go-template` writes
  `web/wasm/go_texttemplate.wasm` and `wasm_exec.js`). The Web Shell loads
  those files at runtime; ordinary lint/test/run does not need a Go toolchain.
  Rebuild only when `go/texttemplate` changes.

## Agent skills

Matt Pocock engineering skills (`grill-with-docs`, `grilling`, `domain-modeling`,
`implement`, `tdd`, `triage`, …) ship in this repo so Cloud Agents see the same
set as a laptop Cursor install. Canonical copies live in `.cursor/skills/`
(Cursor discovery) and `.agents/skills/` (`npx skills` / skills.sh lockfile).
Refresh with:

`npx skills@latest add mattpocock/skills --agent cursor --skill '*' --yes --copy`

Use lowercase `--agent cursor`. Comma-separated `--skill` lists are not
supported; use `--skill '*'` or repeat `--skill <name>`.

A Cloud Agent VM can also hold a **global** copy under `~/.agents/skills` and
`~/.cursor/skills`. That copy dies with the pod and is **not** shared with other
GitHub repos. Other Cursor Cloud projects need the same repo files, or a saved
environment snapshot of a VM that already ran the global install.

### Issue tracker

GitHub Issues via `gh` (PRs are not a triage request surface). See
`docs/agents/issue-tracker.md`.

### Triage labels

Default role labels: `needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.
