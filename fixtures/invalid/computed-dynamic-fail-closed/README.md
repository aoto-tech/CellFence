# computed-dynamic-fail-closed

This invalid fixture shows how CellFence fails closed when a dynamic import
target cannot be resolved statically.

## Files and contract

[`cellfence.manifest.json`](./cellfence.manifest.json) defines one `core`
cell. It owns `src/core/**`, exposes
[`src/core/public.ts`](./src/core/public.ts) as its public entry, and declares
`loadValue` as the public symbol.

The fixture source stores the import target in a variable:

```ts
let moduleName = "./local";
export const loadValue = import(moduleName);
```

Because `import()` receives `moduleName` rather than a string literal,
CellFence cannot determine the target module during static analysis.
Ownership of the surrounding file does not make that unresolved import safe.
The checker therefore fails closed with
`CELLFENCE_UNSUPPORTED_DYNAMIC_IMPORT` instead of silently accepting a
dependency whose destination it cannot prove.

[`expected-result.json`](./expected-result.json) records that error and the
expected `CELLFENCE_OWNERSHIP_COVERAGE_DISABLED` warning.

## Relevant files

- [`cellfence.manifest.json`](./cellfence.manifest.json) — declares the
  `core` cell and its public boundary.
- [`src/core/public.ts`](./src/core/public.ts) — contains the computed
  dynamic import that CellFence cannot resolve statically.
- [`expected-result.json`](./expected-result.json) — records the expected
  error and warning rule IDs.

## Reproduce

From the repository root:

```bash
npm ci
npm run build

node packages/cli/dist/index.js check \
  --root fixtures/invalid/computed-dynamic-fail-closed \
  --format markdown

node --test tests/fixtures.test.mjs
git diff --check
```

The direct `check` command is expected to exit unsuccessfully because this
fixture is intentionally invalid. Its report should include:

- `CELLFENCE_UNSUPPORTED_DYNAMIC_IMPORT` as an error.
- `CELLFENCE_OWNERSHIP_COVERAGE_DISABLED` as a warning.

The fixture test suite should still pass because it compares the observed
diagnostics with [`expected-result.json`](./expected-result.json).
