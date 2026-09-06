import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

import {
  type CellFenceBaseline,
  type CellFenceManifest,
  type CellManifest,
  type CellConsumerManifest,
  validateBaseline,
  validateManifest,
  type RuleSeverity as ConfiguredRuleSeverity,
} from "@cellfence/schema";
export type { CellFenceBaseline } from "@cellfence/schema";
import {
  absolutePath,
  listFiles,
  listSymlinks,
  matchesPattern,
  normalizePath,
  pathIsGoverned,
  pathOwnedByCell,
  patternCoveredByOwnedPaths,
  readSourceText,
  repoPath,
  SOURCE_EXTENSIONS,
  type SymlinkEntry,
  sourceFilesForCell,
  sourceFilesUnderGovernance,
  sourceKindForPath,
} from "./file-index.js";

// C-5: re-export the glob matcher so plugins can share a single, linear-time
// implementation instead of maintaining their own patternToRegExp copies.
export { matchesPattern } from "./file-index.js";
import {
  extractImports,
  extractPublicSymbols,
  getLineNumber,
  importSpecifierLooksPathLike,
  literalText,
  resolvePythonImport,
  resolveNearestPathAliasTarget,
  resolvePackageExportTarget,
  resolvePackageImportsTarget,
  resolvePathAliasTarget,
  resolveRelativeImport,
  type ImportReference,
} from "./module-resolution.js";
import {
  collectResourceAccesses,
  type ResourceAccessMode,
  type ResourceAccessReference,
} from "./resource-access.js";
import {
  addAccessToCell,
  evidencePathsForOptions,
  mergeAccessesByCell,
  resourceEvidenceAccesses as resourceEvidenceAccessesOperation,
} from "./resource-evidence.js";
import {
  externalDependencyIdForImport,
  validateExternalDependencyPolicy,
  type ExternalDependencyObservation,
} from "./external-dependencies.js";
import { createAcceptanceRecord } from "./governance/acceptance-record.js";
import { createEvidenceGraph } from "./governance/evidence-graph.js";
import { governanceEvidenceEnvelopeForCheck } from "./governance/evidence-envelope.js";
import { evaluateGovernance } from "./governance/evaluator.js";
import {
  evaluateImportPolicyFact,
  type ImportPolicyJudgment,
  type NormalizedObservedImportFact,
} from "./governance/import-policy.js";
import { legacyDecisionFromEvaluation } from "./governance/legacy-adapter.js";
import { validateChangedPathClasses, validatePathClassImports } from "./advanced-governance.js";
import { CORE_REQUIRED_RULES, DEFAULT_MANIFEST_PATH } from "./constants.js";
import { readJsonFile } from "./json-file.js";
import {
  addFinding,
  findingFingerprint,
  withFindingFingerprint,
} from "./findings.js";
import { ownedPathPatternsOverlap } from "./glob-overlap.js";
import { errorMessage } from "./errors.js";
import { execCommandSync } from "./command-execution.js";
import {
  BASELINE_ED25519_KEY_ID_ENV,
  BASELINE_ED25519_PUBLIC_KEY_ENV,
  BASELINE_HMAC_KEY_ENV,
  BASELINE_HMAC_KEY_ID_ENV,
  validateBaselineSealFindings,
} from "./baseline-seal.js";
import {
  compareBaseline,
  computeMetrics,
  resourceBaselineEntry,
  resourceBaselineKey,
  sortedResourceBaselineEntries,
} from "./baseline-ratchet.js";
import {
  createBaseline as createBaselineOperation,
  defaultBaselinePath,
  guardBaselineUpdate as guardBaselineUpdateOperation,
  loadBaselineFromFile,
  verifyBaselineSeal as verifyBaselineSealOperation,
} from "./baseline.js";
import {
  checkClaims as checkClaimsOperation,
  checkClaimsAsync as checkClaimsOperationAsync,
  checkWriteAccess as checkWriteAccessOperation,
  checkWriteAccessAsync as checkWriteAccessOperationAsync,
  createClaim as createClaimOperation,
  createClaimAsync as createClaimOperationAsync,
  listClaims as listClaimsOperation,
  listClaimsAsync as listClaimsOperationAsync,
} from "./claims.js";
export { GitHubArtifactClaimStore, type GitHubArtifactClaimStoreOptions } from "./claims/backends/github-artifact.js";
export { RedisClaimStore, type RedisClaimStoreOptions, type RedisLike } from "./claims/backends/redis.js";
import { createCellContext as createCellContextOperation } from "./context.js";
import {
  createAutoAllocation as createAutoAllocationOperation,
  createCouplingGraph as createCouplingGraphOperation,
} from "./graph.js";
import { createRepositoryModel } from "./repository-model.js";
import {
  changedBaseCacheKey,
  readChangedBaseCache,
  writeChangedBaseCache,
} from "./changed-cache.js";
import { createContext, findOwningCell, owningCells } from "./analysis-context.js";
import {
  applyWaiversToFindings,
  collectWaiversForManifest,
  listWaivers as listWaiversOperation,

  waiverMatchesFinding,
} from "./waivers.js";
import { pythonSourceRoots } from "./python-roots.js";
import { prewarmPythonInspections } from "./python-analysis.js";
import { pythonInspectorRuntimeIdentity } from "./python-inspector-runner.js";
import type {
  AnalysisContext,
  AutoAllocation,
  AutoAllocateOptions,
  BaselineUpdateGuardOptions,
  BaselineUpdateGuardResult,
  CellFenceContext,
  CellFenceWaiver,
  ChangedCheckOptions,
  CheckOptions,
  CheckResult,
  ClaimCheckOptions,
  ClaimCheckResult,
  ClaimCreateOptions,
  ClaimCreateResult,
  ContextOptions,
  CouplingGraph,
  Finding,
  FindingExplanation,
  FindingExplanationContract,
  FindingExplanationObservation,
  PluginDefinition,
  PluginAdapterHelpers,
  PluginFinding,
  PluginImportReference,
  PluginRepositoryModel,
  PluginResourceAccess,
  PluginRuleContext,
  PruneCandidate,
  PruneCandidateKind,
  PruneReport,
  ResolvedImport,
  Severity,
  WriteAccessOptions,
  WriteAccessResult,
} from "./types.js";

export { inferManifest, type InferManifestOptions } from "./manifest-inference.js";
export {
  buildCmdCommandLine,
  execCommandSync,
  resolveCommand,
  type ExecCommandOptions,
} from "./command-execution.js";
export {
  checkCommitEvidence,
  checkDesignDocs,
  checkMutationReport,
  checkTaskManifest,
  createBaselineAudit,
  createManifestFromServiceManifests,
  profileConfig,
  profileRuleSeverities,
  stampDesignDoc,
  verifyManifestFromServiceManifests,
  type BaselineAuditResult,
  type CommitEvidenceResult,
  type DocsCheckResult,
  type MutationCheckResult,
  type ServiceManifestImportResult,
  type ServiceManifestVerifyResult,
  type TaskCheckResult,
} from "./advanced-governance.js";
export {
  defaultBaselinePath,
  loadBaselineFromFile,
  sealBaselineWithConfiguredKey,
  writeBaselineFile,
} from "./baseline.js";
export {
  sealBaselineIfConfigured,
} from "./baseline-seal.js";
export {
  createWaiverRequest,
  formatCouplingGraphMermaid,
} from "./graph.js";
export {
  createEvidenceGraph,
  findingWitness,
  type EvidenceGraphInput,
} from "./governance/evidence-graph.js";
export type {
  EvidenceGraph,
  EvidenceGraphEdge,
  EvidenceGraphEdgeKind,
  EvidenceGraphNode,
  EvidenceGraphNodeKind,
  FindingWitness,
  FindingWitnessSubject,
} from "./governance/model.js";
export type {
  AutoAllocation,
  AutoAllocateOptions,
  BaselineUpdateGuardOptions,
  BaselineUpdateGuardResult,
  CellFenceClaim,
  CellFenceClaimStore,
  CellFenceContext,
  CellFenceWaiver,
  ChangedCheckOptions,
  CheckOptions,
  CheckResult,
  ClaimCheckOptions,
  ClaimCheckResult,
  ClaimCreateOptions,
  ClaimCreateResult,
  ContextAllowedImport,
  ContextBudgetEntry,
  ContextOptions,
  CouplingGraph,
  CouplingGraphEdge,
  CouplingGraphEdgeKind,
  CouplingGraphNode,
  Finding,
  FindingExplanation,
  FindingExplanationContract,
  FindingExplanationObservation,
  FindingExplanationScalar,
  FindingExplanationValue,
  PruneCandidate,
  PruneCandidateKind,
  PruneReport,
  RuleId,
  Severity,
  SuggestedResolution,
  WaiverRequest,
  WaiverRequestOptions,
  WriteAccessOptions,
  WriteAccessPathDecision,
  WriteAccessResult,
} from "./types.js";

export {
  MAX_WAIVER_DAYS,
  WAIVER_ATTESTATION_HMAC_KEY_ENV,
  WAIVER_ATTESTATION_HMAC_KEY_ID_ENV,
  WAIVER_REPOSITORY_IDENTITY_ENV,
  waiverAttestationHmacDigest,
} from "./waivers.js";
export { CORE_REQUIRED_RULES } from "./constants.js";
export function listWaivers(options: CheckOptions = {}): CellFenceWaiver[] {
  return listWaiversOperation(options);
}

function validateDuplicateCellIds(manifest: CellFenceManifest, findings: Finding[]): void {
  const seenCellIds = new Set<string>();
  for (const cell of manifest.cells) {
    if (seenCellIds.has(cell.id)) {
      addFinding(findings, {
        ruleId: "CELLFENCE_DUPLICATE_CELL_ID",
        severity: "error",
        cellId: cell.id,
        message: `duplicate cell id ${cell.id}`,
      });
    }
    seenCellIds.add(cell.id);
  }
}

function validateOwnershipOverlap(manifest: CellFenceManifest, findings: Finding[]): void {
  for (let leftIndex = 0; leftIndex < manifest.cells.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < manifest.cells.length; rightIndex += 1) {
      const leftCell = manifest.cells[leftIndex];
      const rightCell = manifest.cells[rightIndex];
      for (const leftPattern of leftCell.ownedPaths) {
        for (const rightPattern of rightCell.ownedPaths) {
          if (ownedPathPatternsOverlap(leftPattern, rightPattern)) {
            addFinding(findings, {
              ruleId: "CELLFENCE_OWNERSHIP_OVERLAP",
              severity: "error",
              cellId: leftCell.id,
              producerCellId: rightCell.id,
              message: `owned path patterns overlap: ${leftCell.id}:${leftPattern} and ${rightCell.id}:${rightPattern}`,
              details: { leftPattern, rightPattern },
            });
          }
        }
      }
    }
  }
}

function warnWhenOwnershipCoverageDisabled(context: AnalysisContext, warnings: Finding[]): void {
  if (context.manifest.governance?.requireOwnership === true) return;
  addFinding(warnings, {
    ruleId: "CELLFENCE_OWNERSHIP_COVERAGE_DISABLED",
    severity: "warning",
    message: "strict ownership coverage is disabled; source outside ownedPaths can escape CellFence checks",
    details: {
      governance: context.manifest.governance,
    },
  });
}

