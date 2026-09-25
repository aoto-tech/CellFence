# Fastify Route Contract Example

This example shows how CellFence can treat Fastify-style route declarations as
static HTTP resource contracts. It is a small analysis example, not a runnable
Fastify application: the source declares only the `server.route()` shape that
CellFence inspects.

## Contract

[`cellfence.manifest.json`](cellfence.manifest.json) defines one `api` cell
that owns `src/api/**` and exposes
[`src/api/public.ts`](src/api/public.ts) through `registerRoutes`.

The cell may serve exactly these HTTP resources:

```text
GET /health
POST /health
```

The source registers one route object with those two methods and the `/health`
URL. Because the observed Fastify route matches the declared selectors, the
example is valid.

## Run the example

Use Node.js 20 or later. From the CellFence repository root:

```bash
npm ci
npm run build
node packages/cli/dist/index.js check \
  --root examples/fastify-routes \
  --format markdown
```

The check should pass with no error findings.

## What CellFence is checking

The built-in Fastify adapter recognizes selected static route registrations such
as the object passed to `server.route()`. It can compare literal methods and
URLs with the cell's declared HTTP `resourceContracts`.

This does not prove that a real Fastify server starts or that arbitrary plugin,
hook, or dynamically assembled route behavior is understood. Dynamic forms and
unsupported framework behavior remain subject to the limits described in
[Current Limitations](../../docs/limitations.md).

Refs: the example is adapted from the existing
[`fastify-routes` fixture](../../fixtures/valid/fastify-routes/README.md).
