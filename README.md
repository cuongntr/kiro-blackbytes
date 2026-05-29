# kiro-blackbytes

Install, update, and list a curated bundle of reusable [Kiro](https://kiro.dev) settings —
**agents**, **prompts**, and **steering** — into your user-level `~/.kiro/` directory.

The bundle ships inside this package, so it is versioned by the npm package version. No
network calls, no configuration, no runtime dependencies.

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
