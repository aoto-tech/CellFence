import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), "..");
const baselinePublicKey = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAYZA7VM69byEHBNRIPOcV5ES5OgM7gMW8MzaGfXxLiiA=
-----END PUBLIC KEY-----
`;

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  if (result.error) throw result.error;
}

run("npm", ["run", "build"]);
run(process.execPath, [
  "packages/cli/dist/index.js",
  "baseline",
  "check",
  "--manifest",
  "cellfence.manifest.json",
  "--baseline",
  "cellfence.baseline.json",
], {
  CELLFENCE_BASELINE_ED25519_PUBLIC_KEY: process.env.CELLFENCE_BASELINE_ED25519_PUBLIC_KEY || baselinePublicKey,
});
