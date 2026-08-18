# Bob QA Test Plan - SalesByWeek

- Generated at: 2026-08-18T13:46:07.207Z
- Source component: ../gm-salesplanning-frontend/src/components/Shared/DashboardComponents/GraphComponents/SalesByWeek/sales-by-week.tsx

## 1. Component Overview

- Component: SalesByWeek
- Purpose: Verify the component behavior, rendering, state transitions, and integration boundaries.
- Route or usage context: Determine from feature usage and parent container.

## 2. Acceptance Criteria Source

- Jira project: SSPLAN
- Jira issue keys: SSPLAN-691
- Extracted criteria:
  - Issue SSPLAN-691: Segmented Control QTY/Price Toggle
  - Acceptance Criteria (derived from description):
  - *Feature:* Segmented Control to toggle data between QTY and Sales
  - *User Story:* As an HFB leader I want the option to toggle my data view by QTY Index, QTY, Sales Index, and Sales, so that I may have flexibility in monitoring sales performance.
  - *Background:*
  - *Given* I am logged into the sales planning dashboard
  - *And* The Weekly Sales Graph is visible
  - *And* All data sources(Actual sales, Goal, Last Year sales, Financial Forecast, Demand plan) are loaded ({color:#00875a}Or Mocked until Data is available{color})
  - *Scenario 1:* Display QTY Index view
  - *When* I select "QTY Index" from the segmented control
  - *Then* The sales graph displays QTY index data
  - *And* the graph shows QTY Index values from Actual Sales
  - *And* the graph shows QTY Index Values from Goal {color:#00875a}- Mocked until Data is available{color}
  - *And* the graph shows QTY Index Values from Last Year Sales
  - *And* the graph shows QTY Index Values from Financial Forecast
  - *And* the graph shows QTY Index Values from Demand Plan {color:#00875a}- Mocked until Data is available{color}
  - *And* the segmented control "QTY Index" button is highlighted as active
  - *Scenario 2:* Display QTY (pieces) view
  - *When* I select "QTY" from the segmented control
  - *Then* The sales graph displays QTY data
  - *And* the graph shows QTY Values from Actual Sales
  - *And* the graph shows QTY Values from Goal {color:#00875a}- Mocked until Data is available{color}
  - *And* the graph shows QTY Values from Last Year Sales
  - *And* the graph shows QTY Values from Financial Forecast
  - *And* the graph shows QTY Values from Demand Plan {color:#00875a}- Mocked until Data is available{color}
  - *And* the segmented control "QTY" button is highlighted as active
  - *Scenario 3:* Display sales Index view
  - *When* I select "Sales Index" from the segmented control
  - *Then* The sales graph displays Sales index data
  - *And* the graph shows sales Index Values from Actual Sales
  - *And* the graph shows sales Index Values from Goal
  - *And* the graph shows sales Index Values from Last Year Sales
  - *And* the graph shows sales Index Values from Demand Plan {color:#00875a}- Mocked until Data is available{color}
  - *And* the segmented control "sales Index" button is highlighted as active
  - *Scenario 4:* Display sales ($$) view
  - *When* I select "Sales" from the segmented control
  - *Then* The sales graph displays Sales ($$) actuals data
  - *And* the graph shows sales Values from Actual Sales
  - *And* the graph shows sales Values from Goal
  - *And* the graph shows sales Values from Last Year Sales
  - *And* the graph shows sales Values from Demand Plan {color:#00875a}- Mocked until Data is available{color}
  - *And* the segmented control "sales" button is highlighted as active
  - *Figma Design:* [Solo Component|https://www.figma.com/design/HdtKcUKqPyPfxr3Er8sStc/Sales-Planning---Spec?node-id=2189-5328&t=PXLklxgT5Ss1ZCW7-4] - [Component in Graph|https://www.figma.com/design/HdtKcUKqPyPfxr3Er8sStc/Sales-Planning---Spec?node-id=3006-10198&t=PXLklxgT5Ss1ZCW7-4]
  - !image-2026-07-21-15-43-00-674.png!
  - *Note:* Data validation will occur in context with overall component feature. For example: Sales by Week(Country-HFB views), PA Performance, News, Commercial Activities, etc.

## 3. Runtime Execution Profile

- Runtime signal: interaction-handlers=1
- Runtime signal: async-data-flow=no
- Runtime signal: state-transitions=no
- Runtime signal: loading-ui=yes
- Runtime signal: error-fallback=yes
- Runtime signal: network-dependencies=no
- Runtime signal detail: interaction-handler-names=onChange

## 4. Happy Path Tests

### Test ID: BOB-HP-SALESB-001

- Title: SalesByWeek renders baseline view with valid defaults
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
1. Open the screen where SalesByWeek is rendered with baseline valid data.
2. Wait for initial render to settle and verify primary visual blocks.
3. Confirm no runtime warnings or rendering exceptions are present.
- Expected result:
  - Primary UI renders with expected baseline values.
  - No crash, blank panel, or unhandled error is observed.
- Failure signals:
  - Missing baseline content
  - Runtime exception
  - State does not initialize

### Test ID: BOB-HP-SALESB-002

- Title: SalesByWeek supports primary interaction updates
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

### Test ID: BOB-SP-SALESB-001

- Title: SalesByWeek handles invalid or incomplete input safely
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
1. Render SalesByWeek with incomplete or invalid values.
2. Execute the same interaction flow used for valid input.
3. Observe validation, blocked actions, or fallback messaging.
- Expected result:
  - User receives clear feedback and invalid transition is blocked or safely handled.
  - Component remains stable without misleading success state.
- Failure signals:
  - Silent acceptance of invalid state
  - Unhandled error
  - Inconsistent error messaging

### Test ID: BOB-SP-SALESB-002

- Title: SalesByWeek preserves consistency across linked fields
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
| AC-1 | Issue SSPLAN-691: Segmented Control QTY/Price Toggle | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-2 | Acceptance Criteria (derived from description): | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-3 | *Feature:* Segmented Control to toggle data between QTY and Sales | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-4 | *User Story:* As an HFB leader I want the option to toggle my data view by QTY Index, QTY, Sales Index, and Sales, so that I may have flexibility in monitoring sales performance. | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-5 | *Background:* | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-6 | *Given* I am logged into the sales planning dashboard | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-7 | *And* The Weekly Sales Graph is visible | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-8 | *And* All data sources(Actual sales, Goal, Last Year sales, Financial Forecast, Demand plan) are loaded ({color:#00875a}Or Mocked until Data is available{color}) | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-9 | *Scenario 1:* Display QTY Index view | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-10 | *When* I select "QTY Index" from the segmented control | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-11 | *Then* The sales graph displays QTY index data | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-12 | *And* the graph shows QTY Index values from Actual Sales | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-13 | *And* the graph shows QTY Index Values from Goal {color:#00875a}- Mocked until Data is available{color} | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-14 | *And* the graph shows QTY Index Values from Last Year Sales | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-15 | *And* the graph shows QTY Index Values from Financial Forecast | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-16 | *And* the graph shows QTY Index Values from Demand Plan {color:#00875a}- Mocked until Data is available{color} | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-17 | *And* the segmented control "QTY Index" button is highlighted as active | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-18 | *Scenario 2:* Display QTY (pieces) view | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-19 | *When* I select "QTY" from the segmented control | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-20 | *Then* The sales graph displays QTY data | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-21 | *And* the graph shows QTY Values from Actual Sales | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-22 | *And* the graph shows QTY Values from Goal {color:#00875a}- Mocked until Data is available{color} | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-23 | *And* the graph shows QTY Values from Last Year Sales | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-24 | *And* the graph shows QTY Values from Financial Forecast | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-25 | *And* the graph shows QTY Values from Demand Plan {color:#00875a}- Mocked until Data is available{color} | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-26 | *And* the segmented control "QTY" button is highlighted as active | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-27 | *Scenario 3:* Display sales Index view | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-28 | *When* I select "Sales Index" from the segmented control | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-29 | *Then* The sales graph displays Sales index data | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-30 | *And* the graph shows sales Index Values from Actual Sales | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-31 | *And* the graph shows sales Index Values from Goal | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-32 | *And* the graph shows sales Index Values from Last Year Sales | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-33 | *And* the graph shows sales Index Values from Demand Plan {color:#00875a}- Mocked until Data is available{color} | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-34 | *And* the segmented control "sales Index" button is highlighted as active | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-35 | *Scenario 4:* Display sales ($$) view | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-36 | *When* I select "Sales" from the segmented control | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-37 | *Then* The sales graph displays Sales ($$) actuals data | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-38 | *And* the graph shows sales Values from Actual Sales | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-39 | *And* the graph shows sales Values from Goal | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-40 | *And* the graph shows sales Values from Last Year Sales | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-41 | *And* the graph shows sales Values from Demand Plan {color:#00875a}- Mocked until Data is available{color} | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-42 | *And* the segmented control "sales" button is highlighted as active | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-43 | *Figma Design:* [Solo Component\|https://www.figma.com/design/HdtKcUKqPyPfxr3Er8sStc/Sales-Planning---Spec?node-id=2189-5328&t=PXLklxgT5Ss1ZCW7-4] - [Component in Graph\|https://www.figma.com/design/HdtKcUKqPyPfxr3Er8sStc/Sales-Planning---Spec?node-id=3006-10198&t=PXLklxgT5Ss1ZCW7-4] | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-44 | !image-2026-07-21-15-43-00-674.png! | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |
| AC-45 | *Note:* Data validation will occur in context with overall component feature. For example: Sales by Week(Country-HFB views), PA Performance, News, Commercial Activities, etc. | BOB-HP-SALESB-001, BOB-HP-SALESB-002, BOB-SP-SALESB-001, BOB-SP-SALESB-002, BOB-A11Y-SALESB-001, BOB-STATE-SALESB-001 |

## 9. Risks, Assumptions, Out of Scope

- Risks:
  - Jira criteria can be incomplete without direct issue content.
  - Shared component behavior may be influenced by parent context not covered in isolation.
- Assumptions:
  - This plan covers component-level validation; route-level workflows are validated separately.
  - Test environments provide stable mock data and deterministic responses.
- Out of scope:
  - Full end-to-end authentication flows unless explicitly requested.
