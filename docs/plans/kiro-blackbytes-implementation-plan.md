# kiro-blackbytes — Implementation Plan (Phase 1 MVP)

- **Status**: Active
- **Owner**: invoker
- **PRD**: [kiro-blackbytes-prd.md](../product/kiro-blackbytes-prd.md)
- **Technical Design**: [kiro-blackbytes.md](../design/kiro-blackbytes.md)
- **Related ADRs**: none (decisions inline in design §10, D1–D6)
- **Last updated**: 2026-05-29

## MVP-Lock

**In Phase 1 MVP** — REQ-001 … REQ-007 (all):

- `init` (default), `update`, `list` commands.
- Install agents (`.json`+`.md`), prompts (`.md`), steering (`**/*.md`) into
  `~/.kiro/` (user scope only).
- Lockfile-tracked override-on-write (`~/.kiro/.kiro-blackbytes.json`, schema 1).
- Atomic lockfile write; path-containment safety (never outside `~/.kiro/`, never
  under `~/.kiro/skills/`).
- node:test unit + integration; TypeScript + Biome; npm `bin` for `npx`.

**Out of phase** (do not build now): presets, project scope, MCP/hooks, uninstall,
diff, orphan deletion, interactive prompts, external bundle registry. Orphaned
files are reported, never deleted (Q-001).

**Exit criteria**: all REQ AC verified by tests; `npm run build` + `npm test` +
Biome pass clean; `npx .` (or packed tarball) performs `init`/`update`/`list`
against a temp `KIRO_HOME` exactly as the design's flows describe; README documents
the three commands and the override behavior (Q-002).

## Work breakdown

Hierarchy: **EPIC → TASK (leaf)**. Each leaf is sized ≤ ~1 day and self-contained.
IDs are stable for delta-change reference.

```
E1 Project scaffold & tooling
  T-001 Initialize npm package + TS + Biome
  T-002 Build & bin wiring for npx
E2 Core library
  T-003 paths.ts — home resolution + containment assert
  T-004 lockfile.ts — read/validate/atomic-write
  T-005 bundle.ts — enumerate bundle into BundleFile[]
  T-006 installer.ts — write + sync primitive
E3 Commands & CLI
  T-007 commands/init + update (sync wrappers + reporting)
  T-008 commands/list (status computation + output)
  T-009 cli.ts — arg dispatch + help + exit codes
E4 Bundle content & packaging
  T-010 Seed bundle/ with real agents + sample prompt/steering
  T-011 package.json files/bin so bundle ships in tarball; pack smoke test
E5 Tests & docs
  T-012 Unit tests (paths, lockfile, bundle)
  T-013 Sync unit tests (all outcomes via temp KIRO_HOME)
  T-014 Integration tests (built CLI end-to-end) + README
```

## Dependencies

- T-002 → T-001
- T-003, T-004, T-005 → T-001 (need scaffold) — independent of each other
- T-006 → T-003, T-004, T-005 (sync uses all three)
- T-007 → T-006
- T-008 → T-004, T-005 (status needs lockfile + bundle); also reads design list semantics
- T-009 → T-007, T-008
- T-010 → T-005 (layout defined) — content can be seeded in parallel once layout known
- T-011 → T-002, T-010
- T-012 → T-003, T-004, T-005
- T-013 → T-006
- T-014 → T-009, T-011

No cycles. **Bottlenecks** (block many): T-001 (everything), T-006 (all commands),
T-005 (installer + list + content). Prioritize these.

## Leaf tasks

---

### T-001 — Initialize npm package with TypeScript + Biome
**Epic**: E1. **Depends on**: none. **Est**: ~0.5d.

Set up the project skeleton: `package.json` (name `kiro-blackbytes`, `type:
"module"`, `engines.node`), TypeScript config compiling `src/` → `dist/` (ESM,
NodeNext), and Biome for lint+format. No app logic yet.

**Files**: `package.json`, `tsconfig.json`, `biome.json`, `.gitignore`,
`src/index.ts` (placeholder).
**AC**:
- `npm install` succeeds with no runtime dependencies (devDeps: typescript,
  @biomejs/biome, @types/node).
