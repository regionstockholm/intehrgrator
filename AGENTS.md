# Instructions for AI programming agents

## Documentation guidance

- Always prefer reading and analyzing original documentation of latest version
  of libraries and projects rather than random search hits or training data 
  that may be of lower quality or based on outdated versions.
- It is good to offload some tasks to external MCP (Model Context Protocol)
  you may need to ask user to add certain MCP servers to you configuration 
  (please do ask user if you can not to it yourself).
- Deepwiki.com is a great source for outsourcing analysis of any project on
  github. If possible, delegate your questions about the library to the Deepwiki
  MCP server. Successful connections to the Deepwiki server has been established
  using all the methods described above, so if conenction fails stop and ask
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

- If asked to make a `PRD` (Product Requirements Document) based on a prompt,
  then follow the instructions in
  https://raw.githubusercontent.com/snarktank/ai-dev-tasks/refs/heads/main/create-prd.md
- If asked to create a `task list` then look in the /tasks subdirectory for a
  PRD file to base it on. If there are several PRD files that don't already have
  associated task lists, then ask user for disambiguation. Then follow
  instructions in
  https://raw.githubusercontent.com/snarktank/ai-dev-tasks/refs/heads/main/generate-tasks.md
  using the PRD file as input. Refer to PRD in task list document.
- Put PRDs and task lists in a /tasks subdirectory
- The task list file(s) should contain a section called "Instructions for
  Completing Tasks" with the following content:

```
**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps. 
Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task. If implementation steps happen to fulfil several things at once then ticking off several boxes is OK.

If running in interactive mode (e.g. Gemini CLI) then stop after each parent task and let user review. If running in autonomus batch mode e.g. dispatched to Jules, then just stop if user input is crucial in order to understand further steps.
```

## Development tooling guidance

- When working with Javascript or Typescript based projects prefer using Deno
  for management over using Node.js and NPM. Deno is installed in the local
  environment, but Jules and other agents runnunf in cloud environments might
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
