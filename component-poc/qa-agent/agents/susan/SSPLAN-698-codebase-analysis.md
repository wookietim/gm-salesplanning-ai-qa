# SSPLAN-698: Breadcrumbs Update - Codebase Analysis

**Date**: 2026-08-05T16:42:04  
**Component**: Breadcrumbs  
**Status**: Ready for test execution upon Bob's test plan arrival

---

## 1. Component Location & Files

**Primary Location**: `/Users/timothy.collins/Documents/ikea work/gm-salesplanning-frontend/src/components/Shared/DashboardComponents/Breadcrumbs/`

### Files:
- `breadcrumbs.tsx` - Main component implementation
- `breadcrumbs.module.scss` - Component styling
- `breadcrumbs.stories.tsx` - Storybook stories (3 scenarios)
- `breadcrumbs.test.tsx` - Unit tests (4 test cases)
- `index.ts` - Module export

---

## 2. Component Implementation Details

### Component Signature
```typescript
export interface BreadcrumbsProps {
    region: string;
    hfbId?: string;
    paId?: string;
}

export const Breadcrumbs = ({ region, hfbId, paId }: BreadcrumbsProps) => { ... }
```

### Key Features
- **Semantic HTML**: Uses `<nav>` with `aria-label="Breadcrumb"` and `<ol>` list
- **Router Integration**: Uses TanStack React Router with custom `HyperlinkRouterLink`
- **Design System**: Uses `@ingka/hyperlink` component from Ingka Skapa design system
- **Current Page Indicator**: Uses `aria-current="page"` attribute
- **Dynamic Link Behavior**: 
  - Region link: Always a link
  - HFB link: Only a link when PA is present (otherwise plain text)
  - PA link: Never a link (always plain text as current page)

### Component Logic Flow
```
Breadcrumbs Rendering:
1. Region always appears as a link to /region-dashboard/{region}
2. If hfbId is provided:
   - If paId is NOT provided: HFB appears as plain text with aria-current="page"
   - If paId IS provided: HFB becomes a link to /region-dashboard/{region}/hfb/{hfbId}
3. If both hfbId and paId are provided:
   - PA appears as plain text with aria-current="page"
```

---

## 3. Styling Details

### SCSS Variables & Design Tokens
- **Source**: `breadcrumbs.module.scss`
- **Design System Integration**: Uses `@ingka/variables/style.scss`
- **Color**: `$colour-static-black` (Ingka design token)

### Visual Styles
```scss
.breadcrumbs
  - display: flex
  - align-items: center
  - flex-wrap: wrap
  - font-size: 0.75rem
  - list-style: none
  - padding: 0
  - margin: 0

.item
  - display: inline-flex
  - align-items: center
  - Separator (›) between items:
    - margin-inline: 0.5rem
    - font-size: 1rem
    - line-height: 1
    - color: $colour-static-black
```

---

## 4. Pages Using Breadcrumbs Component

### Page 1: Country/Region Level
- **Route**: `/_authenticated/region-dashboard/$region/`
- **File**: `/routes/_authenticated/region-dashboard/$region/index.tsx`
- **Breadcrumbs Props**: `region` only
- **Display**: Single link (e.g., "SE")
- **Purpose**: Top-level dashboard for a country/region

### Page 2: HFB Level
- **Route**: `/_authenticated/region-dashboard/$region/hfb/$hfbId`
- **File**: `/routes/_authenticated/region-dashboard/$region/hfb.$hfbId.tsx`
- **Breadcrumbs Props**: `region` + `hfbId`
- **Display**: Region link + HFB plain text
- **Purpose**: HFB (Hub for Business) dashboard

### Page 3: PA Level (Product Area)
- **Route**: `/_authenticated/region-dashboard/$region/hfb_/$hfbId/pa/$paId`
- **File**: `/routes/_authenticated/region-dashboard/$region/hfb_.$hfbId.pa.$paId.tsx`
- **Breadcrumbs Props**: `region` + `hfbId` + `paId`
- **Display**: Region link + HFB link + PA plain text
- **Purpose**: Product Area (PA) dashboard - deepest level

---

## 5. Integration Point

**Component Integration**: Breadcrumbs are rendered within the `NavigationBar` component

**File**: `/components/Shared/DashboardComponents/NavigationBar/navigation-bar.tsx`

**Logic**:
- At country level (`!hfbId && !paId`): Shows `WelcomeUser` component
- At HFB/PA level: Shows `Breadcrumbs` component with appropriate props

---

## 6. Link Behavior & Navigation

### Link Destinations
1. **Region Link** (always): `/region-dashboard/{region}` - navigates back to country dashboard
2. **HFB Link** (if PA present): `/region-dashboard/{region}/hfb/{hfbId}` - navigates back to HFB dashboard
3. **PA Link** (never exists): N/A - PA is always current page

