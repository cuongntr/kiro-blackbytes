# kiro-blackbytes — PRD

- **Status**: Accepted
- **Owner**: invoker (project author)
- **Last updated**: 2026-05-29

## 1. Context

Kiro CLI reads user-level configuration from `~/.kiro/` — notably **agents**
(`~/.kiro/agents/<name>.json` plus optional `<name>.md` prompt files),
**prompts** (`~/.kiro/prompts/*.md`, reusable templates invoked via `@name` or
`/prompts name`), and **steering** documents (`~/.kiro/steering/**/*.md`). Today
these are crafted by hand and live only on one machine. There is no first-class
way to package a curated set of these and reinstall it on a new machine, share
it with a teammate, or keep an installed copy in sync as the source evolves.

The author already maintains a working set of agents (`Bytes`, `explore`,
`oracle`, `reviewer`, `librarian`, `general`) and wants them — together with
prompts and steering — to be installable in one command and updatable when the
source changes. Doing this manually (copy files, track which ones, re-copy on
change) is error-prone and does not scale to sharing.

**Why now**: the agent set is stable enough to be worth reusing across machines
and sharing, and npx is the lowest-friction distribution channel (no global
install, always-current).

## 2. Goals & Non-Goals

### Goals (measurable)

- **G1** — A user can install the bundled agents, prompts, and steering into
  `~/.kiro/` with a single command and zero manual file copying.
- **G2** — Re-running install (`update`) after the package version changes
  re-syncs only the files the tool installed, touching **0** user-authored files
  it did not create.
- **G3** — A user can see, in one command (`list`), every item the bundle
  contains and whether each is currently installed.
- **G4** — Time from "fresh machine with Kiro CLI" to "agents available in a new
  chat session" is a single `npx` invocation (< 1 minute, network permitting).

### Non-Goals

- **Skills** — explicitly out. Skills are managed by the separate `npx skills
  add ...` tool for all coding agents; this tool will not install, update, or
  remove skills.
- **Presets / multiple selectable bundles** — out for v1. The package ships one
  bundle. (May revisit later.)
- **MCP (`mcp.json`), hooks** — out for v1.
- **Project-scope `.kiro/`** — out for v1. User scope (`~/.kiro/`) only.
- **Uninstall command** — out for v1.

## 3. Personas

- **P1 — Bundle author (primary)**: maintains the agents, prompts, and steering,
  publishes new versions to npm. Goal: edit source once, publish, and have every
  consumer able to pick up the change via `update`. Pain today: manual copy + no
  record of what was deployed where.
- **P2 — Bundle consumer**: a developer (often the author on a second machine, or
  a teammate) who wants the author's curated agents, prompts, and steering. Goal:
  one command to get a working setup. Pain today: must be handed files and told
  where to put them; unsure what they got or whether it is current.

## 4. User Journeys

### J1 — First-time install (P2)

1. Consumer has Kiro CLI installed and an empty or populated `~/.kiro/`.
2. Runs `npx kiro-blackbytes` (defaults to `init`).
3. Tool writes the bundle's agents into `~/.kiro/agents/`, prompts into
   `~/.kiro/prompts/`, and steering into `~/.kiro/steering/`, creating
   directories as needed.
4. Tool records what it installed in a lockfile and prints a summary (N agents,
   P prompts, M steering files installed).
5. Consumer opens a new Kiro chat session; the agents are available.

### J2 — Update after a new version (P1/P2)

1. A new package version is published with edited/added agents.
2. Consumer runs `npx kiro-blackbytes update`.
3. Tool compares the lockfile against the new bundle, overwrites the files it
   owns, adds newly introduced files, and reports what changed (added / updated /
   unchanged).
4. Files the user authored themselves (not in the lockfile) are untouched.

### J3 — Inspect before/after (P2)

1. Consumer runs `npx kiro-blackbytes list`.
2. Tool prints every item in the bundle (agents, prompts, steering) and an
   install-status marker for each (installed / not installed / version differs),
   plus the bundle version.

## 5. Functional Requirements

