# Confluence-Writer — QA Summary Table Upsert Agent

## Purpose

Confluence-Writer updates the AI QA Summary page table in Confluence for each
tested Jira ticket. It upserts rows per ticket key and delegates final page
publishing to Confluence-Agent.

## Fixed target page

- URL: `https://confluence.build.ingka.ikea.com/spaces/SSP/pages/1353804850/AI+QA+Summary`
- Space key: `SSP`
- Page ID: `1353804850`
- Page title: `AI QA Summary`

## Managed columns (exact labels)

- Jira Ticket
- tests passing
- Tests failing
- Tests Vlocked
- No of Bugs found

## Behavior

1. Read the existing table from the target page.
2. For each ticket in input:
   - Update row when ticket already exists.
   - Add row when ticket does not exist.
3. Preserve non-target rows and publish updated page via Confluence-Agent.
4. Metrics must represent individual executed test cases, not script invocations.
   - `tests passing` = number of passed test cases
   - `Tests failing` = number of failed test cases
   - `Tests Vlocked` = number of blocked/skipped/todo test cases
   - `No of Bugs found` = number of confirmed failing test cases or defects
5. Do not write or update a Jira ticket row unless the ticket has a real
   ticket-scoped execution result. Full-suite/fallback totals are not ticket rows.

## Output

Confluence-Writer returns:
- status (`pass`, `fail`, `blocked`)
- counts of rows created and updated
- ticket keys processed
- Confluence page metadata from delegated publish
