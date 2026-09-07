# CellFence Fixture Index

This index maps `CELLFENCE_*` rule IDs to representative fixtures under `fixtures/`.

### `CELLFENCE_ARTIFACT_OUTSIDE_OWNERSHIP`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/artifact-outside-ownership`](../fixtures/invalid/artifact-outside-ownership)

### `CELLFENCE_MANIFEST_INVALID`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/duplicate-cell-ids`](../fixtures/invalid/duplicate-cell-ids)
  - [`fixtures/invalid/malformed-manifest`](../fixtures/invalid/malformed-manifest)

### `CELLFENCE_OWNERSHIP_COVERAGE_DISABLED`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/artifact-outside-ownership`](../fixtures/invalid/artifact-outside-ownership)
  - [`fixtures/invalid/commonjs-private-require`](../fixtures/invalid/commonjs-private-require)
  - [`fixtures/invalid/computed-dynamic-fail-closed`](../fixtures/invalid/computed-dynamic-fail-closed)
  - [`fixtures/invalid/computed-require-fail-closed`](../fixtures/invalid/computed-require-fail-closed)
  - [`fixtures/invalid/cross-cell-dependency-growth`](../fixtures/invalid/cross-cell-dependency-growth)
  - [`fixtures/invalid/drizzle-dynamic-table`](../fixtures/invalid/drizzle-dynamic-table)
  - [`fixtures/invalid/missing-public-entry`](../fixtures/invalid/missing-public-entry)
  - [`fixtures/invalid/new-cell-baseline`](../fixtures/invalid/new-cell-baseline)
  - [`fixtures/invalid/owned-path-growth`](../fixtures/invalid/owned-path-growth)
  - [`fixtures/invalid/owned-path-overlap`](../fixtures/invalid/owned-path-overlap)
  - [`fixtures/invalid/ownership-scope-change`](../fixtures/invalid/ownership-scope-change)
  - [`fixtures/invalid/package-subpath-private-import`](../fixtures/invalid/package-subpath-private-import)
  - [`fixtures/invalid/path-alias-extends-private-import`](../fixtures/invalid/path-alias-extends-private-import)
  - [`fixtures/invalid/path-alias-private-import`](../fixtures/invalid/path-alias-private-import)
  - [`fixtures/invalid/private-cross-cell-import`](../fixtures/invalid/private-cross-cell-import)
  - [`fixtures/invalid/private-cross-cell-js-extension`](../fixtures/invalid/private-cross-cell-js-extension)
  - [`fixtures/invalid/public-entry-outside-ownership`](../fixtures/invalid/public-entry-outside-ownership)
  - [`fixtures/invalid/public-star-reexport-symbol-mismatch`](../fixtures/invalid/public-star-reexport-symbol-mismatch)
  - [`fixtures/invalid/public-surface-line-growth`](../fixtures/invalid/public-surface-line-growth)
  - [`fixtures/invalid/public-symbol-growth`](../fixtures/invalid/public-symbol-growth)
  - [`fixtures/invalid/public-symbol-mismatch`](../fixtures/invalid/public-symbol-mismatch)
  - [`fixtures/invalid/public-symbol-set-change`](../fixtures/invalid/public-symbol-set-change)
  - [`fixtures/invalid/resource-baseline-detects-new`](../fixtures/invalid/resource-baseline-detects-new)
  - [`fixtures/invalid/resource-evidence-detects-new`](../fixtures/invalid/resource-evidence-detects-new)
  - [`fixtures/invalid/static-dynamic-private-import`](../fixtures/invalid/static-dynamic-private-import)
  - [`fixtures/invalid/typeorm-dynamic-query-builder`](../fixtures/invalid/typeorm-dynamic-query-builder)
  - [`fixtures/invalid/undeclared-artifact-lane`](../fixtures/invalid/undeclared-artifact-lane)
  - [`fixtures/invalid/undeclared-consumer`](../fixtures/invalid/undeclared-consumer)
  - [`fixtures/invalid/undeclared-resource-access`](../fixtures/invalid/undeclared-resource-access)
  - [`fixtures/invalid/unresolved-dynamic-sql`](../fixtures/invalid/unresolved-dynamic-sql)
  - [`fixtures/invalid/unresolved-relative-import`](../fixtures/invalid/unresolved-relative-import)
