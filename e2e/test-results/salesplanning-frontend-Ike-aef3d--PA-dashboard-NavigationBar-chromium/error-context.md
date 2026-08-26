# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: salesplanning-frontend.spec.js >> IkeaCurrentWeek component >> IKEA week is also visible on the PA dashboard NavigationBar
- Location: salesplanning-frontend.spec.js:1056:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('body')
Expected pattern: /Week \d+/
Received string:  "429 Too Many Requests"
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('body')
    14 × locator resolved to <body>429 Too Many Requests</body>
       - unexpected value "429 Too Many Requests"

```

```yaml
- text: 429 Too Many Requests
```

# Test source

```ts
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
  1045 |     test('renders the current IKEA week number in the NavigationBar', async ({ page }) => {
  1046 |         await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1047 |         // IkeaCurrentWeek renders "Week NNN" — the exact number is date-dependent
  1048 |         await expect(page.locator('body')).toContainText(/Week \d+/);
  1049 |     });
  1050 | 
  1051 |     test('IKEA week is also visible on the HFB dashboard NavigationBar', async ({ page }) => {
  1052 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  1053 |         await expect(page.locator('body')).toContainText(/Week \d+/);
  1054 |     });
  1055 | 
  1056 |     test('IKEA week is also visible on the PA dashboard NavigationBar', async ({ page }) => {
  1057 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 250 });
