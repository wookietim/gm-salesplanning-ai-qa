# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: salesplanning-frontend.spec.js >> API data → UI binding >> Weekly metrics API data → Sales by week chart >> SalesByWeek section is visible and not in an error state when metrics API returns data
- Location: salesplanning-frontend.spec.js:2355:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByLabel('Sales by week')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByLabel('Sales by week')

```

```yaml
- text: 429 Too Many Requests
```

# Test source

```ts
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
  2313 |             await page.getByRole('button', { name: /UniquePA001/ }).waitFor();
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
> 2358 |             await expect(section).toBeVisible();
       |                                   ^ Error: expect(locator).toBeVisible() failed
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
  2414 | 
  2415 |         test('SalesIndexTrend section is visible on the HFB dashboard when rolling trend API returns data', async ({ page }) => {
  2416 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  2417 |             await expect(page.getByRole('region', { name: /Trends - Sales index vs LY/ })).toBeVisible();
  2418 |         });
  2419 | 
  2420 |         test('SalesIndexTrend section is visible on the PA dashboard when rolling trend API returns data', async ({ page }) => {
  2421 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 250 });
  2422 |             await expect(page.getByRole('region', { name: /Trends - Sales index vs LY/ })).toBeVisible();
  2423 |         });
  2424 | 
  2425 |         test('SalesIndexTrend does NOT show error text when /metrics returns 200', async ({ page }) => {
  2426 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  2427 |             await expect(page.getByRole('region', { name: /Trends - Sales index vs LY/ })).not.toContainText('unavailable', { timeout: 5000 });
  2428 |         });
  2429 | 
  2430 |         test('SalesIndexTrend on HFB page does NOT show error text when /metrics returns 200', async ({ page }) => {
  2431 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  2432 |             await expect(page.getByRole('region', { name: /Trends - Sales index vs LY/ })).not.toContainText('unavailable', { timeout: 5000 });
  2433 |         });
  2434 |     });
  2435 | 
  2436 |     test.describe('KpiSummaryCard metric values are sourced from the API response', () => {
  2437 |         // The country-level KPI card renders fixed mock values. We verify that
  2438 |         // the rendered numbers match the mock constants (not some other source).
  2439 |         // If the API binding breaks, the card would show 0 or a stale value.
  2440 |         // The KpiSummaryCard is wrapped in generic divs (not a section), so we
  2441 |         // wait for its heading to confirm the card is loaded, then assert on body.
  2442 | 
  2443 |         test('country dashboard KpiSummaryCard shows vsLatestForecast value from mock (98)', async ({ page }) => {
  2444 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  2445 |             await expect(page.getByRole('heading', { name: 'FY26 sales index' })).toBeVisible();
  2446 |             await expect(page.locator('body')).toContainText('98');
  2447 |         });
  2448 | 
  2449 |         test('country dashboard KpiSummaryCard shows toGo value from mock (106)', async ({ page }) => {
  2450 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  2451 |             await expect(page.getByRole('heading', { name: 'FY26 sales index' })).toBeVisible();
  2452 |             await expect(page.locator('body')).toContainText('106');
  2453 |         });
  2454 | 
  2455 |         test('country dashboard KpiSummaryCard shows the hero index value from mock (94)', async ({ page }) => {
  2456 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  2457 |             await expect(page.getByRole('heading', { name: 'FY26 sales index' })).toBeVisible();
  2458 |             await expect(page.locator('body')).toContainText('94');
```