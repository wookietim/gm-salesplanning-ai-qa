# SSPLAN-722 Test Plan — View More - Component

Mode: **test-plan-only** (Bob planning only; Susan execution deferred)  
Ticket: **SSPLAN-722**  
Last Jira sync: 2026-08-04T18:43:22.345+0000  

## 1) Jira snapshot
- Summary: View More - Component
- Issue type: Story
- Status: Backlog
- Updated: 2026-08-04T18:43:22.345+0000
- Subtasks: none

## 2) Acceptance criteria (normalized)
- **AC-1** Hide footer when list has <=10 items.
- **AC-2** When list has >=11 items, initially show first 10 and visible View More footer.
- **AC-3** Clicking View More expands next set without page reload.
- **AC-4** Expansion follows design and remains smooth.

## 3) Target component/scope
Progressive article list expansion footer (View More) in PA article list

## 4) API-agent-style trace (component -> hook -> service -> endpoint -> transform)
- Component scope: **new** `ViewMoreFooter` + pagination state in article list container.
- Hook/service path: list likely sourced by upcoming article list hook; no existing hook/service found in repo.
- Transformation mapping under test: list length and `visibleCount` state drive footer visibility and row slicing.
- API cross-check: if list is server-paginated later, ensure current client-side progressive expansion still respects local UX contract.

## 5) Top risks/findings
- No article list container implementation yet.
- Potential conflict between client-side slicing and future backend pagination.
- Expansion button can become inaccessible if not keyboard-focusable or if focus jumps.

## 6) Assumptions with confidence
- **A-1 (High)**: Initial visible count is exactly 10 items.
- **A-2 (Medium)**: Each click reveals next fixed chunk (default 10) unless fewer remain.
- **A-3 (Medium)**: Footer disappears automatically when all items are visible.

## 7) Bob test plan matrix
Venue tags: **SOURCE / STORYBOOK / REAL FE / HYBRID**

| ID | Category | Venue | Test | Steps | Measurable assertions | AC trace |
|---|---|---|---|---|---|---|
| HP-01 | happy path | STORYBOOK | Footer hidden at <=10 | Fixture list lengths 0,1,10. | No View More button rendered; all items visible. | AC-1 |
| HP-02 | happy path | REAL FE | Footer visible at >=11 and expands | Fixture list length 25, initial render then click once. | Initially 10 rows + View More; after click exactly 20 rows and no page reload/navigation. | AC-2, AC-3 |
| SP-01 | sad path | SOURCE | Negative/invalid list length state | Force `visibleCount` > total or <0 via reducer edge case. | State clamped to [0,total]; UI remains stable. | AC-4 |
| SP-02 | sad path | REAL FE | Rapid double-click | Double-click View More quickly. | No duplicate rows; count increments once per click transaction deterministically. | AC-3 |
| DC-01 | data consistency | SOURCE | Slice index correctness | List length 25; perform 0/1/2 clicks. | Visible IDs are [0..9], [0..19], [0..24] exactly; no skips/dupes. | AC-2, AC-3 |
| DC-02 | data consistency | SOURCE | Footer lifecycle | At full expansion boundary. | Footer hides exactly when `visibleCount >= totalCount`. | AC-4 |
| API-01 | API integration | HYBRID | Client expansion with static fetched list | Fetch complete list once then expand locally. | No additional network calls on View More clicks in MVP mode. | AC-3 |
| API-02 | API integration | HYBRID | Future cursor mode compatibility | Simulate paged API mode flag. | View More triggers one fetch per click with correct cursor and appends unique rows. | AC-3 |
| REG-01 | regression | REAL FE | Row click behavior remains intact after expansion | Expand then click row near boundary (10/11). | Row expand/navigation behavior identical pre/post View More. | AC-3 |
| A11Y-01 | accessibility | REAL FE | Keyboard activation and focus retention | Activate View More via keyboard. | Button reachable by Tab, Enter/Space works, focus remains predictable post-expand. | AC-3 |
| PERF-01 | performance | HYBRID | Expand throughput under long list | List size 500; expand until full. | Each expand action commits in <100ms and no long frame drops (<45fps). | AC-4 |
| I18N-01 | i18n | SOURCE | Localized CTA text | Switch locale to non-English. | View More label pulls from i18n key and truncation-safe for longer translations. | AC-4 |

## 8) Coverage summary
- Planned tests: **12**
- Category distribution: happy path(2), sad path(2), data consistency(2), API integration(2), regression(1), accessibility(1), performance(1), i18n(1)
- AC coverage: AC-1, AC-2, AC-3, AC-4
