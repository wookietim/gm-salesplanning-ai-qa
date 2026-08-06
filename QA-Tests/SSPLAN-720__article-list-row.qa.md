# SSPLAN-720 Test Plan — Article List Row Component

Mode: **test-plan-only** (Bob planning only; Susan execution deferred)  
Ticket: **SSPLAN-720**  
Last Jira sync: 2026-08-04T18:45:45.519+0000  

## 1) Jira snapshot
- Summary: Article List Row Component
- Issue type: Story
- Status: Backlog
- Updated: 2026-08-04T18:45:45.519+0000
- Subtasks: none

## 2) Acceptance criteria (normalized)
- **AC-1** Row shows article name and ID.
- **AC-2** Row shows metrics cell row.
- **AC-3** Row includes News Readiness component.
- **AC-4** Row includes Article Badges component.
- **AC-5** Row includes News Status component.
- **AC-6** Clicking row expands to article detail.
- **AC-7** Expanded row shows article Weekly Sales Chart module.

## 3) Target component/scope
Article List Row container composing metrics row + readiness + badges + news status + expandable weekly chart

## 4) API-agent-style trace (component -> hook -> service -> endpoint -> transform)
- Component scope: **new** `ArticleListRow` composite component (not present yet).
- Expected composition chain: `ArticleListRow` -> `MetricsCellRow` + `NewsReadinessLine` + `ArticleBadges` + `NewsStatus` + expandable `ArticleWeeklySalesChart`.
- Closest existing hook/API path for weekly module: `useSalesByWeek` -> `fetchSalesByWeek` -> `POST /metrics` metric `WEEKLY_SALES_TREND`.
- Transformation mapping under test: article DTO fields map to subcomponents (`articleId`,`articleName`,`goal`,`demandPlan`,`ly`,`toGo`, readiness booleans, badge flags, status inputs).
- Backend cross-check: no ART level in metric backend and no article list endpoint found; integration contract required for full implementation.

## 5) Top risks/findings
- Composite row depends on four subcomponents with independent contracts not yet in source tree.
- Expand/collapse state can conflict with list virtualization and keyboard focus.
- Weekly chart integration blocked by missing article-level metric contract.

## 6) Assumptions with confidence
- **A-1 (Medium)**: Article row receives complete article DTO from parent PA-level article list endpoint (not yet implemented).
- **A-2 (Medium)**: Row expands inline (accordion style) without route transition.
- **A-3 (Low)**: Weekly chart uses same metric selector semantics as existing SalesByWeek component.

## 7) Bob test plan matrix
Venue tags: **SOURCE / STORYBOOK / REAL FE / HYBRID**

| ID | Category | Venue | Test | Steps | Measurable assertions | AC trace |
|---|---|---|---|---|---|---|
| HP-01 | happy path | STORYBOOK | Row baseline render | Provide full article fixture with all child states present. | Name+ID visible; metrics cell text shows all 4 KPI fields; badges/readiness/status visible. | AC-1, AC-2, AC-3, AC-4, AC-5 |
| HP-02 | happy path | REAL FE | Expand on row click | Click row container once. | Row expands within 300ms and mounts weekly chart region with chart title. | AC-6, AC-7 |
| SP-01 | sad path | SOURCE | Partial DTO handling | Omit optional fields (`toGo`,`demandPlan`,`readinessFlags`). | Row renders fallback placeholders; no throw. | AC-2, AC-3 |
| SP-02 | sad path | REAL FE | Weekly chart API failure in expanded state | Force weekly API 500 after expand. | Expanded details show localized error state; row remains expanded and usable. | AC-7 |
| DC-01 | data consistency | SOURCE | Field-level prop plumbing | Snapshot map of row props to child props. | Each child receives exact expected field names/values with no silent renaming. | AC-2..AC-5 |
| DC-02 | data consistency | SOURCE | Expand state idempotence | Double-click same row and toggle another row. | Only one expanded row at a time (if accordion spec) or stable multi-open behavior documented; no orphan chart. | AC-6 |
| API-01 | API integration | HYBRID | Article-to-chart request mapping | Expand row and inspect weekly request payload. | Payload includes article scope identifiers (artNo + context filters) once contract lands. | AC-7 |
| API-02 | API integration | HYBRID | Response-to-UI metric mapping | Inject known weekly payload values. | Chart point labels and row summary values reflect transformed numbers exactly. | AC-2, AC-7 |
| REG-01 | regression | REAL FE | PA navigation unaffected | Navigate list and expand/collapse repeatedly. | Row interactions do not break PA page routing/back button behavior. | AC-6 |
| A11Y-01 | accessibility | REAL FE | Keyboard expand semantics | Focus row, press Enter/Space. | `aria-expanded` toggles correctly; expanded panel is associated via `aria-controls`. | AC-6 |
| PERF-01 | performance | HYBRID | Expansion latency budget | Measure click->chart-mounted time for list of 50 rows. | p95 expansion latency <250ms without blocking scroll. | AC-6, AC-7 |
| I18N-01 | i18n | STORYBOOK | Row label localization | Render in non-English locale. | Static labels (vs plan/vs LY/to-go/etc.) come from translation keys and remain aligned. | AC-2 |

## 8) Coverage summary
- Planned tests: **12**
- Category distribution: happy path(2), sad path(2), data consistency(2), API integration(2), regression(1), accessibility(1), performance(1), i18n(1)
- AC coverage: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7
