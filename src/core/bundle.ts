import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, posix, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { type ConfigType, targetDir } from "./paths.js";

export interface BundleFile {
  type: ConfigType;
  /** Path relative to the type's target dir, forward-slash separators (e.g. "Bytes.json"). */
  relPath: string;
  /** Absolute source path inside the package bundle/. */
  absSource: string;
  /** Absolute install target under ~/.kiro/<type>/. */
  target: string;
}

/** Allowed file extensions per config type. */
const EXT: Record<ConfigType, string[]> = {
  agents: [".json", ".md"],
  prompts: [".md"],
  steering: [".md"],
};

/** Resolve the shipped bundle/ dir anchored to the package root (not cwd). */
export function bundleRoot(): string {
  const override = process.env.KIRO_BLACKBYTES_BUNDLE;
  if (override && override.length > 0) return override;
  // Compiled location: <pkg>/dist/core/bundle.js -> package root is two dirs up.
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..", "bundle");
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function hasExt(file: string, exts: string[]): boolean {
  return exts.some((e) => file.endsWith(e));
}

/** Enumerate every installable file in the bundle into BundleFile[]. */
export function enumerate(root: string = bundleRoot()): BundleFile[] {
  const types: ConfigType[] = ["agents", "prompts", "steering"];
  const files: BundleFile[] = [];
  for (const type of types) {
    const typeRoot = join(root, type);
    for (const abs of walk(typeRoot)) {
      if (!hasExt(abs, EXT[type])) continue;
      const rel = relative(typeRoot, abs).split(sep).join(posix.sep);
      files.push({
        type,
        relPath: rel,
        absSource: abs,
        target: join(targetDir(type), ...rel.split(posix.sep)),
      });
    }
  }
  return files;
}

/** Lockfile-style relative path for a bundle file (e.g. "agents/Bytes.json"). */
export function lockKey(file: BundleFile): string {
  return `${file.type}/${file.relPath}`;
}
