import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function bugFixture(testContext) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cellfence-bug-"));
  testContext.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const write = (name, value) => {
    const filePath = path.join(rootDir, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, typeof value === "string" ? value : JSON.stringify(value));
    return filePath;
  };
  const manifest = {
    schemaVersion: "cellfence.manifest.v1",
    governance: { requireOwnership: true, include: ["src/**"] },
    cells: ["producer", "consumer"].map((id) => ({
      id, ownedPaths: [`src/${id}/**`], publicEntry: `src/${id}/public.ts`,
      publicSymbols: ["api"], consumes: id === "consumer" ? [{ cell: "producer" }] : [],
    })),
  };
  write("cellfence.manifest.json", manifest);
  write("src/producer/public.ts", "export function api(): number { return 1; }\n");
  write("src/producer/private.ts", "export const secret = 42;\n");
  write("src/consumer/public.ts", "export function api(): number { return 1; }\n");
  write("src/consumer/work.ts", "import { api } from '../producer/public'; api();\n");
  return { rootDir, write, manifest };
}
