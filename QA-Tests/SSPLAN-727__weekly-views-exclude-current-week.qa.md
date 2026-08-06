# SSPLAN-727 Test Plan — Weekly views should not show current week

Mode: **test-plan-only** (Bob planning only; Susan execution deferred)  
Ticket: **SSPLAN-727**  
Last Jira sync: 2026-08-06T12:27:34.993+0000  

## 1) Jira snapshot
- Summary: Weekly views should not show current week
- Issue type: Bug
- Status: Backlog
- Updated: 2026-08-06T12:27:34.993+0000
- Subtasks: none

## 2) Acceptance criteria (normalized)
- **AC-1** Weekly views do not show current-week actual sales values.
- **AC-2** If current week is N, latest actual point shown is N-1.
- **AC-3** Forecast can remain visible for current/future weeks while actual is hidden.
- **AC-4** Rule applies consistently across weekly views (country/hfb/pa/article).

## 3) Target component/scope
All weekly views must hide current week actuals and show only through previous week

## 4) API-agent-style trace (component -> hook -> service -> endpoint -> transform)
- Component scope: `SalesByWeek` and any article weekly chart variant.
- Hook/service path: `useSalesByWeek` -> `fetchSalesByWeek`.
- Transform points in `api.ts`: derives `weekLabel` from `sywNumber`, sorts latest year rows ascending.
- Rendering rule in component: `buildChartRows` currently hides actual only when `actual <= 0` or non-finite; no explicit current-week exclusion.
- Endpoint mapping: POST `/metrics` with `WEEKLY_SALES_TREND` filters by level/context.
- Backend cross-check: rolling trend rows include `currentSyw`; weekly rows include `sywNumber` but FE currently does not consume current week from API for exclusion logic.

## 5) Top risks/findings
- Current logic can still plot non-zero current-week actual, violating bug requirement.
- No authoritative current-week signal wired into weekly transform; timezone/week-boundary errors possible.
- Inconsistent behavior across metric toggles (SALES/QTY/INDEX) if exclusion only applied to one series.

## 6) Assumptions with confidence
- **A-1 (High)**: Current fiscal week can be resolved from navigation current-week context or API field.
- **A-2 (Medium)**: Forecast line remains visible for current week while actual point is hidden/null.
- **A-3 (Medium)**: Exclusion rule applies to all product levels including future article-level weekly view.

## 7) Bob test plan matrix
Venue tags: **SOURCE / STORYBOOK / REAL FE / HYBRID**

| ID | Category | Venue | Test | Steps | Measurable assertions | AC trace |
|---|---|---|---|---|---|---|
| HP-01 | happy path | REAL FE | Current week actual hidden | Fixture includes weeks 30,31,32 where current week=32. | Actual line/bars stop at week 31; week 32 actual is null/not rendered. | AC-1, AC-2 |
| HP-02 | happy path | REAL FE | Forecast continues at current week | Same fixture with forecast for week 32. | Forecast marker/line at week 32 remains visible while actual absent. | AC-3 |
| SP-01 | sad path | SOURCE | Missing current-week context | Remove current-week source input. | Fallback does not expose partial week actual; defaults to safe exclusion path. | AC-1 |
| SP-02 | sad path | SOURCE | Year boundary case | Current week=01 with prior year week 52/53 rows. | Latest actual shown is prior week in correct fiscal-year context. | AC-2 |
| DC-01 | data consistency | SOURCE | Series-level exclusion mapping | For SALES/QTY/SALES_INDEX/QTY_INDEX modes. | Actual values for current week coerced to null across all modes; historical weeks untouched. | AC-4 |
| DC-02 | data consistency | SOURCE | Tooltip integrity after nulling | Hover current-week point. | Tooltip omits actual or shows `N/A`; does not display stale numeric value. | AC-1, AC-3 |
| API-01 | API integration | HYBRID | Current-week comparison source | Assert exclusion uses either API `current_syw` or UI current-week value consistently. | Computed cutoff week equals expected fiscal week every run. | AC-2 |
| API-02 | API integration | HYBRID | No backend schema mutation required | Run against unchanged backend payload. | FE exclusion works without requiring backend filtering, preserving backward compatibility. | AC-4 |
| REG-01 | regression | REAL FE | Historical weeks remain visible | Check weeks N-2 and N-1 values before/after fix. | Only week N actual removed; previous weeks unchanged numerically. | AC-1 |
| A11Y-01 | accessibility | REAL FE | Legend/tooltip explanation | Inspect chart text context for forecast/actual distinction. | Users can understand why current week actual absent via label/help text. | AC-3 |
| PERF-01 | performance | SOURCE | Exclusion compute overhead | Benchmark additional cutoff logic over 52 points x 4 metrics. | Added processing <5ms and no measurable render regression. | AC-4 |
| I18N-01 | i18n | SOURCE | Localized messaging for incomplete week | Switch locale where explanation text exists. | Incomplete-week note/tooltip text localizes correctly. | AC-3 |

## 8) Coverage summary
- Planned tests: **12**
- Category distribution: happy path(2), sad path(2), data consistency(2), API integration(2), regression(1), accessibility(1), performance(1), i18n(1)
- AC coverage: AC-1, AC-2, AC-3, AC-4
