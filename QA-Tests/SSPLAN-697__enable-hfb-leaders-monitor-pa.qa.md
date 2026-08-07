# SSPLAN-697 — Enable HFB Leaders to Monitor PA
**Agent**: Bob (world-class depth — source grounded)
**Generated**: 2026-08-07
**Ticket**: SSPLAN-697
**Project**: gm-salesplanning-modeling / sp-monitor-dashboard

---

## 1. Metadata and Scope

| Field | Value |
|---|---|
| Ticket | SSPLAN-697 |
| Summary | Enable HFB Leaders to monitor Product Area (PA) performance |
| Scope | `PerformanceList` on `/hfb/:id`; `PADetailPage` on `/hfb/:hfbId/pa/:paId` |
| Routes | `/hfb/:id` · `/hfb/:hfbId/pa/:paId` |
| Key source files | `src/features/entity-detail/PerformanceList.tsx` |
| | `src/features/entity-detail/HFBDetailPage.tsx` |
| | `src/features/entity-detail/PADetailPage.tsx` |
| | `src/services/metricsApi.ts` |

---

## 2. Jira AC Traceability

| AC | Description | Test IDs |
|---|---|---|
| AC-1 | HFB leaders see all PAs sorted by performance gap | HP-01, HP-02, HP-03 |
| AC-2 | PAs colour-coded: red (<94), orange (94–97), green (≥98) | HP-04, DC-01, DC-02 |
| AC-3 | Leaders filter PAs by status | HP-05, HP-06, SP-02 |
| AC-4 | Leaders search PAs by name or code | HP-07, SP-03 |
| AC-5 | Clicking a PA navigates to PA detail | HP-08 |
| AC-6 | PA detail: vsLY from real API; vsGoal/vsPlan/vsFG/To-go show "–" | HP-09, HP-10, API-01 |
| AC-7 | PA detail: weekly sales trend from real API | HP-11, API-02, API-03 |
| AC-8 | PA detail: rolling index chart from real API | HP-12, API-04 |
| AC-9 | One API failure does not crash the page | SP-04, SP-05 |

---

## 3. API Contract Map

### POST /metrics — ROLLING_SALES_TREND (PA level)
- Request: `{ metric: "ROLLING_SALES_TREND", level: "pa", filters: { retailUnitCode: <env>, paNo: "<paCode>" } }`
- paNo format: PA code as-is from `paDetail.pa.code` e.g. "0111" — no padding (unlike HFB)
- Response path: `data.data[0]` (single row)

| rawField | frontendField | transformation | null handling |
|---|---|---|---|
| `ytdTrendIndex` | `vsLY` displayed | `100 + Math.round(parseFloat(ytdTrendIndex))` | undefined → "–" |
| `r1TrendIndex` | rolling "1w" vsLastYear | `parseFloat(r1TrendIndex)`, null if non-finite | null |
| `r4TrendIndex` | rolling "4w" vsLastYear | same | null |
| `r8TrendIndex` | rolling "8w" vsLastYear | same | null |
| `r13TrendIndex` | rolling "13w" vsLastYear | same | null |
| `ytdTrendIndex` | rolling "YTD" vsLastYear | same | null |

**Critical constraint:** `SALES_INDEX_TO_GOAL` is NOT called at PA level — backend throws if called with PA filters. vsGoal always "–".

### POST /metrics — WEEKLY_SALES_TREND (PA level)
- Request: `{ metric: "WEEKLY_SALES_TREND", level: "pa", filters: { retailUnitCode: <env>, paNo: "<paCode>" } }`

| rawField | frontendField | transformation | null handling |
|---|---|---|---|
| `sywNumber` | `weekLabel` | `"w" + sywNumber.slice(-2)` | malformed → excluded |
| `netSalesTrendIndex` | `actual` | `parseFloat(...)`, null if non-finite | null |
| *(constant)* | `plan` | Always `100` — no per-week source | never null |
| *(constant)* | `forecast` | Always `null` — no index-scaled forecast | always null |

