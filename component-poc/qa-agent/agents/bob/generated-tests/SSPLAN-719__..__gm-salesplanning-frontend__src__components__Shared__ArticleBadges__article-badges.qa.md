# Bob QA Test Plan - ArticleBadges

- Generated at: 2026-08-17T18:21:23.289Z
- Source component: ../gm-salesplanning-frontend/src/components/Shared/ArticleBadges/article-badges.tsx

## 1. Component Overview

- Component: ArticleBadges
- Purpose: Verify the component behavior, rendering, state transitions, and integration boundaries.
- Route or usage context: Determine from feature usage and parent container.

## 2. Acceptance Criteria Source

- Jira project: SSPLAN
- Jira issue keys: SSPLAN-719
- Extracted criteria:
  - Issue SSPLAN-719: Article Badges Component
  - Acceptance Criteria (derived from description):
  - *User Story:* As an HFB leader I need to know if an article is a new, BTI or other flag.
  - *Description:* This covers the development of a reusable badge component to display strategic classification flags on articles, such as "New", "BTI" (Breath-Taking Item), or "EDS" (End Date Sales).
  - *Background:*
  - Given I am an HFB leader logged into the Sales Planning monitoring tool
  - And I have access to current fiscal year sales data
  - And the Article Badges component is embedded in the article list
  - *Scenario:* Display "New" badge for recently launched articles
  - Given an article has a Sales Start Date within the last 12 weeks
  - When the article is rendered in the list
  - Then I should see a "New" badge next to the article details
  - *Scenario:* Display "BTI" badge for Breath-Taking Items
  - Given an article is flagged as a BTI in the system
  - When the article is rendered in the list
  - Then I should see a "BTI" badge next to the article details
  - *Scenario:* Display multiple badges simultaneously
  - Given an article is both a recently launched "New" item and a "BTI"
  - When the article is rendered in the list
  - Then I should see both the "New" and "BTI" badges displayed side-by-side
  - *Design:* [Article badges component in Figma|https://www.figma.com/design/HdtKcUKqPyPfxr3Er8sStc/Sales-Planning---Spec?node-id=2312-6411&amp;t=XnlRLLiCWynZQ98q-0]
  - !image-2026-08-03-11-41-47-428.png!
  - datacatalog.ingka.com/attribute/7124488/

## 3. Runtime Execution Profile

- Runtime signal: interaction-handlers=0
- Runtime signal: async-data-flow=no
- Runtime signal: state-transitions=no
- Runtime signal: loading-ui=no
- Runtime signal: error-fallback=no
- Runtime signal: network-dependencies=no
- Runtime signal detail: interaction-handler-names=none

## 4. Happy Path Tests

### Test ID: BOB-HP-ARTICL-001

- Title: ArticleBadges renders baseline view with valid defaults
- Priority: High
- Preconditions:
  - Component dependencies are available
  - Baseline data fixture with valid required fields is provided
- Test data:
  - Valid representative payload for all required fields
- Runtime assertions:
- Runtime assertion: interaction-path-covered
- Runtime assertion: state-transition-observed
- Steps:
1. Open the screen where ArticleBadges is rendered with baseline valid data.
2. Wait for initial render to settle and verify primary visual blocks.
3. Confirm no runtime warnings or rendering exceptions are present.
- Expected result:
  - Primary UI renders with expected baseline values.
  - No crash, blank panel, or unhandled error is observed.
- Failure signals:
  - Missing baseline content
  - Runtime exception
  - State does not initialize

### Test ID: BOB-HP-ARTICL-002

- Title: ArticleBadges supports primary interaction updates
- Priority: High
- Preconditions:
  - At least one interactive control is present
- Test data:
  - User input values spanning common edits and toggles
- Runtime assertions:
- Runtime assertion: interaction-path-covered
- Runtime assertion: state-transition-observed
- Steps:
1. Execute the primary interaction path (edit/select/toggle as applicable).
2. Trigger update/submit action for the modified values.
3. Verify downstream UI state reflects the interaction outcome.
- Expected result:
  - Interaction updates are reflected in rendered state.
  - No stale or contradictory values remain in related fields.
- Failure signals:
  - Control does not update
  - State reverts unexpectedly
  - Incorrect dependent values



## 5. Sad Path Tests

### Test ID: BOB-SP-ARTICL-001

- Title: ArticleBadges handles invalid or incomplete input safely
- Priority: High
- Preconditions:
  - Validation or guard behavior is active for bad input
- Test data:
  - Missing required fields
  - Type-mismatched values
  - Out-of-range values
- Runtime assertions:
- Runtime assertion: sad-input-branch-covered
- Runtime assertion: error-or-fallback-observed
- Steps:
1. Render ArticleBadges with incomplete or invalid values.
2. Execute the same interaction flow used for valid input.
3. Observe validation, blocked actions, or fallback messaging.
- Expected result:
  - User receives clear feedback and invalid transition is blocked or safely handled.
  - Component remains stable without misleading success state.
- Failure signals:
  - Silent acceptance of invalid state
  - Unhandled error
  - Inconsistent error messaging

### Test ID: BOB-SP-ARTICL-002

- Title: ArticleBadges preserves consistency across linked fields
- Priority: Medium
- Preconditions:
  - Derived fields or totals exist in the component
- Test data:
  - Input combinations that affect multiple displayed values
- Runtime assertions:
- Runtime assertion: interaction-path-covered
- Runtime assertion: state-transition-observed
- Steps:
1. Apply a change that impacts at least two related fields.
2. Review all dependent values, labels, and aggregates.
3. Repeat with a second data permutation.
- Expected result:
  - All linked values remain logically consistent after each update.
  - No contradictory totals or stale labels remain.
- Failure signals:
  - Derived mismatch
  - Stale dependent value
  - Conflicting displayed totals



## 6. Data Self-Consistency Checks

- Check 1: Values shown in labels, totals, and derived fields are mathematically and logically consistent.
- Check 2: Displayed identifiers, names, and linked entities match the same source record.
- Check 3: Aggregates equal the sum of visible breakdown rows where applicable.
- Check 4: Time range, units, and precision are consistent across all displayed metrics.

## 7. Accessibility Checks

- Keyboard-only navigation reaches all interactive controls in logical order.
- Focus is visible and does not move to hidden or disabled elements.
- Screen-reader labels and landmarks are present and meaningful.
- Error and status messages are announced and not color-only.

## 8. Traceability Matrix

| Criterion ID | Criterion | Covered by Tests |
| --- | --- | --- |
| AC-1 | Issue SSPLAN-719: Article Badges Component | BOB-HP-ARTICL-001, BOB-HP-ARTICL-002, BOB-SP-ARTICL-001, BOB-SP-ARTICL-002, BOB-A11Y-ARTICL-001 |
| AC-2 | Acceptance Criteria (derived from description): | BOB-HP-ARTICL-001, BOB-HP-ARTICL-002, BOB-SP-ARTICL-001, BOB-SP-ARTICL-002, BOB-A11Y-ARTICL-001 |
| AC-3 | *User Story:* As an HFB leader I need to know if an article is a new, BTI or other flag. | BOB-HP-ARTICL-001, BOB-HP-ARTICL-002, BOB-SP-ARTICL-001, BOB-SP-ARTICL-002, BOB-A11Y-ARTICL-001 |
| AC-4 | *Description:* This covers the development of a reusable badge component to display strategic classification flags on articles, such as "New", "BTI" (Breath-Taking Item), or "EDS" (End Date Sales). | BOB-HP-ARTICL-001, BOB-HP-ARTICL-002, BOB-SP-ARTICL-001, BOB-SP-ARTICL-002, BOB-A11Y-ARTICL-001 |
| AC-5 | *Background:* | BOB-HP-ARTICL-001, BOB-HP-ARTICL-002, BOB-SP-ARTICL-001, BOB-SP-ARTICL-002, BOB-A11Y-ARTICL-001 |
| AC-6 | Given I am an HFB leader logged into the Sales Planning monitoring tool | BOB-HP-ARTICL-001, BOB-HP-ARTICL-002, BOB-SP-ARTICL-001, BOB-SP-ARTICL-002, BOB-A11Y-ARTICL-001 |
| AC-7 | And I have access to current fiscal year sales data | BOB-HP-ARTICL-001, BOB-HP-ARTICL-002, BOB-SP-ARTICL-001, BOB-SP-ARTICL-002, BOB-A11Y-ARTICL-001 |
| AC-8 | And the Article Badges component is embedded in the article list | BOB-HP-ARTICL-001, BOB-HP-ARTICL-002, BOB-SP-ARTICL-001, BOB-SP-ARTICL-002, BOB-A11Y-ARTICL-001 |
| AC-9 | *Scenario:* Display "New" badge for recently launched articles | BOB-HP-ARTICL-001, BOB-HP-ARTICL-002, BOB-SP-ARTICL-001, BOB-SP-ARTICL-002, BOB-A11Y-ARTICL-001 |
| AC-10 | Given an article has a Sales Start Date within the last 12 weeks | BOB-HP-ARTICL-001, BOB-HP-ARTICL-002, BOB-SP-ARTICL-001, BOB-SP-ARTICL-002, BOB-A11Y-ARTICL-001 |
| AC-11 | When the article is rendered in the list | BOB-HP-ARTICL-001, BOB-HP-ARTICL-002, BOB-SP-ARTICL-001, BOB-SP-ARTICL-002, BOB-A11Y-ARTICL-001 |
| AC-12 | Then I should see a "New" badge next to the article details | BOB-HP-ARTICL-001, BOB-HP-ARTICL-002, BOB-SP-ARTICL-001, BOB-SP-ARTICL-002, BOB-A11Y-ARTICL-001 |
| AC-13 | *Scenario:* Display "BTI" badge for Breath-Taking Items | BOB-HP-ARTICL-001, BOB-HP-ARTICL-002, BOB-SP-ARTICL-001, BOB-SP-ARTICL-002, BOB-A11Y-ARTICL-001 |
| AC-14 | Given an article is flagged as a BTI in the system | BOB-HP-ARTICL-001, BOB-HP-ARTICL-002, BOB-SP-ARTICL-001, BOB-SP-ARTICL-002, BOB-A11Y-ARTICL-001 |
| AC-15 | When the article is rendered in the list | BOB-HP-ARTICL-001, BOB-HP-ARTICL-002, BOB-SP-ARTICL-001, BOB-SP-ARTICL-002, BOB-A11Y-ARTICL-001 |
| AC-16 | Then I should see a "BTI" badge next to the article details | BOB-HP-ARTICL-001, BOB-HP-ARTICL-002, BOB-SP-ARTICL-001, BOB-SP-ARTICL-002, BOB-A11Y-ARTICL-001 |
| AC-17 | *Scenario:* Display multiple badges simultaneously | BOB-HP-ARTICL-001, BOB-HP-ARTICL-002, BOB-SP-ARTICL-001, BOB-SP-ARTICL-002, BOB-A11Y-ARTICL-001 |
| AC-18 | Given an article is both a recently launched "New" item and a "BTI" | BOB-HP-ARTICL-001, BOB-HP-ARTICL-002, BOB-SP-ARTICL-001, BOB-SP-ARTICL-002, BOB-A11Y-ARTICL-001 |
| AC-19 | When the article is rendered in the list | BOB-HP-ARTICL-001, BOB-HP-ARTICL-002, BOB-SP-ARTICL-001, BOB-SP-ARTICL-002, BOB-A11Y-ARTICL-001 |
| AC-20 | Then I should see both the "New" and "BTI" badges displayed side-by-side | BOB-HP-ARTICL-001, BOB-HP-ARTICL-002, BOB-SP-ARTICL-001, BOB-SP-ARTICL-002, BOB-A11Y-ARTICL-001 |
| AC-21 | *Design:* [Article badges component in Figma\|https://www.figma.com/design/HdtKcUKqPyPfxr3Er8sStc/Sales-Planning---Spec?node-id=2312-6411&amp;t=XnlRLLiCWynZQ98q-0] | BOB-HP-ARTICL-001, BOB-HP-ARTICL-002, BOB-SP-ARTICL-001, BOB-SP-ARTICL-002, BOB-A11Y-ARTICL-001 |
| AC-22 | !image-2026-08-03-11-41-47-428.png! | BOB-HP-ARTICL-001, BOB-HP-ARTICL-002, BOB-SP-ARTICL-001, BOB-SP-ARTICL-002, BOB-A11Y-ARTICL-001 |
| AC-23 | datacatalog.ingka.com/attribute/7124488/ | BOB-HP-ARTICL-001, BOB-HP-ARTICL-002, BOB-SP-ARTICL-001, BOB-SP-ARTICL-002, BOB-A11Y-ARTICL-001 |

## 9. Risks, Assumptions, Out of Scope

- Risks:
  - Jira criteria can be incomplete without direct issue content.
  - Shared component behavior may be influenced by parent context not covered in isolation.
- Assumptions:
  - This plan covers component-level validation; route-level workflows are validated separately.
  - Test environments provide stable mock data and deterministic responses.
- Out of scope:
  - Full end-to-end authentication flows unless explicitly requested.
