# SSPLAN-698__real-fe-storybook__breadcrumbs.qa.md

**Ticket**: SSPLAN-698  
**Component**: Breadcrumbs  
**Test Plan Version**: 1.0  
**Date Created**: 2026-08-05  
**Test Executor**: Susan (QA Agent)  

---

## 1. Test Overview

### Scope
- Breadcrumb component behavior across 3 navigation levels (Region, HFB, PA)
- Visual fidelity and accessibility compliance
- Link navigation and router integration
- Integration with NavigationBar component
- Storybook and real FE testing

### Test Coverage Areas
1. **Visual/UI Tests** (Storybook): Layout, typography, styling, separators
2. **Functional Tests** (Storybook + Real FE): Links, navigation, state management
3. **Accessibility Tests** (Storybook + Real FE): WCAG AA compliance, keyboard nav, screen readers
4. **Integration Tests** (Real FE): Cross-page navigation, data flow
5. **Edge Cases**: Invalid inputs, null values, special characters

### Validation Venues
- **STORYBOOK**: https://storybook.salesplanning.ingka.com/ (Path: Shared/DashboardComponents/Breadcrumbs)
- **REAL FE**: Dev server + integration testing
- **UNIT TESTS**: Vitest (already passing)

---

## 2. Test Cases - Storybook Venue

### Category A: Visual & Layout Tests

#### TC-A-001: RegionOnly Story - Visual Rendering
- **Venue**: STORYBOOK
- **Path**: Shared/DashboardComponents/Breadcrumbs > RegionOnly
- **Props**: `region: 'se'`
- **Expected Behavior**:
  - Single breadcrumb item displayed
  - Text reads "SE" (uppercase)
  - Item rendered as clickable link
  - No HFB or PA text visible
  - Font size: 0.75rem (12px)
  - No separators displayed (only 1 item)
- **Test Steps**:
  1. Navigate to Storybook RegionOnly story
  2. Inspect breadcrumb element
  3. Verify visual appearance
- **Acceptance Criteria**: ✓ Single link displays, ✓ Text is "SE", ✓ Correct font size

---

#### TC-A-002: HfbOnly Story - Visual Rendering
- **Venue**: STORYBOOK
- **Path**: Shared/DashboardComponents/Breadcrumbs > HfbOnly
- **Props**: `region: 'se'`, `hfbId: '01'`
- **Expected Behavior**:
  - Two breadcrumb items displayed
  - First item: "SE" (link)
  - Separator (›) between items
  - Second item: "HFB 01" (plain text, not clickable)
  - Separator color matches design token ($colour-static-black)
  - Layout wraps if narrow
- **Test Steps**:
  1. Navigate to Storybook HfbOnly story
  2. Inspect breadcrumb items and separator
  3. Verify visual hierarchy
- **Acceptance Criteria**: ✓ Two items visible, ✓ Separator displays, ✓ HFB is plain text

---

#### TC-A-003: HfbAndProductArea Story - Visual Rendering
- **Venue**: STORYBOOK
- **Path**: Shared/DashboardComponents/Breadcrumbs > HfbAndProductArea
- **Props**: `region: 'se'`, `hfbId: '01'`, `paId: '05'`
- **Expected Behavior**:
  - Three breadcrumb items displayed
  - First item: "SE" (link)
  - Second item: "HFB 01" (link)
  - Third item: "PA 05" (plain text)
  - Two separators (›) between items
  - All separators visible and properly spaced
- **Test Steps**:
  1. Navigate to Storybook HfbAndProductArea story
  2. Inspect all three breadcrumb items
  3. Verify separator placement
  4. Check text content
- **Acceptance Criteria**: ✓ Three items visible, ✓ Two separators, ✓ Correct text labels

---

### Category B: Link Functionality Tests

#### TC-B-001: RegionOnly - Link Href Validation
- **Venue**: STORYBOOK
- **Path**: Shared/DashboardComponents/Breadcrumbs > RegionOnly
- **Props**: `region: 'se'`
- **Expected Behavior**:
  - Link element exists
  - Link href attribute = `/region-dashboard/se`
  - Link is underlined or has hover state
  - Tab focus includes this link
- **Test Steps**:
  1. Open Storybook RegionOnly story
  2. Inspect the link element (right-click > Inspect)
  3. Verify href attribute
  4. Tab to the link and verify focus
- **Acceptance Criteria**: ✓ href = `/region-dashboard/se`, ✓ Focus visible, ✓ Underlined

