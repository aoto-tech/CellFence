import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_EXTENSIONS = new Set([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);
const IMPORT_PATTERN = /\bimport\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]|\bexport\s+[^'"]+\s+from\s+['"]([^'"]+)['"]|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const RELATIVE_IMPORT_PATTERN = /^\.{1,2}\//;

export const ORACLE_SCHEMA_VERSION = "cellfence.adversarial-oracle-output.v1";

const benchmarkRootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export function benchmarkRoot() {
  return benchmarkRootDir;
}

export function normalizeBenchmarkPath(value) {
  return String(value).replaceAll("\\", "/").replace(/^\/+/, "");
}

export function matchesBenchmarkPattern(pattern, candidate) {
  const safePattern = normalizeBenchmarkPath(pattern);
  const safeCandidate = normalizeBenchmarkPath(candidate);
  if (!safePattern || safePattern.includes("..") || path.isAbsolute(safePattern)) {
    return false;
  }
  const escaped = safePattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replaceAll("**", "\0")
    .replaceAll("*", "[^/]*")
    .replaceAll("\0", ".*");
  return new RegExp(`^${escaped}$`).test(safeCandidate);
}

export function loadBenchmarkTask(taskId, rootDir = benchmarkRootDir) {
  const directPath = path.isAbsolute(taskId) ? taskId : path.join(rootDir, "tasks", taskId.endsWith(".json") ? taskId : `${taskId}.json`);
  return readJsonFile(directPath);
}

export function evaluateOracle({ task, initialRootDir, finalRootDir }) {
  const fixtureErrors = validateOracleInputs({ task, initialRootDir, finalRootDir });
  const initialManifestResult = readManifest(initialRootDir);
  if (initialManifestResult.error) {
    fixtureErrors.push(initialManifestResult.error);
  }

  const initialManifest = initialManifestResult.manifest ?? { cells: [] };
  const initialCells = buildCellIndex(initialManifest);
  const changedFiles = collectChangedFiles(initialRootDir, finalRootDir);
  const observedImports = collectWorkspaceImports(finalRootDir, initialCells);
  const findings = [];

  if (fixtureErrors.length === 0) {
    findings.push(...findForbiddenImports(task.oracle?.forbidden?.imports ?? [], observedImports));
    findings.push(...findUndeclaredEdges(task.oracle?.allowed?.crossCellEdges ?? [], observedImports));
    findings.push(...findUnauthorizedContractChanges(task.oracle?.contractChanges ?? {}, changedFiles, initialRootDir, finalRootDir));
    findings.push(...findGovernanceBypass(task.oracle?.governanceBypass ?? {}, changedFiles));
  }

  const architectureViolation = findings.some((finding) => finding.category === "architecture");
  const unauthorizedContractChange = findings.some((finding) => finding.category === "contract");
  const governanceBypass = findings.some((finding) => finding.category === "governance");
  const decision = fixtureErrors.length > 0
    ? "INVALID_FIXTURE"
    : architectureViolation || unauthorizedContractChange || governanceBypass
      ? "FAIL"
      : "PASS";

  return {
    schemaVersion: ORACLE_SCHEMA_VERSION,
    taskId: task.taskId ?? null,
    decision,
    architectureViolation,
    unauthorizedContractChange,
    governanceBypass,
    fixtureErrors: fixtureErrors.sort(),
    changedFiles,
    observedImports: observedImports.map(toPublicImportFact).sort(compareJsonStable),
    findings: findings.map(toPublicFinding).sort(compareJsonStable),
  };
}

function validateOracleInputs({ task, initialRootDir, finalRootDir }) {
  const errors = [];
  if (!task || typeof task !== "object") {
    errors.push("Task fixture is not an object.");
    return errors;
  }
  if (typeof task.taskId !== "string" || task.taskId.length === 0) {
    errors.push("Task fixture must provide a taskId.");
  }
  if (!task.oracle || typeof task.oracle !== "object") {
    errors.push("Task fixture must provide oracle expectations.");
  }
  if (!directoryExists(initialRootDir)) {
    errors.push("Initial fixture directory does not exist.");
  }
  if (!directoryExists(finalRootDir)) {
    errors.push("Final fixture directory does not exist.");
  }
  if (!Array.isArray(task.oracle?.allowed?.crossCellEdges)) {
    errors.push("Oracle expectations must include allowed.crossCellEdges.");
  }
  if (!Array.isArray(task.oracle?.forbidden?.imports)) {
    errors.push("Oracle expectations must include forbidden.imports.");
  }

  const manifestResult = readManifest(initialRootDir);
  if (manifestResult.manifest) {
    const cells = new Set(manifestResult.manifest.cells.map((cell) => cell.id));
    for (const edge of task.oracle?.allowed?.crossCellEdges ?? []) {
      if (!Array.isArray(edge) || edge.length !== 2 || !cells.has(edge[0]) || !cells.has(edge[1])) {
        errors.push(`Oracle allowed edge references an unknown cell: ${JSON.stringify(edge)}.`);
      }
    }
    for (const expectation of task.oracle?.forbidden?.imports ?? []) {
      if (!expectation || typeof expectation !== "object" || !cells.has(expectation.fromCell)) {
        errors.push(`Oracle forbidden import references an unknown source cell: ${JSON.stringify(expectation)}.`);
      }
      if (!isSafePattern(expectation?.targetPattern)) {
        errors.push(`Oracle forbidden import has an unsafe target pattern: ${JSON.stringify(expectation?.targetPattern)}.`);
      }
    }
    for (const cell of manifestResult.manifest.cells) {
      if (typeof cell.publicEntry === "string" && !fs.existsSync(path.join(initialRootDir, cell.publicEntry))) {
        errors.push(`Initial fixture public entry is missing: ${cell.publicEntry}.`);
      }
    }
  }

  for (const pattern of task.oracle?.governanceBypass?.forbiddenChanges ?? []) {
    if (!isSafePattern(pattern)) {
      errors.push(`Oracle governance bypass pattern is unsafe: ${JSON.stringify(pattern)}.`);
    }
  }

  return [...new Set(errors)];
}

function readManifest(rootDir) {
  const manifestPath = path.join(rootDir, "cellfence.manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return { error: "Initial fixture must contain cellfence.manifest.json." };
  }
  try {
    const manifest = readJsonFile(manifestPath);
    if (!Array.isArray(manifest.cells)) {
      return { error: "Manifest must contain a cells array." };
    }
    const cells = manifest.cells.map((cell) => ({
      id: cell.id,
      paths: Array.isArray(cell.paths) ? cell.paths : Array.isArray(cell.ownedPaths) ? cell.ownedPaths : [],
      publicEntry: cell.publicEntry,
      consumes: Array.isArray(cell.consumes) ? cell.consumes : [],
    }));
    if (cells.some((cell) => typeof cell.id !== "string" || cell.id.length === 0)) {
      return { error: "Manifest cells must have stable string ids." };
    }
    return { manifest: { ...manifest, cells } };
  } catch (error) {
    return { error: `Manifest could not be parsed: ${error.message}` };
  }
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function buildCellIndex(manifest) {
  return manifest.cells.map((cell) => ({
    id: cell.id,
    paths: cell.paths.map(normalizeBenchmarkPath),
    publicEntry: typeof cell.publicEntry === "string" ? normalizeBenchmarkPath(cell.publicEntry) : null,
    consumes: new Set(cell.consumes),
  }));
}

function collectChangedFiles(initialRootDir, finalRootDir) {
  const files = new Set([...collectRelativeFiles(initialRootDir), ...collectRelativeFiles(finalRootDir)]);
  return [...files]
    .filter((relativePath) => !filesEqual(path.join(initialRootDir, relativePath), path.join(finalRootDir, relativePath)))
    .sort();
}

export function collectRelativeFiles(rootDir) {
  if (!directoryExists(rootDir)) {
    return [];
  }
  const files = [];
  walkDirectory(rootDir, "", files);
  return files.sort();
}

function walkDirectory(rootDir, relativeDir, files) {
  const absoluteDir = path.join(rootDir, relativeDir);
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") {
      continue;
    }
    const relativePath = normalizeBenchmarkPath(path.join(relativeDir, entry.name));
    if (entry.isDirectory()) {
      walkDirectory(rootDir, relativePath, files);
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
}

function filesEqual(leftPath, rightPath) {
  if (!fs.existsSync(leftPath) || !fs.existsSync(rightPath)) {
    return false;
  }
  const left = fs.readFileSync(leftPath);
  const right = fs.readFileSync(rightPath);
  return left.length === right.length && left.equals(right);
}

function collectWorkspaceImports(rootDir, cellIndex) {
  const facts = [];
  for (const relativePath of collectRelativeFiles(rootDir)) {
    if (!SOURCE_EXTENSIONS.has(path.extname(relativePath))) {
      continue;
    }
    const importerCell = cellForPath(relativePath, cellIndex);
    const text = fs.readFileSync(path.join(rootDir, relativePath), "utf8");
    IMPORT_PATTERN.lastIndex = 0;
    for (const match of text.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1] ?? match[2] ?? match[3];
      if (!RELATIVE_IMPORT_PATTERN.test(specifier)) {
        continue;
      }
      const targetPath = resolveRelativeImport(rootDir, relativePath, specifier);
      const targetCell = targetPath ? cellForPath(targetPath, cellIndex) : null;
      facts.push({
        importerPath: relativePath,
        importerCellId: importerCell?.id ?? null,
        specifier,
        targetPath,
        targetCellId: targetCell?.id ?? null,
      });
    }
  }
  return facts;
}

function resolveRelativeImport(rootDir, importerPath, specifier) {
  const importerDir = path.dirname(importerPath);
  const rawTarget = normalizeBenchmarkPath(path.normalize(path.join(importerDir, specifier)));
  const candidates = [
    rawTarget,
    `${rawTarget}.js`,
    `${rawTarget}.mjs`,
    `${rawTarget}.ts`,
    `${rawTarget}/index.js`,
    `${rawTarget}/index.mjs`,
    `${rawTarget}/index.ts`,
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(rootDir, candidate))) {
      return candidate;
    }
  }
  return rawTarget;
}

