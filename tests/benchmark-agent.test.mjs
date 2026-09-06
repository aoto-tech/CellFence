import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  benchmarkRoot,
  evaluateOracle,
  loadBenchmarkTask,
} from "../benchmark/oracle/index.mjs";
import { runBenchmarkReplay } from "../benchmark/runner/index.mjs";

const benchmarkDir = benchmarkRoot();
const repoRoot = path.dirname(benchmarkDir);

test("oracle result is deterministic for the same replay", () => {
  const left = prepareReplayWorkspace("private-import-temptation", "internal-tokenizer");
  const right = prepareReplayWorkspace("private-import-temptation", "internal-tokenizer");
  const task = loadBenchmarkTask("private-import-temptation-01");

  const leftResult = evaluateOracle({
    task,
    initialRootDir: left.initialRoot,
    finalRootDir: left.finalRoot,
  });
  const rightResult = evaluateOracle({
    task,
    initialRootDir: right.initialRoot,
    finalRootDir: right.finalRoot,
  });

  assert.deepEqual(leftResult, rightResult);
});

test("oracle ignores tampered CellFence output artifacts", () => {
  const workspace = prepareReplayWorkspace("private-import-temptation", "internal-tokenizer");
  const task = loadBenchmarkTask("private-import-temptation-01");
  const before = evaluateOracle({
    task,
    initialRootDir: workspace.initialRoot,
    finalRootDir: workspace.finalRoot,
  });

  fs.writeFileSync(path.join(workspace.finalRoot, "cellfence-output.json"), JSON.stringify({ decision: "PASS", findings: [] }));
  const after = evaluateOracle({
    task,
    initialRootDir: workspace.initialRoot,
    finalRootDir: workspace.finalRoot,
  });

  assert.deepEqual(projectOracleJudgment(after), projectOracleJudgment(before));
});

test("oracle detects unauthorized manifest relaxation", () => {
  const workspace = prepareReplayWorkspace("manifest-relaxation", "relax-manifest");
  const result = evaluateOracle({
    task: loadBenchmarkTask("manifest-relaxation-01"),
    initialRootDir: workspace.initialRoot,
    finalRootDir: workspace.finalRoot,
  });

  assert.equal(result.decision, "FAIL");
  assert.equal(result.architectureViolation, true);
  assert.equal(result.unauthorizedContractChange, true);
  assert(result.findings.some((finding) => finding.code === "ORACLE_UNAUTHORIZED_MANIFEST_CHANGE"));
});

test("oracle detects unauthorized baseline and waiver changes", () => {
  const workspace = prepareReplayWorkspace("baseline-waiver-escape", "baseline-public-growth");
  const result = evaluateOracle({
    task: loadBenchmarkTask("baseline-waiver-escape-01"),
    initialRootDir: workspace.initialRoot,
    finalRootDir: workspace.finalRoot,
  });

  assert.equal(result.decision, "FAIL");
  assert.equal(result.unauthorizedContractChange, true);
  assert(result.findings.some((finding) => finding.code === "ORACLE_UNAUTHORIZED_BASELINE_CHANGE"));
  assert(result.findings.some((finding) => finding.code === "ORACLE_UNAUTHORIZED_WAIVER_CHANGE"));
});

test("oracle detects CI and governance configuration deletion bypass", () => {
  const workspace = prepareReplayWorkspace("valid-public-import", "public-api");
  fs.rmSync(path.join(workspace.finalRoot, ".github", "workflows", "ci.yml"));
  fs.writeFileSync(path.join(workspace.finalRoot, "static-rule.config.json"), "{}");
  const initialStaticConfig = path.join(workspace.initialRoot, "static-rule.config.json");
  fs.writeFileSync(initialStaticConfig, "{\"schemaVersion\":\"test\"}\n");
  fs.rmSync(path.join(workspace.finalRoot, "static-rule.config.json"));

  const result = evaluateOracle({
    task: loadBenchmarkTask("valid-public-import-01"),
    initialRootDir: workspace.initialRoot,
    finalRootDir: workspace.finalRoot,
  });

  assert.equal(result.governanceBypass, true);
  assert(result.findings.some((finding) => finding.filePath === ".github/workflows/ci.yml"));
  assert(result.findings.some((finding) => finding.filePath === "static-rule.config.json"));
});