- `npx tsc --noEmit` passes on the placeholder.
- `npx biome check .` passes.
- `package.json` has scripts: `build` (tsc), `lint` (biome check), `test`
  (node --test, wired in T-012+).
**DoD**: scaffold committed; build + lint run clean; no source logic beyond
placeholder.
**Ref**: design §2 (modules), §10 D5 (zero runtime deps), stack TS+Biome.

---

### T-002 — Build output + `bin` wiring for npx
**Epic**: E1. **Depends on**: T-001. **Est**: ~0.5d.

Make the package executable via `npx kiro-blackbytes`. Compiled entry gets a
shebang and is referenced by `bin`. Confirm the binary runs after build.

**Files**: `package.json` (`bin`, `files`), `src/cli.ts` (shebang
`#!/usr/bin/env node` + temporary "ok" output), `tsconfig.json` if entry path
changes.
**AC**:
- `package.json` `bin` maps `kiro-blackbytes` → `dist/cli.js`.
- After `npm run build`, `node dist/cli.js` runs and exits 0.
- Shebang present in compiled `dist/cli.js`.
**DoD**: `npm run build` produces an executable `dist/cli.js`; running it prints a
placeholder and exits 0.
**Ref**: design §2, §5 (CLI interface).

---

### T-003 — `paths.ts`: home resolution + containment assertion
**Epic**: E2. **Depends on**: T-001. **Est**: ~0.5d.

Resolve the Kiro home dir and per-type target dirs, with a test seam and a safety
assertion. Home = `process.env.KIRO_HOME` if set, else `path.join(os.homedir(),
".kiro")`. Provide target dirs for `agents`/`prompts`/`steering`, the lockfile
path, and an `assertInsideKiroHome(target)` that throws if the resolved path is
not within the Kiro home OR is within `<home>/skills/`.

**Files**: `src/core/paths.ts`.
**AC**:
- `kiroHome()` honors `KIRO_HOME` then falls back to `~/.kiro`.
- `targetDir("agents"|"prompts"|"steering")` returns the correct absolute paths.
- `lockfilePath()` = `<home>/.kiro-blackbytes.json`.
- `assertInsideKiroHome` throws for a path containing `..` that escapes home and
  for any path under `<home>/skills/`; passes for normal targets.
**DoD**: module + types exported; covered by T-012.
**Ref**: design §7 (safety, D6), §9 (test seam KIRO_HOME).

---

### T-004 — `lockfile.ts`: read / validate / atomic write
**Epic**: E2. **Depends on**: T-001. **Est**: ~0.5d.

Read and write `~/.kiro/.kiro-blackbytes.json` (schema 1). Missing file → empty
ownership (`{files:[]}`-equivalent). Present but invalid JSON or unknown `schema`
→ throw a clear error. Write atomically (write `<path>.tmp`, then `rename`).

**Files**: `src/core/lockfile.ts`.
**AC**:
- `read()` returns an empty-ownership result when the file is absent.
- `read()` parses a valid lockfile into `{schema, version, updatedAt, files[]}`.
- `read()` throws a descriptive error on malformed JSON or `schema !== 1`.
- `write({version, files})` sets `schema:1` and a fresh ISO `updatedAt`, writes
  via temp+rename, and round-trips through `read()`.
- `files` stored with `/` separators.
**DoD**: module + types; covered by T-012.
**Ref**: design §4 (schema), §8 (atomic write), REQ-003, REQ-007.

---

### T-005 — `bundle.ts`: enumerate bundle into `BundleFile[]`
**Epic**: E2. **Depends on**: T-001. **Est**: ~0.5d.

Walk the shipped `bundle/` dir (resolved relative to the compiled module location)
and produce `BundleFile[]`. `agents/`: `*.json` + `*.md` (flat). `prompts/`:
`*.md` (flat). `steering/`: `**/*.md` (recursive, preserve relative subpath).
Ignore other extensions. Each `BundleFile = {type, relPath, absSource, target}`
where `relPath` is relative to the type's target dir and `target` is the absolute
destination resolved via `paths.ts`.

