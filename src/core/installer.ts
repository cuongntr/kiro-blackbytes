import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type BundleFile, enumerate, lockKey } from "./bundle.js";
import * as lockfile from "./lockfile.js";
import { assertInsideKiroHome } from "./paths.js";

export type Outcome = "ADDED" | "OVERWRITTEN" | "UPDATED" | "UNCHANGED" | "ORPHANED";
export type SyncMode = "init" | "update";

export interface SyncResult {
  key: string;
  type?: BundleFile["type"];
  outcome: Outcome;
}

/** Package version, read from the package.json at the package root. */
export function packageVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(join(here, "..", "..", "package.json"), "utf8"));
  return typeof pkg.version === "string" ? pkg.version : "";
}

/** True if target is missing or its bytes differ from the source. */
function contentDiffers(file: BundleFile): boolean {
  let target: Buffer;
  try {
    target = readFileSync(file.target);
  } catch {
    return true;
  }
  return !readFileSync(file.absSource).equals(target);
}

function exists(path: string): boolean {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}

/** Copy a bundle file to its target, asserting the target stays inside Kiro home. */
export function write(file: BundleFile): void {
  assertInsideKiroHome(file.target);
  mkdirSync(dirname(file.target), { recursive: true });
  copyFileSync(file.absSource, file.target);
}

/**
 * Sync the bundle to ~/.kiro/. Classifies each file, copies what changed, leaves
 * orphans on disk, and writes the lockfile only after all copies succeed.
 */
export function sync(_mode: SyncMode = "init"): SyncResult[] {
  const files = enumerate();
  const prior = new Set(lockfile.read().files);
  const results: SyncResult[] = [];
  const toCopy: BundleFile[] = [];

  for (const file of files) {
    const key = lockKey(file);
    if (!exists(file.target)) {
      results.push({ key, type: file.type, outcome: "ADDED" });
      toCopy.push(file);
    } else if (!contentDiffers(file)) {
      results.push({ key, type: file.type, outcome: "UNCHANGED" });
    } else if (prior.has(key)) {
      results.push({ key, type: file.type, outcome: "UPDATED" });
      toCopy.push(file);
    } else {
      results.push({ key, type: file.type, outcome: "OVERWRITTEN" });
      toCopy.push(file);
    }
  }

  const current = new Set(files.map(lockKey));
  for (const key of prior) {
    if (!current.has(key)) results.push({ key, outcome: "ORPHANED" });
  }

  // Copy everything first; abort before touching the lockfile if any copy fails.
  for (const file of toCopy) write(file);

  lockfile.write({ version: packageVersion(), files: [...current] });
  return results;
}