**Note:** `weeklyForecastedQuantityCy` is in the row type but intentionally NOT used.
**Filter:** Only latest fiscal year rows kept; sorted ascending by `sywNumber`.

---

## 4. Test Cases

### HAPPY PATH

#### HP-01 — PerformanceList renders all PAs for the HFB
| | |
|---|---|
| Priority | Critical · Venue: SOURCE + REAL FE |
| Preconditions | Navigate to `/hfb/01` |
| Steps | 1. Navigate to `/hfb/01`; 2. Wait for PA list to render |
| Expected result | Every PA from `fetchPAs("01")` appears as a row. Row count matches API response. |
| Failure signals | Missing rows; blank list with no error state |
| Evidence | `HFBDetailPage.tsx:65` — `fetchPAs(id).then(setPas)` feeds `PerformanceList items` |
| Traceability | AC-1 |

#### HP-02 — PA list sorted worst-first
| | |
|---|---|
| Priority | High · Venue: REAL FE |
| Test data | HFB with PAs at indices 88, 95, 102 |
| Expected result | index 88 (red) before 95 (orange) before 102 (green) |
| Evidence | `PerformanceList.tsx:104` subtitle "By gap to goal & importance (worst first)" |
| Traceability | AC-1 |

#### HP-03 — Summary row shows correct counts by status
| | |
|---|---|
| Priority | High · Venue: SOURCE |
| Test data | 5 PAs: 2 red, 1 orange, 2 green |
| Expected result | "2 below goal", "1 slightly below", "2 on/above goal" |
| Evidence | `PerformanceList.tsx:57–60` |
| Traceability | AC-2 |

#### HP-04 — Status badge colours match thresholds
| | |
|---|---|
| Priority | Critical · Venue: SOURCE |
| Test data | Indices 93, 94, 97, 98, 102 |
| Expected result | 93→red, 94→orange, 97→orange, 98→green, 102→green |
| Failure signals | Off-by-one at 94 or 98 |
| Evidence | `PerformanceList.tsx:17–31` STATUS_CONFIG |
| Traceability | AC-2 |

#### HP-05 — "Below goal" filter shows only red PAs
| | |
|---|---|
| Priority | High · Venue: SOURCE + REAL FE |
| Steps | 1. Click "Below goal" chip; 2. Inspect visible rows |
| Expected result | Only `status: 'red'` PAs visible; orange/green hidden; chip shows selected state |
| Evidence | `PerformanceList.tsx:133` filterFn |
| Traceability | AC-3 |

#### HP-06 — "All" chip restores full list
| | |
|---|---|
| Priority | Medium · Venue: REAL FE |
| Steps | 1. Apply filter; 2. Click "All" |
| Expected result | All PAs visible; "All" selected; others deselected |
| Traceability | AC-3 |

#### HP-07 — Search by PA name filters correctly
| | |
|---|---|
| Priority | High · Venue: SOURCE + REAL FE |
| Test data | PA named "Sofas" and "Sofa beds" |
| Steps | Type "Sofa" in search |
| Expected result | Both matching PAs visible; others hidden |
| Evidence | `PerformanceList.tsx:131` searchKeys defaults to ['name','code'] |
| Traceability | AC-4 |

#### HP-08 — Clicking PA row navigates to PA detail
| | |
|---|---|
| Priority | Critical · Venue: REAL FE |
| Steps | 1. Navigate to `/hfb/01`; 2. Click first PA row |
| Expected result | Navigates to `/hfb/01/pa/:paId` where paId = PA's `id` field |
| Failure signals | No navigation; wrong route; paId is code not id |
| Evidence | `HFBDetailPage.tsx:115` getItemRoute prop |
| Traceability | AC-5 |

#### HP-09 — PA detail vsLY shows transformed API value
| | |
|---|---|
| Priority | Critical · Venue: REAL FE + SOURCE |
| Test data | paNo with `ytdTrendIndex = "3"` |
| Expected result | "vs LY" displays `103` (100 + Math.round(3)) |
| Failure signals | Shows "–"; shows raw "3"; shows non-rounded value |
| Transformation | `100 + Math.round(parseFloat(ytdTrendIndex))` — `PADetailPage.tsx:50–54` |
| Traceability | AC-6 |

