# kiro-blackbytes — Technical Design

- **Status**: Active
- **Owner**: invoker
- **Source PRD**: [kiro-blackbytes-prd.md](../product/kiro-blackbytes-prd.md)
- **Related ADRs**: none yet (greenfield; no ADR repository). Decisions captured
  inline in §10.
- **Last updated**: 2026-05-29

## 1. Boundaries

**This design owns**: the npx CLI (`init`/`update`/`list`), the bundle layout
shipped inside the package, the lockfile schema at `~/.kiro/.kiro-blackbytes.json`,
and the copy/override/sync algorithm.

**Does NOT own**: the content schema of agents/prompts/steering (owned by Kiro
CLI), `~/.kiro/skills/` (owned by `npx skills add`), `mcp.json`, hooks, and any
project-scope `.kiro/`. The tool must never write outside `~/.kiro/` and never
under `~/.kiro/skills/`.

## 2. Architecture

A single small Node CLI, compiled from TypeScript, published to npm with a `bin`
entry so `npx kiro-blackbytes` runs it. No runtime services, no network calls of
its own.

```
                 npx kiro-blackbytes [command]
                              │
                       ┌──────▼──────┐
                       │  cli.ts     │  arg parse → dispatch (default: init)
                       └──────┬──────┘
              ┌───────────────┼───────────────┐
        ┌─────▼────┐    ┌─────▼─────┐    ┌─────▼────┐
        │ init     │    │ update    │    │ list     │   commands/
        └─────┬────┘    └─────┬─────┘    └─────┬────┘
              └──────┬────────┴────────┬───────┘
              ┌──────▼──────┐   ┌──────▼───────┐
              │ bundle.ts   │   │ lockfile.ts  │   core
              │ (read src)  │   │ (read/write) │
              └──────┬──────┘   └──────┬───────┘
                     └────────┬────────┘
                       ┌──────▼──────┐
                       │ installer.ts│  sync(plan) → fs writes under ~/.kiro
                       └─────────────┘
```

**Components**

| Module | Responsibility |
|---|---|
| `cli.ts` | Parse argv, select command (default `init`), map errors → exit code + message. |
| `commands/init.ts` | Full install of the bundle into `~/.kiro/`. |
| `commands/update.ts` | Re-sync installed files to current bundle; classify per-file outcome. |
| `commands/list.ts` | Enumerate bundle items + install status; print. |
| `bundle.ts` | Discover the bundled files shipped in the package; expose them as a typed list of `BundleFile`. |
| `lockfile.ts` | Read/parse/validate/atomically write `~/.kiro/.kiro-blackbytes.json`. |
| `installer.ts` | Given a list of `BundleFile`s, write them to their targets (mkdir -p, copy), return outcomes. Pure-ish: takes resolved paths. |
| `paths.ts` | Resolve `~/.kiro/` and per-type target dirs; home-dir + cross-platform. |

`init` and `update` share the same install primitive; they differ only in how
they treat the prior lockfile (see §6).

## 3. Bundle layout (inside the published package)

Static data shipped in the npm tarball, rooted at `bundle/`:

```
bundle/
├── agents/
│   ├── bb.json
│   ├── bb.md
│   ├── bb-explore.json
│   ├── bb-explore.md
│   └── ...                  (each agent: <name>.json, optional <name>.md)
├── prompts/
│   └── *.md
└── steering/
    └── **/*.md              (may be nested)
```

The bundle is enumerated at runtime by walking these three directories relative
to the package root (resolved from the compiled file location). No manifest file
is required in the bundle — the directory tree *is* the manifest. Each discovered
file maps to a target by type:

| Bundle subdir | Target dir | Match |
|---|---|---|
| `agents/` | `~/.kiro/agents/` | `*.json`, `*.md` (flat) |
| `prompts/` | `~/.kiro/prompts/` | `*.md` (flat) |
| `steering/` | `~/.kiro/steering/` | `**/*.md` (recursive, preserve relative subpath) |

`BundleFile = { type: "agents" | "prompts" | "steering", relPath: string, absSource: string, target: string }`
where `relPath` is relative to the type's target dir (so steering nesting is
preserved) and `target` is the absolute destination under `~/.kiro/`.

## 4. Lockfile schema

Path: `~/.kiro/.kiro-blackbytes.json`. JSON, written atomically (temp file in the
same dir + `rename`). It is the record of "files this tool owns".

```json
{
  "schema": 1,
  "version": "1.2.0",
  "updatedAt": "2026-05-29T06:56:00.000Z",
  "files": [
    "agents/bb.json",
    "agents/bb.md",
    "prompts/review.md",
    "steering/global/style.md"
  ]
}
```