- **Valid Examples (Passing)**:
  - [`fixtures/valid/commonjs-public-require`](../fixtures/valid/commonjs-public-require)
  - [`fixtures/valid/declared-artifact-lane`](../fixtures/valid/declared-artifact-lane)
  - [`fixtures/valid/declared-resource-contracts`](../fixtures/valid/declared-resource-contracts)
  - [`fixtures/valid/dependency-reduction`](../fixtures/valid/dependency-reduction)
  - [`fixtures/valid/drizzle-resource-contracts`](../fixtures/valid/drizzle-resource-contracts)
  - [`fixtures/valid/event-adapters-declared`](../fixtures/valid/event-adapters-declared)
  - [`fixtures/valid/fastify-routes`](../fixtures/valid/fastify-routes)
  - [`fixtures/valid/nestjs-routes`](../fixtures/valid/nestjs-routes)
  - [`fixtures/valid/owned-path-reduction`](../fixtures/valid/owned-path-reduction)
  - [`fixtures/valid/path-alias-public-import`](../fixtures/valid/path-alias-public-import)
  - [`fixtures/valid/prisma-resource-baseline`](../fixtures/valid/prisma-resource-baseline)
  - [`fixtures/valid/public-import`](../fixtures/valid/public-import)
  - [`fixtures/valid/public-star-reexport`](../fixtures/valid/public-star-reexport)
  - [`fixtures/valid/public-star-reexport-js-extension`](../fixtures/valid/public-star-reexport-js-extension)
  - [`fixtures/valid/public-symbol-reduction`](../fixtures/valid/public-symbol-reduction)
  - [`fixtures/valid/query-builder-resource-contracts`](../fixtures/valid/query-builder-resource-contracts)
  - [`fixtures/valid/resource-baseline-allows-existing`](../fixtures/valid/resource-baseline-allows-existing)
  - [`fixtures/valid/resource-evidence-baseline`](../fixtures/valid/resource-evidence-baseline)
  - [`fixtures/valid/single-cell`](../fixtures/valid/single-cell)
  - [`fixtures/valid/sql-string-documentation`](../fixtures/valid/sql-string-documentation)
  - [`fixtures/valid/static-dynamic-public-import`](../fixtures/valid/static-dynamic-public-import)
  - [`fixtures/valid/type-only-import`](../fixtures/valid/type-only-import)
  - [`fixtures/valid/typeorm-resource-contracts`](../fixtures/valid/typeorm-resource-contracts)
  - [`fixtures/valid/unresolved-dynamic-file-path-warning`](../fixtures/valid/unresolved-dynamic-file-path-warning)

### `CELLFENCE_OWNERSHIP_OVERLAP`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/owned-path-overlap`](../fixtures/invalid/owned-path-overlap)

### `CELLFENCE_PRIVATE_IMPORT`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/commonjs-private-require`](../fixtures/invalid/commonjs-private-require)
  - [`fixtures/invalid/package-subpath-private-import`](../fixtures/invalid/package-subpath-private-import)
  - [`fixtures/invalid/path-alias-extends-private-import`](../fixtures/invalid/path-alias-extends-private-import)
  - [`fixtures/invalid/path-alias-private-import`](../fixtures/invalid/path-alias-private-import)
  - [`fixtures/invalid/private-cross-cell-import`](../fixtures/invalid/private-cross-cell-import)
  - [`fixtures/invalid/private-cross-cell-js-extension`](../fixtures/invalid/private-cross-cell-js-extension)
  - [`fixtures/invalid/python-private-import`](../fixtures/invalid/python-private-import)
  - [`fixtures/invalid/python-pyproject-private-import`](../fixtures/invalid/python-pyproject-private-import)
  - [`fixtures/invalid/static-dynamic-private-import`](../fixtures/invalid/static-dynamic-private-import)
- **Valid Examples (Passing)**:
  - [`fixtures/valid/public-import`](../fixtures/valid/public-import)

### `CELLFENCE_PUBLIC_ENTRY_MISSING`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/missing-public-entry`](../fixtures/invalid/missing-public-entry)
- **Valid Examples (Passing)**:
  - [`fixtures/valid/public-import`](../fixtures/valid/public-import)

### `CELLFENCE_PUBLIC_ENTRY_OUTSIDE_OWNERSHIP`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/public-entry-outside-ownership`](../fixtures/invalid/public-entry-outside-ownership)

### `CELLFENCE_PUBLIC_SYMBOL_MISMATCH`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/public-star-reexport-symbol-mismatch`](../fixtures/invalid/public-star-reexport-symbol-mismatch)
  - [`fixtures/invalid/public-symbol-mismatch`](../fixtures/invalid/public-symbol-mismatch)
