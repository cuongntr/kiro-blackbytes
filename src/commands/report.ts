import type { Outcome, SyncResult } from "../core/installer.js";

/** Count results by outcome. */
export function tally(results: SyncResult[]): Record<Outcome, number> {
  const counts: Record<Outcome, number> = {
    ADDED: 0,
    OVERWRITTEN: 0,
    UPDATED: 0,
    UNCHANGED: 0,
    ORPHANED: 0,
  };
  for (const r of results) counts[r.outcome]++;
  return counts;
}

/** List the keys for a given outcome. */
export function keysOf(results: SyncResult[], outcome: Outcome): string[] {
  return results.filter((r) => r.outcome === outcome).map((r) => r.key);
}
