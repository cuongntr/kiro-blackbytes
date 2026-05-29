import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";

export type ConfigType = "agents" | "prompts" | "steering";

/** Resolve the Kiro home dir: KIRO_HOME env override (test seam) or ~/.kiro. */
export function kiroHome(): string {
  const override = process.env.KIRO_HOME;
  return override && override.length > 0 ? resolve(override) : join(homedir(), ".kiro");
}

/** Absolute target dir for a config type under the Kiro home. */
export function targetDir(type: ConfigType): string {
  return join(kiroHome(), type);
}

/** Path to the ownership lockfile. */
export function lockfilePath(): string {
  return join(kiroHome(), ".kiro-blackbytes.json");
}

/**
 * Guard: a target path must resolve inside the Kiro home and must NOT be under
 * <home>/skills/. Throws otherwise. Prevents path escapes and writes to skills.
 */
export function assertInsideKiroHome(target: string): void {
  const home = kiroHome();
  const resolved = resolve(target);
  const homePrefix = home + sep;
  if (resolved !== home && !resolved.startsWith(homePrefix)) {
    throw new Error(`Refusing to write outside Kiro home: ${resolved}`);
  }
  const skillsPrefix = join(home, "skills") + sep;
  if (resolved === join(home, "skills") || resolved.startsWith(skillsPrefix)) {
    throw new Error(`Refusing to write under skills/: ${resolved}`);
  }
}
