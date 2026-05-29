import { packageVersion, sync } from "../core/installer.js";
import { keysOf, tally } from "./report.js";

/** Re-sync the bundle into ~/.kiro/ and print a diff summary. */
export function update(): number {
  const results = sync("update");
  const c = tally(results);
  console.log(`kiro-blackbytes ${packageVersion()} — update`);
  console.log(
    `  added: ${c.ADDED}  updated: ${c.UPDATED}  overwritten: ${c.OVERWRITTEN}  unchanged: ${c.UNCHANGED}`,
  );
  const orphans = keysOf(results, "ORPHANED");
  if (orphans.length > 0) {
    console.log(`  orphaned (left on disk): ${orphans.length}`);
    for (const key of orphans) console.log(`    ${key}`);
  }
  return 0;
}
