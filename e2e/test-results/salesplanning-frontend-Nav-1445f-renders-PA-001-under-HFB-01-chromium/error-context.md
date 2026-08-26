# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: salesplanning-frontend.spec.js >> Navigation path specificity >> Direct URL navigation (specific IDs) >> direct URL /hfb/01/pa/001 renders PA 001 under HFB 01
- Location: salesplanning-frontend.spec.js:871:9

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
  867 |             await expect(page.getByRole('heading', { level: 1 })).not.toContainText('HFB 01');
  868 |             await expect(page.getByRole('heading', { level: 1 })).not.toContainText('HFB 02');
  869 |         });
  870 | 
  871 |         test('direct URL /hfb/01/pa/001 renders PA 001 under HFB 01', async ({ page }) => {
  872 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 250 });
> 873 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('PA 001');
      |                                                                   ^ Error: expect(locator).toContainText(expected) failed
  874 |             await expect(page.getByLabel('Breadcrumb').getByRole('link', { name: 'HFB 01' })).toBeVisible();
  875 |         });
  876 | 
  877 |         test('direct URL /hfb/01/pa/002 renders PA 002 — not PA 001', async ({ page }) => {
  878 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/002', { metricsDelayMs: 250 });
  879 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('PA 002');
  880 |             await expect(page.getByRole('heading', { level: 1 })).not.toContainText('PA 001');
  881 |         });
  882 | 
  883 |         test('direct URL /hfb/02/pa/001 renders PA 001 under HFB 02 (different parent breadcrumb)', async ({ page }) => {
  884 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/02/pa/001', { metricsDelayMs: 250 });
  885 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('PA 001');
  886 |             await expect(page.getByLabel('Breadcrumb').getByRole('link', { name: 'HFB 02' })).toBeVisible();
  887 |         });
  888 |     });
  889 | 
  890 |     test.describe('Multi-hop journeys', () => {
  891 |         test('Region → HFB 01 (click) → back → HFB 02 (click) → back → Region', async ({ page }) => {
  892 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  893 |             await page.getByRole('button', { name: 'View HFB plan' }).first().waitFor();
  894 | 
  895 |             await clickHfbCard(page, '01');
  896 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
  897 | 
  898 |             await page.getByRole('button', { name: 'Go back' }).click();
  899 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('SE Sales');
  900 |             await page.getByRole('button', { name: 'View HFB plan' }).first().waitFor();
  901 | 
  902 |             await clickHfbCard(page, '02');
  903 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 02');
  904 | 
  905 |             await page.getByRole('button', { name: 'Go back' }).click();
  906 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('SE Sales');
  907 |         });
  908 | 
  909 |         test('Region → HFB 01 (click) → PA 001 (click) → back to HFB 01 → PA 002 (click)', async ({ page }) => {
  910 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250, hierarchyDelayMs: 250 });
  911 |             await page.getByRole('button', { name: 'View HFB plan' }).first().waitFor();
  912 | 
  913 |             await clickHfbCard(page, '01');
  914 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
  915 |             await page.getByRole('button', { name: /Sofas.*001/ }).waitFor();
  916 | 
  917 |             await page.getByRole('button', { name: /Sofas.*001/ }).click();
  918 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('PA 001');
  919 | 
  920 |             await page.getByRole('button', { name: 'Go back' }).click();
  921 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
  922 |             await page.getByRole('button', { name: /Armchairs.*002/ }).waitFor();
  923 | 
  924 |             await page.getByRole('button', { name: /Armchairs.*002/ }).click();
  925 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('PA 002');
  926 |         });
  927 | 
  928 |         test('Full breadcrumb round-trip: Region → HFB 01 → PA 001 → breadcrumb HFB 01 → breadcrumb SE → Region', async ({ page }) => {
  929 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 250 });
  930 | 
  931 |             // PA 001 → HFB 01 via breadcrumb
  932 |             await page.getByLabel('Breadcrumb').getByRole('link', { name: 'HFB 01' }).click();
  933 |             await expect(page).toHaveURL(/\/region-dashboard\/se\/hfb\/01$/);
  934 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
  935 | 
  936 |             // HFB 01 → Region via breadcrumb
  937 |             await page.getByLabel('Breadcrumb').getByRole('link', { name: 'SE' }).click();
  938 |             await expect(page).toHaveURL(/\/region-dashboard\/se\/?$/);
  939 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('SE Sales');
  940 |         });
  941 | 
  942 |         test('Each HFB page shows only its own data in the SalesIndexTrend title', async ({ page }) => {
  943 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  944 |             await expect(page.getByText(/Trends - Sales index vs LY - HFB 01/)).toBeVisible();
  945 | 
  946 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/02', { metricsDelayMs: 250 });
  947 |             await expect(page.getByText(/Trends - Sales index vs LY - HFB 02/)).toBeVisible();
  948 |             await expect(page.locator('body')).not.toContainText('Trends - Sales index vs LY - HFB 01');
  949 |         });
  950 | 
  951 |         test('Each PA page shows only its own data in the SalesIndexTrend title', async ({ page }) => {
  952 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 250 });
  953 |             await expect(page.getByText(/Trends - Sales index vs LY - PA 001/)).toBeVisible();
  954 | 
  955 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/002', { metricsDelayMs: 250 });
  956 |             await expect(page.getByText(/Trends - Sales index vs LY - PA 002/)).toBeVisible();
  957 |             await expect(page.locator('body')).not.toContainText('Trends - Sales index vs LY - PA 001');
  958 |         });
  959 |     });
  960 | });
  961 | 
  962 | test.describe('Error states', () => {
  963 |     test('HfbList shows error message when HFB performance data fails', async ({ page }) => {
  964 |         await gotoBypassAuth(page, '/region-dashboard/se/', { hfbError: true, metricsDelayMs: 250 });
  965 |         // TanStack Query retries 3× with exponential back-off — allow up to 20s
  966 |         await expect(
  967 |             page.getByText('HFB performance data is currently unavailable. Please try again later.'),
  968 |         ).toBeVisible({ timeout: 20000 });
  969 |     });
  970 | 
  971 |     test('PA list shows error message when PA performance data fails', async ({ page }) => {
  972 |         // PA rows come from the KPI_SUMMARY children at hfb level, so paError
  973 |         // fails that request and TanStack Query surfaces the error state.
```