#!/usr/bin/env node

import { main } from "../benchmark/runner/index.mjs";

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