---

#### TC-B-002: HfbOnly - Region Link Href & HFB Non-Link
- **Venue**: STORYBOOK
- **Path**: Shared/DashboardComponents/Breadcrumbs > HfbOnly
- **Props**: `region: 'se'`, `hfbId: '01'`
- **Expected Behavior**:
  - First item (SE) is a link with href `/region-dashboard/se`
  - Second item (HFB 01) is NOT a link (plain `<span>`)
  - HFB item has `aria-current="page"` attribute
  - Only one tab stop (the SE link)
- **Test Steps**:
  1. Open Storybook HfbOnly story
  2. Inspect both breadcrumb items
  3. Verify SE is an `<a>` tag
  4. Verify HFB is a `<span>` tag
  5. Tab through breadcrumbs and count tab stops
- **Acceptance Criteria**: ✓ SE is link, ✓ HFB is span, ✓ One tab stop, ✓ aria-current="page" present

---

#### TC-B-003: HfbAndProductArea - Both Links & Current Page Indicator
- **Venue**: STORYBOOK
- **Path**: Shared/DashboardComponents/Breadcrumbs > HfbAndProductArea
- **Props**: `region: 'se'`, `hfbId: '01'`, `paId: '05'`
- **Expected Behavior**:
  - First item (SE) is a link, href = `/region-dashboard/se`
  - Second item (HFB 01) is a link, href = `/region-dashboard/se/hfb/01`
  - Third item (PA 05) is NOT a link (plain `<span>`)
  - PA item has `aria-current="page"` attribute
  - Two tab stops (SE and HFB links)
- **Test Steps**:
  1. Open Storybook HfbAndProductArea story
  2. Inspect all three items in DOM
  3. Verify link hrefs
  4. Tab through and verify 2 tab stops
  5. Verify aria-current="page" on PA
- **Acceptance Criteria**: ✓ SE href correct, ✓ HFB href correct, ✓ PA is span, ✓ Two tab stops

---

### Category C: Accessibility Tests

#### TC-C-001: Breadcrumb Navigation Semantics
- **Venue**: STORYBOOK
- **Path**: All three stories (RegionOnly, HfbOnly, HfbAndProductArea)
- **Expected Behavior**:
  - Breadcrumb is wrapped in `<nav>` element
  - Nav has `aria-label="Breadcrumb"`
  - List is `<ol>` (ordered list)
  - Each item is `<li>`
  - No rogue divs used for navigation structure
- **Test Steps**:
  1. Open Storybook story
  2. Inspect HTML structure
  3. Use browser DevTools to verify semantic elements
  4. Run axe accessibility scan
- **Acceptance Criteria**: ✓ `<nav>` present, ✓ aria-label="Breadcrumb", ✓ `<ol>` used, ✓ `<li>` items, ✓ axe passes

---

#### TC-C-002: Keyboard Navigation (Tab Order)
- **Venue**: STORYBOOK
- **Path**: All three stories
- **Expected Behavior**:
  - Only interactive elements (links) receive tab focus
  - Tab order follows visual order: left to right
  - Plain text items (HFB only, PA only) are skipped
  - Focus indicators are visible (outline or box-shadow)
  - Shift+Tab navigates backward
- **Test Steps**:
  1. Open Storybook story
  2. Press Tab key repeatedly and observe focus
  3. Note which items receive focus
  4. Press Shift+Tab to navigate backward
  5. Verify focus indicators are visible
- **Acceptance Criteria**: ✓ Only links focused, ✓ Visual focus indicator, ✓ Correct tab order

---

#### TC-C-003: Screen Reader Announcement (ARIA Labels)
- **Venue**: STORYBOOK
- **Path**: HfbAndProductArea (most complex)
- **Props**: `region: 'se'`, `hfbId: '01'`, `paId: '05'`
- **Expected Behavior**:
  - Screen reader announces: "navigation, Breadcrumb"
  - Lists items: "1 of 3: link SE", "2 of 3: HFB 01 link", "3 of 3: PA 05 (current page)"
  - `aria-current="page"` on PA item is announced
  - List items are numbered (ol semantics)
- **Test Steps**:
  1. Open Storybook HfbAndProductArea story
  2. Use NVDA (Windows) or VoiceOver (Mac) to read
  3. Listen to breadcrumb announcement
  4. Verify current page indicator is announced
- **Acceptance Criteria**: ✓ Nav role announced, ✓ List items counted, ✓ aria-current announced