- **Valid Examples (Passing)**:
  - [`fixtures/valid/public-import`](../fixtures/valid/public-import)

### `CELLFENCE_RATCHET_CELL_SET_GROWTH`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/new-cell-baseline`](../fixtures/invalid/new-cell-baseline)

### `CELLFENCE_RATCHET_CROSS_CELL_DEPENDENCY_GROWTH`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/cross-cell-dependency-growth`](../fixtures/invalid/cross-cell-dependency-growth)

### `CELLFENCE_RATCHET_OWNED_PATH_GROWTH`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/owned-path-growth`](../fixtures/invalid/owned-path-growth)

### `CELLFENCE_RATCHET_OWNERSHIP_SCOPE_CHANGE`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/ownership-scope-change`](../fixtures/invalid/ownership-scope-change)

### `CELLFENCE_RATCHET_PUBLIC_SURFACE_LINE_GROWTH`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/public-surface-line-growth`](../fixtures/invalid/public-surface-line-growth)

### `CELLFENCE_RATCHET_PUBLIC_SYMBOL_GROWTH`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/public-symbol-growth`](../fixtures/invalid/public-symbol-growth)

### `CELLFENCE_RATCHET_PUBLIC_SYMBOL_SET_CHANGE`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/public-symbol-set-change`](../fixtures/invalid/public-symbol-set-change)

### `CELLFENCE_RATCHET_RESOURCE_ACCESS_CHANGE`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/resource-baseline-detects-new`](../fixtures/invalid/resource-baseline-detects-new)
  - [`fixtures/invalid/resource-evidence-detects-new`](../fixtures/invalid/resource-evidence-detects-new)

### `CELLFENCE_UNDECLARED_ARTIFACT`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/undeclared-artifact-lane`](../fixtures/invalid/undeclared-artifact-lane)
- **Valid Examples (Passing)**:
  - [`fixtures/valid/declared-artifact-lane`](../fixtures/valid/declared-artifact-lane)

### `CELLFENCE_UNDECLARED_CONSUMER`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/undeclared-consumer`](../fixtures/invalid/undeclared-consumer)
- **Valid Examples (Passing)**:
  - [`fixtures/valid/public-import`](../fixtures/valid/public-import)

### `CELLFENCE_UNDECLARED_RESOURCE_ACCESS`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/resource-baseline-detects-new`](../fixtures/invalid/resource-baseline-detects-new)
  - [`fixtures/invalid/resource-evidence-detects-new`](../fixtures/invalid/resource-evidence-detects-new)
  - [`fixtures/invalid/undeclared-resource-access`](../fixtures/invalid/undeclared-resource-access)
- **Valid Examples (Passing)**:
  - [`fixtures/valid/declared-resource-contracts`](../fixtures/valid/declared-resource-contracts)

### `CELLFENCE_UNOWNED_IMPORT_TARGET`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/unowned-import-target`](../fixtures/invalid/unowned-import-target)

### `CELLFENCE_UNOWNED_SOURCE`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/unowned-import-target`](../fixtures/invalid/unowned-import-target)

### `CELLFENCE_UNRESOLVED_IMPORT`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/unresolved-relative-import`](../fixtures/invalid/unresolved-relative-import)

### `CELLFENCE_UNRESOLVED_RESOURCE_ACCESS`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/drizzle-dynamic-table`](../fixtures/invalid/drizzle-dynamic-table)
  - [`fixtures/invalid/typeorm-dynamic-query-builder`](../fixtures/invalid/typeorm-dynamic-query-builder)
  - [`fixtures/invalid/unresolved-dynamic-sql`](../fixtures/invalid/unresolved-dynamic-sql)
- **Valid Examples (Passing)**:
  - [`fixtures/valid/unresolved-dynamic-file-path-warning`](../fixtures/valid/unresolved-dynamic-file-path-warning)

### `CELLFENCE_UNSUPPORTED_DYNAMIC_IMPORT`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/computed-dynamic-fail-closed`](../fixtures/invalid/computed-dynamic-fail-closed)

### `CELLFENCE_UNSUPPORTED_DYNAMIC_REQUIRE`

- **Invalid Examples (Violations)**:
  - [`fixtures/invalid/computed-require-fail-closed`](../fixtures/invalid/computed-require-fail-closed)
