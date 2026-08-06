# QA Test Plan — SSPLAN-623: Show Weekly Sales vs Latest Financial Forecast
### Component: `SalesByWeek`
### Author: Bob (QA Test Creator) — orchestrated by Pablo
### Plan generated: 2026-08-06

---

## 1. Ticket Context

| Field | Value |
|---|---|
| **Jira key** | SSPLAN-623 |
| **Summary** | Show Weekly Sales vs Latest Financial Forecast |
| **Jira status** | Fetched: 401 Unauthorized — known context used |
| **AC source** | Fallback: known feature spec |

### Acceptance Criteria (source: known context)

1. **AC-1** Forecast line is visible ONLY when the metric toggle is set to "Pieces (QTY)" — not on any other metric (SALES, QTY_INDEX, SALES_INDEX)
2. **AC-2** Weekly time intervals are based on the financial calendar (sywNumber)
3. **AC-3** Component shows CY actuals, LY actuals, and Latest Forecast series
4. **AC-4** In scope: Pieces (QTY) granularity only. Out of scope: Turnover toggle

---

## 2. API Contract (traced from source)

### Endpoint

| Property | Value |
|---|---|
| Method | `POST` |
| Path | `${VITE_BACKEND_HOST}${VITE_METRICS_PATH}` |
| Metric key | `WEEKLY_SALES_TREND` |
| Auth | Bearer token (Azure MSAL) |

### Request body — COUNTRY level
```json
{
  "metric": "WEEKLY_SALES_TREND",
  "level": "country",
  "filters": {
    "retailUnitCode": "<retailUnitCode>"
  }
}
```

### Request body — HFB level
```json
{
  "metric": "WEEKLY_SALES_TREND",
  "level": "hfb",
  "filters": {
    "retailUnitCode": "<retailUnitCode>",
    "hfbNo": "<productId>"
  }
}
```

### Request body — PA level
```json
{
  "metric": "WEEKLY_SALES_TREND",
  "level": "pa",
  "filters": {
    "retailUnitCode": "<retailUnitCode>",
    "paNo": "<productId>"
  }
}
```

### Field mappings (`transformResponse`)

| Raw backend field | Frontend field | Transformation |
|---|---|---|
| `sywNumber` | `weekLabel` | Last 2 chars of string (e.g. `202418` → `"18"`) |
| `weeklyNetSalesCy` | `salesCy` | `parseFloat / 1000` |
| `weeklyNetSalesLy` | `salesLy` | `parseFloat / 1000` |
| `weeklyForecastedSalesCy` | `salesForecast` | `parseFloat / 1000` |
| `weeklyNetQuantityCy` | `qtyCy` | `parseFloat` (no scaling) |
| `weeklyNetQuantityLy` | `qtyLy` | `parseFloat` (no scaling) |
| `weeklyForecastedQuantityCy` | `qtyForecast` | `parseFloat` (no scaling) |
| `netSalesTrendIndex` | `salesIndexCy` | `parseFloat` (no scaling) |
| `weeklyForecastedSalesIndex` | `salesIndexForecast` | `parseFloat` (no scaling) |
| `quantityTrendIndex` | `qtyIndexCy` | `parseFloat` (no scaling) |
| `weeklyForecastedQuantityIndex` | `qtyIndexForecast` | `parseFloat` (no scaling) |

### Backend drift — fields MISSING from `WeeklySalesTrendRow.kt`

The backend sealed interface `WeeklySalesTrendRow` and all concrete rows are **missing** the following fields that the frontend `transformResponse` reads:

| Frontend reads | Present in WeeklySalesTrendRow.kt? |
|---|---|
| `weeklyNetSalesCy` | ✅ Yes |
| `weeklyNetSalesLy` | ✅ Yes |
| `weeklyNetQuantityCy` | ✅ Yes |
| `weeklyNetQuantityLy` | ✅ Yes |
| `netSalesTrendIndex` | ✅ Yes |
| `weeklyForecastedSalesCy` | ❌ **MISSING** |
| `weeklyForecastedQuantityCy` | ❌ **MISSING** |
| `weeklyForecastedSalesIndex` | ❌ **MISSING** |
| `weeklyForecastedQuantityIndex` | ❌ **MISSING** |
| `weeklyNetQuantityLy` | ✅ Yes (as `weeklyNetQuantityLy`) |

> **Finding DRIFT-001**: All four forecast fields (`weeklyForecastedSalesCy`, `weeklyForecastedQuantityCy`, `weeklyForecastedSalesIndex`, `weeklyForecastedQuantityIndex`) are absent from the Kotlin row model. The frontend `parseNumber` will receive `undefined`, default to 0, meaning all forecast values will be 0 until the backend is updated.

### METRIC_CONFIG — series rendered per metric type

| MetricType | `showActualLine` | LY dataKey | Actual line | Forecast line | Y-axis domain |
|---|---|---|---|---|---|
| `QTY` | `true` | `ly` (bar) | `actualLine` (Line) | `forecast` (Line) **always rendered** | magnitude (0-based) |
| `SALES` | `true` | `ly` (bar) | `actualLine` (Line) | `forecast` (Line) **always rendered** | magnitude (0-based) |
| `QTY_INDEX` | `false` | `lyRange` (bar) | none | `forecast` (Line) **always rendered** | index (±10 step) |
| `SALES_INDEX` | `false` | `lyRange` (bar) | none | `forecast` (Line) **always rendered** | index (±10 step) |

> **Finding BUG-001 (core SSPLAN-623 bug)**: The `<Line dataKey="forecast" ...>` element is rendered **unconditionally** for ALL four metric types. There is no conditional gate on `metricType === 'QTY'`. Per AC-1, the forecast line should ONLY render when the metric toggle is "Pieces (QTY)". The `SalesByWeekLegend` component also always renders the "latest forecast" legend item regardless of metric type.

---

## 3. Test Cases

---

### CATEGORY: Happy Path

---

**Test ID:** SBW-001  
**Title:** Component renders with COUNTRY product level and no productId  
**Category:** Happy Path  
**Priority:** Critical  
**Venue:** SOURCE (Vitest + @testing-library/react)  
**Preconditions:**  
- `useSalesByWeek` hook is mocked to return `{ data: [buildPoint()], isPending: false, isError: false }`

