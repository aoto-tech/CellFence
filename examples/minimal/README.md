# Minimal Example

This example demonstrates two cells (`parser` and `reporting`) governed by an architectural boundary contract.

`reporting` declares a dependency on `parser`, but is restricted to consuming `parser`'s declared public entry (`examples/minimal/src/parser/public.ts`).

## Check the example

From the repository root:

```bash
npx cellfence check --manifest examples/minimal/cellfence.manifest.json
```

```text
CellFence check passed.
```

## Demonstrating a boundary violation

CellFence catches architectural boundary violations even when tests pass and TypeScript compiles without errors.

If `src/reporting/public.ts` imports private internals directly:

```ts
// Bypassing the public entry point:
import { tokenizeInternal } from "../parser/internal/tokenizer.js";
```

You can verify that standard project checks still succeed, while CellFence blocks the architectural violation:

```bash
npm run test
# Tests pass: ✔ buildReport calculates token count

npx tsc
# Typecheck passes: 0 errors

npx cellfence check --manifest examples/minimal/cellfence.manifest.json
# Fails with CELLFENCE_PRIVATE_IMPORT
```

```text
CellFence check failed.
[error] CELLFENCE_PRIVATE_IMPORT examples/minimal/src/reporting/public.ts: reporting imports private implementation from parser
```
