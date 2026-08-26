# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: salesplanning-frontend.spec.js >> Keyboard navigation >> "Go back" button on HFB page is reachable via Tab
- Location: salesplanning-frontend.spec.js:2093:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [ref=e1]: 429 Too Many Requests
```

# Test source

```ts
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
  2046 |         await expect(spinner).toHaveAttribute('aria-live', 'polite');
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
> 2097 |         expect(reached).toBe(true);
       |                         ^ Error: expect(received).toBe(expected) // Object.is equality
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
  2147 | 
  2148 | // ─── API data → UI binding ────────────────────────────────────────────────────
  2149 | //
  2150 | // These tests intercept each API endpoint, capture its response body, and then
  2151 | // assert that every significant field value is correctly displayed in the UI.
  2152 | // They use a custom gotoAuthenticated variant that records the actual response
  2153 | // JSON so assertions can reference it directly rather than hard-coding numbers.
  2154 | //
  2155 | // Pattern for every test:
  2156 | //   1. Register a page.route() handler that fulfils the request AND stores
  2157 | //      the response body in a `captured` variable.
  2158 | //   2. Navigate to the page via gotoAuthenticated (which also registers routes —
  2159 | //      the last-registered handler wins in Playwright's stack so we register
  2160 | //      our capturing handler AFTER gotoAuthenticated returns but we use a
  2161 | //      helper that registers BEFORE navigation).
  2162 | //   3. Wait for the page to stabilise then assert each captured field value
  2163 | //      appears in the expected DOM location.
  2164 | 
  2165 | /**
  2166 |  * Navigate as an authenticated user while capturing a specific API response.
  2167 |  *
  2168 |  * @param {import('@playwright/test').Page} page
  2169 |  * @param {string} url  - App URL to navigate to
  2170 |  * @param {string} captureUrlPattern  - URL substring to intercept (e.g. '/metrics/hierarchy')
  2171 |  * @param {object} mockBody  - The JSON body to fulfil the request with
  2172 |  * @param {object} [options]  - Same options as gotoAuthenticated
  2173 |  * @returns {Promise<object>} The captured response body
  2174 |  */
  2175 | async function gotoAndCapture(page, url, captureUrlPattern, mockBody, options = {}) {
  2176 |     let captured = null;
  2177 | 
  2178 |     // Seed MSAL + register standard mocks
  2179 |     const { graphDelayMs = 0, hierarchyDelayMs = 0, metricsDelayMs = 0 } = options;
  2180 | 
  2181 |     await page.addInitScript({ content: buildAuthInitScript(options) });
  2182 | 
  2183 |     // Standard auth mocks
  2184 |     await page.route('https://login.microsoftonline.com/**', async (route) => {
  2185 |         const reqUrl = route.request().url();
  2186 |         if (reqUrl.includes('discovery/instance')) {
  2187 |             await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tenant_discovery_endpoint: `https://login.microsoftonline.com/${TENANT_ID}/v2.0/.well-known/openid-configuration`, metadata: [{ preferred_network: 'login.windows.net', preferred_cache: 'login.windows.net', aliases: ['login.windows.net', 'login.microsoftonline.com'] }] }) });
  2188 |             return;
  2189 |         }
  2190 |         if (reqUrl.includes('.well-known/openid-configuration')) {
  2191 |             await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`, authorization_endpoint: `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`, token_endpoint: `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, end_session_endpoint: `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/logout`, jwks_uri: `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys` }) });
  2192 |             return;
  2193 |         }
  2194 |         if (reqUrl.includes('/token')) {
  2195 |             await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token_type: 'Bearer', scope: `User.Read ${API_SCOPE}`, expires_in: 3600, ext_expires_in: 3600, access_token: FAKE_TOKEN, id_token: FAKE_TOKEN }) });
  2196 |             return;
  2197 |         }
```