**Test data:**
```tsx
<SalesByWeek productLevel="COUNTRY" retailUnitCode="SE" productId={undefined} />
```

**Steps:**
1. Render `<SalesByWeek productLevel="COUNTRY" retailUnitCode="SE" productId={undefined} />`
2. Verify the `<section>` element with `aria-label="Sales by week"` is in the DOM
3. Verify the `<h2>` heading with text "Sales by week" is visible
4. Verify all four segment control buttons (Sales, Qty, Sales index, Qty index) are present

**Expected result:**  
- `getByRole('region')` or `getByRole('heading', { name: 'Sales by week' })` resolves without error
- Section has `aria-label="Sales by week"`
- All four metric toggle buttons are rendered

**Failure signals:** Component throws, heading missing, section missing `aria-label`  
**Traceability:** AC-3

---

**Test ID:** SBW-002  
**Title:** Component renders with HFB product level and hfbNo  
**Category:** Happy Path  
**Priority:** Critical  
**Venue:** SOURCE  
**Preconditions:** `useSalesByWeek` returns valid data array with 3 points

**Test data:**
```tsx
const points = [
  buildPoint({ weekLabel: '16' }),
  buildPoint({ weekLabel: '17' }),
  buildPoint({ weekLabel: '18' }),
];
// useSalesByWeek mock: { data: points, isPending: false, isError: false }
<SalesByWeek productLevel="HFB" retailUnitCode="SE" productId="07" />
```

**Steps:**
1. Render with HFB level and productId="07"
2. Confirm chart wrapper is visible (`.chartWrap` or equivalent)
3. Confirm three X-axis week labels "16", "17", "18" appear in the DOM

**Expected result:**  
Chart renders with exactly 3 week labels matching the data

**Failure signals:** Missing week labels, error message shown instead of chart  
**Traceability:** AC-3

---

**Test ID:** SBW-003  
**Title:** Component renders with PA product level and paNo  
**Category:** Happy Path  
**Priority:** High  
**Venue:** SOURCE  
**Preconditions:** `useSalesByWeek` returns valid data array  

**Test data:**
```tsx
<SalesByWeek productLevel="PA" retailUnitCode="DE" productId="10107" />
// useSalesByWeek mock: { data: [buildPoint()], isPending: false, isError: false }
```

**Steps:**
1. Render with PA level
2. Verify no error message is shown
3. Verify the chart area is rendered (ResponsiveContainer present)

**Expected result:**  
Component renders chart without error for PA level

**Failure signals:** Error message "unavailable" shown, component throws  
**Traceability:** AC-3

---

**Test ID:** SBW-004  
**Title:** Default metric type on mount is SALES  
**Category:** Happy Path  
**Priority:** Critical  
**Venue:** SOURCE  
**Preconditions:** `useSalesByWeek` returns valid data  

**Test data:** Single data point with `salesCy: 1200, salesLy: 1300`

**Steps:**
1. Render `<SalesByWeek productLevel="HFB" retailUnitCode="SE" productId="07" />`
2. Inspect SegmentControl — check which button has `aria-pressed="true"`

**Expected result:**  
The "Sales" button has `aria-pressed="true"`. All other three buttons have `aria-pressed="false"`.

**Failure signals:** "Qty" is default, no button has `aria-pressed="true"`  
**Traceability:** AC-4 (SALES is default, QTY is toggled)

---

**Test ID:** SBW-005  
**Title:** Switching metric toggle to QTY updates component state  
**Category:** Happy Path  
**Priority:** Critical  
**Venue:** SOURCE  
**Preconditions:** `useSalesByWeek` returns valid data  

**Test data:** Two data points

**Steps:**
1. Render component (defaults to SALES)
2. `fireEvent.click(screen.getByRole('button', { name: 'Qty' }))`
3. Verify "Qty" button now has `aria-pressed="true"`
4. Verify "Sales" button now has `aria-pressed="false"`

**Expected result:**  
Metric toggle switches to QTY. No error thrown.

**Failure signals:** Button state unchanged, component crashes  
**Traceability:** AC-1

---

**Test ID:** SBW-006  
**Title:** Switching metric toggle to SALES_INDEX updates component  
**Category:** Happy Path  
**Priority:** High  
**Venue:** SOURCE  
**Preconditions:** `useSalesByWeek` returns valid data  

**Steps:**
1. Render (defaults to SALES)
2. Click "Sales index" button
3. Verify `aria-pressed="true"` on "Sales index" button
4. Verify Y-axis domain would use `indexYAxisDomain` — no reference line at 100 is rendered while `showActualLine === false`

**Expected result:**  
"Sales index" selected. ReferenceLine at y=100 is rendered (visible in DOM via recharts `line` element).

**Failure signals:** Wrong button selected, ReferenceLine missing  
**Traceability:** AC-4

---

**Test ID:** SBW-007  
**Title:** Legend shows LY bar + actual line + forecast when metric is SALES  
**Category:** Happy Path  
**Priority:** High  
**Venue:** SOURCE  
**Preconditions:** `useSalesByWeek` returns 1 data point  

**Steps:**
1. Render (defaults to SALES, `showActualLine: true`)
2. In the custom legend, verify all three legend items appear:
   - "last year sales" (bar icon)
   - "actual sales" (line icon — rendered because `showActual=true`)
   - "latest forecast" (forecast icon)

**Expected result:**  
All three legend labels are visible in the DOM.

**Failure signals:** "actual sales" missing, "latest forecast" missing  
**Traceability:** AC-3

---

**Test ID:** SBW-008  
**Title:** Legend hides actual-line item when metric is QTY_INDEX  
**Category:** Happy Path  
**Priority:** High  
**Venue:** SOURCE  
**Preconditions:** `useSalesByWeek` returns valid data  

**Steps:**
1. Render, click "Qty index" button
2. In the custom legend, verify:
   - "last year sales" is present
   - "actual sales" is NOT present (showActual=false)
   - "latest forecast" is present

**Expected result:**  
"actual sales" legend item is absent from the DOM. Other two items are present.

**Failure signals:** "actual sales" still rendered for QTY_INDEX  
**Traceability:** AC-3

---

