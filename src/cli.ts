#!/usr/bin/env node
import { init } from "./commands/init.js";
import { list } from "./commands/list.js";
import { update } from "./commands/update.js";
import { packageVersion } from "./core/installer.js";

const USAGE = `kiro-blackbytes — install reusable Kiro settings into ~/.kiro/

Usage:
  kiro-blackbytes [init]     Install the bundle (default)
  kiro-blackbytes update     Re-sync the bundle to this version
  kiro-blackbytes list       Show bundle contents and install status
  kiro-blackbytes --help     Show this help`;

function run(argv: string[]): number {
  const cmd = argv[2] ?? "init";
  switch (cmd) {
    case "--help":
    case "-h":
      console.log(USAGE);
      return 0;
    case "--version":
    case "-v":
      console.log(packageVersion());
      return 0;
    case "init":
      return init();
    case "update":
      return update();
    case "list":
      return list();
    default:
      console.error(`Unknown command: ${cmd}\n`);
      console.error(USAGE);
      return 1;
  }
}

try {
  process.exit(run(process.argv));
} catch (err) {
  console.error(`kiro-blackbytes: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
