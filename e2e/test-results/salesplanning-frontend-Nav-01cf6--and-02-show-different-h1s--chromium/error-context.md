# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: salesplanning-frontend.spec.js >> Navigation path specificity >> HFB card → HFB page (click-based) >> each HFB card leads to its own independent page (01 and 02 show different h1s)
- Location: salesplanning-frontend.spec.js:793:9

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: locator.waitFor: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'View HFB plan' }).first() to be visible

```

# Page snapshot

```yaml
- generic [active] [ref=e1]: 429 Too Many Requests
```

# Test source

```ts
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
> 766 |             await page.getByRole('button', { name: 'View HFB plan' }).first().waitFor();
      |                                                                               ^ Error: locator.waitFor: Test timeout of 30000ms exceeded.
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
  793 |         test('each HFB card leads to its own independent page (01 and 02 show different h1s)', async ({ page }) => {
  794 |             await clickHfbCard(page, '01');
  795 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
  796 | 
  797 |             await page.goBack();
  798 |             await page.getByRole('button', { name: 'View HFB plan' }).first().waitFor();
  799 | 
  800 |             await clickHfbCard(page, '02');
  801 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 02');
  802 |             await expect(page.getByRole('heading', { level: 1 })).not.toContainText('HFB 01');
  803 |         });
  804 |     });
  805 | 
  806 |     test.describe('HFB page → PA page (click-based)', () => {
  807 |         test.beforeEach(async ({ page }) => {
  808 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', {
  809 |                 hierarchyDelayMs: 250,
  810 |                 metricsDelayMs: 250,
  811 |             });
  812 |             await page.getByRole('button', { name: /Sofas.*001/ }).waitFor();
  813 |         });
  814 | 
  815 |         test('clicking PA 001 (Sofas) navigates to the PA 001 page', async ({ page }) => {
  816 |             await page.getByRole('button', { name: /Sofas.*001/ }).click();
  817 |             await expect(page).toHaveURL(/\/region-dashboard\/se\/hfb\/01\/pa\/001$/);
  818 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('PA 001');
  819 |         });
  820 | 
  821 |         test('clicking PA 002 (Armchairs) navigates to the PA 002 page', async ({ page }) => {
  822 |             await page.getByRole('button', { name: /Armchairs.*002/ }).click();
  823 |             await expect(page).toHaveURL(/\/region-dashboard\/se\/hfb\/01\/pa\/002$/);
  824 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('PA 002');
  825 |         });
  826 | 
  827 |         test('PA 001 and PA 002 are independently navigable and show different pages', async ({ page }) => {
  828 |             await page.getByRole('button', { name: /Sofas.*001/ }).click();
  829 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('PA 001');
  830 | 
  831 |             await page.goBack();
  832 |             await page.getByRole('button', { name: /Armchairs.*002/ }).waitFor();
  833 | 
  834 |             await page.getByRole('button', { name: /Armchairs.*002/ }).click();
  835 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('PA 002');
  836 |             await expect(page.getByRole('heading', { level: 1 })).not.toContainText('PA 001');
  837 |         });
  838 | 
  839 |         test('PA 001 breadcrumb shows HFB 01, PA 002 breadcrumb also shows HFB 01', async ({ page }) => {
  840 |             await page.getByRole('button', { name: /Sofas.*001/ }).click();
  841 |             await expect(page.getByLabel('Breadcrumb').getByRole('link', { name: 'HFB 01' })).toBeVisible();
  842 |             await expect(page.getByLabel('Breadcrumb').getByText('PA 001')).toHaveAttribute('aria-current', 'page');
  843 | 
  844 |             await page.goBack();
  845 |             await page.getByRole('button', { name: /Armchairs.*002/ }).click();
  846 |             await expect(page.getByLabel('Breadcrumb').getByRole('link', { name: 'HFB 01' })).toBeVisible();
  847 |             await expect(page.getByLabel('Breadcrumb').getByText('PA 002')).toHaveAttribute('aria-current', 'page');
  848 |         });
  849 |     });
  850 | 
  851 |     test.describe('Direct URL navigation (specific IDs)', () => {
  852 |         test('direct URL /hfb/01 renders HFB 01 with correct title and breadcrumb', async ({ page }) => {
  853 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  854 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
  855 |             await expect(page.getByLabel('Breadcrumb').getByText('HFB 01')).toHaveAttribute('aria-current', 'page');
  856 |         });
  857 | 
  858 |         test('direct URL /hfb/02 renders HFB 02 with correct title and breadcrumb', async ({ page }) => {
  859 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/02', { metricsDelayMs: 250 });
  860 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 02');
  861 |             await expect(page.getByLabel('Breadcrumb').getByText('HFB 02')).toHaveAttribute('aria-current', 'page');
  862 |         });
  863 | 
  864 |         test('direct URL /hfb/05 renders HFB 05 — not HFB 01 or HFB 02', async ({ page }) => {
  865 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/05', { metricsDelayMs: 250 });
  866 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 05');
```