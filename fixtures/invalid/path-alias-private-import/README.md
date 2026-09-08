# path-alias-private-import

This fixture shows that a TypeScript path alias does not bypass a cell's public boundary.

## Files and cells

[`cellfence.manifest.json`](./cellfence.manifest.json) defines two cells:

- `producer` owns `src/producer/**` and exposes only [`src/producer/public.ts`](./src/producer/public.ts), whose allowed public symbol is `producerValue`.
- `consumer` owns `src/consumer/**`, exposes [`src/consumer/public.ts`](./src/consumer/public.ts), and declares that it consumes `producer`.

The consume relationship permits the consumer to use the producer's public entry. It does not make every file under `src/producer/` public.

## Why the fixture fails

[`tsconfig.json`](./tsconfig.json) maps `@app/*` to `src/*`. The import in [`src/consumer/public.ts`](./src/consumer/public.ts) therefore resolves as follows:

```text
@app/producer/private
→ src/producer/private.ts
```

That target is [`src/producer/private.ts`](./src/producer/private.ts), not the producer cell's declared public entry. CellFence resolves the alias before checking the ownership boundary, so the cross-cell private import produces `CELLFENCE_PRIVATE_IMPORT`.

The fixture also expects `CELLFENCE_OWNERSHIP_COVERAGE_DISABLED` as a warning because ownership-coverage enforcement is not enabled for this fixture. The complete expected result is recorded in [`expected-result.json`](./expected-result.json).

## Reproduce

From the repository root:

```bash
npm ci
npm run build

node packages/cli/dist/index.js check \
  --root fixtures/invalid/path-alias-private-import \
  --format markdown

node --test tests/fixtures.test.mjs
git diff --check
```

The direct `check` command is expected to exit unsuccessfully because this is an intentionally invalid fixture. Its report should contain the `CELLFENCE_PRIVATE_IMPORT` error and the `CELLFENCE_OWNERSHIP_COVERAGE_DISABLED` warning. The fixture test suite should pass by matching those findings against `expected-result.json`.
