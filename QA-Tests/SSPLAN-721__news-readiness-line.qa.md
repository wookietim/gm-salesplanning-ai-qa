# SSPLAN-721 Test Plan — News Readiness Line

Mode: **test-plan-only** (Bob planning only; Susan execution deferred)  
Ticket: **SSPLAN-721**  
Last Jira sync: 2026-08-04T18:34:34.696+0000  

## 1) Jira snapshot
- Summary: News Readiness Line
- Issue type: Story
- Status: Backlog
- Updated: 2026-08-04T18:34:34.696+0000
- Subtasks: none

## 2) Acceptance criteria (normalized)
- **AC-1** If all 5 checks true, show Ready to Sell in green.
- **AC-2** Passed checks render checkmark icon.
- **AC-3** If any check false, show Not Ready to Sell in red.
- **AC-4** Failed checks render X icon.

## 3) Target component/scope
Readiness checklist strip with Ready/Not Ready state and per-check pass/fail icons

## 4) API-agent-style trace (component -> hook -> service -> endpoint -> transform)
- Component scope: **new** `NewsReadinessLine` component (not yet present).
- Hook/service path: no existing readiness hook/service discovered in frontend metrics services.
- Expected data contract: readiness payload with 5 boolean checks and optional labels from article operational data source.
- Transformation mapping under test: `checks[] -> pass/fail icon set`, aggregate state `allTrue ? ready : notReady`.
- Backend cross-check: no readiness endpoint/handler currently found; this plan includes contract-first API tests for upcoming implementation.

## 5) Top risks/findings
- Missing readiness API contract and field names.
- Icon-only communication could fail accessibility if text labels absent.
- All/any logic may be misapplied if tri-state/null booleans appear.

## 6) Assumptions with confidence
- **A-1 (High)**: Exactly 5 readiness checks are rendered for MVP.
- **A-2 (Medium)**: Null/unknown check values are treated as false for safety.
- **A-3 (Medium)**: Component will be embedded inside ArticleListRow and inherits article context.

## 7) Bob test plan matrix
Venue tags: **SOURCE / STORYBOOK / REAL FE / HYBRID**

| ID | Category | Venue | Test | Steps | Measurable assertions | AC trace |
|---|---|---|---|---|---|---|
| HP-01 | happy path | STORYBOOK | All checks pass | Provide 5/5 true checks fixture. | Header state text = `Ready to Sell`; status indicator color = green; 5 checkmark icons shown. | AC-1, AC-2 |
| HP-02 | happy path | REAL FE | One or more checks fail | Provide fixture with at least one false. | Header = `Not Ready to Sell`; failed checks show X icon and passed checks keep checkmarks. | AC-3, AC-4 |
| SP-01 | sad path | SOURCE | Null readiness array | Input `checks=null`. | Component renders deterministic fallback (`Not Ready` + 0 checks) without crash. | AC-3 |
| SP-02 | sad path | SOURCE | Unexpected check payload shape | Input objects missing `value` or `label`. | Component skips malformed checks and logs schema warning once. | AC-4 |
| DC-01 | data consistency | SOURCE | Aggregate rule correctness | Run permutations with 0..5 true checks. | Only 5 true returns ready=true; all other permutations return ready=false. | AC-1, AC-3 |
| DC-02 | data consistency | SOURCE | Per-check icon mapping | For each check value true/false/null. | true->check icon, false/null->X icon consistently. | AC-2, AC-4 |
| API-01 | API integration | HYBRID | Readiness contract mapping | Mock API response fields to UI model. | Exactly five checks mapped by key, preserving order from contract. | AC-2, AC-4 |
| API-02 | API integration | HYBRID | Contract version guard | Inject unknown additional checks from API. | Component handles extras via overflow design or truncation rule; no layout break. | AC-4 |
| REG-01 | regression | REAL FE | Integration with row expansion | Toggle row expanded/collapsed while readiness visible. | Readiness state persists and does not remount with stale status. | AC-1, AC-3 |
| A11Y-01 | accessibility | STORYBOOK | Non-color readiness semantics | Audit ARIA/text output. | Status includes text phrase (`Ready`/`Not Ready`) and check labels, not color-only cues. | AC-1..AC-4 |
| PERF-01 | performance | SOURCE | Bulk readiness render | Render 500 readiness lines in list. | Initial render <120ms JS compute; no long tasks >50ms. | AC-1..AC-4 |
| I18N-01 | i18n | SOURCE | Check label localization | Switch locale pack. | Status and check labels resolved through i18n keys with fallback to default language. | AC-1..AC-4 |

## 8) Coverage summary
- Planned tests: **12**
- Category distribution: happy path(2), sad path(2), data consistency(2), API integration(2), regression(1), accessibility(1), performance(1), i18n(1)
- AC coverage: AC-1, AC-2, AC-3, AC-4
