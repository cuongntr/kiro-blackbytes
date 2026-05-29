import { readFileSync } from "node:fs";
import { type BundleFile, enumerate, lockKey } from "../core/bundle.js";
import { packageVersion } from "../core/installer.js";
import * as lockfile from "../core/lockfile.js";

type Status = "installed" | "not installed" | "modified" | "orphaned";

const MARK: Record<Status, string> = {
  installed: "✓",
  "not installed": " ",
  modified: "~",
  orphaned: "!",
};

function bytesDiffer(file: BundleFile): boolean {
  try {
    return !readFileSync(file.absSource).equals(readFileSync(file.target));
  } catch {
    return true; // target missing
  }
}

function statusOf(file: BundleFile, owned: Set<string>): Status {
  const key = lockKey(file);
  if (!owned.has(key)) {
    // present on disk but unowned still shows as installed if identical; else not installed
    return bytesDiffer(file) ? "not installed" : "installed";
  }
  return bytesDiffer(file) ? "modified" : "installed";
}

/** Print per-item install status grouped by type, plus orphans and version. */
export function list(): number {
  const files = enumerate();
  const owned = new Set(lockfile.read().files);
  const current = new Set(files.map(lockKey));

  console.log(`kiro-blackbytes ${packageVersion()} — bundle contents`);
  for (const type of ["agents", "prompts", "steering"] as const) {
    const group = files.filter((f) => f.type === type);
    if (group.length === 0) continue;
    console.log(`\n${type}:`);
    for (const f of group) {
      const s = statusOf(f, owned);
      console.log(`  [${MARK[s]}] ${f.relPath} (${s})`);
    }
  }

  const orphans = [...owned].filter((k) => !current.has(k));
  if (orphans.length > 0) {
    console.log("\norphaned (owned, no longer in bundle):");
    for (const key of orphans) console.log(`  [${MARK.orphaned}] ${key} (orphaned)`);
  }
  return 0;
}
