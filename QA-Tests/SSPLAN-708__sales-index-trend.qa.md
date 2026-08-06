# SSPLAN-708 Test Plan — Sales Index Trend (Goal line + legend)

Mode: **test-plan-only** (Bob planning only; Susan execution deferred)
Ticket: **SSPLAN-708**
Last Jira sync: 2026-08-06T17:58:06.713+0000

## 1) Jira snapshot
- Summary: Add Goal & legend to rolling index charts
- Issue type: Task
- Status: Backlog
- Updated: 2026-08-06T17:58:06.713+0000
- Subtasks: none

### Acceptance Criteria (normalized IDs)
- **AC-1** Existing second trend line is converted to Index-to-Goal and displayed as a black line at Country, HFB, and PA granularity.
- **AC-2** Index-to-Goal calculation (actual revenue ÷ goal revenue) is correct.
- **AC-3** Gray bar boxes remain unchanged (Index-to-Last-Year).
- **AC-4** Chart legend identifies Index-to-Goal (black line) and Index-to-Last-Year (gray bars).
- **AC-5** Chart displays rolling periods: YTD, 13w, 8w, 4w, 1w.
- **AC-6** Switching to Country updates trends to Country-level data.
- **AC-7** Switching to HFB updates trends to HFB-level data.
- **AC-8** Switching to PA updates trends to PA-level data.
- **AC-9** PA-level uses mock Goal data if actual Goal is unavailable.

## 2) API-Agent trace (frontend → API → backend)
### Impacted component scope
- `SalesIndexTrend` UI: `.../GraphComponents/SalesIndexTrend/sales-index-trend.tsx`
- Query hook: `.../services/metrics/sales-index-trend/queries.ts` (`useSalesIndexTrend`)
- Service API: `.../services/metrics/sales-index-trend/api.ts` (`fetchSalesIndexTrend`, `transformResponse`)
- Endpoint: `POST {VITE_BACKEND_HOST}{VITE_METRICS_PATH}` with body:
  - `metric: "ROLLING_SALES_TREND"`
  - `level: productLevel.toLowerCase()`
  - `filters: { retailUnitCode, hfbNo?, paNo? }`
- Backend controller: `/metrics` (`MetricsController.queryMetrics`)
- Backend handler/repository: `RollingSalesTrendHandler` → `RollingSalesTrendRepository`

### Transform mapping under test
For each period key `{ytd,r13,r8,r4,r1}`:
- `actual` = numeric parse of `${key}TrendIndex`
- `actualLabel` = raw string `${key}TrendIndex`
- `ly` = derived `( ${key}NetSalesLy / ${key}NetSales ) * 100` if finite and denominator != 0
- fallback `ly` = `${key}TrendIndexLy` else `${key}TrendIndex`
- Period labels fixed order: `YTD, 13w, 8w, 4w, 1w`

### Drift/risk findings (for regression traceability)
- **RF-708-01**: Current trend line stroke in component is blue `#0058A3`, not black (AC-1 risk).
- **RF-708-02**: No explicit legend rendered in `SalesIndexTrend` component (AC-4 risk).
- **RF-708-03**: Frontend allows `COUNTRY` level, but backend `ROLLING_SALES_TREND` supports only HFB/PA/PRA enums (AC-6 risk).
- **RF-708-04**: Backend rolling trend payload exposes trend/net-sales fields but no explicit goal fields; AC-2/AC-9 depend on data contract clarification.

## 3) Assumptions (explicit)
- **A-1 (High)**: Ticket validation venue includes UI component + metrics API contract checks.
- **A-2 (Medium)**: `r*TrendIndex` is intended to represent Goal-oriented index after SSPLAN-708 backend/data updates.
- **A-3 (Medium)**: Country-level support for rolling trend is expected either via backend extension or FE fallback behavior.
- **A-4 (High)**: PA Goal fallback (mock/placeholder) is acceptable and testable by fixture/control data path.

## 4) Test cases (Bob plan)
Legend: Venue tags = **SOURCE / STORYBOOK / REAL FE / HYBRID**

| ID | Category | Venue | Test | Steps | Expected | Trace |
|---|---|---|---|---|---|---|
| HP-01 | happy path | REAL FE | HFB view renders Goal line + LY bars | Open dashboard at HFB level with valid retailUnitCode+hfbNo | 5 periods shown; line visible; bars visible | AC-1, AC-3, AC-5, AC-7 |
| HP-02 | happy path | REAL FE | PA view renders Goal line + LY bars | Open PA route with valid retailUnitCode+paNo | 5 periods shown; visuals rendered without error | AC-1, AC-3, AC-5, AC-8 |
| HP-03 | happy path | REAL FE | Country view renders trend module | Open Country dashboard context | Country chart data loads and displays at country granularity | AC-1, AC-5, AC-6, RF-708-03 |
| HP-04 | happy path | STORYBOOK | Legend content and swatches | Render story with populated data | Legend shows “Index-to-Goal” black line and “Index-to-Last-Year” gray bars | AC-4, RF-708-02 |
| HP-05 | happy path | HYBRID | Granularity switch Country→HFB→PA | Switch via navigation/breadcrumb flow | Query and chart refresh per level with correct labels | AC-6, AC-7, AC-8 |
| HP-06 | happy path | REAL FE | Line color compliance | Inspect rendered line style | Line stroke is black (not blue) | AC-1, RF-708-01 |
| SP-01 | sad path | REAL FE | API 500 error handling | Stub metrics POST 500 | Unavailable message shown; no crash | Regression baseline |
| SP-02 | sad path | REAL FE | Empty dataset handling | Stub `data.data=[]` | Unavailable message shown consistently | Regression baseline |
| SP-03 | sad path | REAL FE | Missing token path | Force token-service to return null | Controlled error path; no broken UI shell | Regression baseline |
| SP-04 | sad path | HYBRID | Country unsupported backend response | Force backend to reject `level=country` | UI shows error state; defect raised if AC-6 unmet | AC-6, RF-708-03 |
| SP-05 | sad path | HYBRID | PA Goal missing fallback path | Return PA payload lacking Goal basis | Mock/placeholder behavior activates and remains labeled | AC-9, RF-708-04 |
| DC-01 | data consistency | SOURCE | Period ordering transformation | Unit-check transform input permutation | Output order fixed: YTD,13w,8w,4w,1w | AC-5 |
| DC-02 | data consistency | SOURCE | Numeric parse robustness | Include null/NaN/string numeric variants | Non-finite values default to 0; no NaN in chart model | Transform correctness |
| DC-03 | data consistency | SOURCE | LY derivation formula | Provide known netSales/netSalesLy pair | `ly == (ly/cy)*100` to 1 decimal tolerance | AC-3 |
| DC-04 | data consistency | SOURCE | LY fallback behavior | Set denominator 0 and provide `trendIndexLy` | ly uses fallback trendIndexLy; if absent uses trendIndex | Transform correctness |
| DC-05 | data consistency | HYBRID | Label-number coherence | Compare `actualLabel` text to plotted point value | Label equals source trend index text; plotted value numeric equivalent | Transform correctness |
| API-01 | API integration | SOURCE | Request metric identity | Inspect request body assembly | `metric=ROLLING_SALES_TREND` always | Trace contract |
| API-02 | API integration | SOURCE | Filter shaping by level | HFB sends hfbNo only; PA sends paNo only; Country sends none | Request filters respect level-specific shape | AC-6/7/8 |
| API-03 | API integration | HYBRID | Endpoint/method correctness | Capture network call from UI action | POST sent to configured metrics endpoint once per queryKey | Trace contract |
| API-04 | API integration | HYBRID | Backend level compatibility | Validate accepted levels matrix | HFB/PA pass; Country behavior documented/implemented per AC | AC-6, RF-708-03 |
| API-05 | API integration | HYBRID | Response field contract drift scan | Compare backend row fields vs FE transform keys | Any missing/renamed key flagged before release | RF-708-04 |
| REG-01 | regression | SOURCE | Existing LY bars unchanged | Diff pre/post component behavior against baseline fixture | Gray bar semantics and shape unchanged | AC-3 |
| REG-02 | regression | REAL FE | Existing loading and error UX retained | Trigger pending/error | Existing status role/messages remain accessible | RF-708-02 |
| REG-03 | regression | SOURCE | Query key stability | Verify `salesIndexTrendKeys.trendBy` composition | Cache key changes only with filters/level changes | Functional regression |
| REG-04 | regression | HYBRID | Weekly chart unaffected | Open SalesByWeek with same navigation flow | No behavior regression in weekly graph component | Cross-module safety |
| A11Y-01 | accessibility | STORYBOOK | Legend text readability | Check contrast and text size | Legend meets contrast/readability for labels/swatch pairing | AC-4 |
| A11Y-02 | accessibility | REAL FE | Screen-reader naming | Inspect section/title/legend semantics | Chart region and legend announced with distinct labels | AC-4 |
| A11Y-03 | accessibility | REAL FE | Keyboard navigation stability | Tab through dashboard widgets | Focus order logical; no trap from chart/legend additions | Regression baseline |
| PERF-01 | performance | HYBRID | Render cost after legend/line updates | Measure initial and level-switch render timings | No material regression vs baseline threshold | AC-6/7/8 |
| PERF-02 | performance | HYBRID | Query churn on granularity switch | Switch levels repeatedly | One fetch per state change; no duplicate burst calls | API stability |
| I18N-01 | i18n | STORYBOOK | Label externalization readiness | Verify legend and title strings path | New legend strings are localizable/not hard-coded-only | AC-4 |
| I18N-02 | i18n | REAL FE | Locale formatting resilience | Run non-default locale | Period tokens and index labels remain consistent/readable | AC-5 |

## 5) Coverage summary
- Total planned tests: **32**
- Category coverage: happy(6), sad(5), data consistency(5), API integration(5), regression(4), accessibility(3), performance(2), i18n(2)
- AC coverage: AC-1..AC-9 all mapped in table.

## 6) Exit criteria (for Susan execution phase later)
- 100% pass on all AC-linked tests.
- No Sev1/Sev2 open defects in trend rendering, API contract, or granularity switching.
- Any RF-708-* finding either fixed or formally accepted with product/engineering sign-off.