**Test ID:** SBW-009  
**Title:** Loading state renders correctly with aria attributes  
**Category:** Happy Path  
**Priority:** Critical  
**Venue:** SOURCE  
**Preconditions:** `useSalesByWeek` returns `{ data: undefined, isPending: true, isError: false }`  

**Steps:**
1. Render with `isPending: true`
2. Verify element with `role="status"` is in the DOM
3. Verify that element has `aria-busy="true"`
4. Verify that element has `aria-live="polite"`
5. Verify text "Loading trend data..." is visible

**Expected result:**  
Loading skeleton container has `role="status"`, `aria-live="polite"`, `aria-busy="true"`, and contains "Loading trend data..." text.

**Failure signals:** Any of the four attributes missing  
**Traceability:** Accessibility requirement

---

**Test ID:** SBW-010  
**Title:** Chart renders 52-week dataset without crash  
**Category:** Happy Path  
**Priority:** High  
**Venue:** SOURCE  
**Preconditions:** `useSalesByWeek` returns 52 data points  

**Test data:**
```ts
const points = Array.from({ length: 52 }, (_, i) => buildPoint({
  weekLabel: String(i + 1).padStart(2, '0'),
  salesCy: 1000 + i * 10,
}));
```

**Steps:**
1. Render with 52-point dataset
2. Verify no crash, no error message
3. Verify chart wrapper is present

**Expected result:**  
Component renders successfully with full 52-week dataset.

**Failure signals:** "unavailable" message shown, component crashes  
**Traceability:** Performance / correctness

---

### CATEGORY: Sad Path / Error

---

**Test ID:** SBW-020  
**Title:** API returns empty array → error message shown  
**Category:** Sad Path  
**Priority:** Critical  
**Venue:** SOURCE  
**Preconditions:** `useSalesByWeek` returns `{ data: [], isPending: false, isError: false }`  

**Steps:**
1. Render component
2. Verify the paragraph "Sales trend data is currently unavailable. Please try again later." is in the DOM

**Expected result:**  
Exact text "Sales trend data is currently unavailable. Please try again later." is visible.

**Failure signals:** Blank page, crash, or different message text  
**Traceability:** AC-3

---

**Test ID:** SBW-021  
**Title:** API returns error → error message shown, no chart  
**Category:** Sad Path  
**Priority:** Critical  
**Venue:** SOURCE  
**Preconditions:** `useSalesByWeek` returns `{ data: undefined, isPending: false, isError: true }`  

**Steps:**
1. Render component
2. Verify error message paragraph is visible
3. Verify chart container is NOT in the DOM

**Expected result:**  
Error message shown. No `ResponsiveContainer` / chart rendered.

**Failure signals:** Chart visible alongside error, crash  
**Traceability:** Sad path

---

**Test ID:** SBW-022  
**Title:** Missing required prop `retailUnitCode` (empty string) — query disabled  
**Category:** Sad Path  
**Priority:** Medium  
**Venue:** SOURCE  
**Preconditions:** `useSalesByWeek` real hook logic inspected: `enabled: Boolean(retailUnitCode && ...)` 

**Steps:**
1. Pass `retailUnitCode=""` to component
2. Verify query is not enabled (mock returns `isPending: true`)
3. Verify component renders loading state rather than crash

**Expected result:**  
With empty `retailUnitCode`, query `enabled` evaluates to `false`. Component stays in loading/pending state indefinitely, showing skeleton. No crash.

**Failure signals:** Component crashes with TypeError  
**Traceability:** Sad path

---

**Test ID:** SBW-023  
**Title:** All metric values null/zero — graceful rendering  
**Category:** Sad Path  
**Priority:** Medium  
**Venue:** SOURCE  
**Preconditions:** `useSalesByWeek` returns data with all numeric fields = 0  

**Test data:**
```ts
const allZero = buildPoint({
  salesCy: 0, salesLy: 0, salesForecast: 0,
  qtyCy: 0, qtyLy: 0, qtyForecast: 0,
  salesIndexCy: 0, salesIndexForecast: 0,
  qtyIndexCy: 0, qtyIndexForecast: 0,
});
```

**Steps:**
1. Render with `data: [allZero]`
2. Verify component does NOT show error message (data array has 1 entry, `chartRows.length > 0`)
3. Verify chart renders without crash
4. Verify Y-axis domain = `[0, 0]` does not cause divide-by-zero or NaN crash

**Expected result:**  
Chart renders. No error message. Y-axis domain `[0, 0]` handled gracefully (recharts fallback).

**Failure signals:** Error message shown for non-empty data, crash, NaN in DOM  
**Traceability:** Sad path

---

**Test ID:** SBW-024  
**Title:** Data point with `sywNumber` shorter than 4 chars → filtered out  
**Category:** Sad Path  
**Priority:** Medium  
**Venue:** SOURCE  
**Preconditions:** Raw API response contains a malformed `sywNumber`  

**Test data:**
```ts
// Simulate direct API integration — raw transformResponse input:
const rawResponse = {
  data: {
    data: [
      { sywNumber: '202', weeklyNetSalesCy: '1000', /* ... */ },  // too short
      { sywNumber: '202418', weeklyNetSalesCy: '2000', /* ... */ }, // valid
    ]
  }
};
```

**Steps:**
1. Call `transformResponse(rawResponse)` directly
2. Verify result has exactly 1 entry (the valid one)
3. Verify the malformed row is silently dropped

**Expected result:**  
`transformResponse` returns `[{ weekLabel: '18', salesCy: 2, ... }]` — 1 item, malformed row omitted.

**Failure signals:** 2 items returned, crash on malformed row  
**Traceability:** Defensive coding / data contract

---

**Test ID:** SBW-025  
**Title:** HFB level with no productId → query not enabled  
**Category:** Sad Path  
**Priority:** Medium  
**Venue:** SOURCE  
**Preconditions:** Review `enabled` logic: `Boolean(retailUnitCode && (productLevel === 'COUNTRY' || productId))`  

**Steps:**
1. Render `<SalesByWeek productLevel="HFB" retailUnitCode="SE" productId={undefined} />`
2. Verify `useSalesByWeek` query is not enabled (mock or inspect queryOptions)

**Expected result:**  
Query `enabled: false` when level is HFB and productId is undefined. Component stays in pending/skeleton state.

**Failure signals:** Query fires with `hfbNo: undefined`, API call made with malformed body  
**Traceability:** Sad path / API contract

