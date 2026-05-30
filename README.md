# kiro-blackbytes

Install, update, and list a curated bundle of reusable [Kiro](https://kiro.dev) settings —
**agents**, **prompts**, and **steering** — into your user-level `~/.kiro/` directory.

The bundle ships inside this package, so it is versioned by the npm package version. No
network calls, no configuration, no runtime dependencies.

The agents form an orchestrator-plus-subagents set: `Bytes` routes work to five focused
subagents (`explore`, `oracle`, `librarian`, `reviewer`, `general`) or handles it directly.
The prompts and steering files give every Kiro session a shared review template and a
baseline set of engineering conventions.

## Usage

```bash
# Install the bundle (default command)
npx kiro-blackbytes
npx kiro-blackbytes init

# Re-sync to the bundle shipped with the installed version
npx kiro-blackbytes update

# Show what the bundle contains and the status of each item
npx kiro-blackbytes list

# Help
npx kiro-blackbytes --help
```

## What gets installed

Files are written under your Kiro home (`~/.kiro/` by default):

| Type     | Target                  | Files            |
| -------- | ----------------------- | ---------------- |
| agents   | `~/.kiro/agents/`       | `*.json`, `*.md` |
| prompts  | `~/.kiro/prompts/`      | `*.md`           |
| steering | `~/.kiro/steering/**/`  | `*.md`           |

The tool **never** writes under `~/.kiro/skills/` and never writes outside your Kiro home.
Skills are managed separately (e.g. `npx skills add`).

## Agents

`Bytes` is the orchestrator. It holds the `subagent` tool and routes each task to the
specialized subagent that fits, runs up to four in parallel, or handles small work itself.
The five subagents are scoped to exactly the tools their role needs:

| Agent       | Role                  | Access                                   | Model | Spawn |
| ----------- | --------------------- | ---------------------------------------- | ----- | ----- |
| `Bytes`     | Orchestrator          | Read/write/shell + `subagent` (interactive) | `auto` | — |
| `explore`   | Codebase exploration  | Read-only + read-only `shell` (git, ls, find) | `claude-haiku-4.5` | Trusted |
| `oracle`    | Reasoning & analysis  | Read-only (no shell, no web)             | `claude-opus-4.8` | Trusted |
| `reviewer`  | Code review + verdict | Read-only + read-only `git` shell        | `claude-opus-4.8` | Trusted |
| `librarian` | External research     | Web search/fetch only, no local files    | `claude-sonnet-4.6` | Approval |
| `general`   | Implementation executor | Full read/write/shell, no `subagent`   | `claude-sonnet-4.6` | Approval |

**Spawn approval.** `explore`, `oracle`, and `reviewer` are *trusted* — `Bytes` spawns them
without prompting. `librarian` and `general` require explicit user approval to spawn,
because they reach the network or modify files.

**Subagent tool access.** A spawned subagent runs non-interactively: a tool that needs
approval makes it fail fast rather than pause for a prompt. Every subagent therefore
auto-approves exactly the tools it is allowed to use (`allowedTools` equals `tools`). The
read-only `explore` and `reviewer` agents restrict `shell` to a regex allowlist of
read-only commands with `denyByDefault` so writes are blocked, not merely prompted. `Bytes`
is the exception: it runs interactively, so its write/shell tools prompt for confirmation
as usual.

**Model selection.** Each agent pins a Kiro model ID matched to its job: the high-volume
read-only `explore` runs on cheap `claude-haiku-4.5`; the judgment-heavy `oracle` and
`reviewer` run on `claude-opus-4.8`; the executor `general` and the research `librarian`
run on balanced `claude-sonnet-4.6`; and the `Bytes` orchestrator uses `auto` to let Kiro
route each turn. Kiro has no separate reasoning-effort setting — model choice *is* the
reasoning-depth control. An unknown model ID falls back to the default with a warning, so
the agents-schema test pins every shipped ID to a confirmed allowlist.

**Skills.** Kiro auto-loads skills only into its built-in `kiro_default` agent, so the
custom agents in this bundle would otherwise have no skill access. Every agent that can
touch local context therefore declares `"skill://~/.agents/skills/**/SKILL.md"` in its
`resources`, which loads each skill's name + description at startup and the full `SKILL.md`
on demand (progressive disclosure). Only `librarian` omits it — it is external-only by
design and reaches no local files. The path points at `~/.agents/skills/` (the canonical
skill store that `~/.kiro/skills/` symlinks back to), so it resolves the same regardless of
workspace. Drop new skills there and they become available to every skill-enabled agent
with no config change.

## Prompts and steering

- `review` (`~/.kiro/prompts/review.md`) — a code-review template that groups findings by
  High / Medium / Low severity and ends with a one-line verdict. Invoke it with `@review`
  or `/prompts review` in a Kiro session.
- `engineering-conventions` (`~/.kiro/steering/engineering-conventions.md`) — global
  steering with baseline engineering defaults (small reversible changes, match existing
  style, test alongside behavior, secure-by-default). Kiro loads it automatically in every
  session.

## Ownership and the lockfile

Installed files are tracked in `~/.kiro/.kiro-blackbytes.json` (the lockfile). It records the
package version and the list of files this tool owns.

`update` uses an **override** policy:

- Files in the bundle are written over their targets — **including files you have edited
  locally**. If you customize a bundled file, `update` will restore the bundled version.
  Run `list` first to see which files show as `modified`.
- Files you authored yourself that are **not** part of the bundle are never touched.
- Files that were previously installed but are no longer in the bundle become **orphaned**.
  They are reported but left on disk; the tool never deletes them.

Use `list` to inspect status before updating:

| Marker | Status        | Meaning                                          |
| ------ | ------------- | ------------------------------------------------ |
| `✓`    | installed     | present and identical to the bundle              |
| ` `    | not installed | in the bundle, not yet on disk                   |
| `~`    | modified      | installed but locally changed (update overwrites)|
| `!`    | orphaned      | owned previously, no longer in the bundle        |

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm run lint    # biome
npm test        # build + node --test
```

Tests resolve the Kiro home from the `KIRO_HOME` environment variable and the bundle root from
`KIRO_BLACKBYTES_BUNDLE`, so they run fully isolated from your real `~/.kiro/`.

## License

MIT
