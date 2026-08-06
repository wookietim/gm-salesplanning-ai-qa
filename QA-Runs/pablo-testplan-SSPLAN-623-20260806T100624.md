# Pablo Run Report — Test Plan Only
## SSPLAN-623: Show Weekly Sales vs Latest Financial Forecast

---

### 1. Metadata

| Field | Value |
|---|---|
| **runId** | pablo-testplan-SSPLAN-623-20260806T100624 |
| **Timestamp** | 2026-08-06T10:06:24-04:00 |
| **Ticket** | SSPLAN-623 |
| **Mode** | `test-plan-only` |
| **Orchestrator** | Pablo (QA Orchestration Manager) |
| **Plan author** | Bob (QA Test Creator) |
| **Executor** | Susan — NOT run in this pass |

---

### 2. Smoke Pre-flight Results

| Check | Result | Notes |
|---|---|---|
| `tsconfig.json` exists in frontend | ✅ PASS | `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` all present |
| `package.json` has `build`, `test`, `lint` scripts | ✅ PASS | `build`, `test`, `lint`, `test:e2e`, `storybook` all present |
| `src/` structure intact | ✅ PASS | `src/components`, `src/services`, routes via TanStack Router confirmed |
| Backend has `pom.xml` | ⚠️ N/A | Backend uses Gradle (`build.gradle.kts`, `gradlew`) not Maven — no pom.xml, but build system confirmed present |

**Smoke: PASS** (source-structure check, live commands not run in plan-only mode)

---

### 3. Jira Context

| Field | Value |
|---|---|
| **Fetch attempt** | `GET https://jira.digital.ingka.com/rest/api/2/issue/SSPLAN-623` |
| **Jira HTTP status** | 401 Unauthorized |
| **AC source** | Fallback to known context |
| **Updated timestamp** | Unknown (Jira unreachable) |

**Used AC (fallback):**
1. Forecast line visible ONLY when toggled to "Pieces (QTY)" — not on any other metric toggle
2. Weekly time intervals based on financial calendar
3. Shows CY actuals, LY actuals, and Latest Forecast
4. In scope: Pieces (QTY) granularity only; Out of scope: Turnover

---

### 4. API-Agent Results

#### 4.1 Endpoint Contract

| Property | Value |
|---|---|
| Method | `POST` |
| Path | `${VITE_BACKEND_HOST}${VITE_METRICS_PATH}` |
| Metric key | `WEEKLY_SALES_TREND` |
| Auth | Bearer token (Azure MSAL via `getToken()`) |
| Levels | `country`, `hfb`, `pa` |

#### 4.2 Request Body Shape

- **COUNTRY**: `{ metric, level: "country", filters: { retailUnitCode } }`
- **HFB**: `{ metric, level: "hfb", filters: { retailUnitCode, hfbNo } }`
- **PA**: `{ metric, level: "pa", filters: { retailUnitCode, paNo } }`

#### 4.3 Field Mappings (transformResponse)

| Raw backend field | Frontend field | Transformation |
|---|---|---|
| `sywNumber` (slice -2) | `weekLabel` | Last 2 chars |
| `weeklyNetSalesCy` | `salesCy` | parseFloat / 1000 |
| `weeklyNetSalesLy` | `salesLy` | parseFloat / 1000 |
| `weeklyForecastedSalesCy` | `salesForecast` | parseFloat / 1000 |
| `weeklyNetQuantityCy` | `qtyCy` | parseFloat |
| `weeklyNetQuantityLy` | `qtyLy` | parseFloat |
| `weeklyForecastedQuantityCy` | `qtyForecast` | parseFloat |
| `netSalesTrendIndex` | `salesIndexCy` | parseFloat |
| `weeklyForecastedSalesIndex` | `salesIndexForecast` | parseFloat |
| `quantityTrendIndex` | `qtyIndexCy` | parseFloat |
| `weeklyForecastedQuantityIndex` | `qtyIndexForecast` | parseFloat |

#### 4.4 Backend Drift Findings

**Finding DRIFT-001 — CRITICAL**