#### HP-10 — PA detail shows "–" for vsGoal, vsPlan, vsFG, To-go
| | |
|---|---|
| Priority | High · Venue: SOURCE |
| Expected result | heroValue="–"; metrics: vs plan="–", vs FG="–", To-go="–"; only vsLY has real value |
| Evidence | `PADetailPage.tsx:95–103` — vsGoal never passed |
| Traceability | AC-6 |

#### HP-11 — PA weekly chart from WEEKLY_SALES_TREND
| | |
|---|---|
| Priority | Critical · Venue: REAL FE + SOURCE |
| Expected result | Latest fiscal year only, sorted ascending. `actual=parseFloat(netSalesTrendIndex)`, `plan=100`, `forecast=null`. Labels = `"w" + last 2 digits`. |
| Evidence | `metricsApi.ts:229–259` |
| Traceability | AC-7 |

#### HP-12 — Rolling index chart shows 5 windows
| | |
|---|---|
| Priority | High · Venue: REAL FE + SOURCE |
| Expected result | YTD, 13w, 8w, 4w, 1w points. Each vsLastYear = parseFloat of matching r*TrendIndex. vsGoal = null for all. |
| Evidence | `metricsApi.ts:275–290` |
| Traceability | AC-8 |

---

### SAD PATH

#### SP-01 — Empty PA list shows empty state
| | |
|---|---|
| Priority | High · Venue: SOURCE |
| Test data | `items = []` |
| Expected result | Progress bar not rendered; emptyMessage shown; no crash |
| Evidence | `PerformanceList.tsx:109` total=0 skips progress bar |

#### SP-02 — Combined filter + search no matches shows empty state
| | |
|---|---|
| Priority | Medium · Venue: REAL FE |
| Steps | Apply "Below goal" filter; search for name only in green PAs |
| Expected result | Empty state shown; no crash |

#### SP-03 — Search with no matches shows empty state
| | |
|---|---|
| Priority | Medium · Venue: SOURCE + REAL FE |
| Steps | Type "ZZZZZZ" in search |
| Expected result | Empty state shown; no crash |

#### SP-04 — ROLLING_SALES_TREND failure does not crash PA page
| | |
|---|---|
| Priority | Critical · Venue: REAL FE + SOURCE |
| Expected result | console.warn only; "–" for vsLY; empty rolling chart; no crash; no ErrorBanner |
| Evidence | `PADetailPage.tsx:57–62` soft catch |
| Traceability | AC-9 |

#### SP-05 — WEEKLY_SALES_TREND failure does not crash PA page
| | |
|---|---|
| Priority | Critical · Venue: SOURCE |
| Expected result | console.warn only; SalesIndexChart shows empty/placeholder; no crash |
| Evidence | `PADetailPage.tsx:64–69` soft catch |
| Traceability | AC-9 |

#### SP-06 — Mock API failure shows ErrorBanner with retry
| | |
|---|---|
| Priority | High · Venue: REAL FE |
| Steps | Force `Promise.all` in `load()` to reject |
| Expected result | ErrorBanner: "Failed to load PA data." with Retry button that re-calls `load()` |
| Evidence | `PADetailPage.tsx:44` |

---

### DATA CONSISTENCY

#### DC-01 — Threshold boundary: index 94 is orange not red
| | |
|---|---|
| Priority | High · Venue: SOURCE |
| Test data | `ytdIndex: 94` |
| Expected result | `status: 'orange'` (red requires strictly < 94) |
| Evidence | `PerformanceList.tsx:17–31` STATUS_CONFIG |

#### DC-02 — Threshold boundary: index 98 is green not orange
| | |
|---|---|
| Priority | High · Venue: SOURCE |
| Test data | `ytdIndex: 98` |
| Expected result | `status: 'green'` |

#### DC-03 — transformWeeklyTrendRows keeps only latest fiscal year
| | |
|---|---|
| Priority | Critical · Venue: SOURCE |
| Test data | Rows: sywNumber 202501, 202552, 202601 |
| Expected result | Only 202601 in output; 2025 rows excluded |
| Evidence | `metricsApi.ts:238–241` |

