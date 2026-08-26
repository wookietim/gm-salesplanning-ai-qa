# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: salesplanning-frontend.spec.js >> PA dashboard (/region-dashboard/se/hfb/01/pa/001) >> renders the PA title, full breadcrumb trail, and back button
- Location: salesplanning-frontend.spec.js:690:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('heading', { level: 1 })
Expected substring: "PA 001"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for getByRole('heading', { level: 1 })

```

```yaml
- text: 429 Too Many Requests
```

# Test source

```ts
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
  607 |         await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB');
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
> 692 |         await expect(page.getByRole('heading', { level: 1 })).toContainText('PA 001');
      |                                                               ^ Error: expect(locator).toContainText(expected) failed
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
  708 |         await expect(page.getByLabel('Sales by week')).toBeVisible();
  709 |         await expect(page.getByLabel('PA list navigation')).not.toBeVisible();
  710 |         await expect(page.getByRole('link', { name: 'Sales Planning' })).toBeVisible();
  711 |     });
  712 | });
  713 | 
  714 | test.describe('Signedout page (/signedout)', () => {
  715 |     test.beforeEach(async ({ page }) => {
  716 |         await gotoBypassAuth(page, '/signedout');
  717 |     });
  718 | 
  719 |     test('loads without crashing and renders the header', async ({ page }) => {
  720 |         await expect(page.getByRole('link', { name: 'Sales Planning' })).toBeVisible();
  721 |     });
  722 | 
  723 |     test('does not render error text', async ({ page }) => {
  724 |         await expect(page.locator('body')).not.toContainText('Error');
  725 |     });
  726 | });
  727 | 
  728 | test.describe('Header and breadcrumb navigation', () => {
  729 |     test('"Sales Planning" header link navigates home from the region dashboard', async ({ page }) => {
  730 |         await gotoBypassAuth(page, '/region-dashboard/se/', { graphDelayMs: 750, metricsDelayMs: 250 });
  731 |         await page.getByRole('link', { name: 'Sales Planning' }).click();
  732 |         await expect(page).toHaveURL(/\/$/);
  733 |         await expect(page.getByText('Hej, Test User')).toBeVisible();
  734 |     });
  735 | 
  736 |     test('HFB breadcrumb "SE" link navigates back to the region dashboard', async ({ page }) => {
  737 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { hierarchyDelayMs: 250, metricsDelayMs: 250 });
  738 |         await page.getByLabel('Breadcrumb').getByRole('link', { name: 'SE' }).click();
  739 |         await expect(page).toHaveURL(/\/region-dashboard\/se\/?$/);
  740 |         await expect(page.getByRole('heading', { level: 1 })).toContainText('SE Sales');
  741 |     });
  742 | 
  743 |     test('PA breadcrumb "HFB 01" link navigates back to the HFB dashboard', async ({ page }) => {
  744 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 250 });
  745 |         await page.getByLabel('Breadcrumb').getByRole('link', { name: 'HFB 01' }).click();
  746 |         await expect(page).toHaveURL(/\/region-dashboard\/se\/hfb\/01$/);
  747 |         await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
  748 |     });
  749 | });
  750 | 
  751 | test.describe('Navigation path specificity', () => {
  752 |     // Helper: find the HFB card for a specific number and click its "View HFB plan" button.
  753 |     // Uses the h3 heading as an anchor then walks up to the ancestor card container.
  754 |     async function clickHfbCard(page, hfbNo) {
  755 |         await page
  756 |             .getByRole('heading', { level: 3, name: new RegExp(`^${hfbNo}\\s*-`) })
  757 |             .locator('xpath=ancestor::div[.//button[contains(., "View HFB plan")]][1]')
  758 |             .getByRole('button', { name: 'View HFB plan' })
  759 |             .click();
  760 |     }
  761 | 
  762 |     test.describe('HFB card → HFB page (click-based)', () => {
  763 |         test.beforeEach(async ({ page }) => {
  764 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  765 |             // Wait for HFB cards to load
  766 |             await page.getByRole('button', { name: 'View HFB plan' }).first().waitFor();
  767 |         });
  768 | 
  769 |         test('clicking the HFB 01 card navigates to the HFB 01 page', async ({ page }) => {
  770 |             await clickHfbCard(page, '01');
  771 |             await expect(page).toHaveURL(/\/region-dashboard\/se\/hfb\/01$/);
  772 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
  773 |         });
  774 | 
  775 |         test('clicking the HFB 02 card navigates to the HFB 02 page', async ({ page }) => {
  776 |             await clickHfbCard(page, '02');
  777 |             await expect(page).toHaveURL(/\/region-dashboard\/se\/hfb\/02$/);
  778 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 02');
  779 |         });
  780 | 
  781 |         test('clicking the HFB 05 card navigates to the HFB 05 page', async ({ page }) => {
  782 |             await clickHfbCard(page, '05');
  783 |             await expect(page).toHaveURL(/\/region-dashboard\/se\/hfb\/05$/);
  784 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 05');
  785 |         });
  786 | 
  787 |         test('clicking the HFB 10 card navigates to the HFB 10 page', async ({ page }) => {
  788 |             await clickHfbCard(page, '10');
  789 |             await expect(page).toHaveURL(/\/region-dashboard\/se\/hfb\/10$/);
  790 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 10');
  791 |         });
  792 | 
```