import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { enumerate, lockKey } from "../dist/core/bundle.js";
import { cleanup, fixtureBundle, useEnv } from "./helpers.mjs";

let bundle;
beforeEach(() => {
  bundle = fixtureBundle();
  useEnv("/tmp/kh", bundle);
});
afterEach(() => {
  cleanup(bundle);
  delete process.env.KIRO_HOME;
  delete process.env.KIRO_BLACKBYTES_BUNDLE;
});

test("enumerate lists one entry per matching file across types", () => {
  const keys = enumerate().map(lockKey).sort();
  assert.deepEqual(keys, ["agents/bb.json", "agents/bb.md", "prompts/p.md", "steering/sub/s.md"]);
});

test("enumerate ignores non-md/json files", () => {
  assert.ok(!enumerate().some((f) => f.relPath.endsWith(".txt")));
});

test("enumerate preserves steering nesting in relPath and target", () => {
  const s = enumerate().find((f) => f.type === "steering");
  assert.equal(s.relPath, "sub/s.md");
  assert.equal(s.target, "/tmp/kh/steering/sub/s.md");
});

test("enumerate maps agents target correctly", () => {
  const a = enumerate().find((f) => f.relPath === "bb.json");
  assert.equal(a.target, "/tmp/kh/agents/bb.json");
});
