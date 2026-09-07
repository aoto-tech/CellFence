# CellFence package ownership

CellFence is published as focused npm packages. Use the package that matches
the integration point you need:

| Package | Owns |
| --- | --- |
| `cellfence` | Command-line interface and local repository checks |
| `@cellfence/adapter-call-pattern` | Declarative call-pattern resource adapter |
| `@cellfence/adapter-opentelemetry` | OpenTelemetry resource evidence conversion |
| `@cellfence/engine` | Core manifest and governance evaluation |
| `@cellfence/github-action-baseline-gate` | Baseline gate for GitHub Actions |
| `@cellfence/github-action` | GitHub Actions integration |
| `@cellfence/mcp-proxy` | MCP proxy integration |
| `@cellfence/plugin-agent-budget` | AI agent change budget governance rule |
| `@cellfence/plugin-api` | Public API for writing plugins |
| `@cellfence/plugin-blast-radius` | Change impact radius governance rule |
| `@cellfence/plugin-dependency-sovereignty` | Cross-team dependency sovereignty governance rule |
| `@cellfence/plugin-geo-purity` | AI-context purity and public API documentation rule |
| `@cellfence/plugin-legacy-strangler` | Legacy strangler migration ratchet rule |
| `@cellfence/plugin-quants-trend` | Architecture momentum monitoring rule |
| `@cellfence/reporter-economy-matrix` | Economy matrix reporting |
| `@cellfence/schema` | Shared manifest and result schemas |
| `@cellfence/trace` | Trace capture and replay utilities |

Use the package README for installation and API details. Packages with names
starting with `plugin-` provide optional governance checks, while packages
starting with `adapter-` provide integration adapters.