---

### CATEGORY: Forecast Line Conditional Rendering (SSPLAN-623 Core)

---

**Test ID:** SBW-030  
**Title:** [BUG-001] Forecast line renders unconditionally for ALL metric types — FAILING test until fix  
**Category:** Forecast Line / Regression  
**Priority:** Critical  
**Venue:** SOURCE  
**Preconditions:** `useSalesByWeek` returns valid data with non-zero `salesForecast` and `qtyForecast`  

**Test data:**
```tsx
const point = buildPoint({ salesForecast: 1250, qtyForecast: 4400, salesIndexForecast: 95.3, qtyIndexForecast: 92.1 });
```

**Steps:**
1. Render component (default: SALES metric)
2. Inspect the ComposedChart: verify the `<Line dataKey="forecast">` element is rendered
3. Switch to QTY_INDEX (`fireEvent.click(screen.getByRole('button', { name: 'Qty index' }))`)
4. Inspect the ComposedChart again: verify `<Line dataKey="forecast">` element  
   **→ Per AC-1 this should NOT be rendered for QTY_INDEX, but currently IS**
5. Switch to SALES_INDEX, repeat step 4
6. Switch to QTY, verify forecast line IS rendered

**Expected result (post-fix):**  
- QTY: forecast `<Line>` IS rendered ✅  
- SALES: forecast `<Line>` is NOT rendered (outside scope per AC-1) ✅  
- QTY_INDEX: forecast `<Line>` is NOT rendered ✅  
- SALES_INDEX: forecast `<Line>` is NOT rendered ✅  

**Current behaviour (pre-fix):**  
Forecast line renders for ALL four metric types. All assertions except QTY will FAIL.

**Failure signals (pre-fix):** Forecast line visible when SALES/QTY_INDEX/SALES_INDEX toggled  
**Traceability:** AC-1 (SSPLAN-623), BUG-001

---

**Test ID:** SBW-031  
**Title:** [BUG-001] Forecast legend item shows for ALL metric types — FAILING until fix  
**Category:** Forecast Line / Regression  
**Priority:** Critical  
**Venue:** SOURCE  
**Preconditions:** `useSalesByWeek` returns valid data  

**Steps:**
1. Render (default: SALES metric)
2. Check `SalesByWeekLegend`: "latest forecast" item rendered (always rendered today)
3. Switch to QTY_INDEX
4. Verify "latest forecast" legend item  
   **→ Per AC-1 should NOT appear for QTY_INDEX, but currently does**

**Expected result (post-fix):**  
"latest forecast" legend item only present when metricType === 'QTY'.

**Current behaviour (pre-fix):**  
"latest forecast" always present. Test will FAIL for all non-QTY states.

**Failure signals:** `screen.getByText('latest forecast')` succeeds when metric is not QTY  
**Traceability:** AC-1 (SSPLAN-623), BUG-001

---

**Test ID:** SBW-032  
**Title:** Forecast line is absent when metric type is SALES  
**Category:** Forecast Line  
**Priority:** Critical  
**Venue:** SOURCE  
**Preconditions:** Post-fix. `useSalesByWeek` returns data with non-zero `salesForecast`  

**Steps:**
1. Render (default: SALES metric, `showActualLine: true`)
2. Verify that the recharts `<Line>` with `dataKey="forecast"` is NOT rendered in the DOM  
   (Check absence of dashed line element / no recharts path for forecast series)
3. Verify "latest forecast" legend item is NOT in the DOM

**Expected result:**  
No forecast line or forecast legend item when SALES is active.

**Failure signals:** Forecast line visible in SALES metric  
**Traceability:** AC-1 (SSPLAN-623)

---

**Test ID:** SBW-033  
**Title:** Forecast line is absent when metric type is SALES_INDEX  
**Category:** Forecast Line  
**Priority:** Critical  
**Venue:** SOURCE  
**Preconditions:** Post-fix.  

**Steps:**
1. Render, click "Sales index"
2. Verify no forecast `<Line>` element in DOM
3. Verify "latest forecast" not in legend

**Expected result:**  
No forecast series for SALES_INDEX.

**Failure signals:** Forecast visible on SALES_INDEX  
**Traceability:** AC-1

---

**Test ID:** SBW-034  
**Title:** Forecast line is absent when metric type is QTY_INDEX  
**Category:** Forecast Line  
**Priority:** Critical  
**Venue:** SOURCE  
**Preconditions:** Post-fix.  

**Steps:**
1. Render, click "Qty index"
2. Verify no forecast `<Line>` in DOM
3. Verify "latest forecast" not in legend

**Expected result:**  
No forecast series for QTY_INDEX.

**Failure signals:** Forecast visible on QTY_INDEX  
**Traceability:** AC-1

---

**Test ID:** SBW-035  
**Title:** Forecast line IS present when metric type is QTY  
**Category:** Forecast Line  
**Priority:** Critical  
**Venue:** SOURCE  
**Preconditions:** Post-fix. Data has non-zero `qtyForecast` values.  

**Steps:**
1. Render, click "Qty" button
2. Verify `<Line dataKey="forecast">` is rendered
3. Verify "latest forecast" legend item is visible
4. Verify forecast line uses dashed stroke style (`strokeDasharray="5 4"`)

**Expected result:**  
Forecast line rendered with dashed style. "latest forecast" legend item present.

**Failure signals:** Forecast line absent when QTY active  
**Traceability:** AC-1 (SSPLAN-623)

---

**Test ID:** SBW-036  
**Title:** Switching from QTY to SALES immediately hides forecast line  
**Category:** Forecast Line  
**Priority:** Critical  
**Venue:** SOURCE  
**Preconditions:** Post-fix. Data available.  

**Steps:**
1. Render, click "Qty" (forecast line visible)
2. Click "Sales" button
3. Verify forecast `<Line>` is removed from DOM
4. Verify "latest forecast" legend item removed

**Expected result:**  
Forecast line and legend item disappear immediately on toggle switch.

**Failure signals:** Forecast remains visible after toggle away from QTY  
**Traceability:** AC-1

---

**Test ID:** SBW-037  
**Title:** Switching from QTY_INDEX to QTY shows forecast line  
**Category:** Forecast Line  
**Priority:** High  
**Venue:** SOURCE  
**Preconditions:** Post-fix.  