| Field | Type | Meaning |
|---|---|---|
| `schema` | int | Lockfile format version (this design = `1`). Guards future format changes. |
| `version` | string | npm package version that last wrote the lockfile (the bundle version). |
| `updatedAt` | ISO‑8601 string | Timestamp of the last write. |
| `files` | string[] | Relative paths (relative to `~/.kiro/`) of every file the tool installed. The ownership set. |

**Ownership rule**: a file under `~/.kiro/` is "tool-owned" iff its relative path
is in `files`. Only tool-owned files may be overwritten by `update`; everything
else is untouched (REQ-002). `files` paths use `/` separators and are stored
relative to `~/.kiro/` so they are stable across OSes.

**Validation on read**: if the lockfile is missing → treat as "nothing
installed" (empty set). If present but unparseable or `schema` unknown → fail
with a clear message (REQ-007) rather than guessing, so we never mis-attribute
ownership.

## 5. CLI interface

| Invocation | Command | Behavior |
|---|---|---|
| `npx kiro-blackbytes` | `init` (default) | Install all bundled files; write lockfile. |
| `npx kiro-blackbytes init` | `init` | Same as above. |
| `npx kiro-blackbytes update` | `update` | Re-sync to current bundle; report added/updated/unchanged; rewrite lockfile. |
| `npx kiro-blackbytes list` | `list` | Print bundle items + per-item status + bundle version. |
| `npx kiro-blackbytes --help` / unknown | help | Print usage; unknown command → usage + non-zero exit. |

No flags in v1 (non-interactive, single user scope, single bundle — Q-003).
Output is plain text to stdout; errors to stderr. Exit `0` on success, non-zero
on error.

**`list` status semantics** per item (compares bundle ⨉ disk ⨉ lockfile):

- `installed` — target file exists and is in the lockfile.
- `not installed` — bundle has it, target missing.
- `modified` — target exists, in lockfile, but content differs from the bundle
  (i.e. user hand-edited; `update` would revert it).
- `orphaned` — in the lockfile but no longer in the bundle (left in place per
  Q-001; surfaced here for visibility).

## 6. Core algorithm: sync

`init` and `update` are the same sync with a different starting ownership set.

```
sync(mode):
  prevLock   = lockfile.read()           # {} if absent
  bundle     = bundle.enumerate()        # BundleFile[]
  outcomes   = []
  newFiles   = []

  for f in bundle:
    targetExists = fs.exists(f.target)
    if not targetExists:
      write(f); outcomes += (f, ADDED)
    else:
      if mode == init and f.rel not in prevLock.files:
        # first install over a pre-existing non-owned file → override (per decision)
        write(f); outcomes += (f, OVERWRITTEN)
      else if contentDiffers(f):
        write(f); outcomes += (f, UPDATED)
      else:
        outcomes += (f, UNCHANGED)
    newFiles += f.rel

  # orphans: in prevLock.files but not in current bundle → leave in place (Q-001)
  orphans = prevLock.files - bundleRelPaths
  for o in orphans: outcomes += (o, ORPHANED)   # reported, not deleted

  lockfile.write({schema:1, version: pkgVersion, updatedAt: now, files: newFiles})
  return outcomes
```

`write(f)` = `mkdir -p dirname(target)` then copy source → target (overwrite).
Writes are best-effort sequential; on any write error the command aborts
(REQ-007) — but the lockfile is only written **after** all file writes succeed,
and atomically, so an aborted run never leaves a lockfile that overstates what is
on disk. (Already-written files from a partial run remain; re-running is
idempotent and converges.)

`contentDiffers(f)` = byte comparison of source vs target (small files; read both
and compare). Used to classify UPDATED vs UNCHANGED and to detect `modified` in
`list`.

**init vs update difference**: practically identical. `init` is "install,
overriding anything in the way"; `update` is "re-sync owned files to the new
version". Because override-on-write is the chosen policy, both overwrite
conflicting bundled files. The only behavioral nuance is reporting (init reports
a fresh install summary; update reports a diff). Keeping one primitive avoids
divergence.

## 7. Security & safety

- **Write scope**: all targets are computed by joining the resolved `~/.kiro/`
  root with a per-type subdir. `installer` asserts each resolved target path is
  inside `~/.kiro/` and not inside `~/.kiro/skills/` before writing; a path that
  escapes (e.g. via unexpected `..` in a steering relPath) aborts the run. This
  enforces the PRD boundary structurally, not just by convention.
- **No execution**: bundled files are copied as data; never executed or
  evaluated.
