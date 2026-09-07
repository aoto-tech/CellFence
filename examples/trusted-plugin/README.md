# Trusted Plugin Example

This example demonstrates a minimal, trusted programmatic plugin using `@cellfence/plugin-api` passed directly to `checkRepository({ plugins })` in `@cellfence/engine`.

## Important Security Architecture Note

CellFence intentionally rejects repository-controlled plugin auto-loading in `v0.x`.
Manifest `plugins` or `extends` fields are rejected fail-closed to prevent untrusted repository configuration from executing code.

Plugin code runs in the same Node.js process and with the same privileges as the caller. Therefore, **plugin selection must come from trusted caller configuration or orchestration scripts**, not repository files.

## Files

- `cellfence.manifest.json`: repository manifest defining the `core` cell.
- `src/core/public.ts`: public cell entry containing a mock database call.
- `run-plugin.mjs`: runnable Node.js script that defines an adapter/rule and runs `checkRepository`.

## Running the Example

From the root of the CellFence repository:

```bash
node examples/trusted-plugin/run-plugin.mjs
```