**Steps:**
1. Render, click "Qty index" (no forecast line)
2. Click "Qty" button
3. Verify forecast `<Line>` appears in DOM
4. Verify "latest forecast" appears in legend

**Expected result:**  
Forecast line and legend item appear when switching TO QTY.

**Failure signals:** Forecast still absent after switching to QTY  
**Traceability:** AC-1

---

### CATEGORY: Data Self-Consistency

---

**Test ID:** SBW-040  
**Title:** Week labels derived from last 2 chars of sywNumber  
**Category:** Data Self-Consistency  
**Priority:** High  
**Venue:** SOURCE (unit test on `transformResponse`)  

**Test data:**
```ts
const rawRows = [
  { sywNumber: '202401', weeklyNetSalesCy: '1000', weeklyNetSalesLy: '900', weeklyNetQuantityCy: '500', weeklyNetQuantityLy: '450', netSalesTrendIndex: '111', weeklyForecastedSalesCy: '950', weeklyForecastedQuantityCy: '480', weeklyForecastedSalesIndex: '105', weeklyForecastedQuantityIndex: '103' },
  { sywNumber: '202452', weeklyNetSalesCy: '2000', /* ... same shape */ },
]
```

**Steps:**
1. Pass raw response to `transformResponse`
2. Check first result's `weekLabel === '01'`
3. Check second result's `weekLabel === '52'`

**Expected result:**  
`weekLabel` for sywNumber `202401` is `"01"`. For `202452` is `"52"`.

**Failure signals:** Full sywNumber string as label, wrong slicing  
**Traceability:** AC-2

---

**Test ID:** SBW-041  
**Title:** Only current year (latest year) data retained in multi-year response  
**Category:** Data Self-Consistency  
**Priority:** Critical  
**Venue:** SOURCE (unit test on `transformResponse`)  

**Test data:**
```ts
const rawRows = [
  { sywNumber: '202350', weeklyNetSalesCy: '500', /* ... */ }, // 2023 row
  { sywNumber: '202401', weeklyNetSalesCy: '1000', /* ... */ }, // 2024 row
  { sywNumber: '202418', weeklyNetSalesCy: '2000', /* ... */ }, // 2024 row
]
```

**Steps:**
1. Call `transformResponse` with mixed-year data
2. Verify result has exactly 2 entries (both 2024)
3. Verify 2023 row is excluded

**Expected result:**  
Only 2024 rows returned (latest year = 2024). 2023 row absent.

**Failure signals:** 3 entries returned, 2023 row present  
**Traceability:** AC-2

---

**Test ID:** SBW-042  
**Title:** Data sorted by sywNumber ascending  
**Category:** Data Self-Consistency  
**Priority:** High  
**Venue:** SOURCE (unit test on `transformResponse`)  

**Test data:**
```ts
const rawRows = [
  { sywNumber: '202418', weeklyNetSalesCy: '2000', /* ... */ },
  { sywNumber: '202401', weeklyNetSalesCy: '1000', /* ... */ },
  { sywNumber: '202410', weeklyNetSalesCy: '1500', /* ... */ },
]
```

**Steps:**
1. Call `transformResponse` with unordered weeks
2. Verify result[0].weekLabel === '01'
3. Verify result[1].weekLabel === '10'
4. Verify result[2].weekLabel === '18'

**Expected result:**  
Points sorted ascending by sywNumber. Week 01 first, 18 last.

**Failure signals:** Unsorted output, weekLabels out of order  
**Traceability:** AC-2

---

**Test ID:** SBW-043  
**Title:** Future weeks (no actual value) render with null actualLine and null lyRange  
**Category:** Data Self-Consistency  
**Priority:** High  
**Venue:** SOURCE  
**Preconditions:** Dataset where later weeks have `actual === 0`  

**Test data:**
```ts
const points = [
  { weekLabel: '18', actual: 1200, ly: 1300, forecast: 1250 }, // past week
  { weekLabel: '19', actual: 0,    ly: 1400, forecast: 1300 }, // future week
];
```

**Steps:**
1. Inspect `buildChartRows(points)` result
2. For week 18: `actualLine` should be `1200` (non-null)
3. For week 19: `actualLine` should be `null`
4. For week 19: `lyRange` should be `null` (LY bar not shown)
5. Render component with SALES metric: verify no bar for future week 19

**Expected result:**  
`actualLine=null` and `lyRange=null` for all weeks after the first zero-actual week. No LY bar plotted for future weeks.

**Failure signals:** LY bar shown for future weeks, actualLine non-null for future weeks  
**Traceability:** AC-3

---

**Test ID:** SBW-044  
**Title:** Sales values divided by 1000 (scaled from currency units)  
**Category:** Data Self-Consistency  
**Priority:** High  
**Venue:** SOURCE (unit test on `transformResponse`)  

**Test data:**
```ts
{ sywNumber: '202418', weeklyNetSalesCy: '1500000', weeklyNetSalesLy: '1300000', weeklyForecastedSalesCy: '1400000', weeklyNetQuantityCy: '500', weeklyNetQuantityLy: '450', netSalesTrendIndex: '110', weeklyForecastedQuantityCy: '480', weeklyForecastedSalesIndex: '105', weeklyForecastedQuantityIndex: '103' }
```

**Steps:**
1. Call `transformResponse` with the above raw row
2. Assert `result[0].salesCy === 1500` (1500000 / 1000)
3. Assert `result[0].salesLy === 1300`
4. Assert `result[0].salesForecast === 1400`
5. Assert `result[0].qtyCy === 500` (no scaling)

**Expected result:**  
Sales fields scaled by /1000. Qty fields unscaled.

**Failure signals:** `salesCy === 1500000` (unscaled), `qtyCy === 0.5` (incorrectly scaled)  
**Traceability:** API contract / field mapping

---

**Test ID:** SBW-045  
**Title:** Null/undefined raw field values default to 0 via parseNumber  
**Category:** Data Self-Consistency  
**Priority:** High  
**Venue:** SOURCE (unit test on `transformResponse`)  

