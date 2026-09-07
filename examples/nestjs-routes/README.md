# NestJS route boundary example

This example shows how CellFence can describe a NestJS-style controller as an HTTP resource boundary without requiring a runnable NestJS application.

## What it demonstrates

The example contains one `api` cell. Its public entry is `src/api/public.ts`, and the cell exposes `UsersController` as a public symbol. The resource contract declares the HTTP routes served by that controller:

- `GET /users/:id`
- `POST /users`

The TypeScript source intentionally uses small local decorator declarations instead of importing `@nestjs/common`. This keeps the example dependency-free while preserving the route shape that CellFence analyzes.

The manifest is therefore a **static architecture contract**, not proof that NestJS itself can boot or serve these endpoints.

## Files

```text
examples/nestjs-routes/
├── README.md
├── cellfence.manifest.json
└── src/
    └── api/
        └── public.ts
```

## Check the example

From the repository root (Node.js 20+):

```bash
npm ci
npm run build
node --test tests/examples.test.mjs
```

The `examples.test.mjs` suite should report the NestJS route example as passing.

You can also inspect the contract directly:

```bash
cat examples/nestjs-routes/cellfence.manifest.json
cat examples/nestjs-routes/src/api/public.ts
```

## Demonstrating a violation

Keep the committed example valid. To demonstrate a failure locally, make a temporary edit to `cellfence.manifest.json`, for example by removing `POST /users` from `resourceContracts[0].selectors`, and run the repository's checker against the example. Restore the file afterwards rather than committing the deliberate violation.

The important distinction is that the controller source and the resource contract are separate pieces of evidence: changing either one can make the declared architecture inconsistent with the repository state.

## Limitations

- This example does not install or execute NestJS.
- It does not start an HTTP server or make network requests.
- The decorator declarations model the relevant NestJS syntax only; they are not NestJS runtime implementations.
- The contract describes the intended HTTP resource boundary. It does not prove controller runtime behavior, middleware, guards, pipes, authentication, or framework routing semantics.

For runtime framework behavior, use a real NestJS application separately; keep the CellFence example focused on repository architecture and resource contracts.