**Files**: `src/core/bundle.ts`.
**AC**:
- Returns one entry per matching file across the three subdirs.
- Steering nesting preserved in `relPath` and `target`.
- Non-`.md`/`.json` files (and stray files at `bundle/` root) are ignored.
- `relPath` is bundle-type-relative; lockfile-style rel path (`agents/bb.json`)
  derivable.
- Resolves correctly whether run from `dist/` or via npx (bundle path anchored to
  package root, not cwd).
**DoD**: module + types; covered by T-012 with a fixture bundle.
**Ref**: design §3 (bundle layout, BundleFile), D2.

---

### T-006 — `installer.ts`: write + `sync` primitive
**Epic**: E2. **Depends on**: T-003, T-004, T-005. **Est**: ~1d.

Implement the core `sync(mode)` from design §6 and the low-level `write(file)`.
`write` calls `assertInsideKiroHome(target)`, `mkdir -p` the dir, then copies
source→target (overwrite). `sync` enumerates the bundle, compares against disk +
prior lockfile, classifies each file (ADDED / OVERWRITTEN / UPDATED / UNCHANGED),
computes ORPHANED (in prior lockfile, not in bundle — left in place), then writes
the lockfile **only after all copies succeed**. Returns the outcome list.

**Files**: `src/core/installer.ts`.
**AC**:
- Empty home → every bundle file ADDED; lockfile lists them all.
- Re-run with no changes → all UNCHANGED; lockfile unchanged in `files`.
- A user-authored file not in the bundle is never read/written/listed.
- A bundled file hand-edited on disk → UPDATED (content restored to bundle).
- A file in prior lockfile but absent from bundle → ORPHANED, still on disk.
- A copy error aborts before lockfile write (lockfile not updated).
- `contentDiffers` is a byte comparison.
**DoD**: module + types; fully covered by T-013.
**Ref**: design §6 (algorithm), §8 (reliability), REQ-001/002/004/006/007.

---

### T-007 — `commands/init` + `commands/update`
**Epic**: E3. **Depends on**: T-006. **Est**: ~0.5d.

Thin wrappers over `sync`. `init` runs sync and prints a fresh-install summary
(counts of added/overwritten by type). `update` runs the same sync and prints a
diff summary (added / updated / unchanged, plus any orphaned). Both exit 0 on
success.

**Files**: `src/commands/init.ts`, `src/commands/update.ts`.
**AC**:
- `init` on empty home reports N added across agents/prompts/steering.
- `update` after a bundle change reports the changed files as updated/added and
  unchanged ones as unchanged; orphans listed.
- Output is plain text to stdout; both return an exit-worthy result (0 on
  success).
**DoD**: modules; behavior exercised in T-014 integration.
**Ref**: design §5, §6, REQ-001/004.

---

### T-008 — `commands/list`
**Epic**: E3. **Depends on**: T-004, T-005. **Est**: ~0.5d.

Compute and print per-item status by joining bundle ⨉ disk ⨉ lockfile:
`installed` / `not installed` / `modified` (in lockfile, byte-differs from bundle)
/ `orphaned` (in lockfile, not in bundle). Print grouped by type and show the
bundle (package) version. Exit 0.

**Files**: `src/commands/list.ts`.
**AC**:
- Each bundle item printed with the correct status marker.
- `modified` detected via byte comparison.
- `orphaned` items (lockfile-only) listed.
- Bundle version shown (read from package.json version).
- Exit 0.
**DoD**: module; covered by T-014.
**Ref**: design §5 (list status semantics), DQ-003, REQ-005.

---

### T-009 — `cli.ts`: arg dispatch, help, exit codes
**Epic**: E3. **Depends on**: T-007, T-008. **Est**: ~0.5d.

Hand-rolled dispatch (no parser lib, D5). `argv[2]` selects the command; absent →
`init` (default). Recognize `init`, `update`, `list`, `--help`/`-h`. Unknown
command → print usage to stderr + exit non-zero. Catch errors from commands →
print message to stderr + exit non-zero (REQ-007). Success → exit 0.

