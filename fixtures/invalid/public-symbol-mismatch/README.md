# public-symbol-mismatch

This fixture checks that a cell's declared public symbols match the exports of its public entry. In the [manifest](cellfence.manifest.json), the `core` cell owns `src/core/**` and declares `declaredValue` as its only public symbol. Its [public entry](src/core/public.ts) actually exports `actualValue`.

From the repository root, run:

```bash
npm ci
npm run build
node packages/cli/dist/index.js check \
  --root fixtures/invalid/public-symbol-mismatch \
  --format markdown
```

The check exits with status 1. It reports one `CELLFENCE_PUBLIC_SYMBOL_MISMATCH` error for `src/core/public.ts`, with `missing: declaredValue; undeclared: actualValue`. Both details matter when a public export is renamed: one identifies what consumers were promised, and the other identifies what the file now exposes.

The [expected result](expected-result.json) also lists `CELLFENCE_OWNERSHIP_COVERAGE_DISABLED` as a warning. It concerns whole-repository ownership coverage and is separate from the public-symbol error.
