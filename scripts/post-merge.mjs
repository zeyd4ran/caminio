#!/bin/sh
':' //; exec node "$0" "$@"

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

function runPnpm(args) {
  const result = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    args,
    {
      cwd: projectRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );

  if (result.error) {
    console.error(`Failed to run pnpm: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runPnpm(["install", "--frozen-lockfile"]);
runPnpm(["--filter", "db", "push"]);
