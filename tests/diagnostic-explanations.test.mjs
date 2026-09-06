import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  checkRepository,
  findingFingerprint,
  formatHumanResult,
} from "../packages/engine/dist/index.js";

const root = process.cwd();
const cliPath = path.join(root, "packages/cli/dist/index.js");

function runCli(args, cwd) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
  });
}

function runCliWithInput(args, cwd, input) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    input,
  });
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function writeJson(filePath, value) {
  writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function tempProject(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `cellfence-${name}-`));
}

function writeManifest(rootDir, cells) {
  writeJson(path.join(rootDir, "cellfence.manifest.json"), {
    schemaVersion: "cellfence.manifest.v1",
    governance: {
      requireOwnership: true,
      include: ["src/**"],
      exclude: [],
    },
    cells,
  });
}

function parserCell(publicSymbols = ["parseDocument"]) {
  return {
    id: "parser",
    ownedPaths: ["src/parser/**"],
    publicEntry: "src/parser/public.ts",
    publicSymbols,
    consumes: [],
    producesArtifacts: [],
  };
}

function reportingCell(consumes) {
  return {
    id: "reporting",
    ownedPaths: ["src/reporting/**"],
    publicEntry: "src/reporting/public.ts",
    publicSymbols: ["buildReport"],
    consumes,
    producesArtifacts: [],
  };
}

function writeBoundaryProject(rootDir, { declaredConsumer, privateImport, similarPublicApi = false }) {
  writeFile(
    path.join(rootDir, "src/parser/public.ts"),
    similarPublicApi
      ? "export const tokenizer = true;\nexport const tokenize = true;\n"
      : "export const parseDocument = true;\n",
  );
  writeFile(path.join(rootDir, "src/parser/internal/tokenizer.ts"), "export const tokenizeInternal = true;\n");
  if (privateImport) {
    writeFile(
      path.join(rootDir, "src/reporting/public.ts"),
      "import { tokenizeInternal } from \"../parser/internal/tokenizer\";\nexport const buildReport = tokenizeInternal;\n",
    );
  } else {
    writeFile(
      path.join(rootDir, "src/reporting/public.ts"),
      "import { parseDocument } from \"../parser/public\";\nexport const buildReport = parseDocument;\n",
    );
  }
  writeManifest(rootDir, [
    parserCell(similarPublicApi ? ["tokenizer", "tokenize"] : ["parseDocument"]),
    reportingCell(declaredConsumer ? [{ cell: "parser" }] : []),
  ]);
}

function findRule(result, ruleId) {
  return result.findings.find((finding) => finding.ruleId === ruleId);
}

function collectKeys(value, key, matches = []) {
  if (!value || typeof value !== "object") return matches;
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, key, matches);
    return matches;
  }
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryKey === key) matches.push(entryValue);
    collectKeys(entryValue, key, matches);
  }
  return matches;
}

function assertNoSuggestedResolutions(value) {
  assert.deepEqual(collectKeys(value, "suggestedResolutions"), []);
}

