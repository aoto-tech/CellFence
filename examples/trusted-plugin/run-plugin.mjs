/**
 * Minimal trusted plugin example for CellFence.
 *
 * NOTE: Plugin code is trusted caller code, NOT manifest-loaded repository code.
 * In CellFence v0.x, manifest-controlled plugin auto-loading is intentionally rejected.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import { checkRepository } from "../../packages/engine/dist/index.js";
import { defineAdapter, definePlugin, defineRule } from "../../packages/plugin-api/dist/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

// 1. Define a resource adapter that translates framework/API calls into standard CellFence resource accesses
const databaseAdapter = defineAdapter({
  name: "example-db-adapter",
  detect(context) {
    const accesses = [];
    function visit(node) {
      if (ts.isCallExpression(node) && context.helpers.getQualifiedCallName(node) === "dbAccess.select") {
        const tableName = context.helpers.getStaticStringArgument(node, 0);
        accesses.push({
          kind: "database",
          access: "read",
          selector: tableName || "unresolved:table",
          filePath: context.filePath,
          line: context.helpers.lineOf(node),
          source: "dbAccess.select",
          detectedBy: "example-db-adapter",
          confidence: tableName ? "high" : "low",
          unresolved: !tableName,
        });
      }
      ts.forEachChild(node, visit);
    }
    visit(context.sourceFile);
    return accesses;
  },
});

// 2. Define a custom governance rule that observes detected resources from the repository model
const auditDatabaseRule = defineRule({
  id: "example/audit-database-access",
  meta: {
    description: "Emits a warning finding whenever a database access is observed.",
    defaultSeverity: "warning",
    category: "audit",
  },
  run(context) {
    const findings = [];
    for (const access of context.repository.resources) {
      if (access.kind === "database") {
        findings.push({
          ruleId: "example/audit-database-access",
          severity: "warning",
          cellId: "core",
          filePath: access.filePath,
          message: `Observed database access to ${access.selector} at line ${access.line}`,
        });
      }
    }
    return findings;
  },
});

// 3. Assemble the trusted plugin
const trustedPlugin = definePlugin({
  apiVersion: 1,
  name: "@example/trusted-plugin",
  version: "1.0.0",
  capabilities: { needsAst: true },
  adapters: [databaseAdapter],
  rules: {
    "example/audit-database-access": auditDatabaseRule,
  },
});

// 4. Pass the plugin directly to checkRepository
const result = checkRepository({
  rootDir: repoRoot,
  manifestPath: "examples/trusted-plugin/cellfence.manifest.json",
  plugins: [trustedPlugin],
});

console.log("Check success (ok):", result.ok);
console.log("Warnings emitted:", result.warnings.map((w) => `${w.ruleId}: ${w.message}`));

const foundCustomRule = result.warnings.some((w) => w.ruleId === "example/audit-database-access");
if (!result.ok || !foundCustomRule) {
  console.error("Trusted plugin execution failed expectations");
  process.exit(1);
}
console.log("Trusted plugin example executed successfully!");
