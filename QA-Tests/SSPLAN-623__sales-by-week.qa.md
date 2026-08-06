# SSPLAN-623 Test Plan — Show Weekly Sales vs Latest Financial Forecast

Mode: **test-plan-only** (Bob planning only; Susan execution deferred)  
Ticket: **SSPLAN-623**  
Last Jira sync: **401 Unauthorized in this environment; using validated ticket context from existing SSPLAN-623 plan**

## 1) Metadata and scope
- Feature under test: `SalesByWeek` weekly chart behavior + metric-toggle semantics.
- In scope: Forecast visibility rule, week-axis data integrity, FE/BE field contract alignment for weekly sales/qty/index series.
- Out of scope: Non-weekly dashboard modules and unrelated routing/auth workflows.

## 2) Jira context + AC traceability
- Summary: Show Weekly Sales vs Latest Financial Forecast
- Issue type: Story (context from prior plan)
- Core intent: Forecast should be visible only for **Pieces (QTY)** view while weekly chart contracts remain stable.

### Acceptance criteria (normalized)
- **AC-1** Forecast line is visible only when metric type is **QTY**.
- **AC-2** Weekly intervals are based on financial week (`sywNumber`) with deterministic ordering.
- **AC-3** Component correctly maps CY/LY/forecast payload fields per metric contract.
- **AC-4** Error/empty states, accessibility, localization, and baseline performance remain acceptable.

## 3) Component/API contract mapping
- Component: `SalesByWeek` (container path via sales graph row).
- Hook/query: `useSalesByWeek(...)`.
- Service call: `fetchSalesByWeek` -> `POST {VITE_BACKEND_HOST}{VITE_METRICS_PATH}` with metric `WEEKLY_SALES_TREND`.
- Backend chain: `MetricsController` -> `MetricDispatcher` -> `WeeklySalesTrendHandler` -> `WeeklySalesTrendRepository`.
- Critical contract checks:
  - **QTY-only forecast visibility** enforced in chart + legend behavior.
  - **Backend drift guard** for forecast/index fields (`weeklyForecastedSalesCy`, `weeklyForecastedQuantityCy`, `weeklyForecastedSalesIndex`, `weeklyForecastedQuantityIndex`) impacting FE mappings.

## 4) Test categories with measurable cases

| ID | Category | Venue | Test | Steps | Expected outcome (measurable) | AC trace |
|---|---|---|---|---|---|---|
| HP-01 | happy path | REAL FE | Baseline weekly chart render | Open SalesByWeek route with valid country context and data. | Chart region, title, toggles, and CY/LY series render with no runtime errors. | AC-2, AC-4 |
| HP-02 | happy path | REAL FE | QTY metric shows forecast | Switch metric to QTY and inspect chart + legend. | Forecast line and legend item are visible only in QTY view with non-null data points. | AC-1, AC-3 |
| SP-01 | sad path | HYBRID | Empty dataset fallback | Return empty array from weekly metric response. | Empty-state UX shown; no broken layout or crash. | AC-4 |
| SP-02 | sad path | HYBRID | API error resilience | Force weekly metric 5xx/4xx response. | Error message/retry path is visible and route remains stable. | AC-4 |
| DC-01 | data consistency | SOURCE | Forecast visibility negative checks | Toggle SALES, SALES_INDEX, QTY_INDEX with same fixture. | Forecast line is absent for non-QTY metrics (critical SSPLAN-623 behavior). | AC-1 |
| DC-02 | data consistency | SOURCE | Financial week ordering integrity | Feed unsorted/duplicate `sywNumber` fixtures. | Week labels are deterministically ordered and duplicate handling follows transform rule. | AC-2 |
| API-01 | API integration | SOURCE | Request payload by hierarchy level | Validate COUNTRY/HFB/PA request bodies and filters. | Metric key, level, and filters exactly match expected contract per level. | AC-3 |
| API-02 | API integration | HYBRID | Forecast/index field drift detection | Compare FE required keys vs backend response schema fixtures. | Missing/renamed forecast/index fields produce explicit drift failure with key-level diff. | AC-3 |
| REG-01 | regression | REAL FE | Neighbor graph regression guard | Exercise adjacent weekly graph behavior after SSPLAN-623 change. | Existing weekly modules keep prior behavior and visual stability. | AC-4 |
| A11Y-01 | accessibility | REAL FE | Keyboard and semantics | Tab through metric toggles and chart container. | All controls are keyboard reachable with meaningful role/name labels. | AC-4 |
| PERF-01 | performance | HYBRID | Render/interaction budget | Profile initial render and first metric switch under realistic payload. | Initial render <= 300ms; metric switch response <= 100ms baseline target. | AC-4 |
| I18N-01 | i18n | SOURCE | Locale-safe labels and formatting | Switch locale and validate labels/numeric display. | No hard-coded English in feature path; locale number formatting is applied. | AC-4 |

## 5) Venue tagging per test
Venue tags used in matrix: **SOURCE / STORYBOOK / REAL FE / HYBRID**.
- This plan uses SOURCE, REAL FE, and HYBRID venues.
- STORYBOOK is reserved if an isolated component story is available during execution phase.

## 6) Risks/assumptions with confidence
### Risks/findings
- **R-1 (High):** Forecast rendering can regress if chart/legend visibility logic is not explicitly gated to QTY.
- **R-2 (High):** Backend schema drift on forecast/index fields can silently zero values and mislead users.
- **R-3 (Medium):** `sywNumber` parsing/sort edge cases can produce duplicate or misplaced week labels.

### Assumptions
- **A-1 (Medium):** Weekly metric endpoint path and auth model remain unchanged for this sprint.
- **A-2 (Medium):** Financial week key `sywNumber` remains canonical in payloads.
- **A-3 (Low):** Storybook coverage for SalesByWeek may be unavailable; HYBRID/SOURCE fallback is acceptable.

## 7) Coverage summary
- Planned tests: **12**
- Category distribution: happy path(2), sad path(2), data consistency(2), API integration(2), regression(1), accessibility(1), performance(1), i18n(1)
- Critical checks explicitly covered:
  - QTY-only forecast visibility: **HP-02, DC-01**
  - Backend forecast/index drift: **API-02**
- AC coverage: **AC-1, AC-2, AC-3, AC-4**