---

#### TC-C-004: Color Contrast & Link Styling
- **Venue**: STORYBOOK
- **Path**: All three stories
- **Expected Behavior**:
  - Links have visible underline or different color from plain text
  - Link color meets WCAG AA standards (4.5:1 contrast minimum)
  - Plain text (HFB-only, PA items) is legible (4.5:1 contrast)
  - Separator (›) is visible and has adequate contrast
  - Hover state for links provides visual feedback
- **Test Steps**:
  1. Open Storybook story
  2. Use WebAIM Contrast Checker
  3. Measure contrast ratio for links and plain text
  4. Hover over links and verify state change
  5. Verify separator visibility
- **Acceptance Criteria**: ✓ Links meet WCAG AA, ✓ Plain text readable, ✓ Separator visible, ✓ Hover state clear

---

### Category D: Responsive Design Tests

#### TC-D-001: Breadcrumbs Wrap on Narrow Viewports
- **Venue**: STORYBOOK
- **Path**: HfbAndProductArea story
- **Props**: `region: 'se'`, `hfbId: '01'`, `paId: '05'`
- **Expected Behavior**:
  - On mobile (320px): Breadcrumbs may wrap to multiple lines
  - Flex wrap is enabled (`flex-wrap: wrap`)
  - Items align vertically without breaking layout
  - Separators remain visible on wrapped lines
  - Text remains readable
- **Test Steps**:
  1. Open Storybook story in browser
  2. Resize viewport to 320px wide
  3. Verify breadcrumbs layout
  4. Resize to 768px and 1920px
  5. Verify layout adjustments
- **Acceptance Criteria**: ✓ No horizontal scroll, ✓ Text readable, ✓ Layout integrity

---

#### TC-D-002: Separator Spacing on Different Screen Sizes
- **Venue**: STORYBOOK
- **Path**: HfbAndProductArea story
- **Expected Behavior**:
  - Separator (›) spacing consistent across viewport sizes
  - Margin-inline: 0.5rem maintained
  - No separator overlap with text
  - Alignment centered with text
- **Test Steps**:
  1. Open HfbAndProductArea story
  2. Inspect separator element at different viewport widths
  3. Measure separator spacing
  4. Verify alignment
- **Acceptance Criteria**: ✓ Spacing consistent, ✓ Alignment correct, ✓ No overlap

---

---

## 3. Test Cases - Real FE (Integration)

### Category E: Real FE Navigation & Integration

#### TC-E-001: Region Dashboard - Breadcrumbs Display & Navigation
- **Venue**: REAL FE
- **URL**: http://localhost:5173/region-dashboard/se
- **Expected Behavior**:
  - Page loads successfully
  - NavigationBar displays with "Welcome User" at country level
  - If navigating to HFB level (next test), breadcrumbs should appear
  - Country dashboard content loads (sales graphs, HFB list)
- **Test Steps**:
  1. Start dev server: `cd sp_poc/frontend && npm run dev`
  2. Navigate to http://localhost:5173/region-dashboard/se
  3. Verify page loads
  4. Inspect NavigationBar component
- **Acceptance Criteria**: ✓ Page loads, ✓ Content visible, ✓ No console errors

---

#### TC-E-002: HFB Dashboard - Breadcrumbs Display & Link
- **Venue**: REAL FE
- **URL**: http://localhost:5173/region-dashboard/se/hfb/01
- **Expected Behavior**:
  - Page loads successfully
  - NavigationBar shows Breadcrumbs (not WelcomeUser)
  - Breadcrumbs display: "SE › HFB 01"
  - SE link is clickable and navigates to country dashboard
  - HFB is plain text (current level)
  - HFB dashboard content loads (title, sales graphs, PA list)
- **Test Steps**:
  1. Navigate to HFB URL
  2. Wait for page load
  3. Verify breadcrumb display
  4. Click SE link
  5. Verify navigation back to region dashboard
- **Acceptance Criteria**: ✓ Breadcrumbs visible, ✓ Link navigates, ✓ Content loads

---

#### TC-E-003: PA Dashboard - Breadcrumbs with Three Levels
- **Venue**: REAL FE
- **URL**: http://localhost:5173/region-dashboard/se/hfb_/01/pa/05
- **Expected Behavior**:
  - Page loads successfully
  - NavigationBar shows Breadcrumbs
  - Breadcrumbs display: "SE › HFB 01 › PA 05"
  - SE link navigates to region dashboard
  - HFB link navigates to HFB dashboard
  - PA is plain text (current level)
  - PA dashboard content loads
