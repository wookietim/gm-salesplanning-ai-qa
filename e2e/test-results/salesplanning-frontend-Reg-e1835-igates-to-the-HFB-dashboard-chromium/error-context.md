# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: salesplanning-frontend.spec.js >> Region dashboard (/region-dashboard/se/) >> clicking "View HFB plan" navigates to the HFB dashboard
- Location: salesplanning-frontend.spec.js:603:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('heading', { level: 1 })
Expected substring: "HFB"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for getByRole('heading', { level: 1 })
    3 × locator resolved to <h1 class="text typography-heading-xl">SE Sales</h1>
      - unexpected value "SE Sales"

```

```yaml
- strong: Something went wrong!
- button "Show Error"
```

# Test source

```ts
  507 |         if (hierarchyDelayMs > 0) await wait(hierarchyDelayMs);
  508 |         if (hierarchyStatus !== 200) {
  509 |             await route.fulfill({ status: hierarchyStatus, contentType: 'application/json', body: '{}' });
  510 |             return;
  511 |         }
  512 |         await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(hierarchyResponse) });
  513 |     });
  514 | 
  515 |     await page.goto(url);
  516 | }
  517 | 
  518 | /**
  519 |  * Navigate to a URL with all API mocks active but bypassing real SSO entirely.
  520 |  * Sets __e2e_bypass_auth__ in localStorage before page load so main.tsx injects
  521 |  * a fake active MSAL account. Use this for all tests that are not specifically
  522 |  * testing authentication behaviour.
  523 |  */
  524 | async function gotoBypassAuth(page, url, options = {}) {
  525 |     return gotoAuthenticated(page, url, { ...options, bypassAuth: true });
  526 | }
  527 | 
  528 | // ─── Tests ────────────────────────────────────────────────────────────────────
  529 | 
  530 | test.describe('Unauthenticated home page', () => {
  531 |     // No mocking — let MSAL redirect naturally to Microsoft login and assert the
  532 |     // real redirect URL. Blocking the navigation leaves MSAL stuck in
  533 |     // InteractionStatus.Redirect, preventing UnauthenticatedTemplate from rendering.
  534 | 
  535 |     test('redirects to Microsoft login when no MSAL account exists', async ({ page }) => {
  536 |         await page.goto('/');
  537 |         await page.waitForURL(/login\.microsoftonline\.com/, { timeout: 15000 });
  538 |         expect(page.url()).toContain('login.microsoftonline.com');
  539 |         expect(page.url()).toContain(CLIENT_ID);
  540 |     });
  541 | 
  542 |     test('redirects protected routes through / then on to Microsoft login', async ({ page }) => {
  543 |         await page.goto('/region-dashboard/se/');
  544 |         await page.waitForURL(/login\.microsoftonline\.com/, { timeout: 15000 });
  545 |         expect(page.url()).toContain('login.microsoftonline.com');
  546 |     });
  547 | });
  548 | 
  549 | test.describe('Authenticated home / Welcome page', () => {
  550 |     test.beforeEach(async ({ page }) => {
  551 |         await gotoAuthenticated(page, '/', { graphDelayMs: 750 });
  552 |     });
  553 | 
  554 |     test('renders the Welcome component for an authenticated user', async ({ page }) => {
  555 |         await expect(page.getByText('Hej, Test User')).toBeVisible();
  556 |     });
  557 | 
  558 |     test('shows the header link and authenticated welcome text', async ({ page }) => {
  559 |         await expect(page.getByRole('link', { name: 'Sales Planning' })).toBeVisible();
  560 |         await expect(page.locator('body')).toContainText('Hej, Test User');
  561 |     });
  562 | });
  563 | 
  564 | test.describe('Region dashboard (/region-dashboard/se/)', () => {
  565 |     test.beforeEach(async ({ page }) => {
  566 |         await gotoBypassAuth(page, '/region-dashboard/se/', {
  567 |             hfbDelayMs: 500,
  568 |             metricsDelayMs: 500,
  569 |         });
  570 |     });
  571 | 
  572 |     test('renders the country dashboard shell and shows loading states', async ({ page }) => {
  573 |         await expect(page.getByRole('heading', { level: 1 })).toContainText('SE Sales');
  574 |         await expect(page.locator('body')).toContainText('Forecast G');
  575 |         await expect(page.getByLabel('HFB list navigation')).toBeVisible();
  576 |         await expect(page.getByLabel('HFB list navigation').getByRole('status'))
  577 |             .toContainText('Loading HFB performance...');
  578 |         await expect(page.getByLabel('Sales by week').getByRole('status'))
  579 |             .toContainText('Loading trend data...');
  580 |     });
  581 | 
  582 |     test('renders HFB cards and graph sections after data loads', async ({ page }) => {
  583 |         await expect(page.getByText('FY26 sales index')).toBeVisible();
  584 |         await expect(page.getByRole('button', { name: 'View HFB plan' })).toHaveCount(16);
  585 |         await expect(page.getByLabel('Sales by week')).toBeVisible();
  586 |     });
  587 | 
  588 |     test('HfbList shows Qty/Sales index SegmentedControl and switches metric', async ({ page }) => {
  589 |         const hfbSection = page.getByLabel('HFB list navigation');
  590 |         const qtyBtn = hfbSection.getByRole('button', { name: 'Qty index' });
  591 |         const salesBtn = hfbSection.getByRole('button', { name: 'Sales index' });
  592 | 
  593 |         await expect(qtyBtn).toBeVisible();
  594 |         await expect(salesBtn).toBeVisible();
  595 |         await expect(qtyBtn).toHaveAttribute('aria-pressed', 'true');
  596 | 
  597 |         await salesBtn.click();
  598 | 
  599 |         await expect(salesBtn).toHaveAttribute('aria-pressed', 'true');
  600 |         await expect(qtyBtn).toHaveAttribute('aria-pressed', 'false');
  601 |     });
  602 | 
  603 |     test('clicking "View HFB plan" navigates to the HFB dashboard', async ({ page }) => {
  604 |         await page.getByRole('button', { name: 'View HFB plan' }).first().click();
  605 |         // HFBs are sorted worst-gap-first, so the specific number is data-driven
  606 |         await expect(page).toHaveURL(/\/region-dashboard\/se\/hfb\/\d+$/);
> 607 |         await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB');
      |                                                               ^ Error: expect(locator).toContainText(expected) failed
  608 |     });
  609 | 
  610 |     test('invalid region (>2 chars) shows the InvalidRegion component', async ({ page }) => {
  611 |         await page.goto('/region-dashboard/see/');
  612 |         await expect(
  613 |             page.getByText('Invalid region. Please supply a valid two-character region in the route.'),
  614 |         ).toBeVisible();
  615 |     });
  616 | 
  617 |     test('header "Sales Planning" link is visible on the region dashboard', async ({ page }) => {
  618 |         await expect(page.getByRole('link', { name: 'Sales Planning' })).toBeVisible();
  619 |     });
  620 | });
  621 | 
  622 | test.describe('HFB dashboard (/region-dashboard/se/hfb/01)', () => {
  623 |     test.beforeEach(async ({ page }) => {
  624 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', {
  625 |             hierarchyDelayMs: 500,
  626 |             metricsDelayMs: 500,
  627 |         });
  628 |     });
  629 | 
  630 |     test('renders the HFB title, breadcrumbs, and back button', async ({ page }) => {
  631 |         const breadcrumb = page.getByLabel('Breadcrumb');
  632 |         await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
  633 |         await expect(breadcrumb).toBeVisible();
  634 |         await expect(breadcrumb.getByRole('link', { name: 'SE' })).toBeVisible();
  635 |         await expect(breadcrumb.getByText('HFB 01')).toHaveAttribute('aria-current', 'page');
  636 |         await expect(page.getByRole('button', { name: 'Go back' })).toBeVisible();
  637 |     });
  638 | 
  639 |     test('back button navigates to the region dashboard', async ({ page }) => {
  640 |         await page.getByRole('button', { name: 'Go back' }).click();
  641 |         await expect(page).toHaveURL(/\/region-dashboard\/se\/?$/);
  642 |         await expect(page.getByRole('heading', { level: 1 })).toContainText('SE Sales');
  643 |     });
  644 | 
  645 |     test('PA list shows loading state then loaded PA rows', async ({ page }) => {
  646 |         await expect(page.getByLabel('PA list navigation')).toBeVisible();
  647 |         await expect(page.getByText('Loading PA performance...')).toBeVisible();
  648 |         await expect(page.getByRole('button', { name: /Sofas.*001/ })).toBeVisible();
  649 |         await expect(page.getByRole('button', { name: /Armchairs.*002/ })).toBeVisible();
  650 |     });
  651 | 
  652 |     test('clicking a PA row navigates to the PA dashboard', async ({ page }) => {
  653 |         await page.getByRole('button', { name: /Sofas.*001/ }).click();
  654 |         await expect(page).toHaveURL(/\/region-dashboard\/se\/hfb\/01\/pa\/001$/);
  655 |         await expect(page.getByRole('heading', { level: 1 })).toContainText('PA 001');
  656 |     });
  657 | 
  658 |     test('renders HFB-level sales graphs (YTD sales index, Sales by week)', async ({ page }) => {
  659 |         await expect(page.getByText('YTD sales index')).toBeVisible();
  660 |         await expect(page.getByLabel('Sales by week')).toBeVisible();
  661 |         await expect(page.getByRole('link', { name: 'Sales Planning' })).toBeVisible();
  662 |     });
  663 | 
  664 |     test('NewsInHfbList section renders with title and item list', async ({ page }) => {
  665 |         const newsSection = page.getByLabel('News in HFB list');
  666 |         await expect(newsSection).toBeVisible();
  667 |         await expect(newsSection.getByText(/NEWs in HFB 01/i)).toBeVisible();
  668 |         // Items render as buttons (NewsArticle rows)
  669 |         await expect(newsSection.getByRole('button').first()).toBeVisible();
  670 |     });
  671 | 
  672 |     test('NewsInHfbList shows loading state while item range data is fetching', async ({ page }) => {
  673 |         // Re-navigate with an item-range delay — do this AFTER beforeEach has settled
  674 |         // so the delay only applies to this specific test, not all HFB tests.
  675 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', {
  676 |             metricsDelayMs: 250,
  677 |             itemRangeDelayMs: 800,
  678 |         });
  679 |         await expect(page.getByLabel('News in HFB list')).toContainText('Loading item range...');
  680 |     });
  681 | });
  682 | 
  683 | test.describe('PA dashboard (/region-dashboard/se/hfb/01/pa/001)', () => {
  684 |     test.beforeEach(async ({ page }) => {
  685 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', {
  686 |             metricsDelayMs: 500,
  687 |         });
  688 |     });
  689 | 
  690 |     test('renders the PA title, full breadcrumb trail, and back button', async ({ page }) => {
  691 |         const breadcrumb = page.getByLabel('Breadcrumb');
  692 |         await expect(page.getByRole('heading', { level: 1 })).toContainText('PA 001');
  693 |         await expect(breadcrumb).toBeVisible();
  694 |         await expect(breadcrumb.getByRole('link', { name: 'SE' })).toBeVisible();
  695 |         await expect(breadcrumb.getByRole('link', { name: 'HFB 01' })).toBeVisible();
  696 |         await expect(breadcrumb.getByText('PA 001')).toHaveAttribute('aria-current', 'page');
  697 |         await expect(page.getByRole('button', { name: 'Go back' })).toBeVisible();
  698 |     });
  699 | 
  700 |     test('back button navigates to the HFB dashboard', async ({ page }) => {
  701 |         await page.getByRole('button', { name: 'Go back' }).click();
  702 |         await expect(page).toHaveURL(/\/region-dashboard\/se\/hfb\/01$/);
  703 |         await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
  704 |     });
  705 | 
  706 |     test('renders PA-level sales graphs (no PA list)', async ({ page }) => {
  707 |         await expect(page.getByText('YTD sales index')).toBeVisible();
```