#### DC-04 — Week label formatted correctly
| | |
|---|---|
| Priority | Medium · Venue: SOURCE |
| Test data | `sywNumber: "202607"` |
| Expected result | `weekLabel: "w07"` |
| Evidence | `metricsApi.ts:248` |

#### DC-05 — vsLY transformation: ytdTrendIndex "3.7" → 104
| | |
|---|---|
| Priority | Critical · Venue: SOURCE |
| Test data | `ytdTrendIndex: "3.7"` |
| Expected result | `100 + Math.round(3.7) = 104` displayed |
| Evidence | `PADetailPage.tsx:50–54` + SnapshotCard metrics |

#### DC-06 — sessionStorage records last PA path
| | |
|---|---|
| Priority | Low · Venue: REAL FE |
| Test data | Navigate to `/hfb/01/pa/3` |
| Expected result | `sessionStorage.getItem('lastPaPath') === "/hfb/01/pa/3"` |
| Evidence | `PADetailPage.tsx:37` |

---

### API INTEGRATION

#### API-01 — ROLLING_SALES_TREND uses paNo as-is (no padding)
| | |
|---|---|
| Priority | Critical · Venue: SOURCE |
| Test data | `paDetail.pa.code = "0111"` |
| Expected result | Request: `{ level: "pa", filters: { paNo: "0111" } }` — no String.padStart applied |
| Evidence | `PADetailPage.tsx:46` — code passed directly |

#### API-02 — WEEKLY_SALES_TREND request uses level "pa"
| | |
|---|---|
| Priority | Critical · Venue: SOURCE |
| Expected result | Body includes `level: "pa"` not "hfb" or "country" |
| Evidence | `metricsApi.ts:213–216` |

#### API-03 — Non-finite netSalesTrendIndex yields null not 0
| | |
|---|---|
| Priority | High · Venue: SOURCE |
| Test data | `netSalesTrendIndex: "N/A"` |
| Expected result | `actual: null` — chart renders gap, not zero spike |
| Evidence | `metricsApi.ts:251–252` |

#### API-04 — Non-finite r1TrendIndex yields null vsLastYear
| | |
|---|---|
| Priority | High · Venue: SOURCE |
| Test data | `r1TrendIndex: ""` |
| Expected result | Rolling 1w point has `vsLastYear: null` |
| Evidence | `metricsApi.ts:283–285` |

#### API-05 — SALES_INDEX_TO_GOAL is NOT called at PA level
| | |
|---|---|
| Priority | Critical · Venue: SOURCE |
| Expected result | `fetchSalesIndexToGoalForHfb` not imported or called in PADetailPage.tsx |
| Failure signals | Any import or call to SALES_INDEX_TO_GOAL with PA filters |
| Evidence | Source comment: "SALES_INDEX_TO_GOAL only supports HFB-level filters" metricsApi.ts:65–67 |

---

### REGRESSION

#### REG-01 — [REGRESSION] vsGoal never passed to PA SnapshotCard
| | |
|---|---|
| Priority | Critical · Venue: SOURCE |
| Expected result | `PADetailPage.tsx` SnapshotCard: `heroValue="–"` with no ytdIndex prop. Any real index value at PA level is a regression. |
| Evidence | `PADetailPage.tsx:92` |

#### REG-02 — [REGRESSION] forecast always null in PA weekly chart
| | |
|---|---|
| Priority | High · Venue: SOURCE |
| Expected result | `transformWeeklyTrendRows` returns `forecast: null` for every row. `weeklyForecastedQuantityCy` not read. |
| Evidence | `metricsApi.ts:253` — `forecast: null` hardcoded |

---

### ACCESSIBILITY

#### A11Y-01 — PA row button has descriptive aria-label
| | |
|---|---|
| Priority | Critical · Venue: SOURCE |
| Expected result | aria-label = `"View details for ${name}, status: ${STATUS_ARIA[status]}, index ${ytdIndex}"` |
| Evidence | `PerformanceList.tsx:149` |

