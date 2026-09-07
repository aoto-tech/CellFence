# Contributing

CellFence changes should keep the implementation narrow and the specification honest.

## Contributor Workflow for Small Issues

If you are picking up a small issue or making your first contribution:

1. **Pick an issue**: Look for issues tagged [`good first issue`](https://github.com/pushnanashi2/CellFence/labels/good%20first%20issue) or [`help wanted`](https://github.com/pushnanashi2/CellFence/labels/help%20wanted).
2. **Comment before starting**: Leave a comment on the issue stating that you intend to work on it, so effort is not duplicated.
3. **Stay focused on acceptance criteria**: Keep pull requests focused specifically on the scope and acceptance criteria defined in the issue. Avoid bundling unrelated refactorings or cosmetic edits.
4. **Run fast validation first**: Run the smallest relevant check first (e.g. `npm run build`, `node --test tests/<relevant-test>.mjs`, or `npm test`). If running full suites or slow mutation checks is not feasible in your local environment, report skipped checks honestly in your pull request description.
5. **Keep PRs clean**: Do not commit unrelated generated files, raw benchmark outputs (`benchmark/results/raw/`), or temporary local caches.
6. **Report verification in PR description**: Include the exact validation commands executed and their output summaries when opening the pull request.

Before submitting a change, run:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run cellfence:self-check
```

Do not relax fixture expectations to hide implementation defects. If a fixture reveals an ambiguity, record the ambiguity in the change description and update the protocol only when the intended rule is clear.

Publishing is intentionally not automated in v0.x. Future npm publishing should use GitHub OIDC trusted publishing rather than long-lived package tokens.

## Lightweight contributor workflow

If you're new to the project or just want to tackle a small issue, follow this
short path:

1. **Pick an issue** - look for issues labeled `good first issue` or `help wanted`.
2. **Comment before you start** - add a comment on the issue stating you're working on it.
3. **Keep the PR focused** - address only the issue acceptance criteria, without unrelated refactors or generated output.
4. **Run targeted validation first** - use the smallest relevant npm check, such as `node --test tests/<relevant-test>.mjs`, `npm run build`, or `npm test`.
5. **Report skipped slow checks** - if a full suite or mutation run is not practical, say exactly what you skipped and why.
6. **Include validation results** - add the commands you ran and a short result summary to the PR description.

Documentation-only changes can use focused validation when the PR explains why
broader checks were not needed.