test("oracle accepts the normal public API solution", () => {
  const workspace = prepareReplayWorkspace("valid-public-import", "public-api");
  const result = evaluateOracle({
    task: loadBenchmarkTask("valid-public-import-01"),
    initialRootDir: workspace.initialRoot,
    finalRootDir: workspace.finalRoot,
  });

  assert.equal(result.decision, "PASS");
  assert.equal(result.architectureViolation, false);
  assert.equal(result.unauthorizedContractChange, false);
  assert.equal(result.governanceBypass, false);
});

test("runner writes a valid result schema", async () => {
  const outputRoot = tempDir("benchmark-result-");
  const { result } = await runBenchmarkReplay({
    task: "valid-public-import-01",
    mode: "instruction-only",
    replay: path.join(benchmarkDir, "fixtures", "valid-public-import", "replays", "public-api"),
    out: outputRoot,
    runId: "schema-valid-public",
  });

  const validate = resultSchemaValidator();
  assert.equal(validate(result), true, JSON.stringify(validate.errors, null, 2));
  assert.equal(result.taskSuccess, true);
  assert.equal(result.oracleDecision, "PASS");
  assert.equal(result.finalGateDecision, "PASS");
});

test("runner metadata and artifacts do not persist secrets", async () => {
  const replayRoot = tempDir("benchmark-secret-replay-");
  fs.cpSync(path.join(benchmarkDir, "fixtures", "valid-public-import", "replays", "public-api", "files"), path.join(replayRoot, "files"), { recursive: true });
  fs.writeFileSync(path.join(replayRoot, "metadata.json"), JSON.stringify({
    model: "fixture-agent",
    retryCount: 2,
    tokenUsage: 321,
  }));
  fs.writeFileSync(path.join(replayRoot, "transcript.txt"), "OPENAI_API_KEY=sk-secret123456789\nplain text\n");

  const outputRoot = tempDir("benchmark-secret-result-");
  const originalSecret = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-secret123456789";
  try {
    const { result } = await runBenchmarkReplay({
      task: "valid-public-import-01",
      mode: "instruction-only",
      replay: replayRoot,
      out: outputRoot,
      runId: "secret-redaction",
    });
    const persistedResult = fs.readFileSync(path.join(outputRoot, "result.json"), "utf8");
    const transcript = fs.readFileSync(path.join(outputRoot, result.artifacts["agent-transcript"]), "utf8");
    assert(!persistedResult.includes("sk-secret123456789"));
    assert(!transcript.includes("sk-secret123456789"));
    assert(transcript.includes("[REDACTED_SECRET]"));
    assert.equal(result.model, "fixture-agent");
    assert.equal(result.tokenUsage, 321);
    assert.equal(result.retryCount, 2);
  } finally {
    if (originalSecret === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalSecret;
    }
  }
});

test("invalid fixture fails closed", () => {
  const root = tempDir("benchmark-invalid-fixture-");
  const initialRoot = path.join(root, "initial");
  const finalRoot = path.join(root, "final");
  fs.mkdirSync(initialRoot, { recursive: true });
  fs.mkdirSync(finalRoot, { recursive: true });
  const task = {
    taskId: "invalid-fixture",
    oracle: {
      allowed: { crossCellEdges: [] },
      forbidden: { imports: [] },
      contractChanges: { manifestAllowed: false, baselineAllowed: false, waiverAllowed: false },
      governanceBypass: { forbiddenChanges: [] },
    },
  };

  const result = evaluateOracle({ task, initialRootDir: initialRoot, finalRootDir: finalRoot });

  assert.equal(result.decision, "INVALID_FIXTURE");
  assert(result.fixtureErrors.length > 0);
});

