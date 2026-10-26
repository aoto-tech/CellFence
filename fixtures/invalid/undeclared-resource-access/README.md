# undeclared-resource-access

This intentionally invalid fixture shows how CellFence requires resource
accesses to be declared in the architecture manifest.

## Contract and violations

[`cellfence.manifest.json`](./cellfence.manifest.json) assigns
`src/runtime/**` to the `runtime` cell and declares
[`src/runtime/public.ts`](./src/runtime/public.ts) as its public entry. It
does not declare any resource contracts.

The current CLI report identifies four undeclared accesses in the public
entry:

| Source | Reported access |
| --- | --- |
| `fs.readFileSync("data/config.json", "utf8")` | File read of `data/config.json` |
| `connection.query("select * from app.users")` | Database access to `app.users` |
| `router.get("/health", ...)` | HTTP `GET /health` route |
| `fetch("https://api.example.test/v1/status")` | HTTP call to the external endpoint |

The `publish("jobs.ready", ...)` stub is also present in the source, but this
reproduction does not report it as a queue access. CellFence recognizes
specific queue APIs such as BullMQ and KafkaJS; this generic stub does not
exercise that adapter. See the [resource-analysis limits](../../../docs/rules.md).

Because the manifest does not authorize these accesses, the check reports
`CELLFENCE_UNDECLARED_RESOURCE_ACCESS` for all four reported accesses. The
expected rule IDs are recorded in
[`expected-result.json`](./expected-result.json). The fixture also expects the
`CELLFENCE_OWNERSHIP_COVERAGE_DISABLED` warning because ownership-coverage
enforcement is not enabled in its manifest.

## Reproduce

From the repository root, install dependencies and build the CLI:

```bash
npm ci
npm run build
```

Check the fixture:

```bash
node packages/cli/dist/index.js check \
  --root fixtures/invalid/undeclared-resource-access \
  --format markdown
```

The command is expected to exit unsuccessfully because the fixture is
intentionally invalid. Its report should include
`CELLFENCE_UNDECLARED_RESOURCE_ACCESS` and
`CELLFENCE_OWNERSHIP_COVERAGE_DISABLED`. Run the fixture regression tests from
the repository root with:

```bash
node --test tests/fixtures.test.mjs
git diff --check
```