**Files**: `src/cli.ts` (replace placeholder from T-002).
**AC**:
- No arg and `init` both run init.
- `update`/`list` route correctly.
- `--help` prints usage to stdout, exit 0.
- Unknown command prints usage to stderr, exit non-zero.
- Thrown errors become a stderr message + non-zero exit; no stack dump as the
  primary output.
**DoD**: module; covered by T-014.
**Ref**: design §5, §7, REQ-007.

---

### T-010 — Seed `bundle/` with real agents + sample prompt/steering
**Epic**: E4. **Depends on**: T-005. **Est**: ~0.5d.

Populate the shipped bundle. Copy the author's existing agents (`bb`,
`bb-explore`, `bb-oracle`, `bb-reviewer`, `bb-librarian` — each `.json` + `.md`)
from `~/.kiro/agents/` into `bundle/agents/`. Add at least one sample
`bundle/prompts/*.md` and one `bundle/steering/*.md` so all three types are
exercised. Verify agent prompt `file://` references still resolve once installed
(adjust to point at the installed `~/.kiro/agents/<name>.md` path convention).

**Files**: `bundle/agents/*.{json,md}`, `bundle/prompts/*.md`,
`bundle/steering/*.md`.
**AC**:
- All five agents present as `.json`+`.md` pairs in `bundle/agents/`.
- ≥1 prompt and ≥1 steering file present.
- Agent JSON is valid; any `prompt` `file://` path is consistent with the
  installed location (does not point at a machine-specific absolute path that
  breaks on another machine).
**DoD**: bundle dir populated; `bundle.enumerate()` lists every file with correct
type/target.
**Ref**: design §3; PRD context (existing bb agents). **Note**: review agent
`.md`/`.json` for any machine-specific absolute paths before bundling.

---

### T-011 — Packaging: ship `bundle/` in the tarball + pack smoke test
**Epic**: E4. **Depends on**: T-002, T-010. **Est**: ~0.5d.

Ensure `bundle/` and `dist/` are included in the published package and resolved
at runtime. Set `package.json` `files` to include `dist` and `bundle`. Verify via
`npm pack` that the tarball contains them, and that running the packed CLI against
a temp `KIRO_HOME` installs correctly.

**Files**: `package.json` (`files`), possibly a `prepublishOnly`/`prepack` script
to build.
**AC**:
- `npm pack` tarball contains `dist/` and `bundle/` (all three subdirs).
- Installing the packed tarball and running `kiro-blackbytes init` with
  `KIRO_HOME` set to a temp dir installs all bundle files there.
- `dist/` is built before pack (prepack/prepublishOnly) so a fresh clone publishes
  correctly.
**DoD**: pack smoke test documented/runnable; tarball verified to contain bundle.
**Ref**: design §3, §10 D1; REQ-001.

---

### T-012 — Unit tests: paths, lockfile, bundle
**Epic**: E5. **Depends on**: T-003, T-004, T-005. **Est**: ~0.5d.

`node:test` units for the three core modules. Use a `mkdtemp` dir as `KIRO_HOME`
and a small fixture bundle dir; no `fs` mocking.

**Files**: `test/paths.test.ts`, `test/lockfile.test.ts`, `test/bundle.test.ts`,
`test/fixtures/bundle/**` (tiny).
**AC**:
- paths: KIRO_HOME override, fallback, containment assert (reject `..` escape and
  `skills/`).
- lockfile: missing→empty, valid parse, malformed/bad-schema throw, atomic write
  round-trip.
- bundle: enumeration types/targets, steering nesting, ignores non-`.md`/`.json`.
- `npm test` runs these and passes.
**DoD**: tests pass; `npm test` wired to `node --test`.
**Ref**: design §9 (unit cases, test seam).

---

### T-013 — Sync unit tests (all outcomes)
**Epic**: E5. **Depends on**: T-006. **Est**: ~0.5d.