- **Test Steps**:
  1. Navigate to PA URL
  2. Wait for page load
  3. Verify breadcrumb display (3 items)
  4. Click SE link, verify navigation
  5. Navigate back to PA URL
  6. Click HFB link, verify navigation to HFB
- **Acceptance Criteria**: ✓ 3 breadcrumbs visible, ✓ Links work, ✓ Correct content loads

---

#### TC-E-004: Breadcrumb Link Navigation - Back Button Behavior
- **Venue**: REAL FE
- **URL**: http://localhost:5173/region-dashboard/se/hfb_/01/pa/05
- **Expected Behavior**:
  - Click SE breadcrumb link → navigate to /region-dashboard/se
  - Click HFB breadcrumb link → navigate to /region-dashboard/se/hfb/01
  - Click PA breadcrumb (none) → N/A (current page)
  - Browser back button works correctly
  - No data loss when navigating
- **Test Steps**:
  1. Navigate to PA level
  2. Click SE breadcrumb
  3. Verify in region dashboard
  4. Navigate back to PA level
  5. Click HFB breadcrumb
  6. Verify in HFB dashboard
  7. Test browser back button
- **Acceptance Criteria**: ✓ All links navigate, ✓ Correct pages load, ✓ Browser back works

---

#### TC-E-005: Breadcrumbs with Different Regions
- **Venue**: REAL FE
- **URLs**: 
  - /region-dashboard/de/hfb/02
  - /region-dashboard/no/hfb/03
  - /region-dashboard/fr/hfb_/01/pa/07
- **Expected Behavior**:
  - Region code displays correctly in breadcrumbs (uppercase)
  - Links construct correctly with different region codes
  - Navigation between regions works
  - HFB and PA IDs display correctly
- **Test Steps**:
  1. Navigate to German region HFB
  2. Verify "DE" displays (uppercase)
  3. Navigate to Norwegian region HFB
  4. Navigate to French PA
  5. Verify all links work
- **Acceptance Criteria**: ✓ Region codes correct, ✓ Links work, ✓ Navigation consistent

---

### Category F: Integration with Page Components

#### TC-F-001: Breadcrumbs Don't Break Page Layout
- **Venue**: REAL FE
- **URL**: All dashboard URLs
- **Expected Behavior**:
  - NavigationBar height consistent
  - Breadcrumbs don't overflow or break layout
  - Page content below starts at correct position
  - No layout shift when switching between pages
- **Test Steps**:
  1. Navigate to region dashboard
  2. Navigate to HFB dashboard
  3. Inspect layout flow
  4. Check element alignment
  5. Verify no overflow
- **Acceptance Criteria**: ✓ Layout stable, ✓ No overflow, ✓ Alignment correct

---

#### TC-F-002: Breadcrumbs Styling Matches Design
- **Venue**: REAL FE
- **Path**: Check against `sp_poc/figma-designs/overview.css`
- **Expected Behavior**:
  - Font size: 0.75rem (12px)
  - Font weight: matches design (likely regular)
  - Line height: 1.2 or similar (from SCSS)
  - Color: matches Ingka design token ($colour-static-black)
  - Separator (›): 1rem font size, 0.5rem margin
  - Flex alignment: center
- **Test Steps**:
  1. Navigate to HFB dashboard
  2. Inspect breadcrumb element
  3. Compare computed styles to design file
  4. Check Figma design file for visual reference
- **Acceptance Criteria**: ✓ Styles match design, ✓ Colors correct, ✓ Typography matches

---

### Category G: State Management & Data Flow

#### TC-G-001: Breadcrumbs Props Correct from Route Params
- **Venue**: REAL FE (Code Review)
- **File**: `/routes/_authenticated/region-dashboard/$region/hfb.$hfbId.tsx`
- **Expected Behavior**:
  - Route params extracted correctly: `region`, `hfbId`, `paId`
  - Props passed to NavigationBar are accurate
  - NavigationBar passes correct props to Breadcrumbs
  - No data transformation errors
- **Test Steps**:
  1. Navigate to HFB URL with params
  2. Open browser DevTools > Console
  3. Add console log to verify props
  4. Check component tree in React DevTools
- **Acceptance Criteria**: ✓ Props correct, ✓ No console errors, ✓ Data flows properly

---

