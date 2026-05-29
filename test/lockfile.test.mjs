import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import * as lockfile from "../dist/core/lockfile.js";
import { cleanup, tempDir, useEnv } from "./helpers.mjs";

let home;
beforeEach(() => {
  home = tempDir();
  useEnv(home);
});
afterEach(() => {
  cleanup(home);
  delete process.env.KIRO_HOME;
});

test("read on missing file returns empty ownership", () => {
  const lf = lockfile.read();
  assert.deepEqual(lf.files, []);
  assert.equal(lf.schema, 1);
});

test("write then read round-trips", () => {
  lockfile.write({ version: "1.2.3", files: ["agents/bb.json", "prompts/p.md"] });
  const lf = lockfile.read();
  assert.equal(lf.version, "1.2.3");
  assert.equal(lf.schema, 1);
  assert.ok(lf.updatedAt);
  assert.deepEqual(lf.files, ["agents/bb.json", "prompts/p.md"]);
});

test("read throws on malformed JSON", () => {
  writeFileSync(join(home, ".kiro-blackbytes.json"), "{ not json");
  assert.throws(() => lockfile.read(), /Corrupt lockfile/);
});

test("read throws on unsupported schema", () => {
  writeFileSync(join(home, ".kiro-blackbytes.json"), JSON.stringify({ schema: 99, files: [] }));
  assert.throws(() => lockfile.read(), /schema/);
});
