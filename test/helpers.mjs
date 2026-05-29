import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Make a temp dir; returns its path. */
export function tempDir(prefix = "kb-") {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** Recursively remove a dir, ignoring errors. */
export function cleanup(...dirs) {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}

/**
 * Build a fixture bundle on disk and return its root.
 * Layout: agents/bb.json+bb.md, prompts/p.md, steering/sub/s.md, plus an ignored .txt.
 */
export function fixtureBundle() {
  const root = tempDir("kb-bundle-");
  mkdirSync(join(root, "agents"), { recursive: true });
  mkdirSync(join(root, "prompts"), { recursive: true });
  mkdirSync(join(root, "steering", "sub"), { recursive: true });
  writeFileSync(join(root, "agents", "bb.json"), '{"name":"bb"}');
  writeFileSync(join(root, "agents", "bb.md"), "# bb");
  writeFileSync(join(root, "agents", "ignore.txt"), "nope");
  writeFileSync(join(root, "prompts", "p.md"), "prompt");
  writeFileSync(join(root, "steering", "sub", "s.md"), "steer");
  return root;
}

/** Set the env test seams for an isolated run. */
export function useEnv(home, bundle) {
  process.env.KIRO_HOME = home;
  if (bundle !== undefined) process.env.KIRO_BLACKBYTES_BUNDLE = bundle;
}
