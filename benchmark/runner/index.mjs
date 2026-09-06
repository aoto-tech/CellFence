import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  benchmarkRoot,
  collectRelativeFiles,
  evaluateOracle,
  loadBenchmarkTask,
  matchesBenchmarkPattern,
  normalizeBenchmarkPath,
} from "../oracle/index.mjs";

const RESULT_SCHEMA_VERSION = "cellfence.adversarial-benchmark-result.v1";
const REPO_ROOT = path.dirname(benchmarkRoot());
const DEFAULT_RESULTS_DIR = path.join(benchmarkRoot(), "results", "raw");
const SOURCE_EXTENSIONS = new Set([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);
const IMPORT_PATTERN = /\bimport\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]|\bexport\s+[^'"]+\s+from\s+['"]([^'"]+)['"]|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const RELATIVE_IMPORT_PATTERN = /^\.{1,2}\//;

export function parseBenchmarkAgentArgs(argv) {
  const parsed = {
    json: false,
    keep: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--json") {
      parsed.json = true;
    } else if (value === "--keep") {
      parsed.keep = true;
    } else if (value.startsWith("--")) {
      const key = camelCaseOption(value.slice(2));
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        throw new Error(`Missing value for --${key}.`);
      }
      parsed[key] = next;
      index += 1;
    } else {
      throw new Error(`Unexpected argument: ${value}.`);
    }
  }
  for (const requiredKey of ["task", "mode", "replay"]) {
    if (!parsed[requiredKey]) {
      throw new Error(`Missing required --${requiredKey} argument.`);
    }
  }
  if (!["instruction-only", "static-rule", "cellfence"].includes(parsed.mode)) {
    throw new Error(`Unknown governance mode: ${parsed.mode}.`);
  }
  return parsed;
}

function camelCaseOption(key) {
  return key.replace(/-([a-z])/gu, (_match, letter) => letter.toUpperCase());
}