function validateOwnershipCoverage(context: AnalysisContext, findings: Finding[]): void {
  for (const cell of context.manifest.cells) {
    if (!pathOwnedByCell(cell, cell.publicEntry)) {
      addFinding(findings, {
        ruleId: "CELLFENCE_PUBLIC_ENTRY_OUTSIDE_OWNERSHIP",
        severity: "error",
        cellId: cell.id,
        filePath: cell.publicEntry,
        message: `${cell.id} public entry is outside its ownedPaths: ${cell.publicEntry}`,
        details: { publicEntry: cell.publicEntry, ownedPaths: cell.ownedPaths },
      });
    }

    for (const publicPath of cell.publicPaths || []) {
      if (patternCoveredByOwnedPaths(publicPath, cell.ownedPaths)) continue;
      addFinding(findings, {
        ruleId: "CELLFENCE_PUBLIC_ENTRY_OUTSIDE_OWNERSHIP",
        severity: "error",
        cellId: cell.id,
        filePath: publicPath,
        message: `${cell.id} public path is outside its ownedPaths: ${publicPath}`,
        details: { publicPath, ownedPaths: cell.ownedPaths },
      });
    }

    for (const artifactLane of cell.producesArtifacts || []) {
      if (artifactLane.external) continue;
      for (const artifactPath of artifactLane.paths) {
        if (patternCoveredByOwnedPaths(artifactPath, cell.ownedPaths)) continue;
        addFinding(findings, {
          ruleId: "CELLFENCE_ARTIFACT_OUTSIDE_OWNERSHIP",
          severity: "error",
          cellId: cell.id,
          filePath: artifactPath,
          message: `${cell.id} artifact lane ${artifactLane.id} is outside its ownedPaths: ${artifactPath}`,
          details: { artifactLaneId: artifactLane.id, artifactPath, ownedPaths: cell.ownedPaths },
        });
      }
    }
  }

  for (const sourceFilePath of sourceFilesUnderGovernance(context.rootDir, context.manifest, context)) {
    const relativePath = repoPath(context.rootDir, sourceFilePath);
    if (findOwningCell(context.manifest, relativePath)) continue;
    addFinding(findings, {
      ruleId: "CELLFENCE_UNOWNED_SOURCE",
      severity: "error",
      filePath: relativePath,
      message: `governed source file is not owned by any cell: ${relativePath}`,
      details: { path: relativePath, governance: context.manifest.governance },
    });
  }
}

function symlinkIsRelevant(context: AnalysisContext, symlink: SymlinkEntry): boolean {
  const relativePath = repoPath(context.rootDir, symlink.path);
  return SOURCE_EXTENSIONS.includes(path.extname(relativePath))
    || pathIsGoverned(context.manifest, relativePath)
    || owningCells(context.manifest, relativePath).length > 0;
}

