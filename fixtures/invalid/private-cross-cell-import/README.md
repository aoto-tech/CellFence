# private-cross-cell-import

This fixture demonstrates an invalid cross-cell import in CellFence.

## What this fixture tests

The manifest defines two cells: `producer` and `consumer`.

The `consumer` cell is allowed to consume the `producer` cell. However, the `producer` cell declares the following file as its public entry:

```text
src/producer/public.ts
```

Cross-cell imports should respect this public boundary.

In this fixture, `src/consumer/public.ts` imports directly from the producer's private implementation:

```ts
import { privateValue } from "../producer/private";

export const consumerValue = privateValue;
```

The imported value is defined in:

```text
src/producer/private.ts
```

as:

```ts
export const privateValue = "secret";
```

Although `consumer` is allowed to depend on `producer`, importing directly from `producer/private.ts` crosses the producer cell's private boundary.

## Expected result

This fixture is intentionally invalid.

`expected-result.json` expects CellFence to report the following error rule:

```text
CELLFENCE_PRIVATE_IMPORT
```

It also expects the warning:

```text
CELLFENCE_OWNERSHIP_COVERAGE_DISABLED
```

## Relevant files

- `cellfence.manifest.json` — defines the `producer` and `consumer` cells and their dependency contract.
- `src/producer/public.ts` — the declared public entry of the producer cell.
- `src/producer/private.ts` — the producer's private implementation used by the invalid import.
- `src/consumer/public.ts` — contains the cross-cell private import.
- `expected-result.json` — defines the expected CellFence diagnostics for this fixture.

## Reproduce

From the repository root, install dependencies and build the project:

```bash
npm ci
npm run build
```

Then run CellFence against this fixture:

```bash
node packages/cli/dist/index.js check --root fixtures/invalid/private-cross-cell-import --format markdown
```

The check should report `CELLFENCE_PRIVATE_IMPORT` because the consumer imports the producer's private implementation instead of respecting its declared public boundary.