**Test data:**
```ts
{ sywNumber: '202418', weeklyNetSalesCy: null, weeklyNetSalesLy: undefined, weeklyForecastedSalesCy: '', weeklyNetQuantityCy: null, weeklyNetQuantityLy: null, netSalesTrendIndex: null, weeklyForecastedQuantityCy: null, weeklyForecastedSalesIndex: null, weeklyForecastedQuantityIndex: null }
```

**Steps:**
1. Call `transformResponse` with all-null row
2. Verify `result[0].salesCy === 0`
3. Verify `result[0].salesForecast === 0`
4. Verify `result[0].qtyCy === 0`
5. Verify no NaN or Infinity in any field

**Expected result:**  
All fields return `0`. No NaN/Infinity.

**Failure signals:** NaN, Infinity, or undefined in any field  
**Traceability:** Defensive coding

---

### CATEGORY: API Integration Tests

---

**Test ID:** SBW-050  
**Title:** Correct POST body for COUNTRY level  
**Category:** API Contract  
**Priority:** Critical  
**Venue:** SOURCE (unit test / fetch mock)  

**Preconditions:** `global.fetch` mocked, valid token mocked  

**Steps:**
1. Call `fetchSalesByWeek('SE', undefined, 'COUNTRY')`
2. Capture the body passed to `fetch`
3. Deserialize and assert

**Expected result:**
```json
{
  "metric": "WEEKLY_SALES_TREND",
  "level": "country",
  "filters": {
    "retailUnitCode": "SE"
  }
}
```
No `paNo` or `hfbNo` keys present in `filters`.

**Failure signals:** `level` missing or wrong, extra filter keys present  
**Traceability:** API contract — COUNTRY level

---

**Test ID:** SBW-051  
**Title:** Correct POST body for HFB level  
**Category:** API Contract  
**Priority:** Critical  
**Venue:** SOURCE (unit test / fetch mock)  

**Steps:**
1. Call `fetchSalesByWeek('SE', '07', 'HFB')`
2. Assert body

**Expected result:**
```json
{
  "metric": "WEEKLY_SALES_TREND",
  "level": "hfb",
  "filters": {
    "retailUnitCode": "SE",
    "hfbNo": "07"
  }
}
```
`level === "hfb"`, `hfbNo === "07"`, no `paNo`.

**Failure signals:** `level` wrong (e.g. `"HFB"`), missing `hfbNo`, `paNo` present  
**Traceability:** API contract — HFB level

---

**Test ID:** SBW-052  
**Title:** Correct POST body for PA level  
**Category:** API Contract  
**Priority:** Critical  
**Venue:** SOURCE (unit test / fetch mock)  

**Steps:**
1. Call `fetchSalesByWeek('SE', '10107', 'PA')`
2. Assert body

**Expected result:**
```json
{
  "metric": "WEEKLY_SALES_TREND",
  "level": "pa",
  "filters": {
    "retailUnitCode": "SE",
    "paNo": "10107"
  }
}
```

**Failure signals:** `level` wrong, `hfbNo` present instead of `paNo`  
**Traceability:** API contract — PA level

---

**Test ID:** SBW-053  
**Title:** Non-200 HTTP response throws and triggers isError in component  
**Category:** API Contract  
**Priority:** Critical  
**Venue:** SOURCE  

**Steps:**
1. Mock `global.fetch` to return `{ ok: false, status: 503, statusText: 'Service Unavailable' }`
2. Await `fetchSalesByWeek('SE', undefined, 'COUNTRY')` in a try/catch
3. Verify error thrown with message `"Metrics request failed: 503 Service Unavailable"`
4. In component rendering: mock `useSalesByWeek` to return `isError: true`
5. Verify error message displayed

**Expected result:**  
`fetchSalesByWeek` throws on non-200. Component shows "Sales trend data is currently unavailable."

**Failure signals:** No throw on 503, error message not shown  
**Traceability:** Sad path / API contract

---

**Test ID:** SBW-054  
**Title:** Transformation: salesCy correct for known value (1500000 → 1500)  
**Category:** API Contract  
**Priority:** High  
**Venue:** SOURCE (unit test)  
**Test data:** `weeklyNetSalesCy: '1500000'`  

**Steps:** (See SBW-044 — combined test)  
Assert `salesCy === 1500`.

**Expected result:** `salesCy === 1500`  
**Failure signals:** Value unscaled or wrong  
**Traceability:** Field mapping

---

**Test ID:** SBW-055  
**Title:** Transformation: qtyForecast correct for known value (no scaling)  
**Category:** API Contract  
**Priority:** High  
**Venue:** SOURCE (unit test)  
**Test data:** `weeklyForecastedQuantityCy: '4800'`  

**Steps:**
1. Call `transformResponse` with `weeklyForecastedQuantityCy: '4800'`
2. Assert `result[0].qtyForecast === 4800` (no /1000)

**Expected result:** `qtyForecast === 4800`  
**Failure signals:** `qtyForecast === 4.8` (incorrectly scaled)  
**Traceability:** Field mapping

---

**Test ID:** SBW-056  
**Title:** [DRIFT-001] Backend missing forecast fields → all forecast values = 0 in real environment  
**Category:** API Contract / Backend Drift  
**Priority:** Critical  
**Venue:** REAL FE (integration with live backend)  

**Preconditions:** Running against deployed backend without SSPLAN-623 backend fix  

**Steps:**
1. Navigate to SalesByWeek component in live FE with valid HFB (e.g. HFB 07, SE)
2. Switch to QTY metric
3. Inspect network response for WEEKLY_SALES_TREND POST — check if `weeklyForecastedQuantityCy` field is present in API response
4. Inspect the chart: does forecast line show values > 0?

**Expected result (post-backend fix):**  
API response includes `weeklyForecastedSalesCy`, `weeklyForecastedQuantityCy`, `weeklyForecastedSalesIndex`, `weeklyForecastedQuantityIndex`. Forecast line shows non-zero values.

**Current behaviour (pre-fix):**  
Fields absent from response. Frontend `parseNumber(undefined)` returns 0. Forecast line is flat at 0 (or near-zero baseline).

**Failure signals:** Forecast line flat at 0 in real FE  
**Traceability:** DRIFT-001

---

**Test ID:** SBW-057  
**Title:** Query not enabled when COUNTRY level — no productId required  
**Category:** API Contract  
**Priority:** High  
**Venue:** SOURCE  

