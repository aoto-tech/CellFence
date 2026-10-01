# missing-public-entry

This fixture demonstrates a missing public entry file in CellFence.

## What this fixture tests

The manifest defines a single cell: `core`.

The `core` cell declares the following file as its public entry:

```text
src/core/public.ts
```

and specifies that it exposes the public symbol `coreValue`:

```json
{
  "id": "core",
  "ownedPaths": [
    "src/core/**"
  ],
  "publicEntry": "src/core/public.ts",
  "publicSymbols": [
    "coreValue"
  ],
  "consumes": [],
  "producesArtifacts": []
}
```

Every cell that defines a public contract must provide the entrypoint file declared in its `publicEntry` property so that CellFence and consumer cells can inspect and verify its exported public surface.

In this fixture, the file `src/core/public.ts` does not exist in the filesystem. Because the declared public entry cannot be found, CellFence fails boundary validation and reports this defect.

## Expected result

This fixture is intentionally invalid.

`expected-result.json` expects CellFence to report the following error rule:

```text
CELLFENCE_PUBLIC_ENTRY_MISSING
```

It also expects the warning:

```text
CELLFENCE_OWNERSHIP_COVERAGE_DISABLED
```

## Relevant files

- `cellfence.manifest.json` — defines the `core` cell and declares `src/core/public.ts` as its public entry.
- `src/core/public.ts` — the declared public entry of the `core` cell, which is missing from the filesystem.
- `expected-result.json` — defines the expected CellFence diagnostics for this fixture.

## Reproduce

From the repository root, install dependencies and build the project:

```bash
npm ci
npm run build
```

Then run CellFence against this fixture:

```bash
node packages/cli/dist/index.js check --root fixtures/invalid/missing-public-entry --format markdown
```

The check should report `CELLFENCE_PUBLIC_ENTRY_MISSING` because the cell `core` declares `src/core/public.ts` as its public entry, but that file does not exist in the filesystem.