#### A11Y-02 — Status badge is aria-hidden
| | |
|---|---|
| Priority | High · Venue: SOURCE |
| Expected result | Badge `<div>` has `aria-hidden="true"`; status info carried by button aria-label only |
| Evidence | `PerformanceList.tsx:155` |

#### A11Y-03 — Skip to main content link on PA detail
| | |
|---|---|
| Priority | High · Venue: SOURCE |
| Expected result | `<a href="#main-content">Skip to main content</a>` present and visible on focus; `<main id="main-content">` exists |
| Evidence | `PADetailPage.tsx:62–69` |

#### A11Y-04 — Back button has descriptive aria-label
| | |
|---|---|
| Priority | Medium · Venue: SOURCE |
| Expected result | `aria-label="Go back to ${hfbName}"` where hfbName is resolved (e.g. "01 - Sofas") |
| Evidence | `PADetailPage.tsx:78` |

#### A11Y-05 — Filter chips keyboard operable
| | |
|---|---|
| Priority | High · Venue: REAL FE |
| Steps | Tab to chips, activate with Enter/Space |
| Expected result | Each chip focusable and activatable; selected state announced |

---

### PERFORMANCE

#### PERF-01 — 30-PA list renders within 500ms
| | |
|---|---|
| Priority | Medium · Venue: REAL FE |
| Test data | HFB with 30 PAs |
| Expected result | Initial render including progress bar + all rows within 500ms; no jank on chip toggle |

#### PERF-02 — Filter toggle fires no API requests
| | |
|---|---|
| Priority | Medium · Venue: REAL FE + SOURCE |
| Expected result | Chip click updates list immediately; zero new network requests |
| Evidence | `PerformanceList.tsx` — filter is useState-only, no useEffect dependency |

---

### i18n

#### I18N-01 — Title/subtitle are props (locale-overridable)
| | |
|---|---|
| Priority | Medium · Venue: SOURCE |
| Expected result | `title` and `subtitle` are string props; can be overridden by caller for locale |
| Finding | Defaults are hardcoded English ("Performance", "By gap to goal & importance") |
| Evidence | `PerformanceList.tsx:99–100` |

#### I18N-02 — Status chip labels are hardcoded English
| | |
|---|---|
| Priority | Low · Venue: SOURCE |
| Finding | "Below goal", "Slightly below", "On/above goal" are string literals in STATUS_CONFIG |
| Recommendation | Extract to locale-aware config or i18n key |
| Evidence | `PerformanceList.tsx:17–31` |

#### I18N-03 — ytdIndex rendered as plain integer
| | |
|---|---|
| Priority | Low · Venue: SOURCE |
| Finding | `{item.ytdIndex}` rendered directly — acceptable for index values but confirm intentional for all markets |
| Evidence | `PerformanceList.tsx:160` |

---

## 5. Summary

| Category | Tests | Critical | High | Medium | Low |
|---|---|---|---|---|---|
| Happy Path | 12 | 4 | 5 | 2 | 1 |
| Sad Path | 6 | 2 | 3 | 1 | 0 |
| Data Consistency | 6 | 3 | 2 | 1 | 0 |
| API Integration | 5 | 3 | 2 | 0 | 0 |
| Regression | 2 | 1 | 1 | 0 | 0 |
| Accessibility | 5 | 1 | 3 | 1 | 0 |
| Performance | 2 | 0 | 0 | 2 | 0 |
| i18n | 3 | 0 | 0 | 1 | 2 |
| **Total** | **41** | **14** | **16** | **8** | **3** |

---

## 6. Risks and Assumptions

| Risk | Confidence | Impact |
|---|---|---|
| No i18n framework — all strings English-only | high | medium |
| vsGoal has no PA backend source — always "–" | high | high (expected) |
| `weeklyForecastedQuantityCy` in row type but never displayed | high | low |
| SALES_INDEX_TO_GOAL throws on PA filters | high | critical — guarded by source-only check |
| No unit tests for PerformanceList thresholds/filters | high | medium |
