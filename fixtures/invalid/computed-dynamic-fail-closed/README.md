# computed-dynamic-fail-closed

This invalid fixture shows how CellFence fails closed when a dynamic import
target cannot be resolved statically.

## Contract and violation

[`src/core/public.ts`](src/core/public.ts) stores `"./local"` in a variable and
passes that variable to `import()`. The target is therefore computed rather
than a string literal that CellFence can resolve during static analysis.

[`cellfence.manifest.json`](cellfence.manifest.json) assigns `src/core/**` to
the `core` cell and declares `src/core/public.ts` as its public entry. That
ownership does not make an unresolved import safe: CellFence cannot prove
which module the expression will load, so the check reports
`CELLFENCE_UNSUPPORTED_DYNAMIC_IMPORT` instead of silently accepting it.

[`expected-result.json`](expected-result.json) records that error together
with the expected `CELLFENCE_OWNERSHIP_COVERAGE_DISABLED` warning.

## Reproduce

From the repository root, build the CLI and check the fixture:

```bash
npm run build
node packages/cli/dist/index.js check \
  --root fixtures/invalid/computed-dynamic-fail-closed \
  --format markdown
```

The check is expected to exit unsuccessfully because this fixture is
intentionally invalid, and its output must include
`CELLFENCE_UNSUPPORTED_DYNAMIC_IMPORT`.
