# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: salesplanning-frontend.spec.js >> Navigation path specificity >> Multi-hop journeys >> Each HFB page shows only its own data in the SalesIndexTrend title
- Location: salesplanning-frontend.spec.js:942:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/Trends - Sales index vs LY - HFB 01/)
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText(/Trends - Sales index vs LY - HFB 01/)

```

```yaml
- text: 429 Too Many Requests
```

# Test source

```ts
  844  |             await page.goBack();
  845  |             await page.getByRole('button', { name: /Armchairs.*002/ }).click();
  846  |             await expect(page.getByLabel('Breadcrumb').getByRole('link', { name: 'HFB 01' })).toBeVisible();
  847  |             await expect(page.getByLabel('Breadcrumb').getByText('PA 002')).toHaveAttribute('aria-current', 'page');
  848  |         });
  849  |     });
  850  | 
  851  |     test.describe('Direct URL navigation (specific IDs)', () => {
  852  |         test('direct URL /hfb/01 renders HFB 01 with correct title and breadcrumb', async ({ page }) => {
  853  |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  854  |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
  855  |             await expect(page.getByLabel('Breadcrumb').getByText('HFB 01')).toHaveAttribute('aria-current', 'page');
  856  |         });
  857  | 
  858  |         test('direct URL /hfb/02 renders HFB 02 with correct title and breadcrumb', async ({ page }) => {
  859  |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/02', { metricsDelayMs: 250 });
  860  |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 02');
  861  |             await expect(page.getByLabel('Breadcrumb').getByText('HFB 02')).toHaveAttribute('aria-current', 'page');
  862  |         });
  863  | 
  864  |         test('direct URL /hfb/05 renders HFB 05 — not HFB 01 or HFB 02', async ({ page }) => {
  865  |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/05', { metricsDelayMs: 250 });
  866  |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 05');
  867  |             await expect(page.getByRole('heading', { level: 1 })).not.toContainText('HFB 01');
  868  |             await expect(page.getByRole('heading', { level: 1 })).not.toContainText('HFB 02');
  869  |         });
  870  | 
  871  |         test('direct URL /hfb/01/pa/001 renders PA 001 under HFB 01', async ({ page }) => {
  872  |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 250 });
  873  |             await expect(page.getByRole('heading', { level: 1 })).toContainText('PA 001');
  874  |             await expect(page.getByLabel('Breadcrumb').getByRole('link', { name: 'HFB 01' })).toBeVisible();
  875  |         });
  876  | 
  877  |         test('direct URL /hfb/01/pa/002 renders PA 002 — not PA 001', async ({ page }) => {
  878  |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/002', { metricsDelayMs: 250 });
  879  |             await expect(page.getByRole('heading', { level: 1 })).toContainText('PA 002');
  880  |             await expect(page.getByRole('heading', { level: 1 })).not.toContainText('PA 001');
  881  |         });
  882  | 
  883  |         test('direct URL /hfb/02/pa/001 renders PA 001 under HFB 02 (different parent breadcrumb)', async ({ page }) => {
  884  |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/02/pa/001', { metricsDelayMs: 250 });
  885  |             await expect(page.getByRole('heading', { level: 1 })).toContainText('PA 001');
  886  |             await expect(page.getByLabel('Breadcrumb').getByRole('link', { name: 'HFB 02' })).toBeVisible();
  887  |         });
  888  |     });
  889  | 
  890  |     test.describe('Multi-hop journeys', () => {
  891  |         test('Region → HFB 01 (click) → back → HFB 02 (click) → back → Region', async ({ page }) => {
  892  |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  893  |             await page.getByRole('button', { name: 'View HFB plan' }).first().waitFor();
  894  | 
  895  |             await clickHfbCard(page, '01');
  896  |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
  897  | 
  898  |             await page.getByRole('button', { name: 'Go back' }).click();
  899  |             await expect(page.getByRole('heading', { level: 1 })).toContainText('SE Sales');
  900  |             await page.getByRole('button', { name: 'View HFB plan' }).first().waitFor();
  901  | 
  902  |             await clickHfbCard(page, '02');
  903  |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 02');
  904  | 
  905  |             await page.getByRole('button', { name: 'Go back' }).click();
  906  |             await expect(page.getByRole('heading', { level: 1 })).toContainText('SE Sales');
  907  |         });
  908  | 
  909  |         test('Region → HFB 01 (click) → PA 001 (click) → back to HFB 01 → PA 002 (click)', async ({ page }) => {
  910  |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250, hierarchyDelayMs: 250 });
  911  |             await page.getByRole('button', { name: 'View HFB plan' }).first().waitFor();
  912  | 
  913  |             await clickHfbCard(page, '01');
  914  |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
  915  |             await page.getByRole('button', { name: /Sofas.*001/ }).waitFor();
  916  | 
  917  |             await page.getByRole('button', { name: /Sofas.*001/ }).click();
  918  |             await expect(page.getByRole('heading', { level: 1 })).toContainText('PA 001');
  919  | 
  920  |             await page.getByRole('button', { name: 'Go back' }).click();
  921  |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
  922  |             await page.getByRole('button', { name: /Armchairs.*002/ }).waitFor();
  923  | 
  924  |             await page.getByRole('button', { name: /Armchairs.*002/ }).click();
  925  |             await expect(page.getByRole('heading', { level: 1 })).toContainText('PA 002');
  926  |         });
  927  | 
  928  |         test('Full breadcrumb round-trip: Region → HFB 01 → PA 001 → breadcrumb HFB 01 → breadcrumb SE → Region', async ({ page }) => {
  929  |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 250 });
  930  | 
  931  |             // PA 001 → HFB 01 via breadcrumb
  932  |             await page.getByLabel('Breadcrumb').getByRole('link', { name: 'HFB 01' }).click();
  933  |             await expect(page).toHaveURL(/\/region-dashboard\/se\/hfb\/01$/);
  934  |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
  935  | 
  936  |             // HFB 01 → Region via breadcrumb
  937  |             await page.getByLabel('Breadcrumb').getByRole('link', { name: 'SE' }).click();
  938  |             await expect(page).toHaveURL(/\/region-dashboard\/se\/?$/);
  939  |             await expect(page.getByRole('heading', { level: 1 })).toContainText('SE Sales');
  940  |         });
  941  | 
  942  |         test('Each HFB page shows only its own data in the SalesIndexTrend title', async ({ page }) => {
  943  |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
> 944  |             await expect(page.getByText(/Trends - Sales index vs LY - HFB 01/)).toBeVisible();
       |                                                                                 ^ Error: expect(locator).toBeVisible() failed
  945  | 
  946  |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/02', { metricsDelayMs: 250 });
  947  |             await expect(page.getByText(/Trends - Sales index vs LY - HFB 02/)).toBeVisible();
  948  |             await expect(page.locator('body')).not.toContainText('Trends - Sales index vs LY - HFB 01');
  949  |         });
  950  | 
  951  |         test('Each PA page shows only its own data in the SalesIndexTrend title', async ({ page }) => {
  952  |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 250 });
  953  |             await expect(page.getByText(/Trends - Sales index vs LY - PA 001/)).toBeVisible();
  954  | 
  955  |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/002', { metricsDelayMs: 250 });
  956  |             await expect(page.getByText(/Trends - Sales index vs LY - PA 002/)).toBeVisible();
  957  |             await expect(page.locator('body')).not.toContainText('Trends - Sales index vs LY - PA 001');
  958  |         });
  959  |     });
  960  | });
  961  | 
  962  | test.describe('Error states', () => {
  963  |     test('HfbList shows error message when HFB performance data fails', async ({ page }) => {
  964  |         await gotoBypassAuth(page, '/region-dashboard/se/', { hfbError: true, metricsDelayMs: 250 });
  965  |         // TanStack Query retries 3× with exponential back-off — allow up to 20s
  966  |         await expect(
  967  |             page.getByText('HFB performance data is currently unavailable. Please try again later.'),
  968  |         ).toBeVisible({ timeout: 20000 });
  969  |     });
  970  | 
  971  |     test('PA list shows error message when PA performance data fails', async ({ page }) => {
  972  |         // PA rows come from the KPI_SUMMARY children at hfb level, so paError
  973  |         // fails that request and TanStack Query surfaces the error state.
  974  |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { paError: true, metricsDelayMs: 250 });
  975  |         await expect(
  976  |             page.getByText('PA performance data is currently unavailable. Please try again later.'),
  977  |         ).toBeVisible({ timeout: 20000 });
  978  |     });
  979  | 
  980  |     test('SalesByWeek shows error message when metrics API returns 500', async ({ page }) => {
  981  |         await gotoBypassAuth(page, '/region-dashboard/se/', { hfbDelayMs: 250, metricsStatus: 500 });
  982  |         // TanStack Query retries 3× with exponential back-off — allow up to 20s
  983  |         await expect(page.getByLabel('Sales by week')).toContainText(SALES_BY_WEEK_ERROR_TEXT, { timeout: 20000 });
  984  |     });
  985  | });
  986  | 
  987  | test.describe('/accept_login route (MSAL redirect callback)', () => {
  988  |     test('loads without crashing (MSAL redirect callback page)', async ({ page }) => {
  989  |         await gotoAuthenticated(page, '/accept_login');
  990  |         // accept_login is designed as an MSAL redirect handler — when navigated to directly
  991  |         // it may immediately redirect away. Assert the page was served (title is the app or
  992  |         // Microsoft login) and no error page appeared.
  993  |         await expect.poll(async () => {
  994  |             const title = await page.title();
  995  |             return (
  996  |                 title === 'Sales planning tool' ||
  997  |                 title === '' ||
  998  |                 title === 'Sign in to your account' ||
  999  |                 title.includes('Microsoft')
  1000 |             );
  1001 |         }, { timeout: 10000 }).toBe(true);
  1002 |         await expect(page.locator('body')).not.toContainText('Application error');
  1003 |     });
  1004 | });
  1005 | 
  1006 | test.describe('User component (header avatar & flyout modal)', () => {
  1007 |     test.beforeEach(async ({ page }) => {
  1008 |         await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1009 |     });
  1010 | 
  1011 |     test('renders the user avatar button in the header', async ({ page }) => {
  1012 |         await expect(page.getByRole('button', { name: 'Open user menu' })).toBeVisible();
  1013 |     });
  1014 | 
  1015 |     test('opens the flyout modal showing the user display name, job title and country', async ({ page }) => {
  1016 |         await page.getByRole('button', { name: 'Open user menu' }).click();
  1017 |         const modal = page.getByRole('dialog', { name: 'User menu' });
  1018 |         await expect(modal).toBeVisible();
  1019 |         await expect(modal).toContainText('Test User');
  1020 |         await expect(modal).toContainText('Planner');
  1021 |         await expect(modal).toContainText('Sweden');
  1022 |     });
  1023 | 
  1024 |     test('closes the flyout when Escape is pressed', async ({ page }) => {
  1025 |         await page.getByRole('button', { name: 'Open user menu' }).click();
  1026 |         await expect(page.getByRole('dialog', { name: 'User menu' })).toBeVisible();
  1027 |         await page.keyboard.press('Escape');
  1028 |         await expect(page.getByRole('dialog', { name: 'User menu' })).not.toBeVisible();
  1029 |     });
  1030 | 
  1031 |     test('"Sign out" button is present in the modal and triggers sign-out navigation', async ({ page }) => {
  1032 |         await page.getByRole('button', { name: 'Open user menu' }).click();
  1033 |         const signOutBtn = page.getByRole('dialog', { name: 'User menu' })
  1034 |             .getByRole('button', { name: 'Sign out' });
  1035 |         await expect(signOutBtn).toBeVisible();
  1036 | 
  1037 |         // Clicking Sign out navigates to /_authenticated/signout which fires logoutRedirect.
  1038 |         // The browser ends up at the Microsoft logout endpoint or /signedout.
  1039 |         await signOutBtn.click();
  1040 |         await page.waitForURL(/\/(signout|signedout)$|login\.microsoftonline\.com/, { timeout: 15000 });
  1041 |     });
  1042 | });
  1043 | 
  1044 | test.describe('IkeaCurrentWeek component', () => {
```