### Router Integration
- Uses TanStack React Router's `createLink` function
- Custom `HyperlinkAdapter` bridges `@ingka/hyperlink` with React Router
- Type-safe route parameters with validation

---

## 7. Accessibility Compliance

### Current Accessibility Features
- ✅ Semantic `<nav>` element with `aria-label="Breadcrumb"`
- ✅ Ordered list structure (`<ol>`)
- ✅ List items (`<li>`)
- ✅ `aria-current="page"` on non-linked items
- ✅ Uses `@ingka/hyperlink` (assumes Ingka design system accessibility standards)
- ✅ Uppercase region labels for clarity

### Areas to Test
- Keyboard navigation (Tab, Enter)
- Screen reader announcement of breadcrumb structure
- Color contrast (links vs. plain text)
- Focus indicators on interactive elements

---

## 8. Storybook Stories (3 Scenarios)

### Story 1: RegionOnly
- **Props**: `region: 'se'`
- **Expected**: Single link "SE"
- **Test Assertions**: 
  - 1 list item
  - 1 link with href `/region-dashboard/se`
  - No HFB or PA text

### Story 2: HfbOnly
- **Props**: `region: 'se'`, `hfbId: '01'`
- **Expected**: Region link + HFB plain text
- **Test Assertions**:
  - 2 list items
  - Region link exists
  - HFB text "HFB 01" (no link)

### Story 3: HfbAndProductArea
- **Props**: `region: 'se'`, `hfbId: '01'`, `paId: '05'`
- **Expected**: Region link + HFB link + PA plain text
- **Test Assertions**:
  - 3 list items
  - Region link: href `/region-dashboard/se`
  - HFB link: href `/region-dashboard/se/hfb/01`
  - PA text "PA 05" (no link)

---

## 9. Unit Tests (4 Test Cases)

All tests use a TanStack React Router context for route-aware link testing.

1. **Test**: Region only rendering
   - Validates single link to region dashboard
   
2. **Test**: HFB without PA (plain text)
   - Validates HFB appears as plain text, not a link
   
3. **Test**: HFB + PA together
   - Validates HFB becomes a link when PA is present
   - Validates PA is plain text
   
4. **Test**: Uppercase region label
   - Validates region prop "de" displays as "DE"

---

## 10. Testing Venues

### Venue 1: STORYBOOK
- **URL**: https://storybook.salesplanning.ingka.com/
- **Path**: Shared/DashboardComponents/Breadcrumbs
- **Scenarios**: RegionOnly, HfbOnly, HfbAndProductArea
- **Requires**: No SSO
- **Tests**:
  - Visual rendering (layout, typography, colors)
  - Separator display (›)
  - Link behavior (hover, active states)
  - Responsive behavior (flex-wrap)

### Venue 2: REAL FE (Integration)
- **Dev Server**: `cd sp_poc/frontend && npm run dev`
- **Accessible Pages**:
  - Country dashboard (breadcrumbs show region only)
  - HFB dashboard (breadcrumbs show region + HFB)
  - PA dashboard (breadcrumbs show region + HFB + PA)
- **Tests**:
  - Link functionality (navigate back through breadcrumbs)
  - Integration with NavigationBar
  - Data flow and context passing
  - Real routing behavior

### Venue 3: UNIT TESTS
- **Runner**: Vitest
- **Files**: `breadcrumbs.test.tsx`
- **Command**: `cd sp_poc/frontend && npm run test breadcrumbs`

### Venue 4: ACCESSIBILITY AUDITS
- **Tools**: axe DevTools, WCAG AA compliance
- **Checklist**:
  - Keyboard navigation (Tab through breadcrumbs)
  - Screen reader testing (NVDA, JAWS, VoiceOver)
  - Color contrast verification
  - Focus indicator visibility

---

## 11. Key Files for Reference

| File | Purpose |
|------|---------|
| `breadcrumbs.tsx` | Main component logic |
| `breadcrumbs.module.scss` | Styling |
| `breadcrumbs.stories.tsx` | Storybook documentation |
| `breadcrumbs.test.tsx` | Unit tests |
| `navigation-bar.tsx` | Integration point |
| `$region/index.tsx` | Country page |
| `$region/hfb.$hfbId.tsx` | HFB page |
| `$region/hfb_.$hfbId.pa.$paId.tsx` | PA page |

---

## 12. Test Plan Readiness

This document is complete. I am ready to execute tests as soon as Bob's test plan (`SSPLAN-698__real-fe-storybook__breadcrumbs.qa.md`) is available.

**Ready for Test Execution**: ✅ YES