> 1058 |         await expect(page.locator('body')).toContainText(/Week \d+/);
       |                                            ^ Error: expect(locator).toContainText(expected) failed
  1059 |     });
  1060 | });
  1061 | 
  1062 | test.describe('SalesIndexTrend chart', () => {
  1063 |     test('renders on the region dashboard with the country-level title', async ({ page }) => {
  1064 |         await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1065 |         await expect(page.getByLabel('Trends - Sales index vs LY')).toBeVisible();
  1066 |         await expect(page.getByText('Trends - Sales index vs LY')).toBeVisible();
  1067 |     });
  1068 | 
  1069 |     test('renders on the HFB dashboard with the HFB-scoped title', async ({ page }) => {
  1070 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  1071 |         await expect(page.getByLabel('Trends - Sales index vs LY')).toBeVisible();
  1072 |         await expect(page.getByText(/Trends - Sales index vs LY - HFB 01/)).toBeVisible();
  1073 |     });
  1074 | 
  1075 |     test('renders on the PA dashboard with the PA-scoped title', async ({ page }) => {
  1076 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 250 });
  1077 |         await expect(page.getByLabel('Trends - Sales index vs LY')).toBeVisible();
  1078 |         await expect(page.getByText(/Trends - Sales index vs LY - PA 001/)).toBeVisible();
  1079 |     });
  1080 | 
  1081 |     test('shows loading state while trend data is fetching', async ({ page }) => {
  1082 |         await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 1000 });
  1083 |         await expect(
  1084 |             page.getByLabel('Trends - Sales index vs LY').getByRole('status'),
  1085 |         ).toContainText('Loading trend data...');
  1086 |     });
  1087 | 
  1088 |     test('shows error message when the metrics API returns 500', async ({ page }) => {
  1089 |         await gotoBypassAuth(page, '/region-dashboard/se/', { metricsStatus: 500 });
  1090 |         await expect(page.getByLabel('Trends - Sales index vs LY')).toContainText(
  1091 |             'Sales trend data is currently unavailable. Please try again later.',
  1092 |             { timeout: 20000 },
  1093 |         );
  1094 |     });
  1095 | });
  1096 | 
  1097 | test.describe('SalesByWeek SegmentControl (metric type switching)', () => {
  1098 |     test.beforeEach(async ({ page }) => {
  1099 |         await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1100 |     });
  1101 | 
  1102 |     test('defaults to Sales and shows all four metric options', async ({ page }) => {
  1103 |         const chart = page.getByLabel('Sales by week');
  1104 |         await expect(chart.getByRole('button', { name: 'Sales', exact: true })).toHaveAttribute('aria-pressed', 'true');
  1105 |         await expect(chart.getByRole('button', { name: 'Qty', exact: true })).toBeVisible();
  1106 |         await expect(chart.getByRole('button', { name: 'Sales index' })).toBeVisible();
  1107 |         await expect(chart.getByRole('button', { name: 'Qty index' })).toBeVisible();
  1108 |     });
  1109 | 
  1110 |     test('switches to Qty metric', async ({ page }) => {
  1111 |         const chart = page.getByLabel('Sales by week');
  1112 |         await chart.getByRole('button', { name: 'Qty', exact: true }).click();
  1113 |         await expect(chart.getByRole('button', { name: 'Qty', exact: true })).toHaveAttribute('aria-pressed', 'true');
  1114 |         await expect(chart.getByRole('button', { name: 'Sales', exact: true })).toHaveAttribute('aria-pressed', 'false');
  1115 |     });
  1116 | 
  1117 |     test('switches to Sales index metric', async ({ page }) => {
  1118 |         const chart = page.getByLabel('Sales by week');
  1119 |         await chart.getByRole('button', { name: 'Sales index' }).click();
  1120 |         await expect(chart.getByRole('button', { name: 'Sales index' })).toHaveAttribute('aria-pressed', 'true');
  1121 |     });
  1122 | 
  1123 |     test('switches to Qty index metric', async ({ page }) => {
  1124 |         const chart = page.getByLabel('Sales by week');
  1125 |         await chart.getByRole('button', { name: 'Qty index' }).click();
  1126 |         await expect(chart.getByRole('button', { name: 'Qty index' })).toHaveAttribute('aria-pressed', 'true');
  1127 |     });
  1128 | });
  1129 | 
  1130 | test.describe('ProductAreaSummaryList SegmentControl (metric type switching)', () => {
  1131 |     test.beforeEach(async ({ page }) => {
  1132 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', {
  1133 |             hierarchyDelayMs: 250,
  1134 |             metricsDelayMs: 250,
  1135 |         });
  1136 |     });
  1137 | 
  1138 |     test('defaults to Qty index and shows all four metric options', async ({ page }) => {
  1139 |         const paSection = page.getByLabel('PA list navigation');
  1140 |         await expect(paSection.getByRole('button', { name: 'Qty index' })).toHaveAttribute('aria-pressed', 'true');
  1141 |         await expect(paSection.getByRole('button', { name: 'Qty', exact: true })).toBeVisible();
  1142 |         await expect(paSection.getByRole('button', { name: 'Sales index' })).toBeVisible();
  1143 |         await expect(paSection.getByRole('button', { name: 'Sales', exact: true })).toBeVisible();
  1144 |     });
  1145 | 
  1146 |     test('switches to Sales index metric and PA rows remain visible', async ({ page }) => {
  1147 |         const paSection = page.getByLabel('PA list navigation');
  1148 |         await paSection.getByRole('button', { name: 'Sales index' }).click();
  1149 |         await expect(paSection.getByRole('button', { name: 'Sales index' })).toHaveAttribute('aria-pressed', 'true');
  1150 |         await expect(paSection.getByRole('button', { name: 'Qty index' })).toHaveAttribute('aria-pressed', 'false');
  1151 |         await expect(paSection.getByRole('button', { name: /Sofas.*001/ })).toBeVisible();
  1152 |     });
  1153 | 
  1154 |     test('switches to Qty metric', async ({ page }) => {
  1155 |         const paSection = page.getByLabel('PA list navigation');
  1156 |         await paSection.getByRole('button', { name: 'Qty', exact: true }).click();
  1157 |         await expect(paSection.getByRole('button', { name: 'Qty', exact: true })).toHaveAttribute('aria-pressed', 'true');
  1158 |     });
```