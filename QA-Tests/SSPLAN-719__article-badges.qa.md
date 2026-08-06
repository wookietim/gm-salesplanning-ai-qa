# SSPLAN-719 Test Plan — Article Badges Component

Mode: **test-plan-only** (Bob planning only; Susan execution deferred)  
Ticket: **SSPLAN-719**  
Last Jira sync: 2026-08-04T18:39:41.853+0000  

## 1) Jira snapshot
- Summary: Article Badges Component
- Issue type: Story
- Status: Backlog
- Updated: 2026-08-04T18:39:41.853+0000
- Subtasks: none

## 2) Acceptance criteria (normalized)
- **AC-1** Show `New` badge when SSD is within last 12 weeks.
- **AC-2** Show `BTI` badge when BTI flag is true.
- **AC-3** Render multiple badges side-by-side when multiple conditions match.
- **AC-4** Badges match design and do not overlap.

## 3) Target component/scope
Reusable ArticleBadges component for New/BTI/EDS flags in article list row

## 4) API-agent-style trace (component -> hook -> service -> endpoint -> transform)
- Component scope: **new** `ArticleBadges` reusable UI (not currently in frontend component tree).
- Hook/service path: no dedicated hook/API found for article metadata flags.
- Expected data source path: parent article row provides `salesStartDate`, `isBti`, `isEds` (and future flags).
- Transformation mapping under test: date diff -> `isNew`; boolean flags -> badge list order/styling.
- Backend cross-check: no article metadata endpoint contract found in backend repository; treat as integration gap requiring schema sign-off.

## 5) Top risks/findings
- No article metadata contract currently defined in backend.
- Badge priority/order ambiguity can create unstable snapshots.
- Date-window logic depends on fiscal-week utilities and timezone normalization.

## 6) Assumptions with confidence
- **A-1 (High)**: `New` means SSD within prior 12 fiscal weeks inclusive.
- **A-2 (Medium)**: Badge display order is deterministic: New, BTI, EDS, then future flags.
- **A-3 (Medium)**: All badge labels are translatable display keys.

## 7) Bob test plan matrix
Venue tags: **SOURCE / STORYBOOK / REAL FE / HYBRID**

| ID | Category | Venue | Test | Steps | Measurable assertions | AC trace |
|---|---|---|---|---|---|---|
| HP-01 | happy path | STORYBOOK | New badge condition true | Provide SSD exactly 8 weeks ago. | Badge list contains `New` once; badge style token matches design. | AC-1 |
| HP-02 | happy path | STORYBOOK | BTI badge condition true | Provide `isBti=true`. | Badge list contains `BTI` once with expected styling. | AC-2 |
| SP-01 | sad path | SOURCE | Invalid/missing SSD | Pass null and malformed SSD. | No runtime error; `New` badge omitted deterministically. | AC-1 |
| SP-02 | sad path | SOURCE | Unknown flag keys ignored | Include unsupported badge flags in payload. | Only supported badges render; unknown flags do not break layout. | AC-4 |
| DC-01 | data consistency | SOURCE | 12-week boundary test | Evaluate SSD exactly 12 weeks ago and 12w+1day ago. | First returns `New=true`; second returns `New=false`. | AC-1 |
| DC-02 | data consistency | SOURCE | Multi-badge deduplication | Input repeated true flags from merged sources. | Rendered badges unique by key; order stable. | AC-3 |
| API-01 | API integration | HYBRID | Article metadata field mapping | Validate mapping: `salesStartDate`->new, `isBti`->BTI, `isEds`->EDS. | Each field toggles only its own badge; no cross-field leakage. | AC-1, AC-2 |
| API-02 | API integration | HYBRID | Contract nullability guard | Simulate missing metadata fields from API. | Mapper defaults booleans false and keeps component render-safe. | AC-4 |
| REG-01 | regression | REAL FE | Row layout integrity with 0/1/3 badges | Render article row variants. | No overlap, clipping, or row-height jump >8px across variants. | AC-3, AC-4 |
| A11Y-01 | accessibility | STORYBOOK | Badge semantics | Inspect badges for SR output. | Each badge exposes readable text label; color is not sole indicator. | AC-4 |
| PERF-01 | performance | SOURCE | List-scale badge render | Render 1000 row items in virtualized/mock list. | Badge computation+render completes within baseline threshold (<120ms JS compute). | AC-4 |
| I18N-01 | i18n | SOURCE | Badge label localization | Load non-English locale. | `New/BTI/EDS` labels resolve by i18n keys with fallback behavior verified. | AC-4 |

## 8) Coverage summary
- Planned tests: **12**
- Category distribution: happy path(2), sad path(2), data consistency(2), API integration(2), regression(1), accessibility(1), performance(1), i18n(1)
- AC coverage: AC-1, AC-2, AC-3, AC-4
