# fastify-routes

This fixture demonstrates how Fastify route definitions map to `resourceContracts` for `http` `serve` in CellFence.

## What this fixture tests

The manifest defines a single cell: `api`.

The `api` cell declares ownership of `src/api/**` and declares an HTTP resource contract in `cellfence.manifest.json`:

```json
{
  "id": "health-api",
  "kind": "http",
  "access": [
    "serve"
  ],
  "selectors": [
    "GET /health",
    "POST /health"
  ]
}
```

This contract permits the `api` cell to expose and serve HTTP routes matching the selectors `GET /health` and `POST /health`.

In the cell's public entry (`src/api/public.ts`), Fastify route definitions are registered using `server.route(...)`:

```ts
declare const server: {
  route(config: { method: string[]; url: string; handler: () => void }): void;
};

export function registerRoutes(): void {
  server.route({
    method: ["GET", "POST"],
    url: "/health",
    handler: () => undefined,
  });
}
```

CellFence's Fastify resource adapter statically analyzes `server.route(...)` calls. It recognizes route configurations specifying an array of HTTP methods (`method: ["GET", "POST"]`) and a route URL (`url: "/health"`). The adapter normalizes these route registrations into HTTP `serve` resource accesses for each method:

- `GET /health`
- `POST /health`

Because both resolved route accesses match the declared `selectors` and `access` under `resourceContracts` in the cell manifest, CellFence verifies that all HTTP endpoints served by the cell are authorized.

## Expected result

This fixture is valid and conforms to CellFence boundary rules.

`expected-result.json` expects CellFence to report no errors (`"ok": true` and `"errorRuleIds": []`).

It expects the warning:

```text
CELLFENCE_OWNERSHIP_COVERAGE_DISABLED
```

This warning occurs because strict ownership coverage is disabled for the repository, which is expected for minimal fixtures that do not enable strict ownership coverage.

## Relevant files

- `cellfence.manifest.json` — defines the `api` cell and its HTTP `serve` resource contract for `GET /health` and `POST /health`.
- `src/api/public.ts` — contains the Fastify route registration via `server.route({ method: ["GET", "POST"], url: "/health", handler: ... })`.
- `expected-result.json` — defines the expected CellFence diagnostics for this fixture (pass with no errors).

## Reproduce

From the repository root, install dependencies and build the project:

```bash
npm ci
npm run build
```

Then run CellFence against this fixture:

```bash
node packages/cli/dist/index.js check --root fixtures/valid/fastify-routes --format markdown
```

The check should report `Result: passed` with 0 findings and the `CELLFENCE_OWNERSHIP_COVERAGE_DISABLED` warning, confirming that the Fastify route definitions satisfy the declared resource contract.
