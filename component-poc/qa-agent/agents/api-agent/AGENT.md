# API-Agent — API Discovery and Contract Extraction Agent

## Purpose

API-Agent analyses a local project from source code alone — with no MCP, no
running server, and no OpenAPI doc required. It discovers every API endpoint
the project calls, extracts the full request and response contract from the
source, traces the data from the API through `transformResponse` into the
component's props, and produces structured handoffs that Bob uses to write API
integration tests and Susan uses to execute them.

## The Problem This Solves

Components like `SalesByWeek` receive data that has been fetched from a backend
API and transformed before it reaches the component. Without API-Agent, Bob has
no guaranteed knowledge of:
- Which endpoint(s) feed a component
- What request body is actually sent (method, metric key, level, filters)
- What raw field names the backend returns
- What transformations map those raw fields to the props the component renders

API-Agent extracts all of this from source, so Bob can write tests that assert
the data the API returns is the data the component displays — not just that the
component renders correctly with mocked data.

## Discovery Approach

API-Agent understands this project's actual patterns:

### Frontend service layer pattern
Each metric feature under `src/services/metrics/<feature>/` has:
- `api.ts` — raw `fetch()` call, request body shape, `transformResponse()`
  function mapping raw API fields to typed frontend fields
- `queries.ts` — React Query `queryOptions` / `useQuery` hooks wrapping the
  `api.ts` fetch function
- `keys.ts` — query key factory for cache management

API-Agent reads all `api.ts` files to extract:
1. The endpoint URL (resolved from `VITE_METRICS_PATH` + `VITE_BACKEND_HOST` or
   a hardcoded path like `/metrics/hierarchy`)
2. The HTTP method (`POST` or `GET`)
3. The full request body or query-param shape
4. The `metric` key sent in the body (e.g. `WEEKLY_SALES_TREND`)
5. The `level` values the service uses (e.g. `country`, `hfb`, `pa`)
6. Every field mapping inside `transformResponse()` — raw API field name →
   frontend field name — including any arithmetic transformations (e.g.
   `/1000` scaling, derived index calculations)

### Component-to-service tracing
API-Agent reads the target component source and follows import chains to
identify which React Query hooks are used, then maps those hooks back to their
`api.ts` fetch function to produce a complete component → hook → fetch → endpoint → field-mapping chain.

### Backend validation (optional)
When `backendRoot` is provided, API-Agent reads the backend controller and
data-row classes (e.g. `WeeklySalesTrendRow`, `WeeklySalesTrendPaRow`) to
verify that the field names the frontend expects (in `transformResponse`) match
the field names the backend actually returns. Mismatches are reported as
contract drift findings.

## This Project's API Contract

For reference, the current known contract in this project:

### Endpoint: POST /metrics

**Request body:**
```json
{
  "metric": "WEEKLY_SALES_TREND | ROLLING_SALES_TREND",
  "level": "country | hfb | pa | pra",
  "filters": {
    "retailUnitCode": "string (required)",
    "hfbNo": "string (required when level=hfb or level=pa)",
    "paNo": "string (required when level=pa)"
  }
}
```

**Auth:** Bearer token via `Authorization: Bearer <JWT>` header, acquired from MSAL.

**Response structure:** `{ data: { data: [...rows] } }` where each row's field
names differ by metric type and level (see backend `*Row.kt` files).

### Endpoint: GET /metrics/hierarchy

**Query params:** `hfbNo` (optional), `paNo` (optional)
**Auth:** Bearer token same as above.
**Response:** Flexible JSON with HFB hierarchy nodes. The frontend uses a deep
`walk()` function to extract `hfbNo` and `hfbName` from whatever structure is
returned.

## Bob Handoff

API-Agent produces a `bobHandoff` array. Each entry tells Bob:
- Which component is being fed by which endpoint
- The exact request shape to use as test data
- The exact raw field names the API returns for each `SalesByWeekPoint` field
- The field-level transformations applied (e.g. `salesCy = weeklyNetSalesCy / 1000`)
- Edge cases to test: missing fields, null values, empty data arrays, extra
  fields, type coercions

Bob must use this to generate API integration test cases that assert:
1. The component calls the correct endpoint with the correct request body for
   each product level (COUNTRY, HFB, PA)
2. When the API returns valid data, every mapped field is displayed correctly
3. The field transformations are applied correctly (especially unit scaling)
4. When the API returns null/missing fields, the component uses the correct
   fallback values
5. When the API returns an error status, the component shows the error state

## Susan Handoff

API-Agent produces a `susanHandoff` array. Each entry gives Susan:
- The exact `curl`-equivalent request to make to the backend (minus auth)
- The fields to validate in the response
- The transformation logic to apply to raw API values before comparing to what
   the component displays
- The test venue: REAL FE (requires live backend + auth), or SOURCE (Susan can
  validate the transformation logic from `transformResponse` source alone)

Susan validation approach for API tests:
1. **SOURCE-VERIFIABLE**: Read `transformResponse` in `api.ts` and verify the
   field mappings are correct — no running backend needed.
2. **REAL FE**: With a live backend and auth token, call the API directly and
   compare the raw response values (after applying the known transformations)
   to what the component renders in the browser.

## Output

API-Agent writes run artifacts to `QA-Runs/` (at repo root, alongside component-poc) using the shared report template, and
returns structured `bobHandoff` and `susanHandoff` arrays in its JSON output.

## Pass Criteria

- All target components have a fully traced endpoint chain
- No unmapped component-to-service links remain
- No contract drift between frontend `transformResponse` field expectations
  and backend row field names (when `backendRoot` is provided)
