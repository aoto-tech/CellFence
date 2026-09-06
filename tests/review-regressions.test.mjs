import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import {
  checkCommitEvidence,
  checkMutationReport,
  checkRepository,
  checkTaskManifest,
  detectBaselineChanges,
  emptyClaimStoreState,
  LocalFileClaimStore,
} from "../packages/engine/dist/index.js";
import {
  publicSurfaceHash,
  resolvePackageImportsTarget,
  resolvePathAliasTarget,
} from "../packages/engine/dist/module-resolution.js";
import { inspectPythonSource } from "../packages/engine/dist/python-analysis.js";
import { runCoverageCommand } from "../packages/cli/dist/coverage-command.js";
import { pathsForToolCall, parseProxyArgs } from "../packages/mcp-proxy/dist/index.js";
import { openTelemetryToResourceEvidence } from "../packages/adapter-opentelemetry/dist/index.js";

const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, "packages/cli/dist/index.js");

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${Array.isArray(contents) ? contents.join("\n") : contents}`.replace(/\n?$/, "\n"));
}

function writeJson(filePath, value) {
  writeFile(filePath, JSON.stringify(value, null, 2));
}

function manifest(cells) {
  return {
    schemaVersion: "cellfence.manifest.v1",
    governance: {
      requireOwnership: true,
      include: ["src/**"],
      exclude: [],
    },
    cells,
  };
}

function cell(id, patch = {}) {
  return {
    id,
    ownedPaths: [`src/${id}/**`],
    publicEntry: `src/${id}/public.ts`,
    publicSymbols: [id === "producer" ? "exposed" : "consumerValue"],
    consumes: [],
    producesArtifacts: [],
    ...patch,
  };
}

function git(rootDir, args) {
  const result = spawnSync("git", args, { cwd: rootDir, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function initGit(rootDir) {
  git(rootDir, ["init", "-q", "-b", "main"]);
  git(rootDir, ["config", "user.email", "cellfence@example.invalid"]);
  git(rootDir, ["config", "user.name", "CellFence Test"]);
}

function makeBaseline(overrides = {}) {
  return {
    schemaVersion: "cellfence.baseline.v1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    cellIds: ["core"],
    cells: {
      core: {
        ownedPathPatterns: 1,
        publicSymbols: 1,
        publicSurfaceLines: 1,
        crossCellDependencies: 0,
        ownedPathSet: ["src/core/**"],
        publicSymbolSet: ["run"],
        dependencyEdges: [],
        resourceAccesses: [],
        artifactContracts: [],
        externalDependencySet: [],
      },
    },
    ...overrides,
  };
}

test("review CF-01: init does not overwrite an existing example cell", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cellfence-review-init-"));
  try {
    writeFile(path.join(rootDir, "src/example/public.ts"), "export const precious = 'KEEP';");
    const result = spawnSync(process.execPath, [cliPath, "--root", rootDir, "init"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.readFileSync(path.join(rootDir, "src/example/public.ts"), "utf8"), "export const precious = 'KEEP';\n");
    const generated = JSON.parse(fs.readFileSync(path.join(rootDir, "cellfence.manifest.json"), "utf8"));
    assert.deepEqual(generated.cells[0].publicSymbols, ["precious"]);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("review CF-02: imports in function parameters, type positions, and binding defaults are extracted", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cellfence-review-import-positions-"));
  try {
    writeFile(path.join(rootDir, "src/producer/public.ts"), "export const exposed = true;");
    writeFile(path.join(rootDir, "src/producer/internal.ts"), "export type SecretType = { secret: true };\nexport const secret = 42;");
    writeFile(path.join(rootDir, "src/consumer/public.ts"), [
      "export const consumerValue = true;",
      "export function withDefault(value = import('../producer/internal.js')) { return value; }",
      "export type UsesSecret = import('../producer/internal.js').SecretType;",
      "const { value = import('../producer/internal.js') } = {};",
    ]);
    writeJson(path.join(rootDir, "cellfence.manifest.json"), manifest([
      cell("producer"),
      cell("consumer", { consumes: [{ cell: "producer" }] }),
    ]));
    const result = checkRepository({ rootDir, manifestPath: "cellfence.manifest.json" });
    const privateFindings = result.findings.filter((finding) => finding.ruleId === "CELLFENCE_PRIVATE_IMPORT");
    assert.equal(privateFindings.length >= 3, true, JSON.stringify(result.findings, null, 2));
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("review CF-03: @internal removal does not erase the preceding public declaration", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cellfence-review-internal-"));
  try {
    const publicPath = path.join(rootDir, "public.ts");
    writeFile(publicPath, [
      "export function run(value: string): string { return value; }",
      "/** @internal */",
      "export const hidden = true;",
    ]);
    const before = publicSurfaceHash(publicPath);
    writeFile(publicPath, [
      "export function run(value: number): number { return value; }",
      "/** @internal */",
      "export const hidden = true;",
    ]);
    assert.notEqual(publicSurfaceHash(publicPath), before);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("review CF-04: Python __all__ preserves public signature material", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cellfence-review-python-all-"));
  try {
    const publicPath = path.join(rootDir, "public.py");
    writeFile(publicPath, [
      "__all__ = ['run']",
      "def run(x):",
      "    return x",
    ]);
    const before = inspectPythonSource(publicPath).surfaceParts;
    assert.equal(before.includes("py:function:run(x)"), true);
    writeFile(publicPath, [
      "__all__ = ['run']",
      "def run(x, y):",
      "    return x + y",
    ]);
    assert.notDeepEqual(inspectPythonSource(publicPath).surfaceParts, before);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("review CF-05 and CF-06: resolution follows specific paths and package condition order", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cellfence-review-resolution-"));
  try {
    writeFile(path.join(rootDir, "src/consumer/private.ts"), "export const safe = true;");
    writeFile(path.join(rootDir, "src/producer/private.ts"), "export const secret = true;");
    assert.equal(resolvePathAliasTarget({
      rootDir,
      pathAliases: [
        { pattern: "@app/*", targets: [path.join(rootDir, "src/consumer/*")] },
        { pattern: "@app/private", targets: [path.join(rootDir, "src/producer/private.ts")] },
      ],
    }, "@app/private"), "src/producer/private.ts");

    const packageRoot = path.join(rootDir, "pkg");
    writeFile(path.join(packageRoot, "src/private.ts"), "export const secret = true;");
    writeFile(path.join(packageRoot, "src/safe.ts"), "export const safe = true;");
    writeFile(path.join(packageRoot, "src/importer.ts"), "export const importer = true;");
    writeJson(path.join(packageRoot, "package.json"), {
      imports: {
        "#selected": {
          node: "./src/private.js",
          import: "./src/safe.js",
          default: "./src/safe.js",
        },
      },
    });
    assert.equal(resolvePackageImportsTarget(rootDir, "pkg/src/importer.ts", "#selected", "import"), "pkg/src/private.ts");
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("review CF-07: repo-local file URL imports are treated as local source imports", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cellfence-review-file-url-"));
  try {
    writeFile(path.join(rootDir, "src/producer/public.ts"), "export const exposed = true;");
    writeFile(path.join(rootDir, "src/producer/internal.ts"), "export const secret = 42;");
    const fileUrl = pathToFileURL(path.join(rootDir, "src/producer/internal.ts")).href;
    writeFile(path.join(rootDir, "src/consumer/public.ts"), `import { secret } from ${JSON.stringify(fileUrl)};\nexport const consumerValue = secret;`);
    writeJson(path.join(rootDir, "cellfence.manifest.json"), manifest([
      cell("producer"),
      cell("consumer", { consumes: [{ cell: "producer" }] }),
    ]));
    const result = checkRepository({ rootDir, manifestPath: "cellfence.manifest.json" });
    assert.equal(result.findings.some((finding) => finding.ruleId === "CELLFENCE_PRIVATE_IMPORT"), true, JSON.stringify(result.findings, null, 2));
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("review CF-08 through CF-10: SQL and fs operations fail closed for writes and quoted selectors", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cellfence-review-resources-"));
  try {
    writeFile(path.join(rootDir, "src/app/public.ts"), [
      "import { openSync } from 'node:fs';",
      "declare const db: { query(sql: string): void };",
      "db.query('DELETE FROM users WHERE id = 1');",
      "db.query('SELECT * FROM \"secret_users\"');",
      "openSync('data/a.txt', 577);",
      "export const app = true;",
    ]);
    writeJson(path.join(rootDir, "cellfence.manifest.json"), manifest([
      cell("app", {
        publicSymbols: ["app"],
        resourceContracts: [
          { id: "users-read", kind: "database", access: ["read"], selectors: ["users"] },
          { id: "data-read", kind: "file", access: ["read"], selectors: ["data/a.txt"] },
        ],
      }),
    ]));
    const result = checkRepository({ rootDir, manifestPath: "cellfence.manifest.json" });
    const simplified = result.findings.map((finding) => ({
      ruleId: finding.ruleId,
      kind: finding.details?.kind,
      access: finding.details?.access,
      selector: finding.details?.selector,
    }));
    assert.equal(simplified.some((finding) => finding.kind === "database" && finding.access === "write" && finding.selector === "users"), true, JSON.stringify(simplified));
    assert.equal(simplified.some((finding) => finding.kind === "database" && finding.access === "read" && finding.selector === "secret_users"), true, JSON.stringify(simplified));
    assert.equal(simplified.some((finding) => finding.kind === "file" && finding.access === "write" && finding.selector === "data/a.txt"), true, JSON.stringify(simplified));
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("review CF-11 and CF-12: task and mutation checks see staged/deleted files and official Stryker reports", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cellfence-review-advanced-"));
  try {
    initGit(rootDir);
    writeFile(path.join(rootDir, "src/deleted.ts"), "export const gone = true;");
    writeFile(path.join(rootDir, "src/core/a.ts"), "export const value = true;");
    writeJson(path.join(rootDir, "task.json"), { allowedWritePaths: ["src/allowed/**"], requiredGates: ["test"] });
    git(rootDir, ["add", "."]);
    git(rootDir, ["commit", "-qm", "initial"]);
    fs.rmSync(path.join(rootDir, "src/deleted.ts"));
    writeFile(path.join(rootDir, "src/staged.ts"), "export const staged = true;");
    git(rootDir, ["add", "src/staged.ts"]);

    const taskResult = checkTaskManifest({ rootDir, taskPath: "task.json" });
    assert.deepEqual(taskResult.changedFiles, ["src/deleted.ts", "src/staged.ts"]);

    writeJson(path.join(rootDir, "stryker-report.json"), {
      schemaVersion: "1.0",
      files: {
        "src/core/a.ts": {
          source: "export const value = true;",
          mutants: [{ id: "1", status: "Survived" }],
        },
      },
    });
    const mutationResult = checkMutationReport({
      rootDir,
      reportPath: "stryker-report.json",
      minScore: 100,
      manifest: manifest([cell("core", { publicSymbols: ["value"] })]),
    });
    assert.equal(mutationResult.ok, false);
    assert.equal(mutationResult.cells.core.survived, 1);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("review CF-22: deleted test files do not crash commit evidence checks", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cellfence-review-deleted-test-"));
  try {
    initGit(rootDir);
    writeFile(path.join(rootDir, "tests/core.test.ts"), "test('works', () => {});");
    writeFile(path.join(rootDir, "src/core/public.ts"), "export const run = true;");
    git(rootDir, ["add", "."]);
    git(rootDir, ["commit", "-qm", "initial"]);
    fs.rmSync(path.join(rootDir, "tests/core.test.ts"));
    git(rootDir, ["add", "."]);
    git(rootDir, ["commit", "-qm", [
      "remove obsolete test",
      "",
      "Problem:",
      "An obsolete test file no longer matches current fixtures.",
      "Change:",
      "Remove the obsolete test file from the suite.",
      "Behavior:",
      "Runtime behavior is unchanged by this test-only update.",
      "Tests:",
      "The removed file is declared in the test evidence trailer.",
      "Known-Gaps:",
      "No additional known gaps.",
      "",
      "Change-Type: test-maintenance",
      "Changed-Cells: none",
      "Tests-Added: none",
      "Tests-Modified: tests/core.test.ts",
      "Test-Impact: removes obsolete test coverage",
      "Tests-Not-Added-Reason: test-only deletion",
      "Agent-Run-Id: review-regression-run",
      "Agent-Task-Id: review-regression-task",
    ].join("\n")]);
    const evidence = checkCommitEvidence({
      rootDir,
      manifest: manifest([cell("core", { publicSymbols: ["run"] })]),
      commit: "HEAD",
    });
    assert.equal(evidence.ok, true, JSON.stringify(evidence.findings, null, 2));
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("review CF-15 through CF-17: runtime adapters preserve evidence semantics", () => {
  const evidence = openTelemetryToResourceEvidence({
    name: "DROP users",
    attributes: {
      "db.system": "postgresql",
      "db.operation": "DROP",
      "db.sql.table": "users",
      "cellfence.cell": "api",
    },
  }, {
    commitSha: "abc123",
    generatedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(evidence.transcriptStatus, "active");
  assert.equal(evidence.accesses[0].access, "write");

  const parsed = parseProxyArgs([
    "--agent", "agent",
    "--downstream-command", "node",
    "--write-tool", "Edit=edits[].path",
  ]);
  assert.deepEqual(pathsForToolCall("Edit", {
    file_path: "src/owned.ts",
    edits: [{ path: "src/other.ts" }],
  }, parsed.writeTools), ["src/other.ts"]);
});

test("review CF-20, CF-21, CF-23 through CF-25: governance metadata and recovery edge cases are explicit", () => {
  const baseBaseline = makeBaseline();
  const headBaseline = makeBaseline();
  headBaseline.cells.core.ownedPathPatterns = 999;
  const baselineReport = detectBaselineChanges(baseBaseline, headBaseline, "base.json", "head.json");
  assert.deepEqual(baselineReport.deltas.find((delta) => delta.dimension === "ownedPaths")?.added, ["core: ownedPathPatterns=999"]);

  const coverageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cellfence-review-coverage-"));
  try {
    writeFile(path.join(coverageRoot, "src/core/public.ts"), "export const run = true;");
    writeJson(path.join(coverageRoot, "cellfence.manifest.json"), manifest([cell("core", { publicSymbols: ["run"] })]));
    const coverage = runCoverageCommand({
      rootDir: coverageRoot,
      format: "json",
      failUnder: 1,
      check: { baselinePath: "missing-baseline.json" },
    });
    assert.equal(coverage.exitCode, 1);
    assert.equal(coverage.report.findings.some((finding) => finding.shape === "configuration"), true);
  } finally {
    fs.rmSync(coverageRoot, { recursive: true, force: true });
  }

  const commitRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cellfence-review-commit-"));
  try {
    initGit(commitRoot);
    writeFile(path.join(commitRoot, "docs/readme.md"), "hello");
    git(commitRoot, ["add", "."]);
    git(commitRoot, ["commit", "-qm", "initial"]);
    writeFile(path.join(commitRoot, "docs/readme.md"), "hello again");
    git(commitRoot, ["add", "."]);
    git(commitRoot, ["commit", "-qm", [
      "docs only",
      "",
      "Problem:",
      "Document context needed.",
      "Change:",
      "Update the documentation text.",
      "Behavior:",
      "Runtime behavior is unchanged.",
      "Tests:",
      "No executable code changed.",
      "Known-Gaps:",
      "No additional known gaps.",
      "",
      "Change-Type: documentation",
      "Changed-Cells: none",
      "Tests-Added: none",
      "Tests-Modified: none",
      "Test-Impact: documentation-only change",
      "Tests-Not-Added-Reason: documentation-only change",
      "Agent-Run-Id: review-regression-run",
      "Agent-Task-Id: review-regression-task",
    ].join("\n")]);
    const evidence = checkCommitEvidence({ rootDir: commitRoot, manifest: manifest([cell("core", { publicSymbols: ["run"] })]), commit: "HEAD" });
    assert.equal(evidence.findings.some((finding) => finding.ruleId === "CELLFENCE_COMMIT_TRAILER_MISSING"), false, JSON.stringify(evidence.findings, null, 2));
  } finally {
    fs.rmSync(commitRoot, { recursive: true, force: true });
  }

  const claimRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cellfence-review-claims-"));
  try {
    const claimPath = path.join(claimRoot, ".cellfence/claims.json");
    fs.mkdirSync(path.dirname(claimPath), { recursive: true });
    fs.writeFileSync(`${claimPath}.local-file-write.lock`, "99999999\n1970-01-01T00:00:00.000Z\n");
    const store = new LocalFileClaimStore({ filePath: claimPath });
    const previous = store.read();
    store.write(emptyClaimStoreState(), previous);
    assert.equal(fs.existsSync(`${claimPath}.local-file-write.lock`), false);
  } finally {
    fs.rmSync(claimRoot, { recursive: true, force: true });
  }

  const pythonRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cellfence-review-python-stdlib-"));
  try {
    writeFile(path.join(pythonRoot, "src/core/public.py"), [
      "import random",
      "import socket",
      "import email",
      "import json",
      "run = 1",
    ]);
    writeJson(path.join(pythonRoot, "cellfence.manifest.json"), {
      ...manifest([{
        ...cell("core", { publicEntry: "src/core/public.py", publicSymbols: ["run"] }),
      }]),
      baseline: makeBaseline(),
    });
    const result = checkRepository({ rootDir: pythonRoot, manifestPath: "cellfence.manifest.json" });
    assert.equal(result.findings.some((finding) => finding.ruleId === "CELLFENCE_RATCHET_EXTERNAL_DEPENDENCY_ADDED"), false, JSON.stringify(result.findings, null, 2));
  } finally {
    fs.rmSync(pythonRoot, { recursive: true, force: true });
  }
});

import { bugFixture } from "./bug-fixtures.mjs";
import { checkChangedRepository, createBaseline, createClaim, checkClaims, checkWriteAccess } from "../packages/engine/dist/index.js";
import { walkCoverage } from "../packages/cli/dist/coverage-walker.js";

test("bug #53 explicit headRef checks that snapshot and leaves caller dirt untouched", (testContext) => {
  const { rootDir, write } = bugFixture(testContext);
  initGit(rootDir);
  git(rootDir, ["add", "."]); git(rootDir, ["commit", "-qm", "base"]);
  const baseRef = git(rootDir, ["rev-parse", "HEAD"]);
  write("src/consumer/work.ts", "import { secret } from '../producer/private'; console.log(secret);\n");
  git(rootDir, ["add", "."]); git(rootDir, ["commit", "-qm", "private import"]);
  const headRef = git(rootDir, ["rev-parse", "HEAD"]);
  git(rootDir, ["checkout", "--detach", baseRef]);
  write("README.md", "uncommitted user content\n");
  const before = git(rootDir, ["status", "--porcelain"]);
  const checked = checkChangedRepository({ rootDir, baseRef, headRef, manifestPath: path.join(rootDir, "cellfence.manifest.json") });
  assert.equal(checked.ok, false);
  assert(checked.findings.some((finding) => finding.ruleId === "CELLFENCE_PRIVATE_IMPORT"));
  assert.equal(git(rootDir, ["rev-parse", "HEAD"]), baseRef);
  assert.equal(git(rootDir, ["status", "--porcelain"]), before);
  assert.equal(git(rootDir, ["worktree", "list", "--porcelain"]).split("worktree ").length, 2);
  assert.equal(checkChangedRepository({ rootDir, baseRef, headRef: baseRef }).ok, true);
});

test("bug #56 cell reservations conflict with descendant globs for either ownership spelling", (testContext) => {
  const { rootDir, write, manifest } = bugFixture(testContext);
  manifest.cells[0].ownedPaths = ["src/producer/"];
  write("cellfence.manifest.json", manifest);
  assert.equal(createClaim({ rootDir, agent: "one", cells: ["producer"], ttl: "1h" }).ok, true);
  const conflict = createClaim({ rootDir, agent: "two", paths: ["src/producer/*.ts"], ttl: "1h" });
  assert.equal(conflict.ok, false);
  assert(conflict.findings.some((finding) => finding.ruleId === "CELLFENCE_ACTIVE_CLAIM_CONFLICT"));
  assert.equal(checkClaims({ rootDir }).ok, true);
  assert.equal(checkWriteAccess({ rootDir, agent: "one", paths: ["src/producer/private.ts"] }).ok, true);
  assert.equal(checkWriteAccess({ rootDir, agent: "two", paths: ["src/producer/private.ts"] }).ok, false);
  assert.equal(createClaim({ rootDir, agent: "two", paths: ["src/producer-extra/*.ts"], ttl: "1h" }).ok, true);
});

test("bug #58 coverage uses governance exclusions and preserves unresolved location", (testContext) => {
  const { rootDir, write, manifest } = bugFixture(testContext);
  manifest.governance.exclude = ["src/consumer/hidden.ts"];
  write("cellfence.manifest.json", manifest);
  write("src/consumer/hidden.ts", "this is invalid {{{\n");
  const clean = walkCoverage({ rootDir });
  assert.equal(clean.check.ok, true);
  assert.equal(clean.totalFiles, 4);
  assert.equal(clean.analyzedFiles.length, 4);
  assert(!clean.analyzedFiles.includes("src/consumer/hidden.ts"));
  write("src/consumer/dynamic.ts", "// location\nrequire(candidate);\n");
  const unresolved = walkCoverage({ rootDir });
  assert.equal(unresolved.totalFiles, 5);
  assert.equal(unresolved.analyzedFiles.length, 4);
  assert(unresolved.unresolved.some((entry) => entry.line === 2 && entry.cellId === "consumer"));
});

test("bug #59 documented bootstrap requires approval before baseline creation", (testContext) => {
  const { rootDir, write, manifest } = bugFixture(testContext);
  write("src/consumer/resource.ts", "import fs from 'node:fs'; fs.readFileSync('data/a.txt');\n");
  assert.throws(() => createBaseline({ rootDir }), /undeclared file resource data\/a.txt/);
  manifest.cells[1].resourceContracts = [{ id: "data", kind: "file", access: ["read"], selectors: ["data/a.txt"] }];
  write("cellfence.manifest.json", manifest);
  write("cellfence.baseline.json", createBaseline({ rootDir }));
  assert.equal(checkRepository({ rootDir, baselinePath: "cellfence.baseline.json" }).ok, true);
});

test("bug #60 Python runtime stdlib creates no dependency ratchet delta", (testContext) => {
  const { rootDir, write } = bugFixture(testContext);
  write("cellfence.baseline.json", createBaseline({ rootDir }));
  write("src/consumer/imports.py", "import json\nimport types\nimport hashlib\nimport xml.etree.ElementTree\n");
  const checked = checkRepository({ rootDir, baselinePath: "cellfence.baseline.json" });
  assert.equal(checked.ok, true, JSON.stringify(checked.findings));
  assert.deepEqual(checked.metrics.consumer.externalDependencySet, []);
  write("src/consumer/imports.py", "import third_party_example\n");
  assert.equal(checkRepository({ rootDir, baselinePath: "cellfence.baseline.json" }).ok, false);
  write("src/consumer/imports.py", "import types\n");
  write("src/types/__init__.py", "value = 1\n");
  assert(checkRepository({ rootDir }).findings.some((finding) => finding.ruleId === "CELLFENCE_UNOWNED_SOURCE"));
});

test("bug #61 empty Changed-Cells is checked against actual ownership", (testContext) => {
  const { rootDir, write, manifest } = bugFixture(testContext);
  manifest.cells[0].ownedPaths = ["src/producer"];
  write("cellfence.manifest.json", manifest);
  initGit(rootDir); git(rootDir, ["add", "."]); git(rootDir, ["commit", "-qm", "base"]);
  const message = (declared) => `Update implementation\n\nProblem:\nA concrete behavior needs adjustment.\nChange:\nThe implementation changes the returned value.\nBehavior:\nThe returned number is forty three.\nTests:\nManual inspection checks this constant change.\nKnown-Gaps:\nNo further assumptions in this fixture.\n\nChange-Type: implementation\nChanged-Cells: ${declared}\nTests-Added: none\nTests-Modified: none\nTest-Impact: Existing behavior is checked by manual inspection.\nTests-Not-Added-Reason: This fixture modifies only a returned constant.\nAgent-Run-Id: regression-run\nAgent-Task-Id: regression-task\n`;
  for (const declared of ["none", "n/a", "producer"]) {
    write("src/producer/private.ts", `export const secret = ${JSON.stringify(declared)};\n`);
    git(rootDir, ["add", "."]); git(rootDir, ["commit", "-qm", message(declared)]);
    const checked = checkCommitEvidence({ rootDir, manifest, commit: "HEAD" });
    assert.deepEqual(checked.commits[0].changedCells, ["producer"]);
    assert.equal(checked.findings.some((finding) => finding.ruleId === "CELLFENCE_COMMIT_CHANGED_CELLS_MISMATCH"), declared !== "producer");
  }
  write("README.md", "Documentation only.\n");
  git(rootDir, ["add", "."]); git(rootDir, ["commit", "-qm", message("none")]);
  assert.equal(checkCommitEvidence({ rootDir, manifest, commit: "HEAD" }).ok, true);
});