export async function runBenchmarkReplay(options) {
  const startedAt = new Date();
  const runId = options.runId ?? createRunId(options.task, options.mode);
  const task = loadBenchmarkTask(options.task);
  const fixtureRoot = path.join(benchmarkRoot(), "fixtures", task.fixture, "base");
  const workspaceRoot = options.workdir
    ? path.resolve(options.workdir)
    : fs.mkdtempSync(path.join(os.tmpdir(), `cellfence-benchmark-${runId}-`));
  const outputRoot = path.resolve(options.out ?? path.join(DEFAULT_RESULTS_DIR, runId));
  const initialSnapshotRoot = path.join(workspaceRoot, "..", `${path.basename(workspaceRoot)}-initial`);
  const artifacts = {};
  const metadata = readReplayMetadata(options.replay);
  let taskRun;
  let governanceRun;
  let oracleOutput;
  let changedFiles;
  let finalDiff;
  let finalCommit;

  prepareOutputRoot(outputRoot);
  prepareWorkspaceRoot(workspaceRoot, Boolean(options.workdir));
  fs.rmSync(initialSnapshotRoot, { recursive: true, force: true });

  try {
    copyDirectory(fixtureRoot, workspaceRoot);
    applyGovernanceMode(options.mode, workspaceRoot);
    initializeGitRepository(workspaceRoot);
    copyDirectory(workspaceRoot, initialSnapshotRoot, { skipGit: true });
    applyReplay(options.replay, workspaceRoot);

    taskRun = runTaskSuccessCommand(task, workspaceRoot);
    governanceRun = runGovernanceCheck(options.mode, workspaceRoot);
    oracleOutput = evaluateOracle({ task, initialRootDir: initialSnapshotRoot, finalRootDir: workspaceRoot });

    const gitState = finalizeGitState(workspaceRoot);
    changedFiles = gitState.changedFiles;
    finalDiff = gitState.finalDiff;
    finalCommit = gitState.finalCommit;

    artifacts["oracle-output"] = writeArtifact(outputRoot, "oracle-output.json", `${JSON.stringify(oracleOutput, null, 2)}\n`);
    artifacts["test-stdout"] = writeArtifact(outputRoot, "test-stdout.txt", taskRun.stdout, [workspaceRoot, initialSnapshotRoot]);
    artifacts["test-stderr"] = writeArtifact(outputRoot, "test-stderr.txt", taskRun.stderr, [workspaceRoot, initialSnapshotRoot]);
    artifacts["governance-stdout"] = writeArtifact(outputRoot, "governance-stdout.txt", governanceRun.stdout, [workspaceRoot, initialSnapshotRoot]);
    artifacts["governance-stderr"] = writeArtifact(outputRoot, "governance-stderr.txt", governanceRun.stderr, [workspaceRoot, initialSnapshotRoot]);
    artifacts["final-diff"] = writeArtifact(outputRoot, "final.diff", finalDiff, [workspaceRoot, initialSnapshotRoot]);
    if (governanceRun.cellfenceOutput) {
      artifacts["cellfence-output"] = writeArtifact(outputRoot, "cellfence-output.json", governanceRun.cellfenceOutput, [workspaceRoot, initialSnapshotRoot]);
    }
    if (governanceRun.staticRuleOutput) {
      artifacts["static-rule-output"] = writeArtifact(outputRoot, "static-rule-output.json", `${JSON.stringify(governanceRun.staticRuleOutput, null, 2)}\n`);
    }
    const transcript = readReplayTranscript(options.replay);
    if (transcript) {
      artifacts["agent-transcript"] = writeArtifact(outputRoot, "agent-transcript.txt", transcript, [workspaceRoot, initialSnapshotRoot]);
    }

    const finishedAt = new Date();
    const result = buildResult({
      runId,
      task,
      mode: options.mode,
      model: options.model ?? metadata.model ?? "replay",
      startedAt,
      finishedAt,
      taskRun,
      governanceRun,
      oracleOutput,
      changedFiles,
      finalCommit,
      artifacts,
      retryCount: metadata.retryCount,
      tokenUsage: metadata.tokenUsage,
    });
    artifacts.result = "result.json";
    result.artifacts = { ...result.artifacts, result: artifacts.result };
    fs.writeFileSync(path.join(outputRoot, "result.json"), `${JSON.stringify(result, null, 2)}\n`);

    return { result, oracleOutput, outputRoot, workspaceRoot };
  } finally {
    if (!options.keep) {
      fs.rmSync(initialSnapshotRoot, { recursive: true, force: true });
      if (!options.workdir) {
        fs.rmSync(workspaceRoot, { recursive: true, force: true });
      }
    }
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseBenchmarkAgentArgs(argv);
  const { result, outputRoot } = await runBenchmarkReplay(options);
  if (options.json) {
    console.log(JSON.stringify({ result, outputRoot }, null, 2));
  } else {
    console.log(`Saved benchmark result: ${path.join(outputRoot, "result.json")}`);
    console.log(`Final gate: ${result.finalGateDecision}; oracle: ${result.oracleDecision}`);
  }
}

function createRunId(taskId, mode) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/u, "Z");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${taskId}-${mode}-${stamp}-${suffix}`;
}

function copyDirectory(sourceDir, targetDir, options = {}) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Directory does not exist: ${sourceDir}`);
  }
  fs.cpSync(sourceDir, targetDir, {
    recursive: true,
    force: true,
    filter: (sourcePath) => {
      if (!options.skipGit) {
        return true;
      }
      const relativePath = path.relative(sourceDir, sourcePath);
      return relativePath === "" || !relativePath.split(path.sep).includes(".git");
    },
  });
}

function prepareWorkspaceRoot(workspaceRoot, userProvided) {
  if (!userProvided) {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
    fs.mkdirSync(workspaceRoot, { recursive: true });
    return;
  }
  if (fs.existsSync(workspaceRoot) && fs.readdirSync(workspaceRoot).length > 0) {
    throw new Error(`Provided workdir is not empty: ${workspaceRoot}`);
  }
  fs.mkdirSync(workspaceRoot, { recursive: true });
}

function prepareOutputRoot(outputRoot) {
  const markerPath = path.join(outputRoot, ".cellfence-benchmark-output");
  if (fs.existsSync(outputRoot)) {
    const entries = fs.readdirSync(outputRoot);
    if (entries.length > 0 && !fs.existsSync(markerPath)) {
      throw new Error(`Output directory is not empty and is not a benchmark output directory: ${outputRoot}`);
    }
    fs.rmSync(outputRoot, { recursive: true, force: true });
  }
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.writeFileSync(markerPath, "cellfence adversarial benchmark output\n");
}

