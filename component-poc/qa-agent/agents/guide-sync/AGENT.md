# Guide-Sync Agent

## Purpose

Keep `AGENTS_GUIDE.md` accurate whenever agent definitions change.

## Scope

- Detect changes in `component-poc/qa-agent/agents/*/(AGENT.md|prompt.md|input.schema.json|output.schema.json)`
- Reconcile `AGENTS_GUIDE.md` with:
  - current agent roster
  - current orchestration flow
  - current input/output paths
  - current examples and usage notes
- Update `README.md` links to the guide when missing or outdated

## Pass Criteria

- Guide reflects all current agents in `configs/qa-agent.config.json`
- No stale paths, URLs, or role descriptions in the guide
- No duplicate or orphaned sections in examples

## Output

Write a synchronization report artifact to `QA-Runs/` with:

- which sections were updated
- why each change was needed
- which source files were used to validate the update