**Steps:**
1. Check `salesByWeekQuery` with `productLevel: 'COUNTRY'`, `productId: undefined`
2. Verify `enabled: Boolean('SE' && (true || undefined))` = `true`
3. Verify query fires (mock called once)

**Expected result:**  
Query enabled and fires for COUNTRY level even without productId.

**Failure signals:** Query not enabled for COUNTRY level  
**Traceability:** API contract

---

### CATEGORY: Regression Tests

---

**Test ID:** SBW-060  
**Title:** [REGRESSION — BUG-001] Forecast line unconditionally rendered for non-QTY metrics  
**Category:** Regression  
**Priority:** Critical  
**Venue:** SOURCE  
**Preconditions:** This test should FAIL before fix, PASS after.  

**Steps:**
1. Render with valid data (non-zero salesForecast, qtyForecast, etc.)
2. In SALES metric (default): query DOM for recharts Line element with forecast series
3. Assert forecast `<Line>` is NOT rendered for SALES metric

**Expected result (post-fix):** No forecast line for SALES metric  
**Current result (pre-fix):** Forecast line IS rendered — test FAILS  
**Failure signals:** Forecast line present in SALES metric  
**Traceability:** SSPLAN-623 AC-1, BUG-001

---

**Test ID:** SBW-061  
**Title:** [REGRESSION — DRIFT-001] Backend WeeklySalesTrendRow missing forecast fields  
**Category:** Regression  
**Priority:** Critical  
**Venue:** REAL FE / SOURCE  

**Steps:**
1. In a unit test for `transformResponse`, pass a raw response where all four forecast fields are absent (`undefined`)
2. Verify result has all forecast fields set to `0`
3. File backend ticket / verify fix: `WeeklySalesTrendRow.kt` must add the four fields

**Expected result:**  
Until backend adds fields: `salesForecast === 0`, `qtyForecast === 0`, `salesIndexForecast === 0`, `qtyIndexForecast === 0`. Post-fix: all non-zero.

**Failure signals (regression guard):** Non-zero forecast values when backend hasn't shipped the fields  
**Traceability:** DRIFT-001

---

**Test ID:** SBW-062  
**Title:** [REGRESSION] Error message text matches exact known string  
**Category:** Regression  
**Priority:** Medium  
**Venue:** SOURCE  

**Steps:**
1. Render with `isError: true`
2. Assert exact text: `"Sales trend data is currently unavailable. Please try again later."`

**Expected result:**  
Exact string present.

**Failure signals:** String changed/typo in component  
**Traceability:** UX consistency regression

---

### CATEGORY: Accessibility

---

**Test ID:** SBW-070  
**Title:** Section element has aria-label matching the title prop  
**Category:** Accessibility  
**Priority:** High  
**Venue:** SOURCE  

**Steps:**
1. Render `<SalesByWeek title="Weekly trend" productLevel="COUNTRY" retailUnitCode="SE" />`
2. Assert `getByRole('region', { name: 'Weekly trend' })` resolves
   (or `document.querySelector('section').getAttribute('aria-label') === 'Weekly trend'`)

**Expected result:**  
`<section aria-label="Weekly trend">` is in the DOM.

**Failure signals:** `aria-label` missing or doesn't match title prop  
**Traceability:** WCAG 2.1 – 1.3.1 Info and Relationships

---

**Test ID:** SBW-071  
**Title:** Loading state has role="status", aria-live="polite", aria-busy="true"  
**Category:** Accessibility  
**Priority:** Critical  
**Venue:** SOURCE  
**Preconditions:** `isPending: true`  

**Steps:** (see SBW-009)
1. Render with `isPending: true`
2. Assert: `role="status"` present, `aria-live="polite"` present, `aria-busy="true"` present

**Expected result:**  
All three aria attributes correct.

**Failure signals:** Any attribute wrong or missing  
**Traceability:** WCAG 2.1 – 4.1.3 Status Messages

---

**Test ID:** SBW-072  
**Title:** Legend icons are hidden from screen readers with aria-hidden="true"  
**Category:** Accessibility  
**Priority:** Medium  
**Venue:** SOURCE  

**Steps:**
1. Render chart (valid data, SALES metric)
2. Inspect legend icon `<span>` elements
3. Verify each decorative icon span has `aria-hidden="true"`

**Expected result:**  
All three icon spans (`customLegendBarIcon`, `customLegendLineIcon`, `customLegendForecastIcon`) have `aria-hidden="true"`.

**Failure signals:** Icon spans without `aria-hidden="true"` (read as decorative noise by screen reader)  
**Traceability:** WCAG 2.1 – 1.1.1 Non-text Content

---

**Test ID:** SBW-073  
**Title:** Segment control metric toggle is keyboard operable  
**Category:** Accessibility  
**Priority:** High  
**Venue:** SOURCE + STORYBOOK  

**Steps:**
1. Render component with valid data
2. Locate SegmentControl buttons
3. Use `userEvent.keyboard('{Tab}')` to focus first button
4. Use `userEvent.keyboard('{Space}')` or `{Enter}` to activate
5. Verify `aria-pressed` toggles

**Expected result:**  
All metric toggle buttons are reachable via keyboard Tab, activatable via Space/Enter.

**Failure signals:** Buttons not focusable, Space/Enter does not toggle metric  
**Traceability:** WCAG 2.1 – 2.1.1 Keyboard

---

**Test ID:** SBW-074  
**Title:** Chart has sufficient text alternatives  
**Category:** Accessibility  
**Priority:** Medium  
**Venue:** SOURCE  

**Steps:**
1. Render chart with valid data
2. Inspect: does the chart container have `aria-label` or `role="img"` with description?
3. Verify data table fallback OR tooltip text is accessible

**Expected result:**  
The chart's ComposedChart container or its wrapper has an accessible label or there is a visible text summary available.

**Failure signals:** Chart entirely opaque to screen readers (no label, no fallback)  
**Traceability:** WCAG 2.1 – 1.1.1 (complex images)

---

### CATEGORY: Performance

---

**Test ID:** SBW-080  
**Title:** Component renders 52-week dataset within 2 seconds  
**Category:** Performance  
**Priority:** Medium  
**Venue:** SOURCE (Vitest + performance.now())  

**Test data:** 52 `buildPoint()` items with unique `weekLabel`  

