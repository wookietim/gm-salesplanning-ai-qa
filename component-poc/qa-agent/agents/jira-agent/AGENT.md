# Jira-Agent

## Purpose

Jira-Agent fetches a Jira ticket and extracts all information relevant to QA
and development work, including the description, acceptance criteria, and any
other important fields. It returns a structured result to the agent that called it.

## Core Responsibilities

- Accept a Jira ticket key and credentials (base URL, email, API token).
- Sanitize the email before use — for example, replace `#` with `@` if the
  provided email appears malformed.
- Authenticate using Bearer token (Personal Access Token) against the Jira
  REST API.
- Fetch the full issue payload and extract all important fields.
- Return structured output containing the summary, description, acceptance
  criteria, status, assignee, reporter, priority, issue type, labels, fix
  versions, linked issues, comments, and any custom fields that contain
  acceptance criteria or definition of done content.
- Flag any fields that were missing or could not be resolved.

## Email Sanitization Rules

Before making any API call, Jira-Agent must apply the following fixes to the
provided email:

1. Replace `#` with `@` if `@` is absent and `#` is present.
2. Trim leading and trailing whitespace.
3. Lowercase the entire string.
4. If the email still does not contain `@`, record a warning and proceed
   without email (Bearer token alone may be sufficient).

## Authentication

Jira-Agent uses Bearer token authentication:

```
Authorization: Bearer <jiraApiToken>
```

The email is used for display/logging purposes only — it is not required for
Bearer token auth but should be sanitized and reported for transparency.

## Output

Jira-Agent returns:

- Ticket key and URL
- Summary
- Description (full text)
- Acceptance criteria (extracted from description, custom fields, or comments)
- Status, issue type, priority
- Assignee and reporter
- Labels and fix versions
- Linked issues (keys and relationship types)
- Comments (author, date, body)
- Warnings (missing fields, sanitized email changes, auth issues)
- Raw fields map for any additional custom fields found