function pathIsInsideDirectory(directoryPath: string, targetPath: string): boolean {
  const relativePath = path.relative(directoryPath, targetPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function targetIsInsideRoot(rootDir: string, targetPath: string): boolean {
  const targetAbsolutePath = path.resolve(targetPath);
  if (!fs.existsSync(targetAbsolutePath)) {
    return pathIsInsideDirectory(path.resolve(rootDir), targetAbsolutePath);
  }
  return pathIsInsideDirectory(fs.realpathSync(rootDir), fs.realpathSync(targetAbsolutePath));
}

function validateSymlinkTargets(context: AnalysisContext, findings: Finding[]): void {
  for (const symlink of listSymlinks(context.rootDir)) {
    if (!symlinkIsRelevant(context, symlink)) continue;
    const relativePath = repoPath(context.rootDir, symlink.path);
    if (!symlink.targetPath) {
      addFinding(findings, {
        ruleId: "CELLFENCE_SYMLINK_TARGET_OUTSIDE_OWNERSHIP",
        severity: "error",
        filePath: relativePath,
        message: `governed symlink cannot be resolved: ${relativePath}`,
        details: { path: relativePath, error: symlink.error },
      });
      continue;
    }
    if (!targetIsInsideRoot(context.rootDir, symlink.targetPath)) {
      addFinding(findings, {
        ruleId: "CELLFENCE_SYMLINK_TARGET_OUTSIDE_OWNERSHIP",
        severity: "error",
        filePath: relativePath,
        message: `governed symlink points outside the repository: ${relativePath}`,
        details: { path: relativePath },
      });
      continue;
    }

    const targetRelativePath = repoPath(context.rootDir, symlink.targetPath);
    const linkOwners = owningCells(context.manifest, relativePath);
    const targetOwners = owningCells(context.manifest, targetRelativePath);
    const sharesOwner = linkOwners.some((linkOwner) => targetOwners.some((targetOwner) => targetOwner.id === linkOwner.id));
    if (linkOwners.length > 0 && !sharesOwner) {
      addFinding(findings, {
        ruleId: "CELLFENCE_SYMLINK_TARGET_OUTSIDE_OWNERSHIP",
        severity: "error",
        cellId: linkOwners[0].id,
        producerCellId: targetOwners[0]?.id,
        filePath: relativePath,
        message: `governed symlink ${relativePath} targets ${targetRelativePath} outside its owning cell`,
        details: {
          path: relativePath,
          targetPath: targetRelativePath,
          linkOwners: linkOwners.map((cell) => cell.id),
          targetOwners: targetOwners.map((cell) => cell.id),
        },
      });
    }
  }
}

function resourceAccessDeclaredByManifest(cell: CellManifest, access: ResourceAccessReference): boolean {
  return (cell.resourceContracts || []).some((contract) =>
    contract.kind === access.kind
    && contract.access.includes(access.access)
    && contract.selectors.some((selector) => matchesPattern(access.selector, selector) || selector === access.selector)
  );
}

function resourceAccessDeclaredByBaseline(cell: CellManifest, baseline: CellFenceBaseline | undefined, access: ResourceAccessReference): boolean {
  const resourceAccesses = baseline?.cells[cell.id]?.resourceAccesses || [];
  const currentAccessKey = resourceBaselineKey(resourceBaselineEntry(access));
  return resourceAccesses.some((entry) => resourceBaselineKey(entry) === currentAccessKey);
}

function resourceAccessVerb(access: ResourceAccessMode): string {
  if (access === "publish") return "publishes";
  if (access === "subscribe") return "subscribes to";
  if (access === "call") return "calls";
  if (access === "serve") return "serves";
  if (access === "read") return "reads";
  return "writes";
}

function validateResourceAccesses(
  context: AnalysisContext,
  findings: Finding[],
  warnings: Finding[],
  baseline: CellFenceBaseline | undefined,
  observedResourceFiles = new Set<string>(),
): Map<string, ResourceAccessReference[]> {
  const accessesByCell = new Map<string, ResourceAccessReference[]>();
  for (const cell of context.manifest.cells) {
    const cellAccesses: ResourceAccessReference[] = [];
    for (const sourceFilePath of sourceFilesForCell(context.rootDir, cell, context)) {
      observedResourceFiles.add(repoPath(context.rootDir, sourceFilePath));
      for (const access of collectResourceAccesses(context, sourceFilePath)) {
        if (access.unresolved) {
          if (resourceAccessDeclaredByManifest(cell, access) || resourceAccessDeclaredByBaseline(cell, baseline, access)) {
            cellAccesses.push(access);
            continue;
          }
          const severity: Severity = access.kind === "file" ? "warning" : "error";
          addFinding(severity === "warning" ? warnings : findings, {
            ruleId: "CELLFENCE_UNRESOLVED_RESOURCE_ACCESS",
            severity,
            cellId: cell.id,
            filePath: access.filePath,
            message: `${cell.id} has unresolved ${access.kind} resource access at line ${access.line}: ${access.reason as string}`,
            details: {
              kind: access.kind,
              access: access.access,
              selector: access.selector,
              line: access.line,
              source: access.source,
              detectedBy: access.detectedBy,
              confidence: access.confidence,
              reason: access.reason,
            },
          });
          continue;
        }
        cellAccesses.push(access);
        if (resourceAccessDeclaredByManifest(cell, access) || resourceAccessDeclaredByBaseline(cell, baseline, access)) continue;
        addFinding(findings, {
          ruleId: "CELLFENCE_UNDECLARED_RESOURCE_ACCESS",
          severity: "error",
          cellId: cell.id,
          filePath: access.filePath,
          message: `${cell.id} ${resourceAccessVerb(access.access)} undeclared ${access.kind} resource ${access.selector}`,
          details: {
            kind: access.kind,
            access: access.access,
            selector: access.selector,
            line: access.line,
            source: access.source,
            detectedBy: access.detectedBy,
            confidence: access.confidence,
          },
        });
      }
    }
    accessesByCell.set(cell.id, cellAccesses);
  }
  return accessesByCell;
}

function resourceEvidenceDependencies() {
  return {
    gitCommand,
    resourceAccessDeclaredByBaseline,
    resourceAccessDeclaredByManifest,
    resourceAccessVerb,
    targetIsInsideRoot,
  };
}

function resourceEvidenceAccesses(
  context: AnalysisContext,
  evidencePaths: string[],
  findings: Finding[],
  baseline: CellFenceBaseline | undefined,
): Map<string, ResourceAccessReference[]> {
  return resourceEvidenceAccessesOperation(context, evidencePaths, findings, baseline, resourceEvidenceDependencies());
}
function qualifiedExpressionName(node: ts.Node): string | undefined {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) {
    const root = qualifiedExpressionName(node.expression);
    return root ? `${root}.${node.name.text}` : node.name.text;
  }
  if (ts.isCallExpression(node)) return qualifiedExpressionName(node.expression);
  return undefined;
}

function adapterHelpers(sourceFile: ts.SourceFile): PluginAdapterHelpers {
  return {
    getQualifiedCallName(node: ts.Node): string | undefined {
      if (ts.isCallExpression(node)) return qualifiedExpressionName(node.expression);
      return qualifiedExpressionName(node);
    },
    getStaticStringArgument(node: ts.CallExpression, index: number): string | undefined {
      return literalText(node.arguments[index]);
    },
    lineOf(node: ts.Node): number {
      return getLineNumber(sourceFile, node);
    },
  };
}

function pluginAccessToInternal(access: PluginResourceAccess): ResourceAccessReference {
  return {
    kind: access.kind,
    access: access.access,
    selector: access.selector,
    filePath: normalizePath(access.filePath),
    line: access.line,
    source: access.source,
    detectedBy: access.detectedBy,
    confidence: access.confidence,
    unresolved: access.unresolved,
    reason: access.reason,
  };
}

function validatePluginApiVersion(plugin: PluginDefinition, findings: Finding[]): boolean {
  if (plugin.apiVersion === 1) return true;
  addFinding(findings, {
    ruleId: "CELLFENCE_PLUGIN_INVALID",
    severity: "error",
    message: `plugin ${plugin.name || "(unnamed)"} requires unsupported CellFence plugin API version ${String(plugin.apiVersion)}`,
    details: { plugin: plugin.name, apiVersion: plugin.apiVersion, supportedApiVersion: 1 },
  });
  return false;
}

function runPluginAdapters(
  context: AnalysisContext,
  plugins: PluginDefinition[],
  repository: PluginRepositoryModel,
  findings: Finding[],
): Map<string, ResourceAccessReference[]> {
  const accessesByCell = new Map<string, ResourceAccessReference[]>();
  for (const plugin of plugins) {
    if (!validatePluginApiVersion(plugin, findings)) continue;
    for (const adapter of plugin.adapters || []) {
      for (const cell of context.manifest.cells) {
        for (const sourceFilePath of sourceFilesForCell(context.rootDir, cell, context)) {
          const relativeFilePath = repoPath(context.rootDir, sourceFilePath);
          const sourceText = repository.files.contents[relativeFilePath] as string;
          const sourceFile = ts.createSourceFile(sourceFilePath, sourceText, ts.ScriptTarget.Latest, true, sourceKindForPath(sourceFilePath));
          let accesses: PluginResourceAccess[];
          try {
            accesses = adapter.detect({
              repository,
              cell,
              filePath: relativeFilePath,
              sourceText,
              sourceFile,
              helpers: adapterHelpers(sourceFile),
            });
          } catch (error) {
            addFinding(findings, {
              ruleId: "CELLFENCE_PLUGIN_INVALID",
              severity: "error",
              cellId: cell.id,
              filePath: relativeFilePath,
              message: `plugin adapter ${plugin.name}/${adapter.name} failed: ${errorMessage(error)}`,
              details: { plugin: plugin.name, adapter: adapter.name },
            });
            continue;
          }
          for (const access of accesses) {
            const cellId = access.cellId || cell.id;
            if (!context.cellsById.has(cellId)) {
              addFinding(findings, {
                ruleId: "CELLFENCE_PLUGIN_INVALID",
                severity: "error",
                cellId: cell.id,
                filePath: relativeFilePath,
                message: `plugin adapter ${plugin.name}/${adapter.name} emitted access for unknown cell ${cellId}`,
                details: { plugin: plugin.name, adapter: adapter.name, cellId },
              });
              continue;
            }
            addAccessToCell(accessesByCell, cellId, pluginAccessToInternal({
              ...access,
              filePath: access.filePath || relativeFilePath,
              line: access.line || 1,
              source: access.source || adapter.name,
              detectedBy: access.detectedBy || adapter.name,
            }));
          }
        }
      }
    }
  }
  return accessesByCell;
}

function validatePluginResourceAccesses(
  context: AnalysisContext,
  findings: Finding[],
  warnings: Finding[],
  baseline: CellFenceBaseline | undefined,
  accessesByCell: Map<string, ResourceAccessReference[]>,
): Map<string, ResourceAccessReference[]> {
  const acceptedAccessesByCell = new Map<string, ResourceAccessReference[]>();
  for (const [cellId, accesses] of accessesByCell.entries()) {
    const cell = context.cellsById.get(cellId) as CellManifest;
    for (const access of accesses) {
      if (access.unresolved) {
        if (resourceAccessDeclaredByManifest(cell, access) || resourceAccessDeclaredByBaseline(cell, baseline, access)) {
          addAccessToCell(acceptedAccessesByCell, cellId, access);
          continue;
        }
        const severity: Severity = access.kind === "file" ? "warning" : "error";
        addFinding(severity === "warning" ? warnings : findings, {
          ruleId: "CELLFENCE_UNRESOLVED_RESOURCE_ACCESS",
          severity,
          cellId,
          filePath: access.filePath,
          message: `${cellId} has unresolved ${access.kind} resource access at line ${access.line}: ${access.reason || "resource access is not statically resolvable"}`,
          details: {
            kind: access.kind,
            access: access.access,
            selector: access.selector,
            line: access.line,
            source: access.source,
            detectedBy: access.detectedBy,
            confidence: access.confidence,
            reason: access.reason,
          },
        });
        continue;
      }

      addAccessToCell(acceptedAccessesByCell, cellId, access);
      if (resourceAccessDeclaredByManifest(cell, access) || resourceAccessDeclaredByBaseline(cell, baseline, access)) continue;
      addFinding(findings, {
        ruleId: "CELLFENCE_UNDECLARED_RESOURCE_ACCESS",
        severity: "error",
        cellId,
        filePath: access.filePath,
        message: `${cellId} ${resourceAccessVerb(access.access)} undeclared ${access.kind} resource ${access.selector}`,
        details: {
          kind: access.kind,
          access: access.access,
          selector: access.selector,
          line: access.line,
          source: access.source,
          detectedBy: access.detectedBy,
          confidence: access.confidence,
        },
      });
    }
  }
  return acceptedAccessesByCell;
}

function runPluginRules(
  context: AnalysisContext,
  plugins: PluginDefinition[],
  repository: PluginRepositoryModel,
  findings: Finding[],
): void {
  for (const plugin of plugins) {
    if (!validatePluginApiVersion(plugin, findings)) continue;
    for (const [ruleId, rule] of Object.entries(plugin.rules || {})) {
      const emittedFindings: Finding[] = [];
      const ruleContext: PluginRuleContext = {
        repository,
        cells: context.manifest.cells,
        report(finding: PluginFinding): void {
          emittedFindings.push({ ...finding, ruleId: finding.ruleId || ruleId });
        },
      };
      try {
        const returnedFindings = rule.run(ruleContext) || [];
        for (const finding of returnedFindings) emittedFindings.push({ ...finding, ruleId: finding.ruleId || ruleId });
      } catch (error) {
        addFinding(findings, {
          ruleId: "CELLFENCE_PLUGIN_INVALID",
          severity: "error",
          message: `plugin rule ${plugin.name}/${ruleId} failed: ${errorMessage(error)}`,
          details: { plugin: plugin.name, ruleId },
        });
        continue;
      }
      for (const finding of emittedFindings) addFinding(findings, finding);
    }
  }
}

function findArtifactLaneForPath(cell: CellManifest, relativePath: string): string | undefined {
  for (const lane of cell.producesArtifacts ?? []) {
    if (lane.paths.some((pattern) => matchesPattern(relativePath, pattern))) return lane.id;
  }
  return undefined;
}

function repoRelativePathEscapesRoot(relativePath: string): boolean {
  const normalized = normalizePath(relativePath);
  return normalized === ".."
    || normalized.startsWith("../")
    || path.isAbsolute(normalized)
    || /^[A-Za-z]:\//.test(normalized);
}

function resolvedRepositoryImport(
  context: AnalysisContext,
  targetPath: string,
  options: Partial<Pick<ResolvedImport, "matchedSpecifier" | "isPublicPackage" | "packageExportState" | "packageExportReason">> & { targetCell?: CellManifest } = {},
): ResolvedImport {
  const base: ResolvedImport = {
    targetPath,
    matchedSpecifier: options.matchedSpecifier,
    isExternal: false,
    isPublicPackage: options.isPublicPackage ?? false,
    packageExportState: options.packageExportState,
    packageExportReason: options.packageExportReason,
  };
  if (repoRelativePathEscapesRoot(targetPath)) return { ...base, targetOutsideRoot: true };
  const targetCell = options.targetCell ?? findOwningCell(context.manifest, targetPath);
  const artifactLaneId = targetCell ? findArtifactLaneForPath(targetCell, targetPath) : undefined;
  return { ...base, targetCell, artifactLaneId };
}

function resolveWorkspacePackageImport(context: AnalysisContext, reference: ImportReference): ResolvedImport | undefined {
  const exactPackageCell = context.packageToCell.get(reference.specifier);
  if (exactPackageCell) {
    const packageRoot = context.packageRoots.get(reference.specifier);
    const mode = reference.typeOnly ? "types" : reference.kind === "require" ? "require" : "import";
    const exportedTarget = packageRoot
      ? resolvePackageExportTarget(context.rootDir, packageRoot, reference.specifier, reference.specifier, mode)
      : undefined;
    if (exportedTarget?.exported) {
      if (exportedTarget.targetPath) {
        return resolvedRepositoryImport(context, exportedTarget.targetPath, {
          targetCell: exactPackageCell,
          matchedSpecifier: reference.specifier,
          isPublicPackage: true,
          packageExportState: exportedTarget.state,
          packageExportReason: exportedTarget.reason,
        });
      }
      return {
        targetCell: exactPackageCell,
        matchedSpecifier: reference.specifier,
        isExternal: false,
        isPublicPackage: true,
        packageExportState: exportedTarget.state,
        packageExportReason: exportedTarget.reason,
      };
    }
    if (exportedTarget && exportedTarget.reason !== "package has no exports map") {
      return {
        targetCell: exactPackageCell,
        matchedSpecifier: reference.specifier,
        isExternal: false,
        isPublicPackage: false,
        packageExportState: exportedTarget.state,
        packageExportReason: exportedTarget.reason,
      };
    }
    return resolvedRepositoryImport(context, exactPackageCell.publicEntry, {
      targetCell: exactPackageCell,
      matchedSpecifier: reference.specifier,
      isPublicPackage: true,
      packageExportState: exportedTarget ? "UNRESOLVED_UNKNOWN" : "PUBLIC_RESOLVED",
      packageExportReason: exportedTarget ? "package has no exports map; using manifest packageName public entry" : undefined,
    });
  }

  for (const [packageName, packageCell] of context.packageToCell.entries()) {
    const subpathPrefix = `${packageName}/`;
    if (!reference.specifier.startsWith(subpathPrefix)) continue;
    const packageRoot = context.packageRoots.get(packageName);
    const mode = reference.typeOnly ? "types" : reference.kind === "require" ? "require" : "import";
    const exportedTarget = packageRoot
      ? resolvePackageExportTarget(context.rootDir, packageRoot, packageName, reference.specifier, mode)
      : {
        state: "UNRESOLVED_UNKNOWN" as const,
        exported: false,
        reason: "workspace package root could not be resolved",
      };
    if (exportedTarget.exported) {
      if (exportedTarget.targetPath) {
        return resolvedRepositoryImport(context, exportedTarget.targetPath, {
          targetCell: packageCell,
          matchedSpecifier: reference.specifier,
          isPublicPackage: true,
          packageExportState: exportedTarget.state,
          packageExportReason: exportedTarget.reason,
        });
      }
      return {
        targetCell: packageCell,
        matchedSpecifier: reference.specifier,
        isExternal: false,
        isPublicPackage: true,
        packageExportState: exportedTarget.state,
        packageExportReason: exportedTarget.reason,
      };
    }
    const subpath = reference.specifier.slice(subpathPrefix.length);
    const targetPath = packageRoot
      ? resolveRelativeImport(context.rootDir, normalizePath(path.join(packageRoot, "package.json")), `./${subpath}`)
        || normalizePath(path.join(packageRoot, subpath))
      : undefined;
    if (targetPath) {
      return resolvedRepositoryImport(context, targetPath, {
        targetCell: packageCell,
        matchedSpecifier: reference.specifier,
        packageExportState: exportedTarget.state,
        packageExportReason: exportedTarget.reason,
      });
    }
    return {
      targetCell: packageCell,
      matchedSpecifier: reference.specifier,
      isExternal: false,
      isPublicPackage: false,
      packageExportState: exportedTarget.state,
      packageExportReason: exportedTarget.reason,
    };
  }

  return undefined;
}

function resolveImport(context: AnalysisContext, reference: ImportReference): ResolvedImport {
  const resolutionBasePath = reference.resolutionBasePath ?? reference.importerPath;
  if (path.extname(reference.importerPath) === ".py") {
    const specifiers = [...(reference.candidateSpecifiers || []), reference.specifier];
    for (const specifier of specifiers) {
      const pythonTargetPath = resolvePythonImport(context.rootDir, reference.importerPath, specifier, pythonSourceRoots(context));
      if (pythonTargetPath) return resolvedRepositoryImport(context, pythonTargetPath, { matchedSpecifier: specifier });
    }
    if (reference.specifier.startsWith(".")) return { isExternal: false, isPublicPackage: false };
  }

  if (importSpecifierLooksPathLike(reference.specifier)) {
    const targetPath = resolveRelativeImport(context.rootDir, resolutionBasePath, reference.specifier);
    if (!targetPath) return { isExternal: false, isPublicPackage: false };
    return resolvedRepositoryImport(context, targetPath);
  }

  const packageImportTargetPath = resolvePackageImportsTarget(
    context.rootDir,
    resolutionBasePath,
    reference.specifier,
    reference.typeOnly ? "types" : reference.kind === "require" ? "require" : "import",
  );
  if (packageImportTargetPath) return resolvedRepositoryImport(context, packageImportTargetPath, { matchedSpecifier: reference.specifier });

  const packageImport = resolveWorkspacePackageImport(context, reference);
  if (packageImport) return packageImport;

  const aliasTargetPath = resolveNearestPathAliasTarget(context.rootDir, resolutionBasePath, reference.specifier)
    || resolvePathAliasTarget(context, reference.specifier);
  if (aliasTargetPath) return resolvedRepositoryImport(context, aliasTargetPath, { matchedSpecifier: reference.specifier });

  return { isExternal: true, isPublicPackage: false };
}

function resolvedSpecifier(reference: ImportReference, resolvedImport: ResolvedImport): string {
  return resolvedImport.matchedSpecifier || reference.specifier;
}

function consumerDeclaration(cell: CellManifest, producerCellId: string): CellConsumerManifest | undefined {
  return (cell.consumes ?? []).find((consumer) => consumer.cell === producerCellId);
}

function importTargetsPrivateImplementation(resolvedImport: ResolvedImport, producerCell: CellManifest): boolean {
  if (
    resolvedImport.packageExportState === "NOT_EXPORTED_PRIVATE"
    && resolvedImport.packageExportReason === "specifier is explicitly excluded by the package exports map"
  ) return true;
  if (resolvedImport.isPublicPackage) return false;
  const targetPath = normalizePath(resolvedImport.targetPath || "");
  const targetIsPublicEntry = targetPath === normalizePath(producerCell.publicEntry);
  if (targetIsPublicEntry) return false;
  if ((producerCell.publicPaths || []).some((publicPath) => matchesPattern(targetPath, publicPath))) return false;
  return true;
}

function jsonPointerEscape(value: string): string {
  return value.replace(/~/g, "~0").replace(/\//g, "~1");
}

function manifestCellPointer(context: AnalysisContext, cellId: string): string {
  const cellIndex = context.manifest.cells.findIndex((cell) => cell.id === cellId);
  return cellIndex >= 0 ? `/cells/${cellIndex}` : "/cells";
}

function manifestCellFieldPointer(context: AnalysisContext, cellId: string, field: string): string {
  return `${manifestCellPointer(context, cellId)}/${jsonPointerEscape(field)}`;
}

function manifestConsumerPointer(context: AnalysisContext, importerCell: CellManifest, producerCellId: string): string {
  const cellPointer = manifestCellPointer(context, importerCell.id);
  const consumerIndex = (importerCell.consumes ?? []).findIndex((consumer) => consumer.cell === producerCellId);
  return consumerIndex >= 0 ? `${cellPointer}/consumes/${consumerIndex}` : `${cellPointer}/consumes`;
}

function importPolicyObservedFacts(fact: NormalizedObservedImportFact): FindingExplanationObservation[] {
  return [{
    description: "Static import/reference observed by CellFence",
    filePath: fact.importerPath,
    line: fact.line,
    value: {
      importerPath: fact.importerPath,
      importerCellId: fact.importerCellId,
      specifier: fact.specifier,
      kind: fact.kind,
      typeOnly: fact.typeOnly,
      targetPath: fact.targetPath,
      producerCellId: fact.producerCellId,
      isExternal: fact.isExternal,
      isPublicPackage: fact.isPublicPackage,
      declaredConsumer: fact.declaredConsumer,
      privateImplementation: fact.privateImplementation,
      packageExportState: fact.packageExportState,
      packageExportReason: fact.packageExportReason,
    },
  }];
}

function importPolicyContractReferences(
  context: AnalysisContext,
  manifestFilePath: string,
  importerCell: CellManifest,
  producerCell: CellManifest,
  includePublicSurface: boolean,
): FindingExplanationContract[] {
  const contracts: FindingExplanationContract[] = [{
    source: "manifest",
    filePath: manifestFilePath,
    jsonPointer: manifestConsumerPointer(context, importerCell, producerCell.id),
    description: `Consumer declarations checked for ${importerCell.id}`,
    value: {
      importerCellId: importerCell.id,
      producerCellId: producerCell.id,
      declaredConsumers: (importerCell.consumes ?? []).map((consumer) => consumer.cell),
      declarationFound: Boolean(consumerDeclaration(importerCell, producerCell.id)),
    },
  }];

  if (includePublicSurface) {
    contracts.push({
      source: "manifest",
      filePath: manifestFilePath,
      jsonPointer: manifestCellFieldPointer(context, producerCell.id, "publicEntry"),
      description: `Declared public entry for ${producerCell.id}`,
      value: producerCell.publicEntry,
    });
    contracts.push({
      source: "manifest",
      filePath: manifestFilePath,
      jsonPointer: manifestCellFieldPointer(context, producerCell.id, "publicPaths"),
      description: `Declared public path patterns for ${producerCell.id}`,
      value: producerCell.publicPaths ?? [],
    });
    if (producerCell.packageName) {
      contracts.push({
        source: "manifest",
        filePath: manifestFilePath,
        jsonPointer: manifestCellFieldPointer(context, producerCell.id, "packageName"),
        description: `Declared package name for ${producerCell.id}`,
        value: producerCell.packageName,
      });
    }
  }

  return contracts;
}

const IMPORT_POLICY_UNVERIFIED = [
  "CellFence did not verify whether an alternative API exists.",
  "CellFence did not verify behavioral equivalence, authorization, transaction, side-effect, or exception semantics for any replacement.",
  "CellFence did not decide whether the manifest, baseline, or ownership model should be changed.",
];

function importPolicyExplanation(
  context: AnalysisContext,
  manifestFilePath: string,
  importerCell: CellManifest,
  producerCell: CellManifest,
  judgment: ImportPolicyJudgment,
): FindingExplanation {
  return {
    schemaVersion: "cellfence.finding-explanation.v1",
    observedFacts: importPolicyObservedFacts(judgment.fact),
    appliedContracts: importPolicyContractReferences(
      context,
      manifestFilePath,
      importerCell,
      producerCell,
      judgment.ruleId === "CELLFENCE_PRIVATE_IMPORT",
    ),
    judgment: judgment.message,
    unverified: IMPORT_POLICY_UNVERIFIED,
  };
}

function addPrivateImportFinding(
  context: AnalysisContext,
  findings: Finding[],
  manifestFilePath: string,
  importerCell: CellManifest,
  producerCell: CellManifest,
  reference: ImportReference,
  resolvedImport: ResolvedImport,
  judgment: ImportPolicyJudgment,
): void {
  addFinding(findings, {
    ruleId: "CELLFENCE_PRIVATE_IMPORT",
    severity: "error",
    cellId: importerCell.id,
    producerCellId: producerCell.id,
    filePath: reference.importerPath,
    message: `${importerCell.id} imports private implementation from ${producerCell.id}`,
    details: { specifier: resolvedSpecifier(reference, resolvedImport), targetPath: resolvedImport.targetPath, line: reference.line },
    explanation: importPolicyExplanation(context, manifestFilePath, importerCell, producerCell, judgment),
  });
}

function addUndeclaredConsumerFinding(
  context: AnalysisContext,
  findings: Finding[],
  manifestFilePath: string,
  importerCell: CellManifest,
  producerCell: CellManifest,
  reference: ImportReference,
  specifier: string,
  judgment: ImportPolicyJudgment,
): void {
  addFinding(findings, {
    ruleId: "CELLFENCE_UNDECLARED_CONSUMER",
    severity: "error",
    cellId: importerCell.id,
    producerCellId: producerCell.id,
    filePath: reference.importerPath,
    message: `${importerCell.id} imports ${producerCell.id} without declaring a consumer relationship`,
    details: { specifier, line: reference.line, kind: reference.kind, typeOnly: reference.typeOnly },
    explanation: importPolicyExplanation(context, manifestFilePath, importerCell, producerCell, judgment),
  });
}

function validatePublicEntries(context: AnalysisContext, findings: Finding[], observedPublicSurfaceFiles = new Set<string>()): void {
  for (const cell of context.manifest.cells) {
    const publicEntryPath = absolutePath(context.rootDir, cell.publicEntry);
    if (!fs.existsSync(publicEntryPath)) {
      addFinding(findings, {
        ruleId: "CELLFENCE_PUBLIC_ENTRY_MISSING",
        severity: "error",
        cellId: cell.id,
        filePath: cell.publicEntry,
        message: `public entry for cell ${cell.id} is missing: ${cell.publicEntry}`,
      });
      continue;
    }
    observedPublicSurfaceFiles.add(normalizePath(cell.publicEntry));
    const actualSymbols = extractPublicSymbols(publicEntryPath);
    const declaredSymbols = new Set(cell.publicSymbols);
    const missingSymbols = [...declaredSymbols].filter((symbol) => !actualSymbols.has(symbol));
    const undeclaredSymbols = [...actualSymbols].filter((symbol) => !declaredSymbols.has(symbol));
    if (missingSymbols.length > 0 || undeclaredSymbols.length > 0) {
      const mismatchParts = [];
      if (missingSymbols.length > 0) mismatchParts.push(`missing: ${missingSymbols.join(", ")}`);
      if (undeclaredSymbols.length > 0) mismatchParts.push(`undeclared: ${undeclaredSymbols.join(", ")}`);
      addFinding(findings, {
        ruleId: "CELLFENCE_PUBLIC_SYMBOL_MISMATCH",
        severity: "error",
        cellId: cell.id,
        filePath: cell.publicEntry,
        message: `public symbols for cell ${cell.id} do not match manifest (${mismatchParts.join("; ")})`,
        details: { missingSymbols, undeclaredSymbols, line: 1 },
      });
    }
  }
}

function prewarmRepositoryPythonInspections(context: AnalysisContext): void {
  const pythonFilePaths = new Set<string>();
  for (const cell of context.manifest.cells) {
    for (const sourceFilePath of sourceFilesForCell(context.rootDir, cell, context)) {
      if (path.extname(sourceFilePath) === ".py") pythonFilePaths.add(sourceFilePath);
    }
    const publicEntryPath = absolutePath(context.rootDir, cell.publicEntry);
    if (path.extname(publicEntryPath) === ".py" && fs.existsSync(publicEntryPath)) pythonFilePaths.add(publicEntryPath);
  }
  prewarmPythonInspections([...pythonFilePaths]);
}

function validateImports(
  context: AnalysisContext,
  findings: Finding[],
  warnings: Finding[],
  manifestFilePath = DEFAULT_MANIFEST_PATH,
  observedImports: PluginImportReference[] = [],
  observedImportFiles = new Set<string>(),
  externalDependencyObservations: ExternalDependencyObservation[] = [],
): Map<string, Set<string>> {
  const crossCellDependencies = new Map<string, Set<string>>();
  for (const importerCell of context.manifest.cells) {
    for (const sourceFilePath of sourceFilesForCell(context.rootDir, importerCell, context)) {
      observedImportFiles.add(repoPath(context.rootDir, sourceFilePath));
      const references = extractImports(context, sourceFilePath, warnings, findings);
      for (const reference of references) {
        const resolvedImport = resolveImport(context, reference);
        const specifier = resolvedSpecifier(reference, resolvedImport);
        const observedImport: PluginImportReference = {
          importerPath: reference.importerPath,
          importerCellId: importerCell.id,
          specifier,
          kind: reference.kind,
          typeOnly: reference.typeOnly,
          line: reference.line,
          targetPath: resolvedImport.targetPath ? normalizePath(resolvedImport.targetPath) : undefined,
          targetCellId: resolvedImport.targetCell?.id,
          artifactLaneId: resolvedImport.artifactLaneId,
          isExternal: resolvedImport.isExternal,
          isPublicPackage: resolvedImport.isPublicPackage,
          packageExportState: resolvedImport.packageExportState,
          packageExportReason: resolvedImport.packageExportReason,
        };
        observedImports.push(observedImport);
        const dependencyId = externalDependencyIdForImport(reference, resolvedImport);
        if (dependencyId) {
          externalDependencyObservations.push({
            cellId: importerCell.id,
            dependencyId,
            filePath: reference.importerPath,
            line: reference.line,
            specifier: reference.specifier,
            kind: reference.kind,
            typeOnly: reference.typeOnly,
          });
        }
        if (resolvedImport.targetOutsideRoot && resolvedImport.targetPath) {
          addFinding(findings, {
            ruleId: "CELLFENCE_IMPORT_TARGET_OUTSIDE_ROOT",
            severity: "error",
            cellId: importerCell.id,
            filePath: reference.importerPath,
            message: `${importerCell.id} imports a file outside the repository root: ${specifier}`,
            details: { line: reference.line, specifier, targetPath: resolvedImport.targetPath },
          });
          continue;
        }
        if (!resolvedImport.targetPath && !resolvedImport.isExternal && (reference.specifier.startsWith(".") || reference.specifier.startsWith("/"))) {
          addFinding(findings, {
            ruleId: "CELLFENCE_UNRESOLVED_IMPORT",
            severity: "error",
            filePath: reference.importerPath,
            message: `relative import ${reference.specifier} could not be resolved statically at line ${reference.line}`,
            details: { line: reference.line, specifier: reference.specifier },
          });
        }
        if (
          resolvedImport.targetPath
          && !resolvedImport.targetCell
          && pathIsGoverned(context.manifest, resolvedImport.targetPath)
        ) {
          addFinding(findings, {
            ruleId: "CELLFENCE_UNOWNED_IMPORT_TARGET",
            severity: "error",
            cellId: importerCell.id,
            filePath: reference.importerPath,
            message: `${importerCell.id} imports governed but unowned source ${resolvedImport.targetPath}`,
            details: { specifier, targetPath: resolvedImport.targetPath, line: reference.line },
          });
          continue;
        }
        if (resolvedImport.isExternal || !resolvedImport.targetCell || resolvedImport.targetCell.id === importerCell.id) continue;
        const producerCell = resolvedImport.targetCell;
        const declaration = consumerDeclaration(importerCell, producerCell.id);
        const privateImplementation = importTargetsPrivateImplementation(resolvedImport, producerCell);
        const dependencySet = crossCellDependencies.get(importerCell.id) || new Set<string>();
        dependencySet.add(producerCell.id);
        crossCellDependencies.set(importerCell.id, dependencySet);

        const importFact = {
          importerPath: reference.importerPath,
          importerCellId: importerCell.id,
          specifier,
          kind: reference.kind,
          typeOnly: reference.typeOnly,
          line: reference.line,
          targetPath: observedImport.targetPath,
          producerCellId: producerCell.id,
          isExternal: resolvedImport.isExternal,
          isPublicPackage: resolvedImport.isPublicPackage,
          packageExportState: resolvedImport.packageExportState,
          packageExportReason: resolvedImport.packageExportReason,
          declaredConsumer: Boolean(declaration),
          privateImplementation,
        } satisfies Parameters<typeof evaluateImportPolicyFact>[0];
        const importJudgments = evaluateImportPolicyFact(importFact);
        for (const judgment of importJudgments) {
          if (judgment.status !== "VIOLATED") continue;
          if (judgment.ruleId === "CELLFENCE_UNDECLARED_CONSUMER") {
            addUndeclaredConsumerFinding(context, findings, manifestFilePath, importerCell, producerCell, reference, specifier, judgment);
          }
        }

        if (resolvedImport.artifactLaneId) {
          if (
            resolvedImport.targetPath
            && SOURCE_EXTENSIONS.includes(path.extname(resolvedImport.targetPath))
            && privateImplementation
          ) {
            const privateImportJudgment = importJudgments.find((judgment) => judgment.ruleId === "CELLFENCE_PRIVATE_IMPORT");
            if (privateImportJudgment) {
              addPrivateImportFinding(context, findings, manifestFilePath, importerCell, producerCell, reference, resolvedImport, privateImportJudgment);
            }
          }
          const declaredArtifactLanes = new Set(declaration?.artifactLanes || []);
          if (!declaredArtifactLanes.has(resolvedImport.artifactLaneId)) {
            addFinding(findings, {
              ruleId: "CELLFENCE_UNDECLARED_ARTIFACT",
              severity: "error",
              cellId: importerCell.id,
              producerCellId: producerCell.id,
              filePath: reference.importerPath,
              message: `${importerCell.id} imports artifact lane ${resolvedImport.artifactLaneId} from ${producerCell.id} without declaring it`,
              details: { specifier, artifactLaneId: resolvedImport.artifactLaneId, line: reference.line },
            });
          }
          continue;
        }

        for (const judgment of importJudgments) {
          if (judgment.status === "VIOLATED" && judgment.ruleId === "CELLFENCE_PRIVATE_IMPORT") {
            addPrivateImportFinding(context, findings, manifestFilePath, importerCell, producerCell, reference, resolvedImport, judgment);
          }
        }
      }
    }
  }
  return crossCellDependencies;
}

function manifestInvalidResult(message: string): CheckResult {
  const finding: Finding = {
    ruleId: "CELLFENCE_MANIFEST_INVALID",
    severity: "error",
    message,
  };
  return { ok: false, exitCode: 2, findings: [finding], warnings: [], metrics: {} };
}

function currentGitHeadOrUndefined(rootDir: string): string | undefined {
  try {
    return gitCommand(rootDir, ["rev-parse", "--verify", "--end-of-options", "HEAD^{commit}"]);
  } catch {
    return undefined;
  }
}

function configuredRuleSeverity(
  context: AnalysisContext,
  finding: Finding,
  cliRuleSeverities: Record<string, ConfiguredRuleSeverity> | undefined,
): ConfiguredRuleSeverity | undefined {
  let severity = context.manifest.rules?.[finding.ruleId];
  if (finding.cellId) {
    const cellSeverity = context.cellsById.get(finding.cellId)?.rules?.[finding.ruleId];
    if (cellSeverity) severity = cellSeverity;
  }
  const findingFilePath = finding.filePath;
  if (findingFilePath) {
    for (const override of context.manifest.overrides || []) {
      if (override.files.some((pattern) => matchesPattern(findingFilePath, pattern))) {
        const overrideSeverity = override.rules[finding.ruleId];
        if (overrideSeverity) severity = overrideSeverity;
      }
    }
  }
  return cliRuleSeverities?.[finding.ruleId] || severity;
}

function ruleIsRequired(context: AnalysisContext, ruleId: string): boolean {
  return requiredRuleSet(context).has(ruleId);
}

function requiredRuleSet(context: AnalysisContext): Set<string> {
  return new Set([...CORE_REQUIRED_RULES, ...(context.manifest.governance?.requiredRules || [])]);
}

function validateRequiredRuleConfiguration(
  context: AnalysisContext,
  cliRuleSeverities: Record<string, ConfiguredRuleSeverity> | undefined,
  findings: Finding[],
): void {
  const requiredRules = requiredRuleSet(context);
  if (requiredRules.size === 0) return;
  const checkMap = (source: string, rules: Record<string, ConfiguredRuleSeverity> | undefined, filePath?: string, cellId?: string): void => {
    for (const [ruleId, severity] of Object.entries(rules || {})) {
      if (!requiredRules.has(ruleId) || severity === "error") continue;
      addFinding(findings, {
        ruleId: "CELLFENCE_REQUIRED_RULE_DISABLED",
        severity: "error",
        cellId,
        filePath,
        message: `${source} weakens required rule ${ruleId} to ${severity}`,
        details: { source, ruleId, severity },
      });
    }
  };
  checkMap("repository rules", context.manifest.rules);
  for (const cell of context.manifest.cells) checkMap(`cell ${cell.id} rules`, cell.rules, cell.publicEntry, cell.id);
  for (const [overrideIndex, override] of (context.manifest.overrides || []).entries()) {
    checkMap(`override ${overrideIndex}`, override.rules, override.files.join(","));
  }
  checkMap("CLI ruleSeverities", cliRuleSeverities);
}

function validateManifestPatternsMatchFiles(context: AnalysisContext, findings: Finding[], warnings: Finding[]): void {
  const files = listFiles(context.rootDir, context).map((filePath) => repoPath(context.rootDir, filePath));
  const cellsWithErrors = new Set(findings.filter((finding) => finding.severity === "error" && finding.cellId).map((finding) => finding.cellId));
  const warnSuspiciousGlob = (pattern: string, source: string, cellId?: string, filePath?: string): void => {
    if (!/(^|\/)[^/]*\*{3,}[^/]*(\/|$)/.test(pattern)) return;
    addFinding(warnings, {
      ruleId: "CELLFENCE_SUSPICIOUS_GLOB_PATTERN",
      severity: "warning",
      cellId,
      filePath,
      message: `${source} pattern ${pattern} contains a suspicious triple-star glob segment`,
      details: { source, pattern },
    });
  };
  const checkPattern = (pattern: string, source: string, cellId?: string, filePath?: string): void => {
    warnSuspiciousGlob(pattern, source, cellId, filePath);
    if (cellId && cellsWithErrors.has(cellId)) return;
    if (files.some((candidate) => matchesPattern(candidate, pattern))) return;
    addFinding(warnings, {
      ruleId: "CELLFENCE_PATTERN_MATCHES_NOTHING",
      severity: "warning",
      cellId,
      filePath,
      message: `${source} pattern ${pattern} does not match any repository file`,
      details: { source, pattern },
    });
  };
  for (const pattern of context.manifest.governance?.include || []) checkPattern(pattern, "governance.include");
  for (const pattern of context.manifest.governance?.exclude || []) checkPattern(pattern, "governance.exclude");
  for (const cell of context.manifest.cells) {
    for (const pattern of cell.ownedPaths) checkPattern(pattern, `${cell.id}.ownedPaths`, cell.id, cell.publicEntry);
    for (const pattern of cell.publicPaths || []) checkPattern(pattern, `${cell.id}.publicPaths`, cell.id, cell.publicEntry);
    for (const lane of cell.producesArtifacts || []) {
      if (lane.external) continue;
      for (const pattern of lane.paths) checkPattern(pattern, `${cell.id}.producesArtifacts.${lane.id}.paths`, cell.id, cell.publicEntry);
    }
  }
}

function warnWhenWaiverParsingDisabled(context: AnalysisContext, warnings: Finding[]): void {
  for (const cell of context.manifest.cells) {
    if (cell.waiverParsing !== false) continue;
    addFinding(warnings, {
      ruleId: "CELLFENCE_WAIVER_PARSING_DISABLED",
      severity: "warning",
      cellId: cell.id,
      filePath: cell.publicEntry,
      message: `${cell.id} declared waiverParsing: false; // cellfence-ignore directives in this cell's files will not be interpreted as waivers.`,
      details: { cellId: cell.id, reason: cell.waiverParsingReason },
    });
  }
}

function applyRuleSeverityPolicy(
  context: AnalysisContext,
  findings: Finding[],
  warnings: Finding[],
  cliRuleSeverities: Record<string, ConfiguredRuleSeverity> | undefined,
): { findings: Finding[]; warnings: Finding[] } {
  const nextFindings: Finding[] = [];
  const nextWarnings: Finding[] = [];
  for (const finding of [...findings, ...warnings]) {
    const configuredSeverity = configuredRuleSeverity(context, finding, cliRuleSeverities);
    if (configuredSeverity === "off") {
      if (ruleIsRequired(context, finding.ruleId)) {
        nextFindings.push(withFindingFingerprint({
          ruleId: "CELLFENCE_REQUIRED_RULE_DISABLED",
          severity: "error",
          cellId: finding.cellId,
          filePath: finding.filePath,
          message: `required rule ${finding.ruleId} cannot be disabled`,
          details: { ruleId: finding.ruleId },
        }));
        nextFindings.push(withFindingFingerprint(finding));
      }
      continue;
    }
    const severity = ruleIsRequired(context, finding.ruleId) ? "error" : configuredSeverity || finding.severity;
    const normalizedFinding: Finding = withFindingFingerprint({ ...finding, severity, fingerprint: undefined });
    if (severity === "warning") nextWarnings.push(normalizedFinding);
    else nextFindings.push(normalizedFinding);
  }
  return { findings: nextFindings, warnings: nextWarnings };
}

export function loadManifestFromFile(manifestPath: string): CellFenceManifest {
  const validation = validateManifest(readJsonFile(manifestPath));
  if (!validation.ok || !validation.value) {
    throw new Error(validation.errors.join("; "));
  }
  return validation.value;
}

export function checkRepository(options: CheckOptions = {}): CheckResult {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const manifestPath = path.resolve(rootDir, options.manifestPath || DEFAULT_MANIFEST_PATH);
  const baselinePath = options.baselinePath ? path.resolve(rootDir, options.baselinePath) : undefined;

  let rawManifest: unknown;
  try {
    rawManifest = readJsonFile(manifestPath);
  } catch (error) {
    return manifestInvalidResult(`failed to read manifest ${repoPath(rootDir, manifestPath)}: ${errorMessage(error)}`);
  }

  const manifestValidation = validateManifest(rawManifest);
  if (!manifestValidation.ok || !manifestValidation.value) {
    return manifestInvalidResult(manifestValidation.errors.join("; "));
  }

  const findings: Finding[] = [];
  const warnings: Finding[] = [];
  const manifest = manifestValidation.value;
  const context = createContext(rootDir, manifest);
  const plugins = options.plugins || [];
  let baseline: CellFenceBaseline | undefined;
  let verifiedResourceBaseline: CellFenceBaseline | undefined;

  if (baselinePath) {
    try {
      const baselineValidation = validateBaseline(readJsonFile(baselinePath));
      if (!baselineValidation.ok || !baselineValidation.value) {
        addFinding(findings, {
          ruleId: "CELLFENCE_MANIFEST_INVALID",
          severity: "error",
          message: `baseline is invalid: ${baselineValidation.errors.join("; ")}`,
        });
      } else {
        baseline = baselineValidation.value;
        const sealFindings = validateBaselineSealFindings(manifest, baseline, repoPath(rootDir, baselinePath));
        for (const finding of sealFindings) addFinding(findings, finding);
        if (baseline.seal && sealFindings.length === 0) verifiedResourceBaseline = baseline;
      }
    } catch (error) {
      addFinding(findings, {
        ruleId: "CELLFENCE_MANIFEST_INVALID",
        severity: "error",
        message: `failed to read baseline ${repoPath(rootDir, baselinePath)}: ${errorMessage(error)}`,
      });
    }
  }

  validateDuplicateCellIds(manifest, findings);
  validateOwnershipOverlap(manifest, findings);
  warnWhenWaiverParsingDisabled(context, warnings);
  warnWhenOwnershipCoverageDisabled(context, warnings);
  validateOwnershipCoverage(context, findings);
  validateSymlinkTargets(context, findings);
  prewarmRepositoryPythonInspections(context);
  const observedPublicSurfaceFiles = new Set<string>();
  validatePublicEntries(context, findings, observedPublicSurfaceFiles);
  validateRequiredRuleConfiguration(context, options.ruleSeverities, findings);
  const observedImports: PluginImportReference[] = [];
  const observedImportFiles = new Set<string>();
  const externalDependencyObservations: ExternalDependencyObservation[] = [];
  const crossCellDependencies = validateImports(
    context,
    findings,
    warnings,
    repoPath(rootDir, manifestPath),
    observedImports,
    observedImportFiles,
    externalDependencyObservations,
  );
  const externalDependenciesByCell = validateExternalDependencyPolicy({
    context,
    baseline,
    observations: externalDependencyObservations,
  }, findings);
  for (const finding of validatePathClassImports({
    pathClasses: manifest.governance?.pathClasses,
    imports: observedImports.map((reference) => ({
      importerPath: reference.importerPath,
      targetPath: reference.targetPath,
      importerCellId: reference.importerCellId,
    })),
  })) {
    addFinding(findings, finding);
  }
  for (const finding of validateChangedPathClasses({
    pathClasses: manifest.governance?.pathClasses,
    changedFiles: options.changedFiles,
  })) {
    addFinding(finding.severity === "error" ? findings : warnings, finding);
  }
  const observedResourceFiles = new Set<string>();
  const accessesByCell = validateResourceAccesses(context, findings, warnings, verifiedResourceBaseline, observedResourceFiles);
  mergeAccessesByCell(
    accessesByCell,
    resourceEvidenceAccesses(context, evidencePathsForOptions(rootDir, options.evidencePaths), findings, verifiedResourceBaseline),
  );
  const prePluginMetrics = computeMetrics(context, crossCellDependencies, accessesByCell, externalDependenciesByCell);
  const pluginRepositoryModel = createRepositoryModel(
    context,
    baseline,
    observedImports,
    accessesByCell,
    prePluginMetrics,
    options.changedFiles,
  );
  mergeAccessesByCell(
    accessesByCell,
    validatePluginResourceAccesses(
      context,
      findings,
      warnings,
      baseline,
      runPluginAdapters(context, plugins, pluginRepositoryModel, findings),
    ),
  );
  const metrics = computeMetrics(context, crossCellDependencies, accessesByCell, externalDependenciesByCell);
  const repositoryModel = createRepositoryModel(context, baseline, observedImports, accessesByCell, metrics, options.changedFiles);

  if (baseline) {
    compareBaseline(context, metrics, baseline, findings, addFinding);
  }

  runPluginRules(context, plugins, repositoryModel, findings);
  validateManifestPatternsMatchFiles(context, findings, warnings);

  const rawObservationDiagnostics = [...findings, ...warnings];
  const severityAdjusted = applyRuleSeverityPolicy(context, findings, warnings, options.ruleSeverities);
  const active = applyWaiversToFindings(context, severityAdjusted.findings, severityAdjusted.warnings);
  const evidenceEnvelope = governanceEvidenceEnvelopeForCheck(
    context,
    manifestPath,
    baselinePath,
    evidencePathsForOptions(rootDir, options.evidencePaths),
    observedImports,
    accessesByCell,
    rawObservationDiagnostics,
    {
      imports: observedImportFiles,
      resources: observedResourceFiles,
      "public-surface": observedPublicSurfaceFiles,
    },
  );
  const evaluation = evaluateGovernance({
    evidence: evidenceEnvelope.assessment,
    findings: active.findings,
    warnings: active.warnings,
    metrics,
    requiredRules: [...requiredRuleSet(context)].sort((left, right) => left.localeCompare(right)),
  });
  const decision = legacyDecisionFromEvaluation(evaluation);
  const evidenceGraph = options.includeEvidenceGraph
    ? createEvidenceGraph({
      snapshot: evidenceEnvelope.snapshot,
      report: evidenceEnvelope.report,
      assessment: evidenceEnvelope.assessment,
      findings: decision.findings,
      warnings: decision.warnings,
    })
    : undefined;
  const internalOptions = options as CheckOptions & { includeAcceptanceRecord?: boolean };
  const acceptanceRecord = internalOptions.includeAcceptanceRecord
    ? createAcceptanceRecord({
      manifestPath: repoPath(rootDir, manifestPath),
      baselinePath: baselinePath ? repoPath(rootDir, baselinePath) : undefined,
      headSha: currentGitHeadOrUndefined(rootDir),
      snapshot: evidenceEnvelope.snapshot,
      evidence: evidenceEnvelope.assessment,
      evidenceGraph,
      evaluation,
    })
    : undefined;
  return {
    ok: decision.ok,
    exitCode: decision.exitCode,
    findings: decision.findings,
    warnings: decision.warnings,
    metrics: decision.metrics,
    ...(evidenceGraph ? { evidenceGraph } : {}),
    ...(acceptanceRecord ? { acceptanceRecord } : {}),
  };
}

function addPruneCandidate(candidates: PruneCandidate[], candidate: PruneCandidate): void {
  candidates.push(candidate);
}

/* c8 ignore start -- Public-symbol import shape handling is covered through createPruneReport black-box fixtures; V8 exposes each TypeScript AST guard as separate low-value branches. */
function importClausePublicSymbols(importClause: ts.ImportClause | undefined, producerSymbols: Set<string>): string[] {
  if (!importClause) return [];
  const symbols = new Set<string>();
  if (importClause.name && producerSymbols.has("default")) symbols.add("default");
  const namedBindings = importClause.namedBindings;
  if (namedBindings && ts.isNamespaceImport(namedBindings)) {
    for (const symbol of producerSymbols) symbols.add(symbol);
  } else if (namedBindings && ts.isNamedImports(namedBindings)) {
    for (const element of namedBindings.elements) {
      const importedName = element.propertyName?.text || element.name.text;
      if (producerSymbols.has(importedName)) symbols.add(importedName);
    }
  }
  return [...symbols];
}

function exportDeclarationPublicSymbols(exportDeclaration: ts.ExportDeclaration, producerSymbols: Set<string>): string[] {
  const exportClause = exportDeclaration.exportClause;
  if (!exportClause) return [...producerSymbols].filter((symbol) => symbol !== "default");
  if (ts.isNamespaceExport(exportClause)) return [...producerSymbols];
  const symbols = new Set<string>();
  for (const element of exportClause.elements) {
    const exportedName = element.propertyName?.text || element.name.text;
    if (producerSymbols.has(exportedName)) symbols.add(exportedName);
  }
  return [...symbols];
}

function publicSymbolsUsedByReference(
  context: AnalysisContext,
  reference: PluginImportReference,
  producer: CellManifest,
): string[] {
  const sourceFile = ts.createSourceFile(
    reference.importerPath,
    readSourceText(context, absolutePath(context.rootDir, reference.importerPath)),
    ts.ScriptTarget.Latest,
    true,
    sourceKindForPath(reference.importerPath),
  );
  const producerSymbols = new Set(producer.publicSymbols);
  const symbols = new Set<string>();
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === reference.specifier) {
      for (const symbol of importClausePublicSymbols(node.importClause, producerSymbols)) symbols.add(symbol);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === reference.specifier) {
      for (const symbol of exportDeclarationPublicSymbols(node, producerSymbols)) symbols.add(symbol);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return [...symbols];
}

function collectUsedPublicSymbols(context: AnalysisContext, observedImports: PluginImportReference[]): Map<string, Set<string>> {
  const usedByCell = new Map<string, Set<string>>();
  for (const cell of context.manifest.cells) usedByCell.set(cell.id, new Set<string>());
  for (const reference of observedImports) {
    if (!reference.targetCellId || !reference.targetPath || reference.importerCellId === reference.targetCellId) continue;
    const producer = context.cellsById.get(reference.targetCellId);
    if (!producer || normalizePath(reference.targetPath) !== normalizePath(producer.publicEntry)) continue;
    const usedSymbols = usedByCell.get(producer.id) as Set<string>;
    for (const symbol of publicSymbolsUsedByReference(context, reference, producer)) usedSymbols.add(symbol);
  }
  return usedByCell;
}
/* c8 ignore stop */

function resourceEntrySet(accesses: ResourceAccessReference[] = []): Set<string> {
  return new Set(sortedResourceBaselineEntries(accesses).map(resourceBaselineKey));
}

function countPruneCandidates(candidates: PruneCandidate[], kind: PruneCandidateKind): number {
  return candidates.filter((candidate) => candidate.kind === kind).length;
}

/* c8 ignore next 3 -- Optional fields only make prune output ordering deterministic; rule behavior is asserted through candidate contents. */
function pruneCandidateSortKey(candidate: PruneCandidate): string {
  return `${candidate.kind}:${candidate.cellId || ""}:${candidate.producerCellId || ""}:${candidate.filePath || ""}:${candidate.symbol || ""}:${candidate.artifactLaneId || ""}:${candidate.ruleId || ""}`;
}

function loadOptionalBaseline(rootDir: string, baselinePath: string | undefined): CellFenceBaseline | undefined {
  const resolvedBaselinePath = baselinePath
    ? path.resolve(rootDir, baselinePath)
    : defaultBaselinePath(rootDir);
  if (!fs.existsSync(resolvedBaselinePath)) return undefined;
  return loadBaselineFromFile(resolvedBaselinePath);
}

export function createPruneReport(options: CheckOptions = {}): PruneReport {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const manifestPath = path.resolve(rootDir, options.manifestPath || DEFAULT_MANIFEST_PATH);
  const manifest = loadManifestFromFile(manifestPath);
  const baseline = loadOptionalBaseline(rootDir, options.baselinePath);
  const context = createContext(rootDir, manifest);
  const findings: Finding[] = [];
  const warnings: Finding[] = [];
  const observedImports: PluginImportReference[] = [];

  validateDuplicateCellIds(manifest, findings);
  validateOwnershipOverlap(manifest, findings);
  warnWhenOwnershipCoverageDisabled(context, warnings);
  validateOwnershipCoverage(context, findings);
  validatePublicEntries(context, findings);
  validateRequiredRuleConfiguration(context, options.ruleSeverities, findings);
  const crossCellDependencies = validateImports(context, findings, warnings, repoPath(rootDir, manifestPath), observedImports);
  const accessesByCell = validateResourceAccesses(context, findings, warnings, baseline);
  mergeAccessesByCell(
    accessesByCell,
    resourceEvidenceAccesses(context, evidencePathsForOptions(rootDir, options.evidencePaths), findings, undefined),
  );
  const metrics = computeMetrics(context, crossCellDependencies, accessesByCell);
  if (baseline) compareBaseline(context, metrics, baseline, findings, addFinding);
  const severityAdjusted = applyRuleSeverityPolicy(context, findings, warnings, options.ruleSeverities);
  const preWaiverFindings = [...severityAdjusted.findings, ...severityAdjusted.warnings];
  const candidates: PruneCandidate[] = [];

  for (const cell of manifest.cells) {
    const observedDependencies = crossCellDependencies.get(cell.id) || new Set<string>();
    for (const consumer of cell.consumes || []) {
      if (observedDependencies.has(consumer.cell) || (consumer.artifactLanes || []).length > 0) continue;
      addPruneCandidate(candidates, {
        kind: "unused-consumer",
        cellId: cell.id,
        producerCellId: consumer.cell,
        message: `${cell.id} declares ${consumer.cell} as a consumer dependency, but no in-repository import uses it`,
      });
    }
  }

  const artifactConsumers = new Set<string>();
  for (const cell of manifest.cells) {
    for (const consumer of cell.consumes || []) {
      for (const lane of consumer.artifactLanes || []) artifactConsumers.add(`${consumer.cell}:${lane}`);
    }
  }
  for (const cell of manifest.cells) {
    for (const lane of cell.producesArtifacts || []) {
      if (artifactConsumers.has(`${cell.id}:${lane.id}`)) continue;
      addPruneCandidate(candidates, {
        kind: "unconsumed-artifact-lane",
        cellId: cell.id,
        artifactLaneId: lane.id,
        message: `${cell.id} produces artifact lane ${lane.id}, but no cell declares consumption of it`,
        details: { paths: lane.paths },
      });
    }
  }

  const usedPublicSymbols = collectUsedPublicSymbols(context, observedImports);
  for (const cell of manifest.cells) {
    const usedSymbols = usedPublicSymbols.get(cell.id) as Set<string>;
    for (const symbol of cell.publicSymbols) {
      if (usedSymbols.has(symbol)) continue;
      addPruneCandidate(candidates, {
        kind: "unused-public-symbol",
        cellId: cell.id,
        symbol,
        filePath: cell.publicEntry,
        message: `${cell.id} declares public symbol ${symbol}, but no in-repository consumer imports it`,
      });
    }
  }

  for (const waiver of collectWaiversForManifest(rootDir, manifest).filter((candidate) => candidate.valid)) {
    if (preWaiverFindings.some((finding) => waiverMatchesFinding(waiver, finding))) continue;
    addPruneCandidate(candidates, {
      kind: "stale-waiver",
      cellId: findOwningCell(manifest, waiver.filePath)?.id,
      filePath: waiver.filePath,
      line: waiver.line,
      ruleId: waiver.ruleId,
      message: `waiver for ${waiver.ruleId} at ${waiver.filePath}:${waiver.line} no longer suppresses an active finding`,
      details: { expires: waiver.expires, approvedBy: waiver.approvedBy, reason: waiver.reason },
    });
  }

  if (baseline) {
    for (const [cellId, baselineRecord] of Object.entries(baseline.cells)) {
      const currentResourceKeys = resourceEntrySet(accessesByCell.get(cellId));
      for (const resource of baselineRecord.resourceAccesses || []) {
        if (currentResourceKeys.has(resourceBaselineKey(resource))) continue;
        addPruneCandidate(candidates, {
          kind: "stale-baseline-resource",
          cellId,
          resource,
          message: `${cellId} baseline grandfathers ${resource.kind} ${resource.access} ${resource.selector}, but current analysis no longer observes it`,
        });
      }
    }
  }

  const sortedCandidates = candidates.sort((left, right) =>
    pruneCandidateSortKey(left).localeCompare(pruneCandidateSortKey(right)));
  return {
    schemaVersion: "cellfence.prune.v1",
    ok: sortedCandidates.length === 0,
    candidates: sortedCandidates,
    metrics: {
      candidates: sortedCandidates.length,
      unusedConsumers: countPruneCandidates(sortedCandidates, "unused-consumer"),
      unusedPublicSymbols: countPruneCandidates(sortedCandidates, "unused-public-symbol"),
      unconsumedArtifactLanes: countPruneCandidates(sortedCandidates, "unconsumed-artifact-lane"),
      staleWaivers: countPruneCandidates(sortedCandidates, "stale-waiver"),
      staleBaselineResources: countPruneCandidates(sortedCandidates, "stale-baseline-resource"),
    },
  };
}

function gitCommand(rootDir: string, args: string[]): string {
  return gitCommandRaw(rootDir, args).trim();
}

function gitCommandRaw(rootDir: string, args: string[]): string {
  try {
    return execCommandSync("git", ["-c", "core.quotepath=off", ...args], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const failure = error as { stderr?: unknown; message?: unknown };
    const stderr = typeof failure.stderr === "string" ? failure.stderr.trim() : "";
    /* c8 ignore next -- execFileSync throws Error-like objects with string messages; this is a final defensive fallback. */
    const fallbackMessage = typeof failure.message === "string" ? failure.message : "git command failed";
    const message = stderr || fallbackMessage;
    throw new Error(message, { cause: error });
  }
}

function gitMetadataFailure(message: string): CheckResult {
  return {
    ok: false,
    exitCode: 2,
    findings: [
      {
        ruleId: "CELLFENCE_GIT_METADATA_UNAVAILABLE",
        severity: "error",
        message,
      },
    ],
    warnings: [],
    metrics: {},
  };
}

function assertGitCommit(rootDir: string, ref: string): string {
  return gitCommand(rootDir, ["rev-list", "-1", "--end-of-options", ref]);
}

function changedFilesForRefs(rootDir: string, baseRef: string, headRef?: string): string[] {
  const files = new Set<string>();
  const addDiff = (args: string[]): void => {
    const output = gitCommandRaw(rootDir, args);
    for (const entry of output.split("\0")) {
      const normalized = normalizePath(entry);
      if (normalized) files.add(normalized);
    }
  };
  if (headRef) {
    addDiff(["diff", "--name-only", "-z", "--diff-filter=ACMRD", "--end-of-options", `${baseRef}...${headRef}`]);
  } else {
    addDiff(["diff", "--name-only", "-z", "--diff-filter=ACMRD", "--end-of-options", `${baseRef}...HEAD`]);
    addDiff(["diff", "--name-only", "-z", "--diff-filter=ACMRD", "--cached"]);
    addDiff(["diff", "--name-only", "-z", "--diff-filter=ACMRD"]);
    addDiff(["ls-files", "--others", "--exclude-standard", "-z"]);
  }
  return [...files].sort((left, right) => left.localeCompare(right));
}

type OwnershipMovement = {
  status: "rename" | "copy";
  similarity: number | undefined;
  fromPath: string;
  toPath: string;
};

function parseMovementStatus(status: string): Pick<OwnershipMovement, "status" | "similarity"> | undefined {
  const kind = status[0];
  if (kind !== "R" && kind !== "C") return undefined;
  const rawSimilarity = status.slice(1);
  return {
    status: kind === "R" ? "rename" : "copy",
    similarity: rawSimilarity.length > 0 ? Number(rawSimilarity) : undefined,
  };
}

function movementEntriesFromDiff(output: string): OwnershipMovement[] {
  const movements: OwnershipMovement[] = [];
  const parts = output.split("\0").filter((part) => part.length > 0);
  for (let index = 0; index < parts.length;) {
    const parsedStatus = parseMovementStatus(parts[index] || "");
    index += 1;
    if (!parsedStatus) continue;
    const fromPath = parts[index];
    const toPath = parts[index + 1];
    index += 2;
    if (!fromPath || !toPath) continue;
    movements.push({
      ...parsedStatus,
      fromPath: normalizePath(fromPath),
      toPath: normalizePath(toPath),
    });
  }
  return movements;
}

function movementEntriesForRefs(rootDir: string, baseRef: string, headRef?: string): OwnershipMovement[] {
  const movements = new Map<string, OwnershipMovement>();
  const addDiff = (args: string[]): void => {
    const output = gitCommandRaw(rootDir, args);
    for (const movement of movementEntriesFromDiff(output)) {
      movements.set(`${movement.status}:${movement.fromPath}:${movement.toPath}`, movement);
    }
  };
  const diffArgs = ["diff", "--find-renames=50", "--find-copies=50", "--name-status", "-z", "--diff-filter=RC"];
  if (headRef) {
    addDiff([...diffArgs, "--end-of-options", `${baseRef}...${headRef}`]);
  } else {
    addDiff([...diffArgs, "--end-of-options", `${baseRef}...HEAD`]);
    addDiff([...diffArgs, "--cached"]);
    addDiff([...diffArgs]);
  }
  return [...movements.values()].sort((left, right) => `${left.fromPath}:${left.toPath}`.localeCompare(`${right.fromPath}:${right.toPath}`));
}

function crossCellMovementFindings(manifest: CellFenceManifest, movements: OwnershipMovement[]): Finding[] {
  const findings: Finding[] = [];
  for (const movement of movements) {
    const fromCell = findOwningCell(manifest, movement.fromPath);
    const toCell = findOwningCell(manifest, movement.toPath);
    if (!fromCell || !toCell || fromCell.id === toCell.id) continue;
    findings.push({
      ruleId: "CELLFENCE_CROSS_CELL_MOVE",
      severity: "error",
      cellId: toCell.id,
      producerCellId: fromCell.id,
      filePath: movement.toPath,
      message: `${movement.status} moves governed source across cell ownership from ${fromCell.id} to ${toCell.id}`,
      details: {
        status: movement.status,
        similarity: movement.similarity,
        fromPath: movement.fromPath,
        toPath: movement.toPath,
        fromCell: fromCell.id,
        toCell: toCell.id,
      },
    });
  }
  return findings;
}

function withBaseWorktree<T>(rootDir: string, baseCommit: string, callback: (baseRootDir: string) => T): T {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cellfence-base-"));
  const baseRootDir = path.join(tempRoot, "repo");
  try {
    gitCommand(rootDir, ["worktree", "add", "--detach", "--quiet", baseRootDir, baseCommit]);
    return callback(baseRootDir);
  } finally {
    try {
      if (fs.existsSync(baseRootDir)) gitCommand(rootDir, ["worktree", "remove", "--force", baseRootDir]);
    } catch {
      // Best-effort cleanup. The main check result should not be hidden by worktree removal noise.
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function checkOptionsForBase(baseRootDir: string, options: ChangedCheckOptions): CheckOptions {
  const baseOptions: CheckOptions = {
    rootDir: baseRootDir,
    manifestPath: options.manifestPath,
  };
  if (options.baselinePath && fs.existsSync(path.resolve(baseRootDir, options.baselinePath))) {
    baseOptions.baselinePath = options.baselinePath;
  }
  if (options.plugins) baseOptions.plugins = options.plugins;
  if (options.ruleSeverities) baseOptions.ruleSeverities = options.ruleSeverities;
  const evidencePaths = (options.evidencePaths || []).filter((evidencePath) => fs.existsSync(path.resolve(baseRootDir, evidencePath)));
  if (evidencePaths.length > 0) baseOptions.evidencePaths = evidencePaths;
  return baseOptions;
}

function checkOptionsForChangedCurrent(options: ChangedCheckOptions, changedFiles: string[]): CheckOptions {
  return {
    rootDir: options.rootDir,
    manifestPath: options.manifestPath,
    baselinePath: options.baselinePath,
    evidencePaths: options.evidencePaths,
    plugins: options.plugins,
    ruleSeverities: options.ruleSeverities,
    changedFiles,
  };
}

function findingKey(finding: Finding): string {
  return finding.fingerprint || findingFingerprint(finding);
}

function changedBaseCacheDirectory(rootDir: string, options: ChangedCheckOptions): string | undefined {
  if (options.baseCacheDir === false) return undefined;
  if (typeof options.baseCacheDir === "string") return path.resolve(rootDir, options.baseCacheDir);
  const gitCommonDirectory = gitCommand(rootDir, ["rev-parse", "--git-common-dir"]);
  return path.join(path.resolve(rootDir, gitCommonDirectory), "cellfence-cache", "changed-base");
}

function hasExternalPolicyPath(rootDir: string, options: ChangedCheckOptions): boolean {
  return [options.manifestPath, options.baselinePath, ...(options.evidencePaths || [])]
    .filter((candidate): candidate is string => typeof candidate === "string")
    .some((candidate) => {
      if (path.isAbsolute(candidate)) return true;
      const resolved = path.resolve(rootDir, candidate);
      const relative = path.relative(rootDir, resolved);
      return relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
    });
}

const WAIVER_APPROVERS_ENV = "CELLFENCE_APPROVERS";

function hashedEnvironmentValue(name: string): string | null {
  const value = process.env[name];
  if (value === undefined) return null;
  return crypto.createHash("sha256").update(value).digest("hex");
}

function changedBaseTrustedInputIdentity(): Record<string, unknown> {
  return {
    waiverClockMinuteUtc: new Date().toISOString().slice(0, 16),
    environment: {
      [WAIVER_APPROVERS_ENV]: hashedEnvironmentValue(WAIVER_APPROVERS_ENV),
      [BASELINE_HMAC_KEY_ENV]: hashedEnvironmentValue(BASELINE_HMAC_KEY_ENV),
      [BASELINE_HMAC_KEY_ID_ENV]: hashedEnvironmentValue(BASELINE_HMAC_KEY_ID_ENV),
      [BASELINE_ED25519_PUBLIC_KEY_ENV]: hashedEnvironmentValue(BASELINE_ED25519_PUBLIC_KEY_ENV),
      [BASELINE_ED25519_KEY_ID_ENV]: hashedEnvironmentValue(BASELINE_ED25519_KEY_ID_ENV),
    },
  };
}

function changedBaseCacheIdentity(rootDir: string, baseCommit: string, options: ChangedCheckOptions): string | undefined {
  if (hasExternalPolicyPath(rootDir, options)) return undefined;
  if ((options.plugins?.length || 0) > 0 && !options.pluginCacheKey) return undefined;
  return changedBaseCacheKey({
    baseCommit,
    manifestPath: options.manifestPath || DEFAULT_MANIFEST_PATH,
    baselinePath: options.baselinePath,
    evidencePaths: [...(options.evidencePaths || [])].sort(),
    ruleSeverities: options.ruleSeverities,
    pluginCacheKey: options.pluginCacheKey,
    trustedInputs: changedBaseTrustedInputIdentity(),
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      typescript: ts.version,
      pythonInspector: pythonInspectorRuntimeIdentity(),
    },
  });
}

function checkChangedBase(rootDir: string, baseCommit: string, options: ChangedCheckOptions): {
  result: CheckResult;
  cacheHit: boolean;
} {
  const cacheDirectory = changedBaseCacheDirectory(rootDir, options);
  const cacheKey = changedBaseCacheIdentity(rootDir, baseCommit, options);
  if (cacheDirectory && cacheKey) {
    const cached = readChangedBaseCache(cacheDirectory, cacheKey);
    if (cached) return { result: cached, cacheHit: true };
  }
  const result = withBaseWorktree(rootDir, baseCommit, (baseRootDir) =>
    checkRepository(checkOptionsForBase(baseRootDir, options)));
  if (cacheDirectory && cacheKey && result.exitCode !== 3) {
    writeChangedBaseCache(cacheDirectory, cacheKey, result);
  }
  return { result, cacheHit: false };
}

export function checkChangedRepository(options: ChangedCheckOptions = {}): CheckResult {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const baseRef = options.baseRef || "origin/main";
  try {
    gitCommand(rootDir, ["rev-parse", "--is-inside-work-tree"]);
    const baseCommit = assertGitCommit(rootDir, baseRef);
    if (options.headRef) {
      const headCommit = assertGitCommit(rootDir, options.headRef);
      // An explicit ref selects a committed snapshot, regardless of checkout or dirt.
      return withBaseWorktree(rootDir, headCommit, (headRootDir) => {
        const snapshotPath = (input: string | undefined): string | undefined => {
          if (!input || !path.isAbsolute(input)) return input;
          const relative = path.relative(rootDir, input);
          return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
            ? path.resolve(headRootDir, relative)
            : input;
        };
        return checkChangedRepository({
          ...options,
          rootDir: headRootDir,
          baseRef: baseCommit,
          headRef: undefined,
          manifestPath: snapshotPath(options.manifestPath),
          baselinePath: snapshotPath(options.baselinePath),
          evidencePaths: options.evidencePaths?.map((input) => snapshotPath(input)!),
        });
      });
    }
    const changedFiles = changedFilesForRefs(rootDir, baseRef, options.headRef);
    const movements = movementEntriesForRefs(rootDir, baseRef, options.headRef);
    const currentResult = checkRepository(checkOptionsForChangedCurrent(options, changedFiles));
    if (currentResult.exitCode === 2 || currentResult.exitCode === 3) {
      return { ...currentResult, changedFiles };
    }
    const baseCheck = checkChangedBase(rootDir, baseCommit, options);
    const baseResult = baseCheck.result;
    if (baseResult.exitCode === 2 || baseResult.exitCode === 3) {
      return {
        ...baseResult,
        findings: baseResult.findings.map((finding) => ({
          ...finding,
          message: `base check failed before changed-finding diff could be computed: ${finding.message}`,
        })),
        changedFiles,
        baseCacheHit: baseCheck.cacheHit,
      };
    }
    const baseFindingKeys = new Set(baseResult.findings.map(findingKey));
    const baseWarningKeys = new Set(baseResult.warnings.map(findingKey));
    const manifest = loadManifestFromFile(path.resolve(rootDir, options.manifestPath || DEFAULT_MANIFEST_PATH));
    const movementFindings = crossCellMovementFindings(manifest, movements);
    const findings = [
      ...currentResult.findings.filter((finding) => !baseFindingKeys.has(findingKey(finding))),
      ...movementFindings,
    ];
    const warnings = currentResult.warnings.filter((warning) => !baseWarningKeys.has(findingKey(warning)));
    const hasErrors = findings.some((finding) => finding.severity === "error");
    return {
      ...currentResult,
      ok: !hasErrors,
      exitCode: hasErrors ? 1 : 0,
      findings,
      warnings,
      changedFiles,
      baseFindingCount: baseResult.findings.length,
      baseCacheHit: baseCheck.cacheHit,
    };
  } catch (error) {
    return gitMetadataFailure(`changed check requires git metadata and a valid base ref: ${errorMessage(error)}`);
  }
}

function claimOperationDependencies() {
  return {
    assertGitCommit,
    changedFilesForRefs,
    createContext,
    gitCommand,
    loadManifestFromFile,
  };
}

export function checkWriteAccess(options: WriteAccessOptions): WriteAccessResult {
  return checkWriteAccessOperation(options, claimOperationDependencies());
}

export function checkWriteAccessAsync(options: WriteAccessOptions): Promise<WriteAccessResult> {
  return checkWriteAccessOperationAsync(options, claimOperationDependencies());
}

export function checkClaims(options: ClaimCheckOptions = {}): ClaimCheckResult {
  return checkClaimsOperation(options, claimOperationDependencies());
}

export function checkClaimsAsync(options: ClaimCheckOptions = {}): Promise<ClaimCheckResult> {
  return checkClaimsOperationAsync(options, claimOperationDependencies());
}

export function createClaim(options: ClaimCreateOptions): ClaimCreateResult {
  return createClaimOperation(options, claimOperationDependencies());
}

export function createClaimAsync(options: ClaimCreateOptions): Promise<ClaimCreateResult> {
  return createClaimOperationAsync(options, claimOperationDependencies());
}

export function listClaims(options: ClaimCheckOptions = {}): ClaimCheckResult {
  return listClaimsOperation(options);
}

export function listClaimsAsync(options: ClaimCheckOptions = {}): Promise<ClaimCheckResult> {
  return listClaimsOperationAsync(options);
}
export function createBaseline(options: CheckOptions = {}): CellFenceBaseline {
  return createBaselineOperation(options, { checkRepository, loadManifestFromFile });
}

export function verifyBaselineSeal(options: CheckOptions = {}): CheckResult {
  return verifyBaselineSealOperation(options, { checkRepository, loadManifestFromFile });
}

export function guardBaselineUpdate(options: BaselineUpdateGuardOptions): BaselineUpdateGuardResult {
  return guardBaselineUpdateOperation(options, { checkRepository, loadManifestFromFile });
}

function contextOperationDependencies() {
  return {
    checkRepository,
    createContext,
    loadManifestFromFile,
  };
}

export function createCellContext(options: ContextOptions): CellFenceContext {
  return createCellContextOperation(options, contextOperationDependencies());
}

function graphOperationDependencies() {
  return {
    createCellContext,
    createContext,
    evidencePathsForOptions,
    loadManifestFromFile,
    mergeAccessesByCell,
    resourceEvidenceAccesses,
    validateImports,
    validateResourceAccesses,
  };
}

export function createCouplingGraph(options: CheckOptions = {}): CouplingGraph {
  return createCouplingGraphOperation(options, graphOperationDependencies());
}

export function createAutoAllocation(options: AutoAllocateOptions = {}): AutoAllocation {
  return createAutoAllocationOperation(options, graphOperationDependencies());
}
function explanationValueText(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) return String(value);
  return JSON.stringify(value);
}

function formatFindingExplanationLines(finding: Finding): string[] {
  if (!finding.explanation) return [];
  const lines: string[] = [];
  if (finding.explanation.observedFacts.length > 0) {
    lines.push("  Observed:");
    for (const fact of finding.explanation.observedFacts) {
      const location = fact.filePath ? ` (${fact.filePath}${fact.line ? `:${fact.line}` : ""})` : "";
      const value = explanationValueText(fact.value);
      lines.push(`    - ${fact.description}${location}${value ? `: ${value}` : ""}`);
    }
  }
  if (finding.explanation.appliedContracts.length > 0) {
    lines.push("  Contracts:");
    for (const contract of finding.explanation.appliedContracts) {
      const value = explanationValueText(contract.value);
      lines.push(`    - ${contract.source} ${contract.filePath}${contract.jsonPointer}: ${contract.description}${value ? ` = ${value}` : ""}`);
    }
  }
  lines.push(`  Judgment: ${finding.explanation.judgment}`);
  if (finding.explanation.unverified.length > 0) {
    lines.push("  Unverified:");
    for (const item of finding.explanation.unverified) lines.push(`    - ${item}`);
  }
  return lines;
}

export function formatHumanResult(result: CheckResult): string {
  const lines: string[] = [];
  lines.push(result.ok ? "CellFence check passed." : "CellFence check failed.");
  for (const finding of [...result.findings, ...result.warnings]) {
    const location = finding.filePath ? ` ${finding.filePath}` : "";
    lines.push(`[${finding.severity}] ${finding.ruleId}${location}: ${finding.message}`);
    lines.push(...formatFindingExplanationLines(finding));
  }
  return lines.join("\n");
}

export { findingFingerprint } from "./findings.js";

export {
  repoPath,
  sourceFilesForCell,
  sourceFilesUnderGovernance,
} from "./file-index.js";

// 0.4.0 (prototype): coverage collector used by the `cellfence coverage`
// subcommand. See packages/engine/src/analysis/coverage-collector.ts for
// the rationale. Re-exported here so the CLI can import it through
// `@cellfence/engine` without reaching into the package internals.
export {
  buildCoverageReport,
  recordUnresolved,
  type CoverageInput,
  type CoverageKind,
  type CoverageReport,
  type CoverageSummary,
  type CoverageUnresolved,
} from "./analysis/coverage-collector.js";

// 0.4.0 (prototype): baseline change detector used by the
// `cellfence baseline gate` subcommand and the cellfence-baseline-gate
// GitHub Action. See packages/engine/src/baseline-change-detector.ts
// for the rationale. Re-exported here so the CLI and the action can
// import through `@cellfence/engine` without reaching into the
// package internals.
export {
  detectBaselineChanges,
  type BaselineDimension,
  type BaselineDimensionDelta,
  type GovernanceChangeReport,
} from "./baseline-change-detector.js";

export { readJsonFile } from "./json-file.js";

// 0.4.0 (prototype): distributed claim backend interface and
// reference implementations. The 0.4.0 refactor of
// packages/engine/src/claims.ts will route all claim reads and
// writes through these types. Re-exported here so downstream
// packages (CLI, GitHub Action, MCP proxy) can build against the
// same surface.
export {
  CellFenceClaimCasConflict,
  emptyClaimStoreState,
  type ClaimStoreBackend,
  type ClaimStoreEntry,
  type ClaimStoreState,
} from "./claims/backend.js";
export { LocalFileClaimStore, localFileClaimStoreFingerprint, type LocalFileClaimStoreOptions } from "./claims/backends/local-file.js";

// 0.4.0: claim backend selector. The 0.3.0 prototype shipped the
// `ClaimStoreBackend` interface and two reference implementations;
// the 0.4.0 selector reads `governance.claimBackend` from the
// manifest (or `CELLFENCE_CLAIM_BACKEND` from the environment) and
// returns the matching backend. The full migration of
// `packages/engine/src/claims.ts` to call through this interface
// is queued for a follow-up commit; this lands just the selector
// so a repository can configure a backend today.
export {
  resolveClaimBackend,
  type ClaimBackendType,
  type ResolvedClaimBackend,
  type ResolveOptions,
} from "./claims/selector.js";