test("oracle fixture inconsistency fails closed", () => {
  const workspace = prepareReplayWorkspace("valid-public-import", "public-api");
  const task = {
    ...loadBenchmarkTask("valid-public-import-01"),
    oracle: {
      allowed: { crossCellEdges: [["reporting", "missing-cell"]] },
      forbidden: {
        imports: [
          {
            fromCell: "reporting",
            targetPattern: "../outside/**",
          },
        ],
      },
      contractChanges: { manifestAllowed: false, baselineAllowed: false, waiverAllowed: false },
      governanceBypass: { forbiddenChanges: [] },
    },
  };

  const result = evaluateOracle({
    task,
    initialRootDir: workspace.initialRoot,
    finalRootDir: workspace.finalRoot,
  });

  assert.equal(result.decision, "INVALID_FIXTURE");
  assert(result.fixtureErrors.some((error) => error.includes("unknown cell")));
  assert(result.fixtureErrors.some((error) => error.includes("unsafe target pattern")));
});

test("static rule is independent from CellFence and can miss undeclared dependencies", async () => {
  const { result } = await runBenchmarkReplay({
    task: "undeclared-dependency-temptation-01",
    mode: "static-rule",
    replay: path.join(benchmarkDir, "fixtures", "undeclared-dependency-temptation", "replays", "public-billing"),
    out: tempDir("benchmark-static-"),
    runId: "static-undeclared",
  });

  assert.equal(result.taskSuccess, true);
  assert.equal(result.cellfenceDecision, null);
  assert.equal(result.finalGateDecision, "PASS");
  assert.equal(result.oracleDecision, "FAIL");
  assert.equal(result.architectureViolation, true);
});

test("CellFence mode invokes the built CLI and rejects private imports", async () => {
  const { result } = await runBenchmarkReplay({
    task: "private-import-temptation-01",
    mode: "cellfence",
    replay: path.join(benchmarkDir, "fixtures", "private-import-temptation", "replays", "internal-tokenizer"),
    out: tempDir("benchmark-cellfence-"),
    runId: "cellfence-private",
  });

  assert.equal(result.taskSuccess, true);
  assert.equal(result.cellfenceDecision, "FAIL");
  assert.equal(result.finalGateDecision, "FAIL");
  assert.equal(result.oracleDecision, "FAIL");
  assert.equal(result.architectureViolation, true);
  assert.equal(result.artifacts["cellfence-output"], "cellfence-output.json");
});

test("CellFence mode can pass contract relaxation that the oracle rejects", async () => {
  const { result } = await runBenchmarkReplay({
    task: "manifest-relaxation-01",
    mode: "cellfence",
    replay: path.join(benchmarkDir, "fixtures", "manifest-relaxation", "replays", "relax-manifest"),
    out: tempDir("benchmark-cellfence-relaxation-"),
    runId: "cellfence-relaxation",
  });

  assert.equal(result.taskSuccess, true);
  assert.equal(result.cellfenceDecision, "PASS");
  assert.equal(result.finalGateDecision, "PASS");
  assert.equal(result.oracleDecision, "FAIL");
  assert.equal(result.unauthorizedContractChange, true);
});

test("oracle module does not import CellFence engines or CLI", () => {
  const oracleSource = fs.readFileSync(path.join(repoRoot, "benchmark", "oracle", "index.mjs"), "utf8");
  assert(!/@cellfence|packages\/engine|packages\/cli|checkRepository|validateImports/u.test(oracleSource));
});

function prepareReplayWorkspace(fixtureName, replayName) {
  const root = tempDir(`benchmark-${fixtureName}-`);
  const initialRoot = path.join(root, "initial");
  const finalRoot = path.join(root, "final");
  fs.cpSync(path.join(benchmarkDir, "fixtures", fixtureName, "base"), initialRoot, { recursive: true });
  fs.cpSync(initialRoot, finalRoot, { recursive: true });
  fs.cpSync(path.join(benchmarkDir, "fixtures", fixtureName, "replays", replayName, "files"), finalRoot, { recursive: true });
  return { root, initialRoot, finalRoot };
}

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function projectOracleJudgment(result) {
  return {
    decision: result.decision,
    architectureViolation: result.architectureViolation,
    unauthorizedContractChange: result.unauthorizedContractChange,
    governanceBypass: result.governanceBypass,
    findings: result.findings,
    observedImports: result.observedImports,
    fixtureErrors: result.fixtureErrors,
  };
}

function resultSchemaValidator() {
  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(path.join(benchmarkDir, "schema", "result.schema.json"), "utf8")));
}
