import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { lockfilePath } from "./paths.js";

export const SCHEMA_VERSION = 1;

export interface Lockfile {
  schema: number;
  version: string;
  updatedAt: string;
  /** Relative paths (forward-slash separators), e.g. "agents/Bytes.json". */
  files: string[];
}

/** Read the lockfile. Missing file => empty ownership. Malformed/bad schema => throw. */
export function read(): Lockfile {
  const path = lockfilePath();
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { schema: SCHEMA_VERSION, version: "", updatedAt: "", files: [] };
    }
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Corrupt lockfile (invalid JSON): ${path}`);
  }
  const obj = parsed as Partial<Lockfile>;
  if (obj.schema !== SCHEMA_VERSION) {
    throw new Error(
      `Unsupported lockfile schema ${obj.schema} (expected ${SCHEMA_VERSION}): ${path}`,
    );
  }
  if (!Array.isArray(obj.files)) {
    throw new Error(`Corrupt lockfile (missing files[]): ${path}`);
  }
  return {
    schema: SCHEMA_VERSION,
    version: typeof obj.version === "string" ? obj.version : "",
    updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : "",
    files: obj.files,
  };
}

/** Atomically write the lockfile (temp + rename). */
export function write(data: { version: string; files: string[] }): void {
  const path = lockfilePath();
  const lock: Lockfile = {
    schema: SCHEMA_VERSION,
    version: data.version,
    updatedAt: new Date().toISOString(),
    files: [...data.files].sort(),
  };
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}
