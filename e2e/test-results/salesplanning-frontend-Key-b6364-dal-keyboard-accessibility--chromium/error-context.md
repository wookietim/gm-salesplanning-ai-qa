# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: salesplanning-frontend.spec.js >> Keyboard navigation >> Escape closes the user flyout modal (keyboard accessibility)
- Location: salesplanning-frontend.spec.js:2100:5

# Error details

```
Error: expect(locator).not.toBeVisible() failed

Locator:  getByRole('dialog', { name: 'User menu' })
Expected: not visible
Received: visible
Timeout:  5000ms

Call log:
  - Expect "not toBeVisible" with timeout 5000ms
  - waiting for getByRole('dialog', { name: 'User menu' })
    14 × locator resolved to <div role="dialog" tabindex="-1" aria-modal="true" aria-label="User menu" class="sheets sheets--small sheets--enter">…</div>
       - unexpected value "visible"

```

```yaml
- dialog "User menu":
  - button "Close"
  - img "User Avatar"
  - heading "Test User" [level=1]
  - paragraph: Planner
  - paragraph: Sweden
  - button "Sign out"
```

# Test source

```ts
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
  2097 |         expect(reached).toBe(true);
  2098 |     });
  2099 | 
  2100 |     test('Escape closes the user flyout modal (keyboard accessibility)', async ({ page }) => {
  2101 |         await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  2102 |         await page.getByRole('button', { name: 'Open user menu' }).click();
  2103 |         await expect(page.getByRole('dialog', { name: 'User menu' })).toBeVisible();
  2104 |         await page.keyboard.press('Escape');
> 2105 |         await expect(page.getByRole('dialog', { name: 'User menu' })).not.toBeVisible();
       |                                                                           ^ Error: expect(locator).not.toBeVisible() failed
  2106 |     });
  2107 | 
  2108 |     test('Sales Planning header link is keyboard focusable and Enter navigates home', async ({ page }) => {
  2109 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  2110 |         const homeLink = page.getByRole('link', { name: 'Sales Planning' });
  2111 |         await homeLink.focus();
  2112 |         await expect(homeLink).toBeFocused();
  2113 |         await page.keyboard.press('Enter');
  2114 |         await expect(page).toHaveURL(/\/$/);
  2115 |     });
  2116 | });
  2117 | 
  2118 | test.describe('PaFamilyListRow MetricRowCell content', () => {
  2119 |     test.beforeEach(async ({ page }) => {
  2120 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', {
  2121 |             hierarchyDelayMs: 250,
  2122 |             metricsDelayMs: 250,
  2123 |         });
  2124 |         await page.getByRole('button', { name: /Sofas.*001/ }).waitFor();
  2125 |     });
  2126 | 
  2127 |     test('PA rows show all four MetricRowCell labels: vs goal, vs demand plan, vs last year, To-go', async ({ page }) => {
  2128 |         const paSection = page.getByLabel('PA list navigation');
  2129 |         for (const label of ['vs goal', 'vs demand plan', 'vs last year', 'To-go']) {
  2130 |             await expect(paSection).toContainText(label);
  2131 |         }
  2132 |     });
  2133 | 
  2134 |     test('PA rows show numeric values alongside the metric labels', async ({ page }) => {
  2135 |         const firstPaRow = page.getByRole('button', { name: /Sofas.*001/ });
  2136 |         // Mock values are in range 78–122 — verify numeric content is present
  2137 |         await expect(firstPaRow).toContainText(/\d+/);
  2138 |     });
  2139 | });
  2140 | 
  2141 | // ─── API data → UI binding ────────────────────────────────────────────────────
  2142 | //
  2143 | // These tests intercept each API endpoint, capture its response body, and then
  2144 | // assert that every significant field value is correctly displayed in the UI.
  2145 | // They use a custom gotoAuthenticated variant that records the actual response
  2146 | // JSON so assertions can reference it directly rather than hard-coding numbers.
  2147 | //
  2148 | // Pattern for every test:
  2149 | //   1. Register a page.route() handler that fulfils the request AND stores
  2150 | //      the response body in a `captured` variable.
  2151 | //   2. Navigate to the page via gotoAuthenticated (which also registers routes —
  2152 | //      the last-registered handler wins in Playwright's stack so we register
  2153 | //      our capturing handler AFTER gotoAuthenticated returns but we use a
  2154 | //      helper that registers BEFORE navigation).
  2155 | //   3. Wait for the page to stabilise then assert each captured field value
  2156 | //      appears in the expected DOM location.
  2157 | 
  2158 | /**
  2159 |  * Navigate as an authenticated user while capturing a specific API response.
  2160 |  *
  2161 |  * @param {import('@playwright/test').Page} page
  2162 |  * @param {string} url  - App URL to navigate to
  2163 |  * @param {string} captureUrlPattern  - URL substring to intercept (e.g. '/metrics/hierarchy')
  2164 |  * @param {object} mockBody  - The JSON body to fulfil the request with
  2165 |  * @param {object} [options]  - Same options as gotoAuthenticated
  2166 |  * @returns {Promise<object>} The captured response body
  2167 |  */
  2168 | async function gotoAndCapture(page, url, captureUrlPattern, mockBody, options = {}) {
  2169 |     let captured = null;
  2170 | 
  2171 |     // Seed MSAL + register standard mocks
  2172 |     const { graphDelayMs = 0, hierarchyDelayMs = 0, metricsDelayMs = 0 } = options;
  2173 | 
  2174 |     await page.addInitScript({ content: buildAuthInitScript(options) });
  2175 | 
  2176 |     // Standard auth mocks
  2177 |     await page.route('https://login.microsoftonline.com/**', async (route) => {
  2178 |         const reqUrl = route.request().url();
  2179 |         if (reqUrl.includes('discovery/instance')) {
  2180 |             await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tenant_discovery_endpoint: `https://login.microsoftonline.com/${TENANT_ID}/v2.0/.well-known/openid-configuration`, metadata: [{ preferred_network: 'login.windows.net', preferred_cache: 'login.windows.net', aliases: ['login.windows.net', 'login.microsoftonline.com'] }] }) });
  2181 |             return;
  2182 |         }
  2183 |         if (reqUrl.includes('.well-known/openid-configuration')) {
  2184 |             await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`, authorization_endpoint: `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`, token_endpoint: `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, end_session_endpoint: `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/logout`, jwks_uri: `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys` }) });
  2185 |             return;
  2186 |         }
  2187 |         if (reqUrl.includes('/token')) {
  2188 |             await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token_type: 'Bearer', scope: `User.Read ${API_SCOPE}`, expires_in: 3600, ext_expires_in: 3600, access_token: FAKE_TOKEN, id_token: FAKE_TOKEN }) });
  2189 |             return;
  2190 |         }
  2191 |         await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  2192 |     });
  2193 | 
  2194 |     await page.route('https://graph.microsoft.com/**', async (route) => {
  2195 |         if (graphDelayMs > 0) await wait(graphDelayMs);
  2196 |         if (route.request().url().endsWith('/photo/$value')) {
  2197 |             await route.fulfill({ status: 200, contentType: 'image/png', body: 'avatar' });
  2198 |             return;
  2199 |         }
  2200 |         await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(graphUser) });
  2201 |     });
  2202 | 
  2203 |     // Metrics catch-all (lower priority — registered first)
  2204 |     await page.route(/\/metrics/, async (route) => {
  2205 |         if (metricsDelayMs > 0) await wait(metricsDelayMs);
```