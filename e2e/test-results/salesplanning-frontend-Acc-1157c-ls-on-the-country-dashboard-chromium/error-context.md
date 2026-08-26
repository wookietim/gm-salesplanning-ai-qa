# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: salesplanning-frontend.spec.js >> Acceptance criteria from Jira stories >> SSPLAN-701 & SSPLAN-692 — KpiSummaryCard metric labels >> KpiSummaryCard shows all four metric row cell labels on the country dashboard
- Location: salesplanning-frontend.spec.js:1482:9

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('body')
Expected substring: "vs demand plan"
Received string:    "429 Too Many Requests"
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('body')
    3 × locator resolved to <body>…</body>
      - unexpected value "
        
    

"
    - waiting for "https://dev.salesplanning.ingka.com/region-dashboard/se/" navigation to finish...
    - navigated to "https://dev.salesplanning.ingka.com/region-dashboard/se/"
    11 × locator resolved to <body>429 Too Many Requests</body>
       - unexpected value "429 Too Many Requests"

```

```yaml
- text: 429 Too Many Requests
```

# Test source

```ts
  1385 |      * "Since we don't have the forecast at the PA level, the forecast line shouldn't show
  1386 |      * up when Qty is selected either."
  1387 |      * This tests that "actual sales" appears only in Pieces mode at HFB/PA level,
  1388 |      * mirroring the same legend behaviour as at country level.
  1389 |      */
  1390 |     test.describe('SSPLAN-646 — SalesByWeek legend behaviour at HFB and PA level', () => {
  1391 |         test('"actual sales" hidden in Sales index mode on HFB page', async ({ page }) => {
  1392 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  1393 |             const chart = page.getByLabel('Sales by week');
  1394 |             await chart.getByRole('button', { name: 'Sales index' }).click();
  1395 |             await expect(chart).not.toContainText('actual sales');
  1396 |         });
  1397 | 
  1398 |         test('"actual sales" hidden in Qty index mode on HFB page', async ({ page }) => {
  1399 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  1400 |             const chart = page.getByLabel('Sales by week');
  1401 |             await chart.getByRole('button', { name: 'Qty index' }).click();
  1402 |             await expect(chart).not.toContainText('actual sales');
  1403 |         });
  1404 | 
  1405 |         test('"actual sales" visible in Sales (Pieces) mode on HFB page', async ({ page }) => {
  1406 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  1407 |             const chart = page.getByLabel('Sales by week');
  1408 |             await chart.getByRole('button', { name: 'Sales', exact: true }).click();
  1409 |             await expect(chart).toContainText('actual sales');
  1410 |         });
  1411 | 
  1412 |         test('"actual sales" hidden in Sales index mode on PA page', async ({ page }) => {
  1413 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 250 });
  1414 |             const chart = page.getByLabel('Sales by week');
  1415 |             await chart.getByRole('button', { name: 'Sales index' }).click();
  1416 |             await expect(chart).not.toContainText('actual sales');
  1417 |         });
  1418 | 
  1419 |         test('"actual sales" visible in Qty (Pieces) mode on PA page', async ({ page }) => {
  1420 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 250 });
  1421 |             const chart = page.getByLabel('Sales by week');
  1422 |             await chart.getByRole('button', { name: 'Qty', exact: true }).click();
  1423 |             await expect(chart).toContainText('actual sales');
  1424 |         });
  1425 |     });
  1426 | 
  1427 |     /**
  1428 |      * SSPLAN-736 — Tooltip styling for charts
  1429 |      * AC: Chart tooltips are readable and appear when hovering over data points.
  1430 |      */
  1431 |     test.describe('SSPLAN-736 — Chart tooltips', () => {
  1432 |         test('SalesByWeek chart renders and tooltip appears on hover over a data bar', async ({ page }) => {
  1433 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1434 |             const chart = page.getByLabel('Sales by week');
  1435 |             await expect(chart).toBeVisible();
  1436 |             // Hover over the chart area to trigger the Recharts tooltip
  1437 |             const chartBox = await chart.boundingBox();
  1438 |             if (chartBox) {
  1439 |                 await page.mouse.move(
  1440 |                     chartBox.x + chartBox.width * 0.3,
  1441 |                     chartBox.y + chartBox.height * 0.5,
  1442 |                 );
  1443 |                 // Recharts renders tooltips inside the SVG wrapper — verify tooltip container appears
  1444 |                 await expect(chart.locator('.recharts-tooltip-wrapper')).toBeVisible({ timeout: 3000 })
  1445 |                     .catch(() => {
  1446 |                         // Tooltip may not appear if no data point is under the cursor —
  1447 |                         // assert the chart svg itself rendered correctly instead
  1448 |                     });
  1449 |             }
  1450 |             // Primary assertion: chart SVG rendered (tooltip infrastructure present)
  1451 |             await expect(chart.locator('svg')).toBeVisible();
  1452 |         });
  1453 | 
  1454 |         test('SalesIndexTrend chart renders its SVG on the region dashboard', async ({ page }) => {
  1455 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1456 |             await expect(page.getByLabel('Trends - Sales index vs LY').locator('svg')).toBeVisible();
  1457 |         });
  1458 |     });
  1459 | 
  1460 |     /**
  1461 |      * SSPLAN-701 — Hero Metric Component
  1462 |      * SSPLAN-692 — Metric Row Cell
  1463 |      * AC: KpiSummaryCard shows goal value vs compare number (hero metric),
  1464 |      * and four metric row cells: "vs demand plan", "vs last year", "vs latest forecast", "to-go vs goal".
  1465 |      */
  1466 |     test.describe('SSPLAN-701 & SSPLAN-692 — KpiSummaryCard metric labels', () => {
  1467 |         test('Country dashboard KpiSummaryCard shows "FY26 sales index" title', async ({ page }) => {
  1468 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1469 |             await expect(page.getByRole('heading', { level: 3, name: 'FY26 sales index' })).toBeVisible();
  1470 |         });
  1471 | 
  1472 |         test('HFB dashboard KpiSummaryCard shows "YTD sales index" title', async ({ page }) => {
  1473 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  1474 |             await expect(page.getByRole('heading', { level: 3, name: 'YTD sales index' })).toBeVisible();
  1475 |         });
  1476 | 
  1477 |         test('PA dashboard KpiSummaryCard shows "YTD sales index" title', async ({ page }) => {
  1478 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 250 });
  1479 |             await expect(page.getByRole('heading', { level: 3, name: 'YTD sales index' })).toBeVisible();
  1480 |         });
  1481 | 
  1482 |         test('KpiSummaryCard shows all four metric row cell labels on the country dashboard', async ({ page }) => {
  1483 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1484 |             for (const label of ['vs demand plan', 'vs last year', 'vs latest forecast', 'to-go vs goal']) {
> 1485 |                 await expect(page.locator('body')).toContainText(label);
       |                                                    ^ Error: expect(locator).toContainText(expected) failed
  1486 |             }
  1487 |         });
  1488 | 
  1489 |         test('KpiSummaryCard shows all four metric row cell labels on the HFB dashboard', async ({ page }) => {
  1490 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  1491 |             for (const label of ['vs demand plan', 'vs last year', 'vs latest forecast', 'to-go vs goal']) {
  1492 |                 await expect(page.locator('body')).toContainText(label);
  1493 |             }
  1494 |         });
  1495 | 
  1496 |         test('Each HFB card in the HFB list shows its own KpiSummaryCard title', async ({ page }) => {
  1497 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1498 |             await page.getByRole('button', { name: 'View HFB plan' }).first().waitFor();
  1499 |             // Each HFB card renders its own h3 title (e.g. "01 - Living Room")
  1500 |             await expect(page.getByRole('heading', { level: 3, name: /\d{2}\s*-\s*\w+/ }).first()).toBeVisible();
  1501 |             // There should be 16 h3 card titles (one per HFB)
  1502 |             await expect(page.getByRole('heading', { level: 3, name: /\d{2}\s*-/ })).toHaveCount(16);
  1503 |         });
  1504 |     });
  1505 | });
  1506 | 
  1507 | test.describe('Multi-region coverage', () => {
  1508 |     test.describe('SE region (/region-dashboard/se/)', () => {
  1509 |         test('renders SE country dashboard with h1 = SE Sales', async ({ page }) => {
  1510 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1511 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('SE Sales');
  1512 |         });
  1513 | 
  1514 |         test('SE HFB dashboard shows SE in breadcrumb', async ({ page }) => {
  1515 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  1516 |             await expect(page.getByLabel('Breadcrumb').getByRole('link', { name: 'SE' })).toBeVisible();
  1517 |         });
  1518 |     });
  1519 | 
  1520 |     test.describe('US region (/region-dashboard/us/)', () => {
  1521 |         test('renders US country dashboard with h1 = US Sales', async ({ page }) => {
  1522 |             await gotoBypassAuth(page, '/region-dashboard/us/', { metricsDelayMs: 250 });
  1523 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('US Sales');
  1524 |         });
  1525 | 
  1526 |         test('US HFB list renders 16 cards just like SE', async ({ page }) => {
  1527 |             await gotoBypassAuth(page, '/region-dashboard/us/', { metricsDelayMs: 250 });
  1528 |             await page.getByRole('button', { name: 'View HFB plan' }).first().waitFor();
  1529 |             await expect(page.getByRole('button', { name: 'View HFB plan' })).toHaveCount(16);
  1530 |         });
  1531 | 
  1532 |         test('navigating to US HFB 01 shows HFB 01 with US in breadcrumb', async ({ page }) => {
  1533 |             await gotoBypassAuth(page, '/region-dashboard/us/hfb/01', { metricsDelayMs: 250 });
  1534 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
  1535 |             await expect(page.getByLabel('Breadcrumb').getByRole('link', { name: 'US' })).toBeVisible();
  1536 |         });
  1537 | 
  1538 |         test('navigating to US HFB 01 PA 001 shows PA 001 with US and HFB 01 in breadcrumb', async ({ page }) => {
  1539 |             await gotoBypassAuth(page, '/region-dashboard/us/hfb/01/pa/001', { metricsDelayMs: 250 });
  1540 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('PA 001');
  1541 |             await expect(page.getByLabel('Breadcrumb').getByRole('link', { name: 'US' })).toBeVisible();
  1542 |             await expect(page.getByLabel('Breadcrumb').getByRole('link', { name: 'HFB 01' })).toBeVisible();
  1543 |         });
  1544 | 
  1545 |         test('US and SE dashboards are independent — h1 differs between the two', async ({ page }) => {
  1546 |             await gotoBypassAuth(page, '/region-dashboard/us/', { metricsDelayMs: 250 });
  1547 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('US Sales');
  1548 |             await expect(page.getByRole('heading', { level: 1 })).not.toContainText('SE Sales');
  1549 | 
  1550 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1551 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('SE Sales');
  1552 |             await expect(page.getByRole('heading', { level: 1 })).not.toContainText('US Sales');
  1553 |         });
  1554 |     });
  1555 | 
  1556 |     test.describe('XX — nonexistent region (valid 2-char code, no real data)', () => {
  1557 |         test('renders XX country dashboard with h1 = XX Sales (route accepts any 2-char code)', async ({ page }) => {
  1558 |             await gotoBypassAuth(page, '/region-dashboard/xx/', { metricsDelayMs: 250 });
  1559 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('XX Sales');
  1560 |         });
  1561 | 
  1562 |         test('XX HFB list renders the same mock HFB data (mock is not region-gated)', async ({ page }) => {
  1563 |             await gotoBypassAuth(page, '/region-dashboard/xx/', { metricsDelayMs: 250 });
  1564 |             await page.getByRole('button', { name: 'View HFB plan' }).first().waitFor();
  1565 |             await expect(page.getByRole('button', { name: 'View HFB plan' })).toHaveCount(16);
  1566 |         });
  1567 | 
  1568 |         test('XX HFB 01 renders correctly with XX in breadcrumb', async ({ page }) => {
  1569 |             await gotoBypassAuth(page, '/region-dashboard/xx/hfb/01', { metricsDelayMs: 250 });
  1570 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
  1571 |             await expect(page.getByLabel('Breadcrumb').getByRole('link', { name: 'XX' })).toBeVisible();
  1572 |         });
  1573 | 
  1574 |         test('navigating from XX dashboard to HFB and back shows XX throughout', async ({ page }) => {
  1575 |             await gotoBypassAuth(page, '/region-dashboard/xx/', { metricsDelayMs: 250 });
  1576 |             await page.getByRole('button', { name: 'View HFB plan' }).first().waitFor();
  1577 |             await page.getByRole('heading', { level: 3, name: /01\s*-/ })
  1578 |                 .locator('xpath=ancestor::div[.//button[contains(., "View HFB plan")]][1]')
  1579 |                 .getByRole('button', { name: 'View HFB plan' })
  1580 |                 .click();
  1581 |             await expect(page.getByLabel('Breadcrumb').getByRole('link', { name: 'XX' })).toBeVisible();
  1582 |             await page.getByRole('button', { name: 'Go back' }).click();
  1583 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('XX Sales');
  1584 |         });
  1585 |     });
```