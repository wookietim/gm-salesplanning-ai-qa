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
- Last Test Run
- Jira Title
- tests passing
- Tests failing
- tests blocked
- No of Bugs found

## Behavior

1. Read the existing table from the target page.
2. For each ticket in input:
   - Update row when ticket already exists.
   - Add row when ticket does not exist.
3. Keep exactly one managed QA summary table on the page:
   - Reuse/update the managed table when present
   - Merge/remove duplicate managed tables if found
   - Do not create a second managed summary table
4. Render `Jira Ticket` as a clickable link to Jira for that ticket.
5. Render `Last Test Run` as date-only (`YYYY-MM-DD`) from the latest
   ticket-scoped execution in the column immediately after `Jira Ticket`.
6. Preserve non-target page content and publish updated page via Confluence-Agent.
7. Metrics must represent individual executed test cases, not script invocations.
   - `tests passing` = number of passed test cases
   - `Tests failing` = number of failed test cases
   - `tests blocked` = number of blocked/skipped/todo test cases
   - `No of Bugs found` = number of confirmed failing test cases or defects
8. Do not write or update a Jira ticket row unless the ticket has a real
   ticket-scoped execution result. Full-suite/fallback totals are not ticket rows.
9. Apply row background color by result status:
   - Red when `Tests failing` > 0
   - Yellow when `Tests failing` = 0 and `tests blocked` > 0
   - Green when `Tests failing` = 0 and `tests blocked` = 0
10. Add a legend at the top of the page (above the table) describing row colors:
   - Green = passing (no failed/blocked tests)
   - Yellow = blocked tests present, no failures
   - Red = failed tests present

## Output

Confluence-Writer returns:
- status (`pass`, `fail`, `blocked`)
- counts of rows created and updated
- ticket keys processed
- Confluence page metadata from delegated publish