| ID | Priority | Requirement | Acceptance Criteria |
|---|---|---|---|
| REQ-001 | P0 | `init` (default command) installs all bundled agents, prompts, and steering into `~/.kiro/`. | Running `npx kiro-blackbytes` with an empty `~/.kiro/` results in every bundled agent `.json` (+ its `.md`) present in `~/.kiro/agents/`, every bundled prompt `.md` present in `~/.kiro/prompts/`, and every bundled steering `.md` present under `~/.kiro/steering/`, with identical content to the source. Missing target directories are created. |
| REQ-002 | P0 | `init`/`update` overwrites files the tool previously installed, but never deletes or overwrites files it did not install. | Given a user-authored `~/.kiro/agents/mine.json` not in the bundle, after `init` and `update` that file is byte-for-byte unchanged. Given a bundled `Bytes.json` the user later hand-edited, `update` overwrites it back to the bundled content (override semantics, per scope decision). |
| REQ-003 | P0 | The tool records what it installed in a lockfile at `~/.kiro/.kiro-blackbytes.json`. | After `init`, the lockfile exists and lists the package version and the relative path of every file the tool wrote. |
| REQ-004 | P0 | `update` re-syncs installed files to the current package version and reports a per-file outcome. | After bumping the bundle and running `update`, changed bundled files are overwritten, newly added bundled files are written, and the command output classifies each file as added / updated / unchanged. The lockfile reflects the new version and current file set. |
| REQ-005 | P0 | `list` shows bundle contents and install status. | Output enumerates each bundled agent, prompt, and steering file, marks each as installed or not (based on the lockfile / target presence), and shows the bundle version. Exit code 0. |
| REQ-006 | P1 | All commands are safe to run repeatedly (idempotent) and never touch paths outside `~/.kiro/`. | Running `init` twice in a row produces the same `~/.kiro/` state and lockfile. No file outside `~/.kiro/` is written by any command. |
| REQ-007 | P1 | Commands fail clearly and non-destructively on error (e.g. unwritable `~/.kiro/`, malformed lockfile). | On a write/permission error the tool exits non-zero with a human-readable message and does not leave a partially-written lockfile that misrepresents disk state. |

## 6. Non-Functional Requirements

- **Performance**: install/update of a few dozen small files completes in well
  under a second on local disk. No specific throughput target beyond "feels
  instant".
- **Security**: the tool writes only within `~/.kiro/`. It does not execute
  bundled content, make network calls of its own (delivery is via npm/npx), or
  read credentials. Bundled files are static data shipped in the package.
- **Availability / distribution**: distributed via npm; availability is npm's.
  No runtime service.
- **Compatibility**: runs under the Node.js version range declared in
  `package.json` `engines`; cross-platform path handling (macOS/Linux/Windows
  home dir).
- **Reliability**: lockfile writes are atomic enough that an interrupted run does
  not corrupt the lockfile (write-temp-then-rename or equivalent — detailed in
  design).

## 7. Boundaries & Dependencies

- **Depends on**: Kiro CLI's `~/.kiro/` layout conventions (agents, prompts,
  steering); Node.js + npm/npx as the runtime and delivery channel.
- **Does NOT own**: the agent/prompt/steering *content schema* (owned by Kiro
  CLI), the `~/.kiro/skills/` tree (owned by `npx skills add`), `mcp.json`,
  hooks, or any project-scope `.kiro/`.
- **Interaction with skills tool**: must not write under `~/.kiro/skills/` so it
  never conflicts with `npx skills add`.

## 8. Roadmap

### Phase 1 MVP (this PRD)

- `init` (default), `update`, `list` commands.
- Agents (`.json` + `.md`), prompts (`.md`), and steering (`.md`) into
  `~/.kiro/` (user scope).
- Lockfile-tracked override-on-write.
- Versioned by npm package version.
- **Exit criteria**: REQ-001 … REQ-007 met and verified; published to npm and
  installable via `npx kiro-blackbytes`.

### Phase 2 (candidate, not committed)

- Presets / multiple selectable bundles.
- Project-scope `.kiro/` target.
- Additional config types (MCP merge, hooks).
- `uninstall` / `diff` commands.
- **Exit criteria**: defined when/if Phase 2 is picked up.

## 9. Open Questions

| ID | Question | Owner | Status |
|---|---|---|---|
| Q-001 | On `update`, if a bundled file was removed from the source in a new version, should the tool delete the previously-installed copy? | invoker | Deferred — v1 leaves orphaned files in place and notes them in `list`; revisit if it causes confusion. |
| Q-002 | Should `update` warn before overwriting a bundled file the user has locally modified, or override silently? | invoker | Answered — override silently per the locked "override" decision; document the behavior so it is not surprising. |
| Q-003 | Interactive prompts (e.g. confirm scope) vs fully non-interactive? | invoker | Answered — v1 is non-interactive (single user scope, single bundle); no prompts needed. |

## 10. Revision History

| Date | Author | Change |
|---|---|---|
| 2026-05-29 | invoker (via feature-workflow) | Initial PRD. Scope locked to agents + steering into `~/.kiro/`, commands init/update/list, lockfile-tracked override, no presets/skills. |
| 2026-05-29 | invoker (via feature-workflow) | Added **prompts** (`~/.kiro/prompts/*.md`) as a third installed config type ("command" = prompts). Updated G1, personas, journeys, REQ-001/005, boundaries, Phase 1 scope. |