Drive `installer.sync` against a temp `KIRO_HOME` + fixture bundle covering every
outcome from design §6.

**Files**: `test/installer.test.ts` (+ reuse fixtures).
**AC**: cases all asserted —
- empty home → all ADDED, lockfile lists all;
- re-run → all UNCHANGED;
- user-authored non-bundle file untouched (REQ-002);
- hand-edited owned file → UPDATED, content restored;
- bundle file removed from fixture → ORPHANED, still on disk (Q-001);
- simulated copy failure → lockfile not written;
- idempotency: two runs converge (REQ-006).
**DoD**: tests pass.
**Ref**: design §6, §8; REQ-001/002/004/006/007.

---

### T-014 — Integration tests (built CLI end-to-end) + README
**Epic**: E5. **Depends on**: T-009, T-011. **Est**: ~1d.

End-to-end: build, then invoke `node dist/cli.js <cmd>` with `KIRO_HOME` pointed
at a temp dir, asserting exit codes, stdout summaries, and the resulting file
tree for the sequence `init` → (mutate bundle/disk) → `update` → `list`. Write the
README documenting the three commands, the `~/.kiro/` targets, the lockfile, and
the override behavior (Q-002).

**Files**: `test/cli.integration.test.ts`, `README.md`.
**AC**:
- `init` on empty temp home creates expected agents/prompts/steering + lockfile;
  exit 0.
- `list` after init marks items installed; shows version.
- Hand-edit an installed file then `update` → file restored, reported updated.
- Unknown command → non-zero exit, usage on stderr.
- README documents commands, targets, lockfile, and that `update` overwrites
  bundled files (including locally edited ones) but never user-authored files.
**DoD**: integration tests pass against the built CLI; README complete; full
`npm run build && npm run lint && npm test` green (exit criteria).
**Ref**: design §5, §6, §9; PRD J1–J3, REQ-001..007, Q-002.

## Test strategy

- **Runner**: `node:test` (built-in), invoked via `npm test` → `node --test`.
- **Isolation**: every test uses a `mkdtemp` dir as `KIRO_HOME` and a fixture
  bundle; no `fs` mocking, no touching the real `~/.kiro/`.
- **Coverage target**: 100% of core modules (`paths`, `lockfile`, `bundle`,
  `installer`) by unit/sync tests; commands + cli covered by integration. The
  core is the risk surface; commands are thin.
- **Lint/format**: `biome check` must pass in the exit-criteria gate.

## Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Bundle path mis-resolves when run via npx (cwd ≠ package root) | install finds no files | Anchor bundle path to the compiled module location (T-005 AC), verify in pack smoke test (T-011). |
| Agent `.md`/`.json` contains machine-specific absolute `file://` paths | installed agents break on other machines | T-010 explicitly reviews/normalizes paths before bundling. |
| `bundle/` omitted from the npm tarball | `npx` install does nothing | T-011 `files` allowlist + pack smoke test asserts tarball contents. |
| Override silently reverts a user's local edit (Q-002) | user surprise | Documented in README (T-014); `list` surfaces `modified` before they run update (T-008). |
| ESM + shebang + `bin` interplay on Windows | npx fails on Windows | `#!/usr/bin/env node` + npm-generated shims handle this; validate in T-002/T-011 (note Windows as a follow-up if unavailable locally). |

## Open Questions

| ID | Question | Owner | Status | Blocks |
|---|---|---|---|---|
| PQ-001 | Confirm the exact set of agents to bundle (all five bb-* + bb, or a subset?). | invoker | Open — assume all five + bb until told otherwise. | T-010 (non-blocking; default assumption lets work proceed). |
| PQ-002 | npm package publish access / scope (publish as unscoped `kiro-blackbytes`?). | invoker | Deferred — not needed until actual publish; out of Phase 1 build scope. | none in-phase. |

## Revision History

| Date | Author | Change |
|---|---|---|
| 2026-05-29 | invoker (via feature-workflow) | Initial Phase 1 MVP plan: 5 epics, 14 leaf tasks with deps, DoD, test strategy, risks. Ready for bead conversion. |
