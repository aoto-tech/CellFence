# Research Artifact Index

This directory is the evidence trail for CellFence research work. It mixes current protocols, historical pilot notes, and machine-readable handoff artifacts. Keep old notes in place for auditability; prefer adding a new dated note over rewriting a prior conclusion.

## Current Protocols And Evidence Notes

| Purpose | Artifact | Status |
|---|---|---|
| Reviewed corpus precision protocol and claim lane | [corpus-precision-study.md](corpus-precision-study.md) | Current protocol for precision claims and reviewed-manifest evidence. |
| History replay protocol | [history-replay-study.md](history-replay-study.md) | Current replay protocol for historical changes. |
| Product evidence harnesses | [../evidence-harnesses.md](../evidence-harnesses.md) | Current command map for corpus, oracle, adversarial, and competitor harnesses. |
| Agent effectiveness design | [effectiveness-benchmark-plan.md](effectiveness-benchmark-plan.md) and [agent-effectiveness-study.md](agent-effectiveness-study.md) | Current design notes; results should stay date-bound. |
| Mutation injection study | [mutation-injection-study.md](mutation-injection-study.md) | Current mutation-evidence method note. |
| Evidence graph verifier | [evidence-graph-verifier.md](evidence-graph-verifier.md) | Current verifier note for evidence graph consistency. |
| Upstream policy oracle | [upstream-policy-oracle-v1.md](upstream-policy-oracle-v1.md) | Current oracle design; the dated pilot is historical. |
| External precision labeling frontier | [external-precision-labeling-2026-07-24.md](external-precision-labeling-2026-07-24.md) | Current blocker/frontier note, not a product claim. |

## Historical Precision And Onboarding Rounds

| Group | Artifacts | Status |
|---|---|---|
| First TS/JS and Python onboarding pilots | [ts-js-workspace-pilot-2026-07-18.md](ts-js-workspace-pilot-2026-07-18.md), [oss-ts-js-200-2026-07-18.md](oss-ts-js-200-2026-07-18.md), [oss-python-10-2026-07-18.md](oss-python-10-2026-07-18.md), [oss-python-framework-800-2026-07-18.md](oss-python-framework-800-2026-07-18.md) | Historical onboarding and scale diagnostics. |
| Reviewed TS/JS pilot sequence | [ts-js-reviewed-pilot-10-2026-07-19.md](ts-js-reviewed-pilot-10-2026-07-19.md) through [ts-js-reviewed-pilot-10-2026-07-23-round16.md](ts-js-reviewed-pilot-10-2026-07-23-round16.md) | Historical precision rounds; superseded by later corpus protocols. |
| Reviewed pilot expansion rounds | [ts-js-reviewed-pilot-12-2026-07-24-round17.md](ts-js-reviewed-pilot-12-2026-07-24-round17.md), [ts-js-reviewed-pilot-12-2026-07-25-round18.md](ts-js-reviewed-pilot-12-2026-07-25-round18.md), [ts-js-reviewed-pilot-52-2026-07-25-round21.md](ts-js-reviewed-pilot-52-2026-07-25-round21.md), [ts-js-reviewed-pilot-105-2026-07-25-round23.md](ts-js-reviewed-pilot-105-2026-07-25-round23.md) through [ts-js-reviewed-pilot-105-2026-07-25-round33-valid-frontier.md](ts-js-reviewed-pilot-105-2026-07-25-round33-valid-frontier.md), [ts-js-reviewed-pilot-160-2026-07-26-round46-boundary-core.md](ts-js-reviewed-pilot-160-2026-07-26-round46-boundary-core.md), [ts-js-reviewed-pilot-160-2026-07-26-round47-boundary-core.md](ts-js-reviewed-pilot-160-2026-07-26-round47-boundary-core.md) | Historical gap-directed and frontier rounds. |
| Precision handoff summaries | [ts-js-reviewed-precision-round18-100-handoff.md](ts-js-reviewed-precision-round18-100-handoff.md), [ts-js-reviewed-precision-round101-10000-handoff.md](ts-js-reviewed-precision-round101-10000-handoff.md) | Historical handoff notes with matching JSON artifacts. |

## Archived Or Superseded Notes

| Artifact | Status |
|---|---|
| [cellfence-experiment-summary.md](cellfence-experiment-summary.md) | Early experiment summary; use current protocol docs for claims. |
| [adversarial-validation-2026-07-18.md](adversarial-validation-2026-07-18.md) | Dated validation record; use `benchmark/` docs for current adversarial benchmark shape. |
| [baseline-2026-07-19.md](baseline-2026-07-19.md) | Dated baseline record. |
| [conformance-hardening-2026-07-19.md](conformance-hardening-2026-07-19.md) | Dated conformance hardening note. |
| [semantic-event-detector-v3.2.md](semantic-event-detector-v3.2.md) and [semantic-event-detector-v3.2-freeze.md](semantic-event-detector-v3.2-freeze.md) | Frozen detector record; keep for audit, not as live roadmap. |
| [upstream-policy-oracle-v1-pilot-2026-07-18.md](upstream-policy-oracle-v1-pilot-2026-07-18.md) | Dated pilot for the upstream policy oracle. |

## Machine-Readable Artifacts

| Artifact | Status |
|---|---|
| [adversarial-validation-2026-07-18.json](adversarial-validation-2026-07-18.json) | Dated adversarial validation data. |
| [ts-js-reviewed-pilot-12-2026-07-25-round18-policy-decisions.json](ts-js-reviewed-pilot-12-2026-07-25-round18-policy-decisions.json) | Round 18 policy-decision data. |
| [ts-js-reviewed-precision-round18-100-handoff.json](ts-js-reviewed-precision-round18-100-handoff.json) | Round 18 handoff data. |
| [ts-js-reviewed-precision-round101-10000-handoff.json](ts-js-reviewed-precision-round101-10000-handoff.json) | Round 101-10000 handoff data. |

## Reproduction Commands

Only commands present in the root `package.json` are listed here:

```bash
npm run conformance:oracles
npm run evidence:graph:verify
npm run evidence:corpus
npm run evidence:github-corpus
npm run evidence:oss-scale
npm run evidence:competitors
npm run evidence:adversarial:verify
npm run mutation:injection
npm run research:corpus
npm run research:history
npm run research:oracle
npm run research:effectiveness
npm run research:bundle
npm run research:claim
```

Broad corpus and live research runs require operator-supplied inputs such as frozen corpus files, trusted analyzer descriptors, output paths, and network or disk budget. Do not commit generated benchmark or corpus output unless a separate issue explicitly asks for a reviewed artifact.