#### TC-G-002: Breadcrumbs Update on Route Change
- **Venue**: REAL FE
- **URLs**: Navigate between region, HFB, PA levels
- **Expected Behavior**:
  - Breadcrumbs update immediately when route changes
  - Old breadcrumbs don't linger
  - New breadcrumbs render correctly
  - No stale data
- **Test Steps**:
  1. Navigate from region to HFB
  2. Observe breadcrumb update
  3. Navigate to PA
  4. Observe update (should add PA item)
  5. Navigate back to region
  6. Observe update (breadcrumbs disappear, WelcomeUser shows)
- **Acceptance Criteria**: ✓ Updates immediate, ✓ No stale data, ✓ Clean transitions

---

---

## 4. Test Cases - Accessibility & Compliance

### Category H: WCAG AA Compliance

#### TC-H-001: Full Accessibility Audit (axe DevTools)
- **Venue**: STORYBOOK
- **Tool**: axe DevTools browser extension
- **Expected Behavior**:
  - No violations detected
  - No warnings related to breadcrumbs
  - All elements properly labeled
  - Color contrast passes
  - ARIA attributes correct
- **Test Steps**:
  1. Open Storybook story
  2. Run axe DevTools scan
  3. Review results
  4. Fix any violations
- **Acceptance Criteria**: ✓ 0 violations, ✓ 0 warnings (breadcrumb-related)

---

#### TC-H-002: Keyboard-Only Navigation Test
- **Venue**: STORYBOOK & REAL FE
- **Expected Behavior**:
  - All interactive elements (links) accessible via keyboard
  - Focus order logical (left to right)
  - Focus indicators visible
  - Can navigate and interact without mouse
- **Test Steps**:
  1. Open page
  2. Unplug mouse (or disable trackpad)
  3. Use Tab/Shift+Tab to navigate
  4. Press Enter to click links
  5. Verify all breadcrumb links accessible
- **Acceptance Criteria**: ✓ All links navigable, ✓ Focus visible, ✓ Focus order logical

---

#### TC-H-003: Screen Reader Test (NVDA or VoiceOver)
- **Venue**: REAL FE or STORYBOOK
- **Tool**: NVDA (Windows) or VoiceOver (Mac)
- **Expected Behavior**:
  - Screen reader announces breadcrumb navigation
  - Lists items are read with count (e.g., "list 3 items")
  - Links are announced as links with URLs
  - Current page (aria-current="page") is announced
- **Test Steps**:
  1. Open page with screen reader enabled
  2. Navigate to breadcrumb area
  3. Listen to announcements
  4. Verify comprehensiveness
- **Acceptance Criteria**: ✓ Navigation announced, ✓ Links announced, ✓ Current page announced

---

---

## 5. Edge Case Tests

### Category I: Edge Cases & Error Handling

#### TC-I-001: Empty/Null Region Prop
- **Venue**: REAL FE (Negative Test)
- **Expected Behavior**:
  - Component handles gracefully (no crash)
  - May show empty breadcrumb or error state
  - No console errors
- **Test Steps**:
  1. Attempt to render with empty region
  2. Check console for errors
  3. Verify no crash
- **Acceptance Criteria**: ✓ No crash, ✓ Handles gracefully

---

#### TC-I-002: Invalid Region Code (Not 2 Characters)
- **Venue**: REAL FE
- **URL**: /region-dashboard/invalid
- **Expected Behavior**:
  - Route validation catches error
  - 404 or error page shown
  - Breadcrumbs don't render with invalid data
- **Test Steps**:
  1. Navigate to invalid region URL
  2. Check page response
  3. Verify error handling
- **Acceptance Criteria**: ✓ Error handled, ✓ No malformed breadcrumbs

---

#### TC-I-003: Missing HFB ID When PA ID Provided
- **Venue**: Code Review / Unit Tests
- **Expected Behavior**:
  - Component only renders PA if HFB is also present
  - No orphaned PA items
  - Props validation correct
- **Test Steps**:
  1. Review breadcrumbs.tsx logic
  2. Check conditional rendering
  3. Verify prop dependencies
- **Acceptance Criteria**: ✓ Proper conditional logic, ✓ No orphaned items

---

#### TC-I-004: Very Long HFB/PA IDs
- **Venue**: STORYBOOK & REAL FE
- **Example Props**: `hfbId: 'VERYLONG01234567890'`, `paId: '9999'`
- **Expected Behavior**:
  - Long IDs display without breaking layout
  - Text wraps or truncates gracefully
  - Breadcrumb remains readable
  - No overflow
