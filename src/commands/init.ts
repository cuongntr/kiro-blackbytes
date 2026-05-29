import { packageVersion, sync } from "../core/installer.js";
import { tally } from "./report.js";

/** Install the bundle into ~/.kiro/ and print a fresh-install summary. */
export function init(): number {
  const results = sync("init");
  const c = tally(results);
  console.log(`kiro-blackbytes ${packageVersion()} — init`);
  console.log(`  added: ${c.ADDED}  overwritten: ${c.OVERWRITTEN}  unchanged: ${c.UNCHANGED}`);
  return 0;
}