test("allowed public imports still pass without correctness guarantees", () => {
  const dir = tempProject("diagnostic-public");
  try {
    writeBoundaryProject(dir, { declaredConsumer: true, privateImport: false });

    const result = checkRepository({ rootDir: dir });

    assert.equal(result.ok, true);
    assert.deepEqual(result.findings, []);
    assert.deepEqual(result.warnings, []);
    assertNoSuggestedResolutions(result);
    assert.doesNotMatch(formatHumanResult(result), /guarantee|alternative API|behavioral equivalence|functionally correct/i);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("private import diagnostic explains observed facts and manifest contracts without suggestions", () => {
  const dir = tempProject("diagnostic-private");
  try {
    writeBoundaryProject(dir, { declaredConsumer: true, privateImport: true });

    const result = checkRepository({ rootDir: dir });
    const finding = findRule(result, "CELLFENCE_PRIVATE_IMPORT");

    assert.equal(result.ok, false);
    assert.ok(finding);
    assert.equal(finding.suggestedResolutions, undefined);
    assert.equal(finding.details.targetPath, "src/parser/internal/tokenizer.ts");
    assert.equal(finding.explanation.schemaVersion, "cellfence.finding-explanation.v1");
    assert.deepEqual(finding.explanation.observedFacts[0].value, {
      importerPath: "src/reporting/public.ts",
      importerCellId: "reporting",
      specifier: "../parser/internal/tokenizer",
      kind: "import",
      typeOnly: false,
      targetPath: "src/parser/internal/tokenizer.ts",
      producerCellId: "parser",
      isExternal: false,
      isPublicPackage: false,
      declaredConsumer: true,
      privateImplementation: true,
      packageExportState: undefined,
      packageExportReason: undefined,
    });
    assert.ok(finding.explanation.appliedContracts.some((contract) =>
      contract.filePath === "cellfence.manifest.json"
      && contract.jsonPointer === "/cells/1/consumes/0"
      && contract.value.declarationFound === true
    ));
    assert.ok(finding.explanation.appliedContracts.some((contract) =>
      contract.filePath === "cellfence.manifest.json"
      && contract.jsonPointer === "/cells/0/publicEntry"
      && contract.value === "src/parser/public.ts"
    ));
    assert.match(finding.explanation.judgment, /imports private implementation from parser/);
    assert.ok(finding.explanation.unverified.some((item) => /alternative API/.test(item)));
    assert.ok(finding.explanation.unverified.some((item) => /behavioral equivalence/.test(item)));
    assertNoSuggestedResolutions(result);
    assert.doesNotMatch(JSON.stringify(finding), /Use public entry|instead of|change-code|ask-human/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("undeclared dependency diagnostic explains checked declaration set without JSON add proposal", () => {
  const dir = tempProject("diagnostic-undeclared");
  try {
    writeBoundaryProject(dir, { declaredConsumer: false, privateImport: false });

    const result = checkRepository({ rootDir: dir });
    const finding = findRule(result, "CELLFENCE_UNDECLARED_CONSUMER");

    assert.equal(result.ok, false);
    assert.ok(finding);
    assert.equal(finding.suggestedResolutions, undefined);
    assert.equal(finding.explanation.schemaVersion, "cellfence.finding-explanation.v1");
    assert.equal(finding.explanation.observedFacts[0].value.declaredConsumer, false);
    assert.equal(finding.explanation.observedFacts[0].value.privateImplementation, false);
    assert.deepEqual(finding.explanation.appliedContracts[0].value, {
      importerCellId: "reporting",
      producerCellId: "parser",
      declaredConsumers: [],
      declarationFound: false,
    });
    assert.equal(finding.explanation.appliedContracts[0].jsonPointer, "/cells/1/consumes");
    assert.match(finding.explanation.judgment, /without declaring a consumer relationship/);
    assertNoSuggestedResolutions(result);
    assert.doesNotMatch(JSON.stringify(finding), /"kind":"change-manifest"|Declare .*consumer/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("unresolved import remains rejected without fabricated target or alternative", () => {
  const dir = tempProject("diagnostic-unresolved");
  try {
    writeFile(
      path.join(dir, "src/app/public.ts"),
      "import { missingValue } from \"./missing\";\nexport const app = missingValue;\n",
    );
    writeManifest(dir, [{
      id: "app",
      ownedPaths: ["src/app/**"],
      publicEntry: "src/app/public.ts",
      publicSymbols: ["app"],
      consumes: [],
      producesArtifacts: [],
    }]);

    const result = checkRepository({ rootDir: dir });
    const finding = findRule(result, "CELLFENCE_UNRESOLVED_IMPORT");

    assert.equal(result.ok, false);
    assert.ok(finding);
    assert.equal(finding.details.targetPath, undefined);
    assert.equal(finding.explanation, undefined);
    assertNoSuggestedResolutions(result);
    assert.doesNotMatch(JSON.stringify(finding), /publicEntry|alternative API|Fix the import|Use public entry/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("similarly named public API is not promoted as a replacement", () => {
  const dir = tempProject("diagnostic-similar-public");
  try {
    writeBoundaryProject(dir, { declaredConsumer: true, privateImport: true, similarPublicApi: true });

    const result = checkRepository({ rootDir: dir });
    const finding = findRule(result, "CELLFENCE_PRIVATE_IMPORT");

    assert.equal(result.ok, false);
    assert.ok(finding);
    assert.equal(finding.explanation.appliedContracts.find((contract) =>
      contract.jsonPointer === "/cells/0/publicEntry"
    ).value, "src/parser/public.ts");
    assert.ok(finding.explanation.unverified.some((item) => /alternative API/.test(item)));
    assert.doesNotMatch(JSON.stringify(finding), /instead of|Use public entry|functionally correct|this fix/i);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("explanation text does not affect fingerprints or decisions", () => {
  const dir = tempProject("diagnostic-fingerprint");
  try {
    writeBoundaryProject(dir, { declaredConsumer: true, privateImport: true });
    const result = checkRepository({ rootDir: dir });
    const finding = findRule(result, "CELLFENCE_PRIVATE_IMPORT");
    const changedExplanation = {
      ...finding.explanation,
      observedFacts: [{
        ...finding.explanation.observedFacts[0],
        description: "different observation wording",
      }],
      judgment: "different judgment wording",
      unverified: ["different unverified wording"],
    };

    assert.equal(result.ok, false);
    assert.equal(
      findingFingerprint(finding),
      findingFingerprint({ ...finding, explanation: changedExplanation }),
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI output formats expose explanations without fix suggestions", () => {
  const dir = tempProject("diagnostic-cli");
  try {
    writeBoundaryProject(dir, { declaredConsumer: true, privateImport: true });

    const jsonResult = runCli(["check", "--json"], dir);
    assert.equal(jsonResult.status, 1, jsonResult.stderr || jsonResult.stdout);
    const json = JSON.parse(jsonResult.stdout);
    const jsonFinding = findRule(json, "CELLFENCE_PRIVATE_IMPORT");
    assert.ok(jsonFinding.explanation);
    assertNoSuggestedResolutions(json);

    const humanResult = runCli(["check"], dir);
    assert.equal(humanResult.status, 1, humanResult.stderr || humanResult.stdout);
    assert.match(humanResult.stdout, /Observed:/);
    assert.match(humanResult.stdout, /Contracts:/);
    assert.match(humanResult.stdout, /Unverified:/);
    assert.match(humanResult.stdout, /src\/parser\/public\.ts/);
    assert.doesNotMatch(humanResult.stdout, /Use public entry|instead of|suggestedResolutions/);

    const markdownResult = runCli(["check", "--format", "markdown"], dir);
    assert.equal(markdownResult.status, 1, markdownResult.stderr || markdownResult.stdout);
    assert.match(markdownResult.stdout, /## Diagnostic Evidence/);
    assert.match(markdownResult.stdout, /src\/parser\/public\.ts/);
    assert.doesNotMatch(markdownResult.stdout, /Use public entry|instead of|suggestedResolutions/);

    const sarifResult = runCli(["check", "--format", "sarif"], dir);
    assert.equal(sarifResult.status, 1, sarifResult.stderr || sarifResult.stdout);
    const sarif = JSON.parse(sarifResult.stdout);
    assert.equal(collectKeys(sarif, "fixes").length, 0);
    assertNoSuggestedResolutions(sarif);
    assert.ok(sarif.runs[0].results.some((result) =>
      result.ruleId === "CELLFENCE_PRIVATE_IMPORT"
      && result.properties.explanation
    ));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("MCP check and explain_finding do not redistribute old suggestions", () => {
  const dir = tempProject("diagnostic-mcp");
  try {
    writeBoundaryProject(dir, { declaredConsumer: true, privateImport: true });
    const input = [
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
      JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
      JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "check_change", arguments: {} } }),
      JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "explain_finding",
          arguments: {
            finding: {
              ruleId: "CELLFENCE_PRIVATE_IMPORT",
              message: "private import",
              suggestedResolutions: [{ kind: "change-code", title: "Use public entry", approvalRequired: false }],
            },
          },
        },
      }),
      "",
    ].join("\n");

    const mcpResult = runCliWithInput(["serve", "--mcp"], dir, input);
    assert.equal(mcpResult.status, 0, mcpResult.stderr || mcpResult.stdout);
    const responses = mcpResult.stdout.trim().split(/\n/).map((line) => JSON.parse(line));
    const explainTool = responses[1].result.tools.find((tool) => tool.name === "explain_finding");
    assert.doesNotMatch(explainTool.description, /suggested resolutions/i);

    const checkText = responses[2].result.content[0].text;
    const checkPayload = JSON.parse(checkText);
    assert.ok(findRule(checkPayload, "CELLFENCE_PRIVATE_IMPORT").explanation);
    assertNoSuggestedResolutions(checkPayload);
    assert.doesNotMatch(checkText, /Use public entry|instead of|change-code/);

    const explainText = responses[3].result.content[0].text;
    assert.match(explainText, /"ruleId": "CELLFENCE_PRIVATE_IMPORT"/);
    assert.doesNotMatch(explainText, /Use public entry|suggestedResolutions|change-code/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("baseline contract diffs remain visible without baseline suggestions", () => {
  const dir = tempProject("diagnostic-baseline");
  try {
    writeFile(
      path.join(dir, "src/core/public.ts"),
      "export const a = true;\nexport const b = true;\n",
    );
    writeManifest(dir, [{
      id: "core",
      ownedPaths: ["src/core/**"],
      publicEntry: "src/core/public.ts",
      publicSymbols: ["a", "b"],
      consumes: [],
      producesArtifacts: [],
    }]);
    writeJson(path.join(dir, "cellfence.baseline.json"), {
      schemaVersion: "cellfence.baseline.v1",
      generatedAt: "2026-01-01T00:00:00.000Z",
      cellIds: ["core"],
      cells: {
        core: {
          ownedPathPatterns: 1,
          publicSymbols: 1,
          publicSurfaceLines: 10,
          crossCellDependencies: 0,
          ownedPathSet: ["src/core/**"],
          publicSymbolSet: ["a"],
          dependencyEdges: [],
          artifactContracts: [],
          resourceAccesses: [],
        },
      },
    });

    const result = checkRepository({ rootDir: dir, baselinePath: "cellfence.baseline.json" });
    const growthFinding = findRule(result, "CELLFENCE_RATCHET_PUBLIC_SYMBOL_GROWTH");
    const setFinding = findRule(result, "CELLFENCE_RATCHET_PUBLIC_SYMBOL_SET_CHANGE");

    assert.equal(result.ok, false);
    assert.ok(growthFinding);
    assert.deepEqual(growthFinding.details, { metric: "publicSymbols", previous: 1, current: 2 });
    assert.ok(setFinding);
    assert.deepEqual(setFinding.details.previous, ["a"]);
    assert.deepEqual(setFinding.details.current, ["a", "b"]);
    assert.deepEqual(setFinding.details.addedSymbols, ["b"]);
    assertNoSuggestedResolutions(result);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
