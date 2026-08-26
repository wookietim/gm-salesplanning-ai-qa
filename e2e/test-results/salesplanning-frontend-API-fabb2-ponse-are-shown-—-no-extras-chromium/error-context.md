# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: salesplanning-frontend.spec.js >> API data → UI binding >> Hierarchy API data → PA list rows >> only the PAs from the hierarchy response are shown — no extras
- Location: salesplanning-frontend.spec.js:2311:9

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.waitFor: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /UniquePA001/ }) to be visible

```

# Page snapshot

```yaml
- generic [active] [ref=e1]: 429 Too Many Requests
```

# Test source

```ts
  2213 |         const reqUrl = route.request().url();
  2214 |         if (reqUrl.includes(captureUrlPattern)) {
  2215 |             captured = mockBody;
  2216 |             await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockBody) });
  2217 |             return;
  2218 |         }
  2219 |         // Fallback for non-captured metrics. When the test overrides the
  2220 |         // hierarchy, KPI_SUMMARY children must follow it — the PA list is built
  2221 |         // from those children, not from the hierarchy endpoint.
  2222 |         const effectiveHierarchy =
  2223 |             captureUrlPattern === '/metrics/hierarchy' ? mockBody : hierarchyResponse;
  2224 |         const requestBody = route.request().postDataJSON();
  2225 |         const fallback = resolveMetricsResponse(requestBody, effectiveHierarchy);
  2226 |         await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fallback) });
  2227 |     });
  2228 | 
  2229 |     // Hierarchy — registered last (highest priority)
  2230 |     await page.route(/\/metrics\/hierarchy/, async (route) => {
  2231 |         if (hierarchyDelayMs > 0) await wait(hierarchyDelayMs);
  2232 |         const body = captureUrlPattern === '/metrics/hierarchy' ? mockBody : hierarchyResponse;
  2233 |         if (captureUrlPattern === '/metrics/hierarchy') captured = mockBody;
  2234 |         await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  2235 |     });
  2236 | 
  2237 |     await page.goto(url);
  2238 |     return captured;
  2239 | }
  2240 | 
  2241 | test.describe('API data → UI binding', () => {
  2242 |     test.describe('Graph user profile fields render in the user flyout', () => {
  2243 |         // The MSAL FAKE_TOKEN and fakeAccount both hard-code name = 'Test User', so
  2244 |         // the welcome page always shows "Hej, Test User" regardless of the Graph mock.
  2245 |         // The user flyout, however, fetches live profile data from MS Graph and renders
  2246 |         // it — so we assert the flyout fields against the standard graphUser mock.
  2247 | 
  2248 |         test('displayName from Graph API (Test User) renders in the welcome message', async ({ page }) => {
  2249 |             await gotoBypassAuth(page, '/', {});
  2250 |             // "Hej, <displayName>" is sourced from the MSAL token name which matches graphUser.displayName
  2251 |             await expect(page.getByText(`Hej, ${graphUser.displayName}`)).toBeVisible({ timeout: 10000 });
  2252 |         });
  2253 | 
  2254 |         test('displayName from Graph API renders inside the user flyout', async ({ page }) => {
  2255 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  2256 |             await page.getByRole('button', { name: 'Open user menu' }).click();
  2257 |             const modal = page.getByRole('dialog', { name: 'User menu' });
  2258 |             await expect(modal).toContainText(graphUser.displayName);
  2259 |         });
  2260 | 
  2261 |         test('jobTitle from Graph API renders inside the user flyout', async ({ page }) => {
  2262 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  2263 |             await page.getByRole('button', { name: 'Open user menu' }).click();
  2264 |             const modal = page.getByRole('dialog', { name: 'User menu' });
  2265 |             await expect(modal).toContainText(graphUser.jobTitle);
  2266 |         });
  2267 | 
  2268 |         test('email (mail) from Graph API renders inside the user flyout', async ({ page }) => {
  2269 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  2270 |             await page.getByRole('button', { name: 'Open user menu' }).click();
  2271 |             const modal = page.getByRole('dialog', { name: 'User menu' });
  2272 |             // The flyout shows country from the Graph profile, not the raw mail field
  2273 |             await expect(modal).toContainText(graphUser.country);
  2274 |         });
  2275 |     });
  2276 | 
  2277 |     test.describe('Hierarchy API data → PA list rows', () => {
  2278 |         // Uses a custom hierarchy response with unique names to verify field-level binding
  2279 |         const customHierarchy = [
  2280 |             {
  2281 |                 hfbNo: '01',
  2282 |                 hfbName: 'TestLivingRoom',
  2283 |                 pras: [
  2284 |                     {
  2285 |                         praNo: '100',
  2286 |                         praName: 'TestSeating',
  2287 |                         pas: [
  2288 |                             { paNo: '001', paName: 'UniquePA001' },
  2289 |                             { paNo: '002', paName: 'UniquePA002' },
  2290 |                             { paNo: '003', paName: 'UniquePA003' },
  2291 |                         ],
  2292 |                     },
  2293 |                 ],
  2294 |             },
  2295 |         ];
  2296 | 
  2297 |         test('PA names from hierarchy response appear as PA row buttons on the HFB page', async ({ page }) => {
  2298 |             await gotoAndCapture(page, '/region-dashboard/se/hfb/01', '/metrics/hierarchy', customHierarchy, { metricsDelayMs: 250 });
  2299 |             await expect(page.getByRole('button', { name: /UniquePA001/ })).toBeVisible();
  2300 |             await expect(page.getByRole('button', { name: /UniquePA002/ })).toBeVisible();
  2301 |             await expect(page.getByRole('button', { name: /UniquePA003/ })).toBeVisible();
  2302 |         });
  2303 | 
  2304 |         test('PA numbers from hierarchy response appear in PA row buttons', async ({ page }) => {
  2305 |             await gotoAndCapture(page, '/region-dashboard/se/hfb/01', '/metrics/hierarchy', customHierarchy, { metricsDelayMs: 250 });
  2306 |             await expect(page.getByRole('button', { name: /UniquePA001.*001/ })).toBeVisible();
  2307 |             await expect(page.getByRole('button', { name: /UniquePA002.*002/ })).toBeVisible();
  2308 |             await expect(page.getByRole('button', { name: /UniquePA003.*003/ })).toBeVisible();
  2309 |         });
  2310 | 
  2311 |         test('only the PAs from the hierarchy response are shown — no extras', async ({ page }) => {
  2312 |             await gotoAndCapture(page, '/region-dashboard/se/hfb/01', '/metrics/hierarchy', customHierarchy, { metricsDelayMs: 250 });
> 2313 |             await page.getByRole('button', { name: /UniquePA001/ }).waitFor();
       |                                                                     ^ Error: locator.waitFor: Test timeout of 30000ms exceeded.
  2314 |             // The default "Armchairs" from the original mock must NOT appear
  2315 |             await expect(page.getByRole('button', { name: /Armchairs/ })).not.toBeVisible();
  2316 |         });
  2317 | 
  2318 |         test('clicking a PA row navigates to the URL built from the hierarchy paNo', async ({ page }) => {
  2319 |             await gotoAndCapture(page, '/region-dashboard/se/hfb/01', '/metrics/hierarchy', customHierarchy, { metricsDelayMs: 250 });
  2320 |             await page.getByRole('button', { name: /UniquePA003/ }).click();
  2321 |             await expect(page).toHaveURL(/\/region-dashboard\/se\/hfb\/01\/pa\/003$/);
  2322 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('PA 003');
  2323 |         });
  2324 | 
  2325 |         test('PA page heading uses the paNo from the hierarchy response, not a hard-coded value', async ({ page }) => {
  2326 |             await gotoAndCapture(page, '/region-dashboard/se/hfb/01/pa/002', '/metrics/hierarchy', customHierarchy, { metricsDelayMs: 250 });
  2327 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('PA 002');
  2328 |             await expect(page.getByRole('heading', { level: 1 })).not.toContainText('PA 001');
  2329 |             await expect(page.getByRole('heading', { level: 1 })).not.toContainText('PA 003');
  2330 |         });
  2331 |     });
  2332 | 
  2333 |     test.describe('Weekly metrics API data → Sales by week chart', () => {
  2334 |         // Uses a custom weekly metrics response with distinct values to verify binding
  2335 |         const customWeekly = {
  2336 |             data: {
  2337 |                 data: [
  2338 |                     {
  2339 |                         ikeaWeek: '202734',
  2340 |                         weeklyNetSalesCy: 3456789,
  2341 |                         weeklyNetSalesLy: 2345678,
  2342 |                         weeklyForecastedSalesCy: 4567890,
  2343 |                         weeklyNetSalesTrendIndex: 147,
  2344 |                         weeklyForecastedSalesIndex: 152,
  2345 |                         weeklyNetQuantityCy: 3456,
  2346 |                         weeklyNetQuantityLy: 2345,
  2347 |                         weeklyForecastedQuantityCy: 4567,
  2348 |                         weeklyNetQuantityTrendIndex: 147,
  2349 |                         weeklyForecastedQuantityIndex: 152,
  2350 |                     },
  2351 |                 ],
  2352 |             },
  2353 |         };
  2354 | 
  2355 |         test('SalesByWeek section is visible and not in an error state when metrics API returns data', async ({ page }) => {
  2356 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  2357 |             const section = page.getByLabel('Sales by week');
  2358 |             await expect(section).toBeVisible();
  2359 |             await expect(section).not.toContainText('unavailable');
  2360 |         });
  2361 | 
  2362 |         test('SalesByWeek section renders on the HFB page when metrics API returns data', async ({ page }) => {
  2363 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  2364 |             await expect(page.getByLabel('Sales by week')).toBeVisible();
  2365 |             await expect(page.getByLabel('Sales by week')).not.toContainText('unavailable');
  2366 |         });
  2367 | 
  2368 |         test('SalesByWeek section renders on the PA page when metrics API returns data', async ({ page }) => {
  2369 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 250 });
  2370 |             await expect(page.getByLabel('Sales by week')).toBeVisible();
  2371 |             await expect(page.getByLabel('Sales by week')).not.toContainText('unavailable');
  2372 |         });
  2373 | 
  2374 |         test('SalesByWeek does NOT show the error message when /metrics returns 200', async ({ page }) => {
  2375 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  2376 |             await expect(page.getByLabel('Sales by week')).not.toContainText(SALES_BY_WEEK_ERROR_TEXT, { timeout: 5000 });
  2377 |         });
  2378 | 
  2379 |         test('switching to "Sales" segment reflects that the section is still populated (no error)', async ({ page }) => {
  2380 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  2381 |             const section = page.getByLabel('Sales by week');
  2382 |             await section.getByRole('button', { name: 'Sales', exact: true }).click();
  2383 |             await expect(section).not.toContainText('unavailable');
  2384 |         });
  2385 | 
  2386 |         test('switching to "Qty" segment does not produce an error when metrics data is available', async ({ page }) => {
  2387 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  2388 |             const section = page.getByLabel('Sales by week');
  2389 |             await section.getByRole('button', { name: 'Qty', exact: true }).click();
  2390 |             await expect(section).not.toContainText('unavailable');
  2391 |         });
  2392 |     });
  2393 | 
  2394 |     test.describe('Rolling trend API data → SalesIndexTrend section', () => {
  2395 |         // Custom rolling trend response — unique values so we can assert binding
  2396 |         const customRolling = {
  2397 |             data: {
  2398 |                 data: [
  2399 |                     {
  2400 |                         ytdNetSalesIndex: 134,
  2401 |                         r13NetSalesIndex: 133,
  2402 |                         r8NetSalesIndex: 132,
  2403 |                         r4NetSalesIndex: 135,
  2404 |                         r1NetSalesIndex: 136,
  2405 |                     },
  2406 |                 ],
  2407 |             },
  2408 |         };
  2409 | 
  2410 |         test('SalesIndexTrend section is visible on the country dashboard when rolling trend API returns data', async ({ page }) => {
  2411 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  2412 |             await expect(page.getByLabel('Trends - Sales index vs LY')).toBeVisible();
  2413 |         });
```