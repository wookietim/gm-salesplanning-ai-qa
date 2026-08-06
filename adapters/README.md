# Adapter Configs

Adapters hold only repository-specific details (paths, scope roots, and workflow overrides).

Keep shared orchestration, reporting, Jira publishing, and test semantics in the centralized core:

- `../component-poc/qa-agent/`

Add adapter logic only when a repo needs conditionals that do not apply program-wide.