**Steps:**
1. Record `performance.now()` before `render()`
2. Render component with 52-point dataset
3. Wait for chart to be stable (no pending state)
4. Record `performance.now()` after render completes
5. Assert elapsed time < 2000ms

**Expected result:**  
Render time < 2000ms for 52-week full year dataset.

**Failure signals:** Render time ≥ 2000ms  
**Traceability:** Performance non-functional requirement

---

**Test ID:** SBW-081  
**Title:** Metric toggle switch completes without visible jank (< 100ms rerender)  
**Category:** Performance  
**Priority:** Low  
**Venue:** SOURCE  

**Steps:**
1. Render with 52-point dataset
2. Record time before `fireEvent.click(screen.getByRole('button', { name: 'Qty' }))`
3. Record time after React finishes re-render
4. Assert elapsed < 100ms

**Expected result:**  
Toggle switch rerender time < 100ms.

**Failure signals:** > 100ms rerender on toggle  
**Traceability:** Performance

---

### CATEGORY: i18n / l10n

---

**Test ID:** SBW-090  
**Title:** Week labels are numeric and locale-neutral  
**Category:** i18n  
**Priority:** Medium  
**Venue:** SOURCE  

**Steps:**
1. Verify `transformResponse` week label derivation: `sywString.slice(-2)` returns a 2-char numeric string
2. Verify no locale-sensitive `toLocaleString()` or `Intl.DateTimeFormat` is used for week label
3. Render component in DE locale: week labels still "01"–"52"

**Expected result:**  
Week labels are always numeric strings "01"–"52", consistent across all locales.

**Failure signals:** Week labels change format by locale, non-numeric chars appear  
**Traceability:** AC-2

---

**Test ID:** SBW-091  
**Title:** No hardcoded locale-specific currency strings in chart  
**Category:** i18n  
**Priority:** Medium  
**Venue:** SOURCE  

**Steps:**
1. Inspect `METRIC_CONFIG.SALES.formatValue`: uses `Math.round(value).toString()` — no locale
2. Inspect `METRIC_CONFIG.QTY.formatValue`: uses `Math.round(value / 100) * 100).toString()` — no locale
3. Verify no `toLocaleString()` calls in `sales-by-week.tsx` or `api.ts`
4. Run `grep -r "toLocaleString" src/components/Shared/DashboardComponents/GraphComponents/SalesByWeek/` — expect no hits

**Expected result:**  
Zero `toLocaleString` calls. All formatting is numeric and locale-agnostic.

**Failure signals:** `toLocaleString()` found in component files  
**Traceability:** i18n

---

**Test ID:** SBW-092  
**Title:** Legend label strings are translation-key candidates (not hardcoded per locale)  
**Category:** i18n  
**Priority:** Low  
**Venue:** SOURCE  

**Steps:**
1. Inspect `SERIES_NAMES`: values are `'last year sales'`, `'actual sales'`, `'latest forecast'`
2. Verify these are NOT passed through i18next `t()` function currently
3. Flag as i18n gap: these strings should use `t('series.lyLabel')` etc.

**Expected result:**  
This test documents a known i18n gap: legend labels are hardcoded English strings. Raise as a follow-up ticket.

**Failure signals (future):** Legend labels appear in English on DE/SE locale  
**Traceability:** i18n — follow-up recommended

---

## 4. Test Coverage Matrix

| AC | Tests covering |
|---|---|
| AC-1: Forecast only on QTY | SBW-030, SBW-031, SBW-032, SBW-033, SBW-034, SBW-035, SBW-036, SBW-037, SBW-060 |
| AC-2: Financial calendar weeks | SBW-040, SBW-041, SBW-042, SBW-090 |
| AC-3: CY actuals, LY actuals, forecast series | SBW-007, SBW-008, SBW-043, SBW-044 |
| AC-4: Pieces (QTY) only in scope | SBW-004, SBW-005 |
| API contract | SBW-050, SBW-051, SBW-052, SBW-053, SBW-054, SBW-055, SBW-057 |
| Backend drift | SBW-056, SBW-061 |
| Error handling | SBW-020, SBW-021, SBW-022, SBW-023, SBW-024, SBW-025 |
| Accessibility | SBW-070, SBW-071, SBW-072, SBW-073, SBW-074 |
| Performance | SBW-080, SBW-081 |
| i18n | SBW-090, SBW-091, SBW-092 |

---

## 5. Summary

| Category | Count | Priority breakdown |
|---|---|---|
| Happy Path | 10 | 5 Critical, 4 High, 1 Medium |
| Sad Path | 6 | 3 Critical, 2 Medium, 1 Medium |
| Forecast Line (AC-1 core) | 8 | 6 Critical, 2 High |
| Data Self-Consistency | 6 | 3 Critical, 3 High |
| API Contract | 8 | 5 Critical, 3 High |
| Regression | 3 | 2 Critical, 1 Medium |
| Accessibility | 5 | 1 Critical, 2 High, 2 Medium |
| Performance | 2 | 1 Medium, 1 Low |
| i18n | 3 | 1 Medium, 1 Medium, 1 Low |
| **TOTAL** | **51** | **22 Critical, 18 High, 9 Medium, 2 Low** |

| Venue | Count |
|---|---|
| SOURCE (Vitest unit/component tests) | 46 |
| REAL FE (live integration) | 3 |
| STORYBOOK | 1 |
| HYBRID | 1 |

---

## 6. Known Issues / Findings

| ID | Severity | Description |
|---|---|---|
| BUG-001 | Critical | `<Line dataKey="forecast">` rendered unconditionally for all 4 metric types; AC-1 requires QTY only. `SalesByWeekLegend` also always shows "latest forecast" item. |
| DRIFT-001 | Critical | `WeeklySalesTrendRow.kt` missing `weeklyForecastedSalesCy`, `weeklyForecastedQuantityCy`, `weeklyForecastedSalesIndex`, `weeklyForecastedQuantityIndex` — all forecast chart values will be 0 in real environment until backend ships these fields. |
| GAP-001 | Low | Legend labels (`last year sales`, `actual sales`, `latest forecast`) are hardcoded English — not wrapped in i18next `t()`. Follow-up i18n ticket recommended. |

---

*End of test plan — SSPLAN-623*
