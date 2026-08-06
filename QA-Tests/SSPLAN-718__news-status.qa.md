# SSPLAN-718 Test Plan — News Status Component

Mode: **test-plan-only** (Bob planning only; Susan execution deferred)  
Ticket: **SSPLAN-718**  
Last Jira sync: 2026-08-04T18:28:09.020+0000  

## 1) Jira snapshot
- Summary: News Status Component
- Issue type: Story
- Status: Backlog
- Updated: 2026-08-04T18:28:09.020+0000
- Subtasks: none

## 2) Acceptance criteria (normalized)
- **AC-1** If cumulative actual >= cumulative ramp forecast at 4 weeks, show On Track in green.
- **AC-2** If cumulative actual < cumulative ramp forecast at 4 weeks, show Off Track in red.
- **AC-3** If forecast data missing/null, show neutral placeholder (grey).
- **AC-4** Calculation follows design definition.

## 3) Target component/scope
New article status indicator (On Track/Off Track/Neutral) in article row/detail context

## 4) API-agent-style trace (component -> hook -> service -> endpoint -> transform)
- Component scope: **new** `NewsStatus` component (not yet present in frontend tree).
- Hook/service path: **gap** — no dedicated `useNewsStatus` hook found; likely derived from article weekly actual+ramp fields.
- Closest API path today: `SalesByWeek` -> `useSalesByWeek` -> `services/metrics/sales-by-week/api.ts` -> `POST /metrics` metric `WEEKLY_SALES_TREND`.
- Expected request evolution for article status: include article identifier (`artNo`) and article-level filter in metrics request.
- Field transformation under test: cumulative actual = sum(weekly actuals window), cumulative ramp = sum(weekly forecast/ramp window), status color mapping green/red/grey.
- Backend cross-check: `MetricType.WEEKLY_SALES_TREND` supports HFB/PA/PRA levels only; no ART level documented, so article-level status requires backend extension.

## 5) Top risks/findings
- No implemented NewsStatus component/hook yet.
- No backend ART-level weekly metric level; article scope currently unsupported.
- Forecast/ramp fields expected by FE (`weeklyForecasted*`) are not visible in backend row models.

## 6) Assumptions with confidence
- **A-1 (Medium)**: Status calculation uses 4-week cumulative actual vs cumulative planned ramp from weekly metric stream.
- **A-2 (Medium)**: Color tokens map to design semantic states: success=green, warning/error=red, missing=grey.
- **A-3 (Low)**: Article identifier will be available to metric request as `artNo` or equivalent filter.

## 7) Bob test plan matrix
Venue tags: **SOURCE / STORYBOOK / REAL FE / HYBRID**

| ID | Category | Venue | Test | Steps | Measurable assertions | AC trace |
|---|---|---|---|---|---|---|
| HP-01 | happy path | STORYBOOK | On Track rendering | Fixture: cumulativeActual=100,cumulativeRamp=100,weekCount=4. | Label `On Track`; status dot hex equals approved green token; no warning icon. | AC-1, AC-4 |
| HP-02 | happy path | STORYBOOK | Off Track rendering | Fixture: cumulativeActual=95,cumulativeRamp=100,weekCount=4. | Label `Off Track`; status dot equals approved red token. | AC-2, AC-4 |
| SP-01 | sad path | SOURCE | Null ramp data fallback | Inject ramp values null/undefined. | Component renders neutral label + grey dot; no crash/NaN text. | AC-3 |
| SP-02 | sad path | SOURCE | Insufficient weeks (<4) behavior | Provide only 1-3 actual points. | Status remains neutral/pending per spec; no false On/Off classification. | AC-4 |
| DC-01 | data consistency | SOURCE | Field-level cumulative transform | Input weeklyActual=[20,30,25,25], weeklyRamp=[25,25,25,25]. | Computed totals exactly 100 and 100; state evaluates On Track. | AC-1, AC-4 |
| DC-02 | data consistency | SOURCE | Boundary comparator | Test actual=99.99 vs ramp=100 and actual=100.00 vs ramp=100. | Strict `<` path => Off Track for 99.99; `>=` path => On Track for 100.00. | AC-1, AC-2 |
| API-01 | API integration | HYBRID | Weekly API field mapping for status | Capture transformed weekly payload fields used for status computation. | Status function consumes numeric values only after parse; null/strings coerced deterministically. | AC-4 |
| API-02 | API integration | HYBRID | Article filter contract gate | Assert metrics request includes article identifier filter when status rendered in article context. | Missing article filter fails integration test with explicit contract error. | AC-4 |
| REG-01 | regression | REAL FE | Non-article views unaffected | Open country/hfb/pa dashboards. | No status badge appears outside article context unless explicitly enabled. | AC-4 |
| A11Y-01 | accessibility | STORYBOOK | Status announced to screen readers | Inspect rendered semantics. | Accessible name includes status text (On Track/Off Track/Neutral), not color-only signal. | AC-1, AC-2, AC-3 |
| PERF-01 | performance | SOURCE | Bulk row status compute | Compute status for 500 article rows. | Computation completes <50ms in unit benchmark on baseline env. | AC-4 |
| I18N-01 | i18n | SOURCE | Localizable status labels | Switch locale pack. | Status labels resolve from i18n keys; no hardcoded English-only strings. | AC-1, AC-2, AC-3 |

## 8) Coverage summary
- Planned tests: **12**
- Category distribution: happy path(2), sad path(2), data consistency(2), API integration(2), regression(1), accessibility(1), performance(1), i18n(1)
- AC coverage: AC-1, AC-2, AC-3, AC-4
