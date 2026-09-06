# Mutation testing

CellFence keeps two mutation-testing paths with the same `break: 100` threshold.

- `.github/workflows/mutation-audit.yml` is the scheduled, manually dispatched, and reusable full audit. It derives the authoritative scope matrix from `stryker.conf.mjs`, disables incremental reuse, and keeps each scope at `high: 100`, `low: 100`, and `break: 100`. The npm publish workflow must complete this audit at the exact tag ref before its approval-controlled publish job can start.
- `npm run mutation` remains the local single-process full audit for machines that can accommodate it.
- `npm run mutation:changed` is the pull-request feedback path. It compares the branch with `origin/main` by default, selects mutation-covered production files and their dedicated tests, and runs each selected target against its fixed dedicated test set.

Each changed scope has its own incremental cache under `reports/mutation/incremental/` and its own Stryker temp directory. The PR workflow isolates this cache by pull-request number; it is never reused by the full audit. Changing, deleting, or renaming a target or one of its tests invalidates the relevant cached results through Stryker incremental mode. Rename detection is disabled for scope selection so both old and new paths are considered. Changing the mutation runner, mapping, configuration, mutation workflows, or root package metadata selects every scope and forces fresh incremental evidence for those selected scopes. Lockfile-only changes are narrowed to the changed workspace package blocks when the diff is safely attributable; shared root or external dependency lock changes still fall back to every scope. Helper files that feed a mutation-covered entry point can also select that dependent scope even when the helper is not itself an authoritative full-audit mutation target. Use `--force` to disregard a cache, `--no-incremental` to run selected scopes without caching, `--files <comma-separated-paths>` to select paths explicitly, repeat `--scope <id>` for a stable explicit scope selection, or pass `--jobs 1..4` / `CELLFENCE_MUTATION_CHANGED_JOBS=1..4` to run isolated changed scopes in parallel. When changed scopes run in parallel, most nested Stryker runs use `concurrency: 1` to avoid oversubscribing the host; the heaviest engine scopes keep their measured faster concurrency so parallelism does not make them slower.

CI checkouts must fetch the comparison ref used by the runner. Pass `--base <ref>` or set `CELLFENCE_MUTATION_BASE` when `origin/main` is unavailable in a shallow checkout.

The target-to-test map lives in `scripts/mutation-scopes.mjs`. Its complete target set is checked against `stryker.conf.mjs` before a changed run or matrix generation starts. Adding a full mutation target without adding a changed scope therefore fails closed instead of silently omitting the target.

Every run writes `reports/mutation/changed/plan.json` and `summary.json`. A successful no-work run records an empty execution list and an explicit reason; executed runs record base/head commits, elapsed time, exit status, and failed scopes. CI uploads the directory even on failure. A killed runner can leave only `plan.json`; treat that as incomplete evidence and rerun the scope.

The changed runner does not replace the full audit and must not be cited as release-wide mutation evidence. Files outside the existing full mutation target set and its declared helper or infrastructure inputs produce no scoped mutation work and still require the normal lint, typecheck, and test gates.

## Troubleshooting Changed PR Failures

Start with the uploaded `reports/mutation/changed/` artifact. `plan.json` shows which files selected which scopes; `summary.json` shows the scopes that ran, their exit status, report paths, elapsed time, and any failed scope IDs. If CI uploaded only `plan.json`, the run did not finish and should be treated as incomplete evidence.

To reproduce the planner locally:

```bash
npm run mutation:changed:plan
```

To force one explicit scope after inspecting `plan.json`, repeat the reported scope ID:

```bash
npm run mutation:changed -- --scope engine-file-index --force
```

For a file-focused rerun without incremental cache reuse:

```bash
npm run mutation:changed -- --files packages/engine/src/file-index.ts --no-incremental
```

Use `--base <ref>` or `CELLFENCE_MUTATION_BASE=<ref>` when `origin/main` is not available locally. Use `--jobs 1..4` only after a single-scope reproduction is understood; parallel output is better for throughput than diagnosis.

If the changed runner finds no scoped mutation work, or if the touched behavior is outside the changed-scope map, that is not release-wide evidence. Keep the ordinary build and tests, and rely on the scheduled or reusable full audit for repository-wide mutation coverage. In a PR comment, name the artifact inspected, the exact local command run, the scope IDs covered, and any reason a smaller local run was used instead of the full audit.
