import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { cleanup, fixtureBundle, tempDir, useEnv } from "./helpers.mjs";

let home;
let bundle;
let sync;
let lockfile;

beforeEach(async () => {
  home = tempDir("kb-home-");
  bundle = fixtureBundle();
  useEnv(home, bundle);
  sync = (await import("../dist/core/installer.js")).sync;
  lockfile = await import("../dist/core/lockfile.js");
});
afterEach(() => {
  cleanup(home, bundle);
  delete process.env.KIRO_HOME;
  delete process.env.KIRO_BLACKBYTES_BUNDLE;
});

const byKey = (results) => Object.fromEntries(results.map((r) => [r.key, r.outcome]));

test("empty home => all ADDED and lockfile lists all", () => {
  const r = byKey(sync("init"));
  assert.equal(r["agents/bb.json"], "ADDED");
  assert.equal(r["steering/sub/s.md"], "ADDED");
  assert.equal(lockfile.read().files.length, 4);
});

test("re-run => all UNCHANGED", () => {
  sync("init");
  const r = byKey(sync("update"));
  assert.ok(Object.values(r).every((o) => o === "UNCHANGED"));
});

test("user-authored non-bundle file is untouched and unowned", () => {
  sync("init");
  writeFileSync(join(home, "agents", "mine.json"), "MINE");
  sync("update");
  assert.equal(readFileSync(join(home, "agents", "mine.json"), "utf8"), "MINE");
  assert.ok(!lockfile.read().files.includes("agents/mine.json"));
});

test("hand-edited owned file => UPDATED and content restored", () => {
  sync("init");
  writeFileSync(join(home, "agents", "bb.json"), "HACKED");
  const r = byKey(sync("update"));
  assert.equal(r["agents/bb.json"], "UPDATED");
  assert.equal(readFileSync(join(home, "agents", "bb.json"), "utf8"), '{"name":"bb"}');
});

test("removed-from-bundle => ORPHANED and left on disk", () => {
  sync("init");
  rmSync(join(bundle, "prompts", "p.md"));
  const r = byKey(sync("update"));
  assert.equal(r["prompts/p.md"], "ORPHANED");
  assert.ok(existsSync(join(home, "prompts", "p.md")));
  assert.ok(!lockfile.read().files.includes("prompts/p.md"));
});

test("pre-existing non-owned file at a bundle target => OVERWRITTEN", () => {
  mkdirSync(join(home, "agents"), { recursive: true });
  writeFileSync(join(home, "agents", "bb.json"), "PREEXISTING");
  // no lockfile yet => not owned
  const r = byKey(sync("init"));
  assert.equal(r["agents/bb.json"], "OVERWRITTEN");
});

test("idempotency: two runs converge to identical lockfile files", () => {
  sync("init");
  const a = lockfile.read().files;
  sync("update");
  const b = lockfile.read().files;
  assert.deepEqual(a, b);
});

test("copy failure aborts before lockfile is written", () => {
  sync("init");
  // Edit an owned file so it must be re-copied, then make that target file unwritable
  // so copyFileSync fails mid-sync.
  const target = join(home, "agents", "bb.json");
  writeFileSync(target, "EDIT");
  const before = readFileSync(join(home, ".kiro-blackbytes.json"), "utf8");
  chmodSync(target, 0o400); // read-only
  let threw = false;
  try {
    sync("update");
  } catch {
    threw = true;
  } finally {
    chmodSync(target, 0o600);
  }
  assert.ok(threw, "sync should throw on copy failure");
  const after = readFileSync(join(home, ".kiro-blackbytes.json"), "utf8");
  assert.equal(after, before, "lockfile must be unchanged when a copy fails");
});
