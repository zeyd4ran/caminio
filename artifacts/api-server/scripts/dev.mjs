import { execSync, spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

process.env.NODE_ENV = "development";

execSync("node ./build.mjs", {
  stdio: "inherit",
  cwd: root,
  env: process.env,
});

const args = [
  "--env-file-if-exists=../../.env",
  "--env-file-if-exists=../../.env.local",
  "--enable-source-maps",
  "./dist/index.mjs",
];

const child = spawn(process.execPath, args, {
  stdio: "inherit",
  cwd: root,
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
