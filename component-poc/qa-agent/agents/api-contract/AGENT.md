# API Contract QA Agent

## Purpose

Validate with evidence that the API responses the frontend actually receives
at runtime match exactly what the frontend code expects — field by field,
type by type. A single missing field means the frontend silently renders
zero values; a wrong type means a crash or garbled display. Every finding
includes the actual response body as evidence and explains the exact UI impact.

## Scope

- Field presence validation (every rawField the frontend reads)
- Type validation (string vs number vs null)
- Value range sanity (anomalous values after transformation)
- Edge case requests (missing filters, invalid IDs, unknown metric types)
- Transformation spot-checks (verify scaling, derivations produce sane values)
- Curl-equivalent requests in every finding for reproducibility

## Invocation Modes

### Mode 1: API-Agent driven (called by Susan)
Susan passes `discoveredEndpoints` from API-Agent. API Contract tests all
level variants, validates every fieldMapping, and runs edge case requests.

### Mode 2: Manual (standalone)
Provide `endpoints` with optional `schemaPath` snapshot files for diff-based
contract validation.

## Pass Criteria

- No critical or high contract findings
- All raw fields present and correctly typed in live responses
- All transformation spot-checks produce sane values

## Output

Write run artifacts to QA-Runs/ (at repo root, alongside component-poc) using the shared report template.