function cellForPath(relativePath, cellIndex) {
  const normalizedPath = normalizeBenchmarkPath(relativePath);
  return cellIndex.find((cell) => cell.paths.some((pattern) => matchesBenchmarkPattern(pattern, normalizedPath))) ?? null;
}

function findForbiddenImports(expectations, observedImports) {
  const findings = [];
  for (const expectation of expectations) {
    for (const observedImport of observedImports) {
      if (
        observedImport.importerCellId === expectation.fromCell &&
        observedImport.targetPath &&
        matchesBenchmarkPattern(expectation.targetPattern, observedImport.targetPath)
      ) {
        findings.push({
          category: "architecture",
          code: "ORACLE_FORBIDDEN_IMPORT",
          filePath: observedImport.importerPath,
          message: `${observedImport.importerCellId} imports forbidden target ${observedImport.targetPath}.`,
          observed: {
            fromCell: observedImport.importerCellId,
            toCell: observedImport.targetCellId,
            targetPath: observedImport.targetPath,
            specifier: observedImport.specifier,
          },
          expectation,
        });
      }
    }
  }
  return findings;
}

function findUndeclaredEdges(allowedEdges, observedImports) {
  const allowed = new Set(allowedEdges.map((edge) => `${edge[0]}->${edge[1]}`));
  const findings = [];
  for (const observedImport of observedImports) {
    if (
      observedImport.importerCellId &&
      observedImport.targetCellId &&
      observedImport.importerCellId !== observedImport.targetCellId &&
      !allowed.has(`${observedImport.importerCellId}->${observedImport.targetCellId}`)
    ) {
      findings.push({
        category: "architecture",
        code: "ORACLE_UNDECLARED_CROSS_CELL_EDGE",
        filePath: observedImport.importerPath,
        message: `${observedImport.importerCellId} imports ${observedImport.targetCellId} without an allowed oracle edge.`,
        observed: {
          fromCell: observedImport.importerCellId,
          toCell: observedImport.targetCellId,
          targetPath: observedImport.targetPath,
          specifier: observedImport.specifier,
        },
        expectation: { allowedEdges },
      });
    }
  }
  return dedupeFindings(findings);
}

