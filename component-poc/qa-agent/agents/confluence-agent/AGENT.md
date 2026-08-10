# Confluence-Agent — Confluence Publishing Agent

## Purpose

Confluence-Agent takes structured input and publishes it to Confluence as a
page (create or update), then returns the resulting page metadata and link.

## Core capabilities

- Creates a new Confluence page from provided title/content/space input
- Updates an existing page when `pageId` is provided
- Supports dry-run preview output without mutating Confluence
- Produces a run artifact in `QA-Runs/` with publishing details

## Invocation modes

1. Direct: call Confluence-Agent with explicit page details.
2. Orchestrated: Pablo can call Confluence-Agent to publish run summaries.

## Output contract

Confluence-Agent always returns:
- Status (`pass`, `fail`, `blocked`)
- A concise summary
- Page result metadata (id/title/url/version/operation)
- Any warnings or errors encountered