- **No network**: the tool itself makes no network calls. Delivery is npm/npx.
- **No secrets**: the tool reads only the bundle (its own package) and the
  lockfile; it does not read user credentials.

## 8. Reliability

- **Atomic lockfile write**: write to `~/.kiro/.kiro-blackbytes.json.tmp` then
  `fs.rename` over the target (atomic on same filesystem). Guards against a
  corrupt lockfile on interruption (REQ-007, NFR reliability).
- **Idempotency**: re-running `init` or `update` converges to the same disk +
  lockfile state (REQ-006). Achieved because sync is a function of (bundle, disk)
  and always rewrites the full `files` list.
- **Failure isolation**: file copy errors abort before the lockfile is updated,
  so the lockfile never claims ownership of a file that failed to write.

## 9. Testing strategy

Test runner: **node:test** (built-in, zero extra deps) — fits the
minimal-dependency goal. Alternative `vitest` noted in §10.

- **Unit**
  - `lockfile`: read-missing → empty; parse valid; reject bad `schema`/JSON;
    atomic write round-trips.
  - `bundle`: enumeration maps the three subdirs to correct types/targets;
    steering nesting preserved; non-`.md`/`.json` ignored.
  - `paths`: home resolution; path-escape assertion rejects `..` and
    `skills/` targets.
  - `sync` (the core): drive against a **temp `KIRO_HOME`** (see below) with
    fixture bundles. Cases: empty home → all ADDED; re-run → all UNCHANGED;
    user-authored file not in bundle → untouched; hand-edited owned file →
    UPDATED/OVERWRITTEN; bundle file removed → ORPHANED, left on disk.
- **Integration**: invoke the built CLI end-to-end against a temp home dir;
  assert exit codes, stdout summaries, and resulting file tree for
  `init` → `update` → `list`.

**Test seam**: `paths.ts` resolves the Kiro home from an injectable base
(env override `KIRO_HOME` or an explicit arg in tests) instead of hard-coding
`os.homedir()`. This lets every test run fully isolated in a `mkdtemp` dir with
no mocking of `fs`. Production default remains `~/.kiro/`.

## 10. Key decisions (inline, no ADR repo yet)

| # | Decision | Rationale | Alternative considered |
|---|---|---|---|
| D1 | Self-contained bundle inside the package (Model A), no registry. | Ships immediately; bundle version = package version. | External versioned bundle packages (Model B) — deferred to Phase 2. |
| D2 | Directory tree is the manifest (no `bundle.json`). | Less to keep in sync; adding a file = dropping it in the right dir. | Explicit manifest — more ceremony, redundant for v1. |
| D3 | Lockfile records relative paths only (ownership set). | Minimal, portable across OSes, enough to honor "never touch non-owned files". | Store hashes/timestamps — not needed; content compare is cheap for small files. |
| D4 | One `sync` primitive for init+update. | Avoids drift between two near-identical code paths. | Separate implementations — duplication risk. |
| D5 | `node:test` + no runtime deps for core. | Matches minimal-footprint goal; faster `npx` cold start. | `vitest`/`commander`/`fs-extra` — heavier; revisit only if arg parsing grows. |
| D6 | Path-containment assertion in installer. | Structurally enforces "only inside ~/.kiro, never skills/". | Trust-by-convention — weaker, risk of escaping writes. |

## 11. MVP scope summary

**In (Phase 1)**: `init`/`update`/`list`; agents+prompts+steering → `~/.kiro/`;
lockfile-tracked override; atomic lockfile; path-containment safety; node:test
unit+integration.

**Out (Phase 2+)**: presets, project scope, MCP/hooks, uninstall/diff, orphan
deletion, interactive prompts, external bundle registry.

## 12. Open Questions

| ID | Question | Owner | Status |
|---|---|---|---|
| DQ-001 | Arg parsing: hand-rolled switch vs a tiny parser lib? | invoker | Answered — hand-rolled for 3 commands + `--help` (D5); revisit if flags grow. |
| DQ-002 | `node:test` vs `vitest`? | invoker | Answered — node:test for zero deps (D5). Reopen if richer assertions/watch needed. |
| DQ-003 | Should `list` byte-compare every file (cost) or trust lockfile presence? | invoker | Answered — byte-compare; files are few and small, enables the `modified` status. |

## 13. Revision History

| Date | Author | Change |
|---|---|---|
| 2026-05-29 | invoker (via feature-workflow) | Initial design. Bundle layout, lockfile schema (v1), sync algorithm, path-containment safety, node:test strategy with KIRO_HOME seam. |
