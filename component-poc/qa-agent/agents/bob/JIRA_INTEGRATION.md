# Bob Jira Integration Guide

Bob can derive acceptance criteria in two modes.

## Mode 1: Direct Jira context input (recommended default)

Provide one or more of the following in agent input:

- jira.projectKey
- jira.issueKeys
- jira.acceptanceCriteriaText

This mode works without external Jira API connectivity.

## Mode 2: External Jira fetch (optional)

If your orchestrator has Jira API access, fetch issue content first and pass the
resulting acceptance criteria text into jira.acceptanceCriteriaText.

Bob then:

1. Extracts explicit acceptance criteria.
2. Flags ambiguous or missing criteria.
3. Creates assumptions when criteria are incomplete.
4. Maps criteria to test IDs in the traceability section.

## Minimum data for high-quality output

- Component name and purpose
- At least one Jira issue key or acceptance criteria text
- Known constraints (if any)

Without Jira data, Bob still generates tests, but marks criteria as assumed.
