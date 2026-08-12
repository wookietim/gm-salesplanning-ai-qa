# GM Sales Planning AI QA

This project now hosts the shared QA agent system (Pablo, Bob, Susan, and supporting agents) for the GM Sales Planning program.

## QA Agent Documentation

- [QA Agent System Guide](component-poc/qa-agent/AGENTS_GUIDE.md)

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

## Environment Setup

The agents require a `.env` file in the repo root for credentials. This file is git-ignored and must be created locally.

Create `.env` by copying the template below:

```bash
# Jira credentials for Pablo / QA agent
JIRA_BASE_URL=https://jira.digital.ingka.com
JIRA_USER_EMAIL=your.email@ingka.ikea.com
JIRA_API_TOKEN=your_jira_personal_access_token

# Confluence credentials / settings
CONFLUENCE_BASE_URL=https://confluence.build.ingka.ikea.com
CONFLUENCE_SPACE_KEY=SSP
CONFLUENCE_PAGE_ID=your_confluence_page_id
CONFLUENCE_API_TOKEN=your_confluence_personal_access_token
```

> **Never commit `.env` to source control.** It is listed in `.gitignore`.

## Notes

- The original QA assets were migrated from:
  - `/Users/timothy.collins/Documents/ikea work/gm-salesplanning-modeling/component-poc/qa-agent`
- Existing script paths were preserved to avoid breaking current workflows.