- **Test Steps**:
  1. Create Storybook story with long IDs
  2. Verify layout
  3. Check text overflow
  4. Verify readability
- **Acceptance Criteria**: ✓ No overflow, ✓ Readable, ✓ Layout stable

---

#### TC-I-005: Special Characters in Region/HFB/PA
- **Venue**: Code Review
- **Example**: Emoji, non-ASCII characters
- **Expected Behavior**:
  - IDs sanitized/validated before display
  - No XSS vulnerabilities
  - Special chars handled safely
- **Test Steps**:
  1. Review code for input sanitization
  2. Check for XSS vulnerabilities
  3. Verify encoding
- **Acceptance Criteria**: ✓ Safe rendering, ✓ No XSS, ✓ Proper encoding

---

---

## 6. Test Data & Fixtures

### Regions to Test
- `se` (Sweden) - Common case
- `de` (Germany) - Different language context
- `no` (Norway) - Nordic region
- `fr` (France) - Western Europe
- `us` (USA) - Extended region code (if supported)

### HFB IDs to Test
- `01`, `02`, `03` (standard)
- `99` (edge case)
- Leading zeros preserved

### PA IDs to Test
- `01`, `05`, `07` (standard)
- `99` (high number)

---

## 7. Acceptance Criteria Summary

### Visual/UI Acceptance
- ✅ Breadcrumbs render in correct format (separators, items, text)
- ✅ Typography matches design (0.75rem font size)
- ✅ Styling consistent across venues (Storybook & Real FE)
- ✅ Responsive on mobile (no horizontal scroll)
- ✅ No layout breaks or overflow

### Functional Acceptance
- ✅ Links navigate to correct pages
- ✅ Region link always navigable
- ✅ HFB link only navigable when PA present
- ✅ PA never a link (current page indicator)
- ✅ Breadcrumbs update on route change

### Accessibility Acceptance
- ✅ Semantic HTML (`<nav>`, `<ol>`, `<li>`)
- ✅ aria-label="Breadcrumb" on nav
- ✅ aria-current="page" on current level
- ✅ Keyboard navigation works (Tab, Enter)
- ✅ Screen reader announcements correct
- ✅ Color contrast meets WCAG AA (4.5:1)
- ✅ Focus indicators visible
- ✅ axe DevTools: 0 violations

### Integration Acceptance
- ✅ NavigationBar displays Breadcrumbs correctly
- ✅ Data flows from routes to component
- ✅ No prop errors or console warnings
- ✅ Works across all dashboard pages
- ✅ Responsive to region/HFB/PA changes

---

## 8. Test Execution Plan

### Phase 1: Storybook Visual Tests (Est. 30 min)
1. Verify 3 stories display correctly
2. Check visual styles match design
3. Validate separators and layout
4. Test responsive behavior

### Phase 2: Storybook Functional Tests (Est. 20 min)
1. Test link hrefs
2. Verify navigation state
3. Check current page indicators
4. Validate link behavior (hover, active)

### Phase 3: Storybook Accessibility Tests (Est. 25 min)
1. Run axe scan
2. Test keyboard navigation
3. Test screen reader (if available)
4. Verify ARIA attributes

### Phase 4: Real FE Integration Tests (Est. 40 min)
1. Start dev server
2. Navigate to region/HFB/PA pages
3. Test breadcrumb navigation
4. Verify data flow
5. Test across multiple regions

### Phase 5: Edge Cases & Final Validation (Est. 15 min)
1. Test invalid scenarios
2. Verify error handling
3. Final accessibility check

**Total Estimated Time**: ~2.5 hours

---

## 9. Test Failure Response

### Critical Failures (Block Release)
- Breadcrumbs not displaying on any page
- Links not navigating correctly
- Accessibility violations (axe)
- Layout breaks on mobile

### Major Failures (Fix Before Release)
- Styling doesn't match design
- aria-current not applied
- Keyboard navigation broken
- Screen reader issues

### Minor Failures (Nice to Have)
- Visual polish (spacing, shadows)
- Hover state details
- Animation smoothness

---

## 10. Test Execution Log

To be completed during test execution. Will track:
- Test case ID
- Status (PASS/FAIL/PARTIAL)
- Evidence/Screenshots
- Notes
- Time taken

---

**End of Test Plan**

*This plan is ready for execution. Tests will be run systematically across Storybook and Real FE, with results documented in both JSON and Markdown formats.*

