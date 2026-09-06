# @cellfence/engine

Repository analysis engine for CellFence. It validates cell ownership, public surfaces, declared dependencies, artifact lanes, resource access, baselines, runtime resource evidence, and active agent claim leases. It also projects per-cell or auto-allocated agent context, coupling graphs, diagnostic evidence, and waiver requests so tools can read the allowed fence before editing. Diagnostics explain observed facts and contracts; they do not guarantee an alternative implementation or emit remediation patches as recommended fixes. Programmatic callers can pass Plugin API v1 rules and adapters through `checkRepository({ plugins })`; plugin code runs with the caller's process privileges and must come from trusted code, not repository-controlled configuration.

Most users should install the `cellfence` CLI package instead.

See the main CellFence README: https://github.com/pushnanashi2/CellFence#readme
