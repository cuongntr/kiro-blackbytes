import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { cleanup, tempDir } from "./helpers.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(repoRoot, "dist", "cli.js");

let home;
beforeEach(() => {
  home = tempDir("kb-it-");
});
afterEach(() => {
  cleanup(home);
});

/** Run the built CLI against the temp home and the real shipped bundle. */
function run(args, env = {}) {
  return spawnSync("node", [CLI, ...args], {
    encoding: "utf8",
    env: { ...process.env, KIRO_HOME: home, ...env },
  });
}

test("init on empty home installs files and lockfile, exit 0", () => {
  const r = run(["init"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /init/);
  assert.ok(existsSync(join(home, "agents", "bb.json")));
  assert.ok(existsSync(join(home, "prompts", "review.md")));
  assert.ok(existsSync(join(home, "steering", "engineering-conventions.md")));
  assert.ok(existsSync(join(home, ".kiro-blackbytes.json")));
});

test("no-arg defaults to init", () => {
  const r = run([]);
  assert.equal(r.status, 0);
  assert.ok(existsSync(join(home, ".kiro-blackbytes.json")));
});

test("list after init marks installed and shows version", () => {
  run(["init"]);
  const r = run(["list"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /installed/);
  assert.match(r.stdout, /\d+\.\d+\.\d+/);
});

test("hand-edit then update restores file and reports updated", () => {
  run(["init"]);
  const target = join(home, "agents", "bb.json");
  const original = readFileSync(target, "utf8");
  writeFileSync(target, "LOCAL EDIT");
  const r = run(["update"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /updated: [1-9]/);
  assert.equal(readFileSync(target, "utf8"), original);
});

test("unknown command exits non-zero with usage on stderr", () => {
  const r = run(["bogus"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Unknown command/);
});

test("--help prints usage and exits 0", () => {
  const r = run(["--help"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Usage:/);
});