function applyGovernanceMode(mode, workspaceRoot) {
  if (mode === "instruction-only") {
    fs.copyFileSync(
      path.join(benchmarkRoot(), "governance", "instruction-only", "AGENTS.md"),
      path.join(workspaceRoot, "AGENTS.md"),
    );
  }
  if (mode === "static-rule") {
    fs.copyFileSync(
      path.join(benchmarkRoot(), "governance", "static-rule", "static-rule.config.json"),
      path.join(workspaceRoot, "static-rule.config.json"),
    );
  }
}

function initializeGitRepository(workspaceRoot) {
  runProcess("git", ["init", "--quiet"], { cwd: workspaceRoot });
  runProcess("git", ["config", "user.email", "benchmark@example.invalid"], { cwd: workspaceRoot });
  runProcess("git", ["config", "user.name", "CellFence Benchmark"], { cwd: workspaceRoot });
  runProcess("git", ["add", "-A"], { cwd: workspaceRoot });
  runProcess("git", ["commit", "--quiet", "--no-gpg-sign", "-m", "Initial benchmark fixture"], { cwd: workspaceRoot });
}

function applyReplay(replayPath, workspaceRoot) {
  const absoluteReplayPath = path.resolve(replayPath);
  if (!fs.existsSync(absoluteReplayPath)) {
    throw new Error(`Replay path does not exist: ${replayPath}`);
  }
  const stat = fs.statSync(absoluteReplayPath);
  if (stat.isFile()) {
    applyPatchFile(absoluteReplayPath, workspaceRoot);
    return;
  }
  const patchPath = path.join(absoluteReplayPath, "patch.diff");
  if (fs.existsSync(patchPath)) {
    applyPatchFile(patchPath, workspaceRoot);
  }
  const filesPath = path.join(absoluteReplayPath, "files");
  if (fs.existsSync(filesPath)) {
    overlayFiles(filesPath, workspaceRoot);
  }
}

function applyPatchFile(patchPath, workspaceRoot) {
  const result = runProcess("git", ["apply", "--whitespace=nowarn", patchPath], { cwd: workspaceRoot, allowFailure: true });
  if (result.status !== 0) {
    throw new Error(`Replay patch failed: ${result.stderr || result.stdout}`);
  }
}

