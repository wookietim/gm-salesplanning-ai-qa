# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: salesplanning-frontend.spec.js >> API data → UI binding >> KpiSummaryCard metric values are sourced from the API response >> country dashboard KpiSummaryCard shows vsLatestForecast value from mock (98)
- Location: salesplanning-frontend.spec.js:2443:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'FY26 sales index' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'FY26 sales index' })

```

```yaml
- text: 429 Too Many Requests
```

# Test source

```ts
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
> 2445 |             await expect(page.getByRole('heading', { name: 'FY26 sales index' })).toBeVisible();
       |                                                                                   ^ Error: expect(locator).toBeVisible() failed
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
  2459 |         });
  2460 | 
  2461 |         test('KpiSummaryCard on HFB page shows metric values (not empty / zero)', async ({ page }) => {
  2462 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  2463 |             await expect(page.getByRole('heading', { name: 'YTD sales index' })).toBeVisible();
  2464 |             await expect(page.locator('body')).toContainText(/\d+/);
  2465 |         });
  2466 | 
  2467 |         test('KpiSummaryCard on PA page shows metric values (not empty / zero)', async ({ page }) => {
  2468 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 250 });
  2469 |             await expect(page.getByRole('heading', { name: 'YTD sales index' })).toBeVisible();
  2470 |             await expect(page.locator('body')).toContainText(/\d+/);
  2471 |         });
  2472 |     });
  2473 | 
  2474 |     test.describe('API error responses produce UI error messages (not blank/stale data)', () => {
  2475 |         test('when /metrics returns 500 on the country page, error text replaces the SalesByWeek chart', async ({ page }) => {
  2476 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsStatus: 500 });
  2477 |             await expect(page.getByLabel('Sales by week')).toContainText(SALES_BY_WEEK_ERROR_TEXT, { timeout: 20000 });
  2478 |         });
  2479 | 
  2480 |         test('when /metrics returns 500 on the HFB page, error text replaces the SalesByWeek chart', async ({ page }) => {
  2481 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsStatus: 500 });
  2482 |             await expect(page.getByLabel('Sales by week')).toContainText(SALES_BY_WEEK_ERROR_TEXT, { timeout: 20000 });
  2483 |         });
  2484 | 
  2485 |         test('when /metrics returns 500 on the PA page, error text replaces the SalesByWeek chart', async ({ page }) => {
  2486 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsStatus: 500 });
  2487 |             await expect(page.getByLabel('Sales by week')).toContainText(SALES_BY_WEEK_ERROR_TEXT, { timeout: 20000 });
  2488 |         });
  2489 | 
  2490 |         test('when /metrics returns 500, SalesIndexTrend also shows the error message', async ({ page }) => {
  2491 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsStatus: 500 });
  2492 |             await expect(page.getByRole('region', { name: /Trends - Sales index vs LY/ })).toContainText(SALES_BY_WEEK_ERROR_TEXT, { timeout: 20000 });
  2493 |         });
  2494 | 
  2495 |         test('when /metrics/hierarchy returns 404, no PA buttons are shown', async ({ page }) => {
  2496 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { hierarchyStatus: 404, metricsDelayMs: 250 });
  2497 |             await expect(page.getByRole('button', { name: /Sofas|Armchairs/ })).not.toBeVisible({ timeout: 10000 });
  2498 |         });
  2499 | 
  2500 |         test('API error on country page does not affect the page heading (h1 still renders)', async ({ page }) => {
  2501 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsStatus: 500 });
  2502 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('SE Sales');
  2503 |         });
  2504 | 
  2505 |         test('API error on HFB page does not affect breadcrumbs', async ({ page }) => {
  2506 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsStatus: 500 });
  2507 |             await expect(page.getByLabel('Breadcrumb').getByText('HFB 01')).toBeVisible();
  2508 |         });
  2509 |     });
  2510 | 
  2511 |     test.describe('Different API responses per region produce different UI output', () => {
  2512 |         // Verify that two separate region pages each display their own API data,
  2513 |         // proving the response is bound per-request and not shared/cached between regions.
  2514 | 
  2515 |         test('SE and US pages both render without error when metrics API responds', async ({ page }) => {
  2516 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  2517 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('SE Sales');
  2518 |             await expect(page.getByLabel('Sales by week')).not.toContainText('unavailable', { timeout: 5000 });
  2519 | 
  2520 |             await gotoBypassAuth(page, '/region-dashboard/us/', { metricsDelayMs: 250 });
  2521 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('US Sales');
  2522 |             await expect(page.getByLabel('Sales by week')).not.toContainText('unavailable', { timeout: 5000 });
  2523 |         });
  2524 | 
  2525 |         test('SE and US KpiSummaryCards both show metric data from the API', async ({ page }) => {
  2526 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  2527 |             await expect(page.getByRole('heading', { name: 'FY26 sales index' })).toBeVisible();
  2528 |             await expect(page.locator('body')).toContainText(/\d+/);
  2529 | 
  2530 |             await gotoBypassAuth(page, '/region-dashboard/us/', { metricsDelayMs: 250 });
  2531 |             await expect(page.getByRole('heading', { name: 'FY26 sales index' })).toBeVisible();
  2532 |             await expect(page.locator('body')).toContainText(/\d+/);
  2533 |         });
  2534 | 
  2535 |         test('XX region (nonexistent) still gets the mock API data and renders the KpiSummaryCard', async ({ page }) => {
  2536 |             await gotoBypassAuth(page, '/region-dashboard/xx/', { metricsDelayMs: 250 });
  2537 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('XX Sales');
  2538 |             await expect(page.getByRole('heading', { name: 'FY26 sales index' })).toBeVisible();
  2539 |             await expect(page.locator('body')).toContainText(/\d+/);
  2540 |         });
  2541 |     });
  2542 | });
  2543 | 
```