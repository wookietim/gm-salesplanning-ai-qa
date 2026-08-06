# SSPLAN-723 Test Plan — Article Level Weekly Sales Chart

Mode: **test-plan-only** (Bob planning only; Susan execution deferred)  
Ticket: **SSPLAN-723**  
Last Jira sync: 2026-08-04T18:53:31.759+0000  

## 1) Jira snapshot
- Summary: Article Level Weekly Sales Chart
- Issue type: Story
- Status: Backlog
- Updated: 2026-08-04T18:53:31.759+0000
- Subtasks: none

## 2) Acceptance criteria (normalized)
- **AC-1** Render responsive weekly chart comparing actual vs goal.
- **AC-2** Render responsive weekly chart comparing actual vs demand plan.
- **AC-3** X-axis displays fiscal weeks.
- **AC-4** Implementation matches design behavior.

## 3) Target component/scope
Article-level weekly chart for actual vs goal and actual vs demand plan

## 4) API-agent-style trace (component -> hook -> service -> endpoint -> transform)
- Current component baseline: `SalesByWeek` in `GraphComponents/SalesByWeek/sales-by-week.tsx`.
- Hook: `useSalesByWeek(retailUnitCode, productId, productLevel)` from `services/metrics/sales-by-week/queries.ts`.
- Service: `fetchSalesByWeek` in `services/metrics/sales-by-week/api.ts`.
- Endpoint mapping: `POST {VITE_BACKEND_HOST}{VITE_METRICS_PATH}` body `{metric: WEEKLY_SALES_TREND, level, filters}`.
- Transform mapping under test: `sywNumber->weekLabel`, sales fields scaled by 1000, qty fields raw, index fields raw, latest fiscal year filter, ascending week sort.
- Backend cross-check: `WeeklySalesTrendRow` exposes current/LY/index fields but no explicit `weeklyForecastedSalesCy`, `weeklyForecastedQuantityCy`, or forecast index fields expected by FE transform; article-level (`ART`) level not supported in backend enums.

## 5) Top risks/findings
- Article-level filter/level not implemented in FE service or backend metric type.
- Forecast field mismatch between FE transform and backend row model can zero-out forecast series.
- Design requires actual-vs-goal and actual-vs-demand overlays that may need new backend fields.

## 6) Assumptions with confidence
- **A-1 (Medium)**: Article chart reuses SalesByWeek rendering patterns with article-level filters added.
- **A-2 (Medium)**: Goal and demand-plan series are provided as forecast fields in final API contract.
- **A-3 (Low)**: Week window is latest fiscal year, with last 12 relevant weeks highlighted in article view.

## 7) Bob test plan matrix
Venue tags: **SOURCE / STORYBOOK / REAL FE / HYBRID**

| ID | Category | Venue | Test | Steps | Measurable assertions | AC trace |
|---|---|---|---|---|---|---|
| HP-01 | happy path | REAL FE | Actual vs Goal series render | Load article detail with valid weekly payload including goal series. | Chart shows both series with distinct legend entries and non-zero points. | AC-1, AC-4 |
| HP-02 | happy path | REAL FE | Actual vs Demand Plan series render | Toggle/inspect demand-plan overlay in same chart module. | Demand-plan series visible with correct style and tooltip naming. | AC-2, AC-4 |
| SP-01 | sad path | REAL FE | No data fallback | Return empty weekly dataset for article. | Unavailable message shown; module does not crash. | AC-4 |
| SP-02 | sad path | HYBRID | Missing forecast columns | Remove forecast fields in API mock. | Chart still renders actual and LY; forecast line suppressed with warning telemetry. | AC-1, AC-2 |
| DC-01 | data consistency | SOURCE | Field-level transform scaling | Input `weeklyNetSalesCy=6708431.52`,`weeklyNetQuantityCy=42158`. | Transformed `salesCy=6708.43152` (÷1000), `qtyCy=42158` (no scaling). | AC-4 |
| DC-02 | data consistency | SOURCE | Fiscal week extraction and sort | Input rows `202615`,`202618`,`202520`. | Only latest-year rows retained and ordered `15,18`; week labels are last two digits. | AC-3 |
| API-01 | API integration | SOURCE | Request body contract | Invoke fetch with PA/HFB/article context. | Body contains `metric=WEEKLY_SALES_TREND`, correct `level`, and context filters only. | AC-4 |
| API-02 | API integration | HYBRID | Backend schema drift guard | Compare FE required keys vs backend row model keys. | Any missing required key fails test with explicit diff list. | AC-1, AC-2 |
| REG-01 | regression | REAL FE | Existing HFB/PA weekly chart unaffected | Open existing SalesByWeek on HFB and PA routes. | Current behavior unchanged while adding article-level chart path. | AC-4 |
| A11Y-01 | accessibility | REAL FE | Chart semantic labeling | Inspect chart region, legend, tooltip accessibility. | Chart has accessible title and legend labels map to series semantics. | AC-1, AC-2 |
| PERF-01 | performance | HYBRID | Render budget for 52 weekly points x 3 series | Profile initial chart paint. | Initial paint <300ms and interactions stay responsive. | AC-4 |
| I18N-01 | i18n | SOURCE | Week and series labels localization | Run locale variations. | Series names/axis labels use translatable strings; numeric formatting locale-safe. | AC-3 |

## 8) Coverage summary
- Planned tests: **12**
- Category distribution: happy path(2), sad path(2), data consistency(2), API integration(2), regression(1), accessibility(1), performance(1), i18n(1)
- AC coverage: AC-1, AC-2, AC-3, AC-4
