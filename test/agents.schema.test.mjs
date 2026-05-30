import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// Validates the real shipped bundle/agents against Kiro CLI's agent schema so a
// typo'd tool name, a missing prompt file, or a broken subagent reference fails
// here rather than at runtime inside Kiro. Source: kiro.dev/docs/cli built-in
// tools + custom-agents configuration reference (verified 2026-05-30).

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const agentsDir = join(repoRoot, "bundle", "agents");

// Canonical Kiro CLI built-in tool names (no MCP @-prefixed tools used here).
const KIRO_TOOLS = new Set([
  "read",
  "glob",
  "grep",
  "write",
  "shell",
  "aws",
  "introspect",
  "code",
  "tool_search",
  "delegate",
  "report",
  "knowledge",
  "thinking",
  "todo",
  "session",
  "subagent",
  "web_search",
  "web_fetch",
]);

function agentJsonFiles() {
  return readdirSync(agentsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ file: f, name: f.slice(0, -".json".length) }));
}

function loadAgent(file) {
  return JSON.parse(readFileSync(join(agentsDir, file), "utf8"));
}

const agents = agentJsonFiles();
const agentNames = new Set(agents.map((a) => a.name));

test("bundle ships at least the Bytes orchestrator", () => {
  assert.ok(agentNames.has("Bytes"), "expected bundle/agents/Bytes.json to exist");
});

for (const { file, name } of agents) {
  test(`${file}: valid schema, tool names, prompt, and subagent refs`, () => {
    const a = loadAgent(file);

    // name is optional in Kiro (derived from filename) but must match if present.
    if (a.name !== undefined) {
      assert.equal(a.name, name, `name "${a.name}" must match filename "${name}"`);
    }

    const tools = a.tools ?? [];
    const allowed = a.allowedTools ?? [];

    // Every referenced tool must be a real Kiro built-in.
    for (const t of [...tools, ...allowed]) {
      assert.ok(KIRO_TOOLS.has(t), `${file}: unknown tool "${t}"`);
    }

    // allowedTools must be a subset of tools (cannot auto-approve an absent tool).
    for (const t of allowed) {
      assert.ok(tools.includes(t), `${file}: allowedTools "${t}" not in tools`);
    }

    // prompt file:// references must be bare-relative and resolve on disk.
    if (typeof a.prompt === "string" && a.prompt.startsWith("file://")) {
      const ref = a.prompt.slice("file://".length);
      assert.ok(!ref.startsWith("/"), `${file}: prompt must be relative, not absolute (${ref})`);
      assert.ok(existsSync(join(agentsDir, ref)), `${file}: prompt file missing (${ref})`);
    }

    // Subagent references must point at agents that ship in this bundle.
    const sub = a.toolsSettings?.subagent;
    if (sub) {
      for (const key of ["availableAgents", "trustedAgents"]) {
        for (const ref of sub[key] ?? []) {
          if (ref.includes("*") || ref.includes("?")) continue; // glob pattern
          assert.ok(agentNames.has(ref), `${file}: ${key} references unknown agent "${ref}"`);
        }
      }
      // trustedAgents must be a subset of availableAgents when both are set.
      if (sub.availableAgents && sub.trustedAgents) {
        for (const ref of sub.trustedAgents) {
          assert.ok(
            sub.availableAgents.includes(ref),
            `${file}: trustedAgent "${ref}" not in availableAgents`,
          );
        }
      }
    }
  });
}

test("subagents auto-approve every tool they can use (non-interactive fail-fast rule)", () => {
  // A spawned subagent runs non-interactive: a tool requiring approval makes it
  // fail-fast instead of prompting. So a subagent's allowedTools must equal its
  // tools. The orchestrator (the agent holding the `subagent` tool) is the
  // interactive main agent and is exempt.
  for (const { file } of agents) {
    const a = loadAgent(file);
    const tools = a.tools ?? [];
    if (tools.includes("subagent")) continue; // orchestrator, runs interactively
    const allowed = a.allowedTools ?? [];
    assert.deepEqual(
      [...allowed].sort(),
      [...tools].sort(),
      `${file}: subagent allowedTools must equal tools (non-interactive fail-fast)`,
    );
  }
});