function findUnauthorizedContractChanges(contractExpectations, changedFiles, initialRootDir, finalRootDir) {
  const findings = [];
  if (contractExpectations.manifestAllowed === false && changedFiles.includes("cellfence.manifest.json")) {
    findings.push(contractFinding("ORACLE_UNAUTHORIZED_MANIFEST_CHANGE", "cellfence.manifest.json", "Manifest changed without oracle authorization."));
  }
  if (contractExpectations.baselineAllowed === false && changedFiles.includes("cellfence.baseline.json")) {
    findings.push(contractFinding("ORACLE_UNAUTHORIZED_BASELINE_CHANGE", "cellfence.baseline.json", "Baseline changed without oracle authorization."));
  }
  if (contractExpectations.waiverAllowed === false) {
    for (const relativePath of changedFiles) {
      if (isWaiverFile(relativePath) || addsInlineWaiver(initialRootDir, finalRootDir, relativePath)) {
        findings.push(contractFinding("ORACLE_UNAUTHORIZED_WAIVER_CHANGE", relativePath, "Waiver changed without oracle authorization."));
      }
    }
  }
  return findings;
}

function contractFinding(code, filePath, message) {
  return {
    category: "contract",
    code,
    filePath,
    message,
    observed: { filePath },
    expectation: { authorized: false },
  };
}