`WeeklySalesTrendRow.kt` (sealed interface + 3 concrete rows: `WeeklySalesTrendHfbRow`, `WeeklySalesTrendPraRow`, `WeeklySalesTrendPaRow`) is **missing the following 4 fields** that `transformResponse` reads:

- `weeklyForecastedSalesCy` ❌ Missing
- `weeklyForecastedQuantityCy` ❌ Missing
- `weeklyForecastedSalesIndex` ❌ Missing
- `weeklyForecastedQuantityIndex` ❌ Missing

**Impact:** Frontend `parseNumber(undefined)` returns `0` for all forecast fields. Forecast line will be flat at 0 in production until backend ships these fields.

#### 4.5 METRIC_CONFIG — showActualLine + forecast line analysis

| MetricType | showActualLine | Forecast Line in DOM |
|---|---|---|
| `QTY` | true | ✅ Always rendered (correct per AC-1) |
| `SALES` | true | ✅ Always rendered (**BUG-001: should not render**) |
| `QTY_INDEX` | false | ✅ Always rendered (**BUG-001: should not render**) |
| `SALES_INDEX` | false | ✅ Always rendered (**BUG-001: should not render**) |

**Finding BUG-001 — CRITICAL**

The `<Line dataKey="forecast" ...>` element in `sales-by-week.tsx` is rendered **unconditionally** — there is no `{metricType === 'QTY' && ...}` guard. Per AC-1, forecast must only appear on QTY. `SalesByWeekLegend` also always passes `seriesNames.forecast` regardless of metric type (there is no `showForecast` prop).

---

### 5. Bob Summary

**Total test cases: 51**

| Category | Count |
|---|---|
| Happy Path | 10 |
| Sad Path / Error | 6 |
| Forecast Line Conditional Rendering (AC-1 core) | 8 |
| Data Self-Consistency | 6 |
| API Contract | 8 |
| Regression | 3 |
| Accessibility | 5 |
| Performance | 2 |
| i18n / l10n | 3 |

**Priority breakdown:**

| Priority | Count |
|---|---|
| Critical | 22 |
| High | 18 |
| Medium | 9 |
| Low | 2 |

**Venue breakdown:**

| Venue | Count |
|---|---|
| SOURCE (Vitest unit/component) | 46 |
| REAL FE (live integration) | 3 |
| STORYBOOK | 1 |
| HYBRID | 1 |

---

### 6. Test Plan File Location

```
/Users/timothy.collins/Documents/ikea work/gm-salesplanning-ai-qa/QA-Tests/SSPLAN-623__sales-by-week.qa.md
```

---

### 7. Key Findings Summary

| ID | Severity | Summary |
|---|---|---|
| BUG-001 | 🔴 Critical | Forecast `<Line>` rendered for all 4 metric types. Must be gated on `metricType === 'QTY'`. Tests SBW-030 through SBW-037 + SBW-060 will FAIL until fixed. |
| DRIFT-001 | 🔴 Critical | `WeeklySalesTrendRow.kt` missing 4 forecast fields. All forecast values will be 0 in real FE. Backend fix required. |
| GAP-001 | 🟡 Low | Legend labels hardcoded English — not i18n-wrapped. Follow-up ticket recommended. |

---

### 8. Existing Test Coverage Note

An existing `sales-by-week.test.tsx` file was found with 6 passing tests covering:
- Loading state, error state, empty data state
- Title/segment control rendering
- Default SALES metric selection
- Toggle switching

The 51 new test cases in the plan **complement and extend** this existing coverage. They do NOT duplicate the existing tests — they add the forecast-line conditional rendering, API contract, data transformation, accessibility, performance, and i18n dimensions which the existing file does not cover.

---

### 9. Next Steps

1. **Backend team**: Add the 4 missing forecast fields to `WeeklySalesTrendRow.kt` and all three concrete row classes (DRIFT-001)
2. **Frontend team**: Gate forecast `<Line>` and forecast legend item on `metricType === 'QTY'` (BUG-001)
3. **QA**: Once fixes are shipped, run Pablo again in `execute` mode — Susan will execute all 51 test cases against SOURCE + REAL FE

---

> ⚠️ **Susan execution not run in this pass — run Pablo again to execute**

---

*Pablo run report — generated 2026-08-06T10:06:24-04:00*