function overlayFiles(sourceRoot, workspaceRoot) {
  for (const relativePath of collectRelativeFiles(sourceRoot)) {
    assertSafeRelativePath(relativePath);
    const targetPath = path.join(workspaceRoot, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(path.join(sourceRoot, relativePath), targetPath);
  }
}

function assertSafeRelativePath(relativePath) {
  if (path.isAbsolute(relativePath) || relativePath.split("/").includes("..")) {
    throw new Error(`Unsafe replay path: ${relativePath}`);
  }
}

function runTaskSuccessCommand(task, workspaceRoot) {
  const command = task.successCommand;
  if (!command || typeof command.command !== "string" || !Array.isArray(command.args)) {
    throw new Error(`Task ${task.taskId} is missing a successCommand.`);
  }
  return runProcess(command.command, command.args, {
    cwd: workspaceRoot,
    allowFailure: true,
    timeout: command.timeoutMs ?? 60_000,
  });
}

function runGovernanceCheck(mode, workspaceRoot) {
  if (mode === "instruction-only") {
    return {
      decision: "PASS",
      stdout: "",
      stderr: "",
      cellfenceDecision: null,
      staticRuleOutput: null,
      cellfenceOutput: null,
    };
  }
  if (mode === "static-rule") {
    return runStaticRuleCheck(workspaceRoot);
  }
  return runCellFenceCheck(workspaceRoot);
}

function runStaticRuleCheck(workspaceRoot) {
  const configPath = path.join(workspaceRoot, "static-rule.config.json");
  if (!fs.existsSync(configPath)) {
    return {
      decision: "ERROR",
      stdout: "",
      stderr: "static-rule.config.json is missing.",
      cellfenceDecision: null,
      staticRuleOutput: null,
      cellfenceOutput: null,
    };
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const findings = [];
  for (const relativePath of changedFilesSinceInitialCommit(workspaceRoot)) {
    for (const pattern of config.protectedFiles ?? []) {
      if (matchesBenchmarkPattern(pattern, relativePath)) {
        findings.push({
          code: "STATIC_RULE_PROTECTED_FILE_CHANGE",
          filePath: relativePath,
          pattern,
        });
      }
    }
  }
  for (const importFact of collectStaticImports(workspaceRoot)) {
    for (const pattern of config.forbiddenImportTargets ?? []) {
      if (importFact.targetPath && matchesBenchmarkPattern(pattern, importFact.targetPath)) {
        findings.push({
          code: "STATIC_RULE_FORBIDDEN_IMPORT",
          importerPath: importFact.importerPath,
          targetPath: importFact.targetPath,
          pattern,
        });
      }
    }
  }
  const output = {
    schemaVersion: "cellfence.benchmark.static-rule-output.v1",
    decision: findings.length > 0 ? "FAIL" : "PASS",
    findings,
  };
  return {
    decision: output.decision,
    stdout: `${JSON.stringify(output, null, 2)}\n`,
    stderr: "",
    cellfenceDecision: null,
    staticRuleOutput: output,
    cellfenceOutput: null,
  };
}

function changedFilesSinceInitialCommit(workspaceRoot) {
  return runProcess("git", ["diff", "--name-only", "HEAD"], { cwd: workspaceRoot }).stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

function collectStaticImports(workspaceRoot) {
  const imports = [];
  for (const relativePath of collectRelativeFiles(workspaceRoot)) {
    if (!SOURCE_EXTENSIONS.has(path.extname(relativePath))) {
      continue;
    }
    const text = fs.readFileSync(path.join(workspaceRoot, relativePath), "utf8");
    IMPORT_PATTERN.lastIndex = 0;
    for (const match of text.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1] ?? match[2] ?? match[3];
      if (!RELATIVE_IMPORT_PATTERN.test(specifier)) {
        continue;
      }
      imports.push({
        importerPath: relativePath,
        specifier,
        targetPath: resolveStaticRelativeImport(workspaceRoot, relativePath, specifier),
      });
    }
  }
  return imports;
}

function resolveStaticRelativeImport(workspaceRoot, importerPath, specifier) {
  const rawTarget = normalizeBenchmarkPath(path.normalize(path.join(path.dirname(importerPath), specifier)));
  const candidates = [
    rawTarget,
    `${rawTarget}.js`,
    `${rawTarget}.mjs`,
    `${rawTarget}.ts`,
    `${rawTarget}/index.js`,
    `${rawTarget}/index.mjs`,
    `${rawTarget}/index.ts`,
  ];
  return candidates.find((candidate) => fs.existsSync(path.join(workspaceRoot, candidate))) ?? rawTarget;
}

function runCellFenceCheck(workspaceRoot) {
  const args = [path.join(REPO_ROOT, "packages", "cli", "dist", "index.js"), "check", "--json"];
  if (fs.existsSync(path.join(workspaceRoot, "cellfence.baseline.json"))) {
    args.push("--baseline", "cellfence.baseline.json");
  }
  const run = runProcess(process.execPath, args, {
    cwd: workspaceRoot,
    allowFailure: true,
    timeout: 60_000,
  });
  const parsedOutput = parseJsonObject(run.stdout);
  const decision = run.status === 0
    ? "PASS"
    : parsedOutput && parsedOutput.ok === false
      ? "FAIL"
      : "ERROR";
  return {
    decision,
    stdout: run.stdout,
    stderr: run.stderr,
    cellfenceDecision: decision,
    staticRuleOutput: null,
    cellfenceOutput: run.stdout,
  };
}

function parseJsonObject(text) {
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function finalizeGitState(workspaceRoot) {
  runProcess("git", ["add", "-A"], { cwd: workspaceRoot });
  const changedFiles = runProcess("git", ["diff", "--cached", "--name-only"], { cwd: workspaceRoot }).stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
  const finalDiff = runProcess("git", ["diff", "--cached"], { cwd: workspaceRoot }).stdout;
  let finalCommit = runProcess("git", ["rev-parse", "HEAD"], { cwd: workspaceRoot }).stdout.trim();
  if (changedFiles.length > 0) {
    runProcess("git", ["commit", "--quiet", "--no-gpg-sign", "-m", "Apply benchmark replay"], { cwd: workspaceRoot });
    finalCommit = runProcess("git", ["rev-parse", "HEAD"], { cwd: workspaceRoot }).stdout.trim();
  }
  return { changedFiles, finalDiff, finalCommit };
}

function buildResult({
  runId,
  task,
  mode,
  model,
  startedAt,
  finishedAt,
  taskRun,
  governanceRun,
  oracleOutput,
  changedFiles,
  finalCommit,
  artifacts,
  retryCount,
  tokenUsage,
}) {
  const taskSuccess = taskRun.status === 0;
  const finalGateDecision = taskSuccess && governanceRun.decision === "PASS"
    ? "PASS"
    : governanceRun.decision === "ERROR"
      ? "ERROR"
      : "FAIL";
  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    runId,
    taskId: task.taskId,
    governanceMode: mode,
    model,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    taskSuccess,
    architectureViolation: oracleOutput.architectureViolation,
    unauthorizedContractChange: oracleOutput.unauthorizedContractChange,
    governanceBypass: oracleOutput.governanceBypass,
    falseRejection: taskSuccess && oracleOutput.decision === "PASS" && finalGateDecision !== "PASS",
    retryCount: normalizeRetryCount(retryCount),
    elapsedMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
    tokenUsage: normalizeTokenUsage(tokenUsage),
    cellfenceDecision: governanceRun.cellfenceDecision,
    oracleDecision: oracleOutput.decision,
    finalGateDecision,
    changedFiles,
    finalCommit,
    artifacts: { ...artifacts },
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  };
}

function normalizeRetryCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function normalizeTokenUsage(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function readReplayMetadata(replayPath) {
  const metadataPath = path.join(path.resolve(replayPath), "metadata.json");
  if (!fs.existsSync(metadataPath)) {
    return {};
  }
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  return {
    model: typeof metadata.model === "string" ? metadata.model : undefined,
    retryCount: metadata.retryCount,
    tokenUsage: metadata.tokenUsage,
  };
}

function readReplayTranscript(replayPath) {
  const absoluteReplayPath = path.resolve(replayPath);
  if (!fs.existsSync(absoluteReplayPath) || !fs.statSync(absoluteReplayPath).isDirectory()) {
    return "";
  }
  for (const name of ["agent-transcript.txt", "transcript.txt"]) {
    const transcriptPath = path.join(absoluteReplayPath, name);
    if (fs.existsSync(transcriptPath)) {
      return fs.readFileSync(transcriptPath, "utf8");
    }
  }
  return "";
}

function writeArtifact(outputRoot, name, text, roots = []) {
  const relativeName = normalizeBenchmarkPath(name);
  assertSafeRelativePath(relativeName);
  fs.writeFileSync(path.join(outputRoot, relativeName), redactText(text, roots));
  return relativeName;
}

function redactText(value, roots) {
  let text = String(value ?? "");
  const replacements = [...roots, REPO_ROOT].filter(Boolean).sort((left, right) => right.length - left.length);
  for (const root of replacements) {
    text = text.replaceAll(root, "[REDACTED_PATH]");
    text = text.replaceAll(root.replaceAll("\\", "/"), "[REDACTED_PATH]");
  }
  for (const secret of secretEnvironmentValues()) {
    text = text.replaceAll(secret, "[REDACTED_SECRET]");
  }
  text = text.replace(/sk-[A-Za-z0-9_-]{8,}/gu, "[REDACTED_SECRET]");
  text = text.replace(/((?:api[_-]?key|access[_-]?token|auth[_-]?token|secret|password)\s*[:=]\s*)[^\s"'`]+/giu, "$1[REDACTED_SECRET]");
  return text;
}

function secretEnvironmentValues() {
  return Object.entries(process.env)
    .filter(([key, value]) => /(?:api[_-]?key|access[_-]?token|auth[_-]?token|secret|password)/iu.test(key) && typeof value === "string" && value.length >= 8)
    .map(([, value]) => value);
}

function runProcess(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    timeout: options.timeout ?? 30_000,
    env: process.env,
  });
  const status = typeof result.status === "number" ? result.status : 124;
  const output = {
    status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? (result.error ? result.error.message : ""),
  };
  if (!options.allowFailure && output.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${output.stderr || output.stdout}`);
  }
  return output;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
