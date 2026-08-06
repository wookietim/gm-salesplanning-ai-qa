# SSPLAN-714 Test Plan — Create Blank Card Component

Mode: **test-plan-only** (Bob planning only; Susan execution deferred)  
Ticket: **SSPLAN-714**  
Last Jira sync: 2026-08-06T17:27:54.087+0000

## 1) Jira snapshot
- Summary: Create Blank Card Component
- Issue type: Task
- Status: In Progress
- Updated: 2026-08-06T17:27:54.087+0000
- Subtasks: none

## 2) Acceptance criteria (normalized)
- **AC-1** Create Blank Card Component renders according to design and required states.
- **AC-2** Create Blank Card Component handles empty/error data safely without UI breakage.
- **AC-3** Create Blank Card Component uses correct filters/parameters for selected hierarchy level.
- **AC-4** Create Blank Card Component remains accessible and localized with existing dashboard patterns.

## 3) Target component/scope
Dashboard feature behavior and integration

## 4) API-agent-style trace (component -> hook -> service -> endpoint -> transform)
- Component baseline: dashboard shared component route for this feature scope.
- Hook/service baseline: TanStack query service in `src/services/metrics`.
- Endpoint baseline: backend metrics/hierarchy APIs under `/metrics`.
- Backend chain: controller -> dispatcher -> handler -> repository.
- Transform focus: mapping payload fields to display model and fallback states.

## 5) Top risks/findings
- Feature may depend on contracts still under active change in sprint.
- Cross-component regressions possible due shared dashboard modules.

## 6) Assumptions with confidence
- **A-1 (Medium): Existing routing and auth flows remain stable.**
- **A-2 (Medium): Required data fields are present in metric payloads.**

## 7) Bob test plan matrix
Venue tags: **SOURCE / STORYBOOK / REAL FE / HYBRID**

| ID | Category | Venue | Test | Steps | Measurable assertions | AC trace |
|---|---|---|---|---|---|---|
| HP-01 | happy path | REAL FE | Primary Create Blank Card Component render path | Open target route with valid fixture/user context. | Expected primary content appears with correct title/value labels and no console/runtime error. | AC-1, AC-2 |
| HP-02 | happy path | REAL FE | Interaction path for Create Blank Card Component | Execute expected user interaction (navigate/select/toggle/expand). | State transition completes within 1 click/gesture and target view/data updates correctly. | AC-2, AC-3 |
| SP-01 | sad path | HYBRID | Empty-data fallback | Return empty dataset or no eligible rows. | Fallback/empty message is shown and layout remains stable (no broken placeholders). | AC-2, AC-4 |
| SP-02 | sad path | HYBRID | Error-state resilience | Force 4xx/5xx from dependent endpoint/service. | Error state is user-visible, recoverable on retry, and does not hard-crash route. | AC-4 |
| DC-01 | data consistency | SOURCE | Numeric transform validation | Run representative fixture values through transform/mapping layer. | Scaled and raw fields retain expected precision (sales scaled where applicable, index untouched). | AC-3 |
| DC-02 | data consistency | SOURCE | Ordering and identity consistency | Feed out-of-order and duplicate-key fixture records. | Output order and uniqueness follow deterministic rule (documented sort/dedupe behavior). | AC-3, AC-4 |
| API-01 | API integration | SOURCE | Request contract validation | Inspect generated request payload and query params for this feature path. | Metric/level/filters are populated exactly as expected for selected hierarchy context. | AC-3, AC-4 |
| API-02 | API integration | HYBRID | Response schema drift guard | Compare required FE keys against backend response schema fixture. | Missing or renamed required keys fail with explicit diff and actionable message. | AC-1, AC-4 |
| REG-01 | regression | REAL FE | Neighbor-module non-regression | Exercise adjacent dashboard module in same route family. | Existing module behavior remains unchanged after feature integration. | AC-4 |
| A11Y-01 | accessibility | REAL FE | Keyboard + semantic accessibility | Tab through interactive controls and inspect role/name semantics. | All interactives reachable by keyboard and exposed names/roles are meaningful. | AC-1, AC-4 |
| PERF-01 | performance | HYBRID | Render/interaction budget | Profile initial render and first interaction under realistic payload size. | Initial render under 300ms and interaction response under 100ms on baseline environment. | AC-1, AC-4 |
| I18N-01 | i18n | SOURCE | Localization and formatting | Switch locale and validate translated strings/number formatting. | No hard-coded English labels in feature path; numeric/date formats follow locale. | AC-2, AC-4 |

## 8) Coverage summary
- Planned tests: **12**
- Category distribution: happy path(2), sad path(2), data consistency(2), API integration(2), regression(1), accessibility(1), performance(1), i18n(1)
- AC coverage: AC-1, AC-2, AC-3, AC-4
