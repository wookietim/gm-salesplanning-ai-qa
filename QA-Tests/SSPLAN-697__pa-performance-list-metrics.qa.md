# SSPLAN-697 Test Plan — Enable HFB Leaders to Monitor PA Performance Across Multiple Metrics

Mode: **test-plan-only** (Bob planning only; Susan execution deferred)  
Ticket: **SSPLAN-697**  
Last Jira sync: 2026-08-06T18:38:42.982+0000  

## 1) Jira snapshot
- Summary: Enable HFB Leaders to Monitor PA Performance Across Multiple Metrics
- Issue type: Story
- Status: Backlog
- Updated: 2026-08-06T18:38:42.982+0000
- Subtasks: SSPLAN-669

## 2) Acceptance criteria (normalized)
- **AC-1** HFB detail shows PA Performance List with all PAs (no pagination).
- **AC-2** Default metric view is Qty Index.
- **AC-3** Each PA card shows PA name, metric value, trend indicator, baseline label, gap indicator, to-go forecast.
- **AC-4** List default sort is Gap-to-Goal worst first.
- **AC-5** Quick overview shows performance tiers (critical/below/on-or-above).
- **AC-6** Metric toggles Qty / Qty Index / Sales / Sales Index with correct formatting.
- **AC-7** Clicking PA card navigates to PA detail view.
- **AC-8** Data points align with definitions/design.

## 3) Target component/scope
HFB PA performance module: ProductAreaSummaryList + ProductAreaSummary + sales-performance service

## 4) API-agent-style trace (component -> hook -> service -> endpoint -> transform)
- Component: `ProductAreaSummaryList` -> child `ProductAreaSummary`.
- Hook: `usePaSalesPerformanceForHfb(retailUnitCode,hfbNo)` in `services/metrics/sales-performance/queries.ts`.
- Service: `fetchPaSalesPerformanceForHfb` currently returns local mock in `services/metrics/sales-performance/api.ts` (no network call yet).
- Endpoint mapping: **GAP** — no `/metrics` POST integration yet for `PA_PERFORMANCE`.
- Field mapping under test: `data.data[] -> {paNo,paName,vsPlan,vsLy,plannedActivations,toGoIndex,score}`; badge color uses score thresholds (<89 critical, <100 warning, >=100 good).
- Backend cross-check: no `PA_PERFORMANCE` metric handler/repository currently found in backend; integration risk for production data.

## 5) Top risks/findings
- No backend metric contract for PA performance (mock-only FE service).
- No in-component metric toggle in ProductAreaSummaryList yet; AC requires selector behavior.
- Default sorting/quick-tier summary not implemented in current component path.

## 6) Assumptions with confidence
- **A-1 (High)**: This story validates existing HFB PA list implementation path and its planned API integration.
- **A-2 (High)**: Until backend exists, SOURCE/STORYBOOK tests use mock payload deterministically.
- **A-3 (Medium)**: Metric selector behavior may be shared with existing `SegmentControl` pattern used by SalesByWeek.

## 7) Bob test plan matrix
Venue tags: **SOURCE / STORYBOOK / REAL FE / HYBRID**

| ID | Category | Venue | Test | Steps | Measurable assertions | AC trace |
|---|---|---|---|---|---|---|
| HP-01 | happy path | REAL FE | HFB route renders PA list | Open `/region-dashboard/us/hfb/01`. | At least 1 PA row renders with `PA name - PA no`, score badge, and chevron. | AC-1, AC-3 |
| HP-02 | happy path | REAL FE | PA row navigation | Click first PA row button. | Router path changes to `/region-dashboard/us/hfb/01/pa/<paId>` with no full reload. | AC-7 |
| SP-01 | sad path | SOURCE | Empty PA dataset | Mock query return `data.data=[]`. | Section title remains; empty-state/blank list shown without runtime error. | AC-1 |
| SP-02 | sad path | SOURCE | Missing required metric fields | Inject row missing `score` and `paNo`. | Component does not crash; row either omitted or safe fallback rendered; error logged for contract drift. | AC-8 |
| DC-01 | data consistency | SOURCE | Field-level mapping integrity | Feed deterministic payload with known values for all 7 fields. | Rendered metrics line contains exact `vsPlan`, `vsLy`, `plannedActivations`, `toGoIndex`; score badge shows exact numeric score. | AC-3, AC-8 |
| DC-02 | data consistency | SOURCE | Score threshold color boundaries | Run scores 88,89,99,100. | 88=critical, 89/99=warning, 100=good class tokens exactly match threshold rules. | AC-3 |
| API-01 | API integration | SOURCE | Service contract shape test | Call `paSalesPerformanceForHfbQuery` with mock response. | Select function returns only `response.data.data` array preserving order and values. | AC-8 |
| API-02 | API integration | HYBRID | Future endpoint wiring guard | When replacing mock with fetch, assert POST to `/metrics` with `metric=PA_PERFORMANCE`,`level=hfb`,`filters{retailUnitCode,hfbNo}`. | Request body schema matches agreed contract; incompatible schema fails test loudly. | AC-1, AC-8 |
| REG-01 | regression | REAL FE | Existing HFB list + charts unaffected | Visit country->HFB navigation then PA list. | `SalesGraphsRow` still renders both graphs; PA list still navigable. | AC-1, AC-7 |
| A11Y-01 | accessibility | REAL FE | Keyboard-only PA row access | Tab to first PA row and press Enter. | Focus ring visible; Enter triggers same navigation as click; no trap. | AC-7 |
| PERF-01 | performance | HYBRID | Large list render budget | Inject 200 PA rows in mock payload. | First contentful list render <500ms on baseline QA hardware; scroll stays responsive (>45fps). | AC-1 |
| I18N-01 | i18n | SOURCE | Metric text locale safety | Run locale `sv-SE` and `en-US` formatting helpers. | Labels remain translatable; numeric separators follow locale without truncation. | AC-8 |

## 8) Coverage summary
- Planned tests: **12**
- Category distribution: happy path(2), sad path(2), data consistency(2), API integration(2), regression(1), accessibility(1), performance(1), i18n(1)
- AC coverage: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8
