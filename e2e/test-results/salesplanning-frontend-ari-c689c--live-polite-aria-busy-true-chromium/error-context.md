# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: salesplanning-frontend.spec.js >> aria-live and aria-busy attributes on loading spinners >> SalesByWeek loading div: aria-live=polite, aria-busy=true
- Location: salesplanning-frontend.spec.js:2044:5

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator: getByLabel('Sales by week').getByRole('status')
Expected: "polite"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveAttribute" with timeout 5000ms
  - waiting for getByLabel('Sales by week').getByRole('status')

```

```yaml
- text: 429 Too Many Requests
```

# Test source

```ts
  1946 | });
  1947 | 
  1948 | test.describe('PlaceholderAvatar / user avatar', () => {
  1949 |     test.beforeEach(async ({ page }) => {
  1950 |         await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1951 |     });
  1952 | 
  1953 |     test('header renders either a placeholder avatar (role=img) or a user photo img', async ({ page }) => {
  1954 |         const avatarBtn = page.getByRole('button', { name: 'Open user menu' });
  1955 |         await expect(avatarBtn).toBeVisible();
  1956 |         const placeholder = avatarBtn.locator('[role="img"]');
  1957 |         const photo = avatarBtn.locator('img');
  1958 |         const hasPlaceholder = await placeholder.count() > 0;
  1959 |         const hasPhoto = await photo.count() > 0;
  1960 |         expect(hasPlaceholder || hasPhoto).toBe(true);
  1961 |     });
  1962 | 
  1963 |     test('placeholder avatar has aria-label containing the user display name', async ({ page }) => {
  1964 |         const placeholder = page.locator('[role="img"][aria-label="Test User"]');
  1965 |         if (await placeholder.count() > 0) {
  1966 |             await expect(placeholder).toBeVisible();
  1967 |             await expect(placeholder).toContainText('TU'); // initials for "Test User"
  1968 |         } else {
  1969 |             // Real photo loaded — verify User Avatar alt text instead
  1970 |             await expect(page.locator('img[alt="User Avatar"]')).toBeVisible();
  1971 |         }
  1972 |     });
  1973 | });
  1974 | 
  1975 | test.describe('SalesByWeek h3 title on all dashboard levels', () => {
  1976 |     test('"Sales by week" h3 heading renders on the country dashboard', async ({ page }) => {
  1977 |         await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1978 |         await expect(page.getByLabel('Sales by week')
  1979 |             .getByRole('heading', { level: 3 })).toContainText('Sales by week');
  1980 |     });
  1981 | 
  1982 |     test('"Sales by week" h3 heading renders on the HFB dashboard', async ({ page }) => {
  1983 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  1984 |         await expect(page.getByLabel('Sales by week')
  1985 |             .getByRole('heading', { level: 3 })).toContainText('Sales by week');
  1986 |     });
  1987 | 
  1988 |     test('"Sales by week" h3 heading renders on the PA dashboard', async ({ page }) => {
  1989 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 250 });
  1990 |         await expect(page.getByLabel('Sales by week')
  1991 |             .getByRole('heading', { level: 3 })).toContainText('Sales by week');
  1992 |     });
  1993 | });
  1994 | 
  1995 | test.describe('SalesIndexTrend loading state at HFB and PA level', () => {
  1996 |     test('SalesIndexTrend shows Loading trend data... on HFB page', async ({ page }) => {
  1997 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 1000 });
  1998 |         await expect(page.getByLabel('Trends - Sales index vs LY').getByRole('status'))
  1999 |             .toContainText('Loading trend data...');
  2000 |     });
  2001 | 
  2002 |     test('SalesIndexTrend shows Loading trend data... on PA page', async ({ page }) => {
  2003 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 1000 });
  2004 |         await expect(page.getByLabel('Trends - Sales index vs LY').getByRole('status'))
  2005 |             .toContainText('Loading trend data...');
  2006 |     });
  2007 | });
  2008 | 
  2009 | test.describe('SalesByWeek and SalesIndexTrend error states at HFB and PA level', () => {
  2010 |     const ERROR_MSG = 'Sales trend data is currently unavailable. Please try again later.';
  2011 | 
  2012 |     test('SalesByWeek shows error on HFB page when /metrics returns 500', async ({ page }) => {
  2013 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsStatus: 500 });
  2014 |         await expect(page.getByLabel('Sales by week')).toContainText(ERROR_MSG, { timeout: 20000 });
  2015 |     });
  2016 | 
  2017 |     test('SalesByWeek shows error on PA page when /metrics returns 500', async ({ page }) => {
  2018 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsStatus: 500 });
  2019 |         await expect(page.getByLabel('Sales by week')).toContainText(ERROR_MSG, { timeout: 20000 });
  2020 |     });
  2021 | 
  2022 |     test('SalesIndexTrend shows error on HFB page when /metrics returns 500', async ({ page }) => {
  2023 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsStatus: 500 });
  2024 |         await expect(page.getByLabel('Trends - Sales index vs LY')).toContainText(ERROR_MSG, { timeout: 20000 });
  2025 |     });
  2026 | 
  2027 |     test('SalesIndexTrend shows error on PA page when /metrics returns 500', async ({ page }) => {
  2028 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsStatus: 500 });
  2029 |         await expect(page.getByLabel('Trends - Sales index vs LY')).toContainText(ERROR_MSG, { timeout: 20000 });
  2030 |     });
  2031 | });
  2032 | 
  2033 | test.describe('aria-live and aria-busy attributes on loading spinners', () => {
  2034 |     test.beforeEach(async ({ page }) => {
  2035 |         await gotoBypassAuth(page, '/region-dashboard/se/', { hfbDelayMs: 500, metricsDelayMs: 500 });
  2036 |     });
  2037 | 
  2038 |     test('HFB list loading div: aria-live=polite, aria-busy=true', async ({ page }) => {
  2039 |         const spinner = page.getByLabel('HFB list navigation').getByRole('status');
  2040 |         await expect(spinner).toHaveAttribute('aria-live', 'polite');
  2041 |         await expect(spinner).toHaveAttribute('aria-busy', 'true');
  2042 |     });
  2043 | 
  2044 |     test('SalesByWeek loading div: aria-live=polite, aria-busy=true', async ({ page }) => {
  2045 |         const spinner = page.getByLabel('Sales by week').getByRole('status');
> 2046 |         await expect(spinner).toHaveAttribute('aria-live', 'polite');
       |                               ^ Error: expect(locator).toHaveAttribute(expected) failed
  2047 |         await expect(spinner).toHaveAttribute('aria-busy', 'true');
  2048 |     });
  2049 | 
  2050 |     test('SalesIndexTrend loading div: aria-live=polite, aria-busy=true', async ({ page }) => {
  2051 |         const spinner = page.getByLabel('Trends - Sales index vs LY').getByRole('status');
  2052 |         await expect(spinner).toHaveAttribute('aria-live', 'polite');
  2053 |         await expect(spinner).toHaveAttribute('aria-busy', 'true');
  2054 |     });
  2055 | });
  2056 | 
  2057 | test.describe('Keyboard navigation', () => {
  2058 |     async function tabUntil(page, matcher, maxTabs = 40) {
  2059 |         for (let i = 0; i < maxTabs; i++) {
  2060 |             await page.keyboard.press('Tab');
  2061 |             const active = await page.evaluate(() => {
  2062 |                 const el = document.activeElement;
  2063 |                 if (!el) return { text: '', label: '' };
  2064 |                 return {
  2065 |                     text: (el.textContent || '').trim(),
  2066 |                     label: el.getAttribute('aria-label') || '',
  2067 |                 };
  2068 |             });
  2069 |             if (matcher(active)) return true;
  2070 |         }
  2071 |         return false;
  2072 |     }
  2073 | 
  2074 |     test('Tab key can reach a "View HFB plan" button on the region dashboard', async ({ page }) => {
  2075 |         await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  2076 |         await page.getByRole('button', { name: 'View HFB plan' }).first().waitFor();
  2077 |         await page.locator('body').click();
  2078 |         const reached = await tabUntil(page, (active) => active.text.includes('View HFB plan'));
  2079 |         expect(reached).toBe(true);
  2080 |     });
  2081 | 
  2082 |     test('Enter key on a focused "View HFB plan" button navigates to the HFB page', async ({ page }) => {
  2083 |         await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  2084 |         await page.getByRole('button', { name: 'View HFB plan' }).first().waitFor();
  2085 |         await page.locator('body').click();
  2086 |         const reached = await tabUntil(page, (active) => active.text.includes('View HFB plan'));
  2087 |         if (reached) {
  2088 |             await page.keyboard.press('Enter');
  2089 |         }
  2090 |         await expect(page).toHaveURL(/\/region-dashboard\/se\/hfb\/\d+$/);
  2091 |     });
  2092 | 
  2093 |     test('"Go back" button on HFB page is reachable via Tab', async ({ page }) => {
  2094 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  2095 |         await page.locator('body').click();
  2096 |         const reached = await tabUntil(page, (active) => active.label === 'Go back', 60);
  2097 |         expect(reached).toBe(true);
  2098 |     });
  2099 | 
  2100 |     test('Escape closes the user flyout modal (keyboard accessibility)', async ({ page }) => {
  2101 |         await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  2102 |         await page.getByRole('button', { name: 'Open user menu' }).click();
  2103 |         const dialog = page.getByRole('dialog', { name: 'User menu' });
  2104 |         await expect(dialog).toBeVisible();
  2105 |         // toBeVisible resolves while the sheet is still mid enter-animation, and an
  2106 |         // Escape sent during that transition is ignored. Under full-suite parallel
  2107 |         // load the animation lags enough to make this flaky, so wait for it to settle.
  2108 |         await dialog.evaluate((el) =>
  2109 |             Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  2110 |         );
  2111 |         await page.keyboard.press('Escape');
  2112 |         await expect(dialog).not.toBeVisible();
  2113 |     });
  2114 | 
  2115 |     test('Sales Planning header link is keyboard focusable and Enter navigates home', async ({ page }) => {
  2116 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  2117 |         const homeLink = page.getByRole('link', { name: 'Sales Planning' });
  2118 |         await homeLink.focus();
  2119 |         await expect(homeLink).toBeFocused();
  2120 |         await page.keyboard.press('Enter');
  2121 |         await expect(page).toHaveURL(/\/$/);
  2122 |     });
  2123 | });
  2124 | 
  2125 | test.describe('PaFamilyListRow MetricRowCell content', () => {
  2126 |     test.beforeEach(async ({ page }) => {
  2127 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', {
  2128 |             hierarchyDelayMs: 250,
  2129 |             metricsDelayMs: 250,
  2130 |         });
  2131 |         await page.getByRole('button', { name: /Sofas.*001/ }).waitFor();
  2132 |     });
  2133 | 
  2134 |     test('PA rows show all four MetricRowCell labels: vs goal, vs demand plan, vs last year, To-go', async ({ page }) => {
  2135 |         const paSection = page.getByLabel('PA list navigation');
  2136 |         for (const label of ['vs goal', 'vs demand plan', 'vs last year', 'To-go']) {
  2137 |             await expect(paSection).toContainText(label);
  2138 |         }
  2139 |     });
  2140 | 
  2141 |     test('PA rows show numeric values alongside the metric labels', async ({ page }) => {
  2142 |         const firstPaRow = page.getByRole('button', { name: /Sofas.*001/ });
  2143 |         // Mock values are in range 78–122 — verify numeric content is present
  2144 |         await expect(firstPaRow).toContainText(/\d+/);
  2145 |     });
  2146 | });
```