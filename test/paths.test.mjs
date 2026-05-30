import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { assertInsideKiroHome, kiroHome, lockfilePath, targetDir } from "../dist/core/paths.js";

afterEach(() => {
  delete process.env.KIRO_HOME;
});

test("kiroHome honors KIRO_HOME override", () => {
  process.env.KIRO_HOME = "/tmp/kh";
  assert.equal(kiroHome(), "/tmp/kh");
});

test("kiroHome falls back to ~/.kiro", () => {
  delete process.env.KIRO_HOME;
  assert.equal(kiroHome(), join(homedir(), ".kiro"));
});

test("targetDir and lockfilePath resolve under home", () => {
  process.env.KIRO_HOME = "/tmp/kh";
  assert.equal(targetDir("agents"), "/tmp/kh/agents");
  assert.equal(targetDir("prompts"), "/tmp/kh/prompts");
  assert.equal(targetDir("steering"), "/tmp/kh/steering");
  assert.equal(lockfilePath(), "/tmp/kh/.kiro-blackbytes.json");
});

test("assertInsideKiroHome passes for normal target", () => {
  process.env.KIRO_HOME = "/tmp/kh";
  assert.doesNotThrow(() => assertInsideKiroHome("/tmp/kh/agents/Bytes.json"));
});

test("assertInsideKiroHome rejects path escapes", () => {
  process.env.KIRO_HOME = "/tmp/kh";
  assert.throws(() => assertInsideKiroHome("/tmp/kh/../etc/passwd"));
});

test("assertInsideKiroHome rejects skills/ paths", () => {
  process.env.KIRO_HOME = "/tmp/kh";
  assert.throws(() => assertInsideKiroHome("/tmp/kh/skills/foo.md"));
});
