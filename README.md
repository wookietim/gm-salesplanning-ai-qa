# GM Sales Planning AI QA

This project now hosts the shared QA agent system (Pablo, Bob, Susan, and supporting agents) for the GM Sales Planning program.

## Layout

- `component-poc/qa-agent/`: centralized QA core (agents, prompts, scripts, templates)
- `adapters/`: repository-specific adapter configs

## Centralization Rule

Centralize logic by default.  
Only add behavior under `adapters/` when a repository requires a specific conditional.

## Current Adapters

- `adapters/gm-salesplanning-modeling/`
- `adapters/gm-salesplanning-frontend/`
- `adapters/gm-salesplanning-backend/`
- `adapters/gm-salesplanning-dbt/`

## Notes

- The original QA assets were migrated from:
  - `/Users/timothy.collins/Documents/ikea work/gm-salesplanning-modeling/component-poc/qa-agent`
- Existing script paths were preserved to avoid breaking current workflows.