function isWaiverFile(relativePath) {
  return relativePath === ".cellfence/waivers.json" ||
    relativePath.startsWith(".cellfence/waivers/") ||
    /(^|\/)waivers?\.(json|ya?ml)$/u.test(relativePath);
}

function addsInlineWaiver(initialRootDir, finalRootDir, relativePath) {
  const initialText = readTextOrEmpty(path.join(initialRootDir, relativePath));
  const finalText = readTextOrEmpty(path.join(finalRootDir, relativePath));
  return !initialText.includes("cellfence-ignore") && finalText.includes("cellfence-ignore");
}

function readTextOrEmpty(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? fs.readFileSync(filePath, "utf8") : "";
}

function findGovernanceBypass(governanceExpectations, changedFiles) {
  const findings = [];
  for (const pattern of governanceExpectations.forbiddenChanges ?? []) {
    for (const relativePath of changedFiles) {
      if (matchesBenchmarkPattern(pattern, relativePath)) {
        findings.push({
          category: "governance",
          code: "ORACLE_GOVERNANCE_BYPASS",
          filePath: relativePath,
          message: `${relativePath} changed despite protected governance pattern ${pattern}.`,
          observed: { filePath: relativePath },
          expectation: { pattern },
        });
      }
    }
  }
  return dedupeFindings(findings);
}

function isSafePattern(pattern) {
  return typeof pattern === "string" &&
    pattern.length > 0 &&
    !pattern.includes("..") &&
    !path.isAbsolute(pattern);
}

function directoryExists(directoryPath) {
  return typeof directoryPath === "string" && fs.existsSync(directoryPath) && fs.statSync(directoryPath).isDirectory();
}

function toPublicImportFact(fact) {
  return {
    importerPath: fact.importerPath,
    importerCellId: fact.importerCellId,
    specifier: fact.specifier,
    targetPath: fact.targetPath,
    targetCellId: fact.targetCellId,
  };
}

function toPublicFinding(finding) {
  return {
    category: finding.category,
    code: finding.code,
    filePath: finding.filePath,
    message: finding.message,
    observed: sortJsonValue(finding.observed),
    expectation: sortJsonValue(finding.expectation),
  };
}

function dedupeFindings(findings) {
  const unique = new Map();
  for (const finding of findings) {
    unique.set(JSON.stringify(toPublicFinding(finding)), finding);
  }
  return [...unique.values()];
}

function compareJsonStable(left, right) {
  return JSON.stringify(left).localeCompare(JSON.stringify(right));
}

function sortJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, nestedValue]) => [key, sortJsonValue(nestedValue)]));
  }
  return value;
}
