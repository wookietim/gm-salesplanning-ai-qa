# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: salesplanning-frontend.spec.js >> Multi-region coverage >> XX — nonexistent region (valid 2-char code, no real data) >> XX HFB 01 renders correctly with XX in breadcrumb
- Location: salesplanning-frontend.spec.js:1568:9

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('heading', { level: 1 })
Expected substring: "HFB 01"
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
  1485 |                 await expect(page.locator('body')).toContainText(label);
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
> 1570 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
       |                                                                   ^ Error: expect(locator).toContainText(expected) failed
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
  1586 | 
  1587 |     test.describe('Region URL case-insensitivity', () => {
  1588 |         test('/region-dashboard/SE/ (uppercase) normalises to lowercase and renders SE Sales', async ({ page }) => {
  1589 |             await gotoBypassAuth(page, '/region-dashboard/SE/', { metricsDelayMs: 250 });
  1590 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('SE Sales');
  1591 |         });
  1592 | 
  1593 |         test('/region-dashboard/US/ (uppercase) normalises to lowercase and renders US Sales', async ({ page }) => {
  1594 |             await gotoBypassAuth(page, '/region-dashboard/US/', { metricsDelayMs: 250 });
  1595 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('US Sales');
  1596 |         });
  1597 |     });
  1598 | });
  1599 | 
  1600 | test.describe('Edge cases', () => {
  1601 |     test.describe('Page <title>', () => {
  1602 |         test('authenticated region dashboard has title "Sales planning tool"', async ({ page }) => {
  1603 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1604 |             await expect(page).toHaveTitle('Sales planning tool');
  1605 |         });
  1606 | 
  1607 |         test('authenticated HFB dashboard has title "Sales planning tool"', async ({ page }) => {
  1608 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  1609 |             await expect(page).toHaveTitle('Sales planning tool');
  1610 |         });
  1611 | 
  1612 |         test('authenticated PA dashboard has title "Sales planning tool"', async ({ page }) => {
  1613 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 250 });
  1614 |             await expect(page).toHaveTitle('Sales planning tool');
  1615 |         });
  1616 |     });
  1617 | 
  1618 |     test.describe('Unknown / catch-all route', () => {
  1619 |         test('unknown URL /unknown-page redirects away (catch-all $ route calls redirect to /)', async ({ page }) => {
  1620 |             // The $ catch-all fires redirect({ to: '/' }), then MSAL fires the login redirect
  1621 |             await page.goto('/unknown-page');
  1622 |             await page.waitForURL(/login\.microsoftonline\.com|\/$/, { timeout: 10000 });
  1623 |             // Confirm we are NOT still on /unknown-page
  1624 |             expect(page.url()).not.toContain('/unknown-page');
  1625 |         });
  1626 | 
  1627 |         test('deeply nested unknown URL /some/unknown/path also redirects away', async ({ page }) => {
  1628 |             await page.goto('/some/unknown/path');
  1629 |             await page.waitForURL(/login\.microsoftonline\.com|\/$/, { timeout: 10000 });
  1630 |             expect(page.url()).not.toContain('/some/unknown/path');
  1631 |         });
  1632 |     });
  1633 | 
  1634 |     test.describe('"· Forecast G" appears on all dashboard levels', () => {
  1635 |         test('"· Forecast G" visible on country (SE) dashboard', async ({ page }) => {
  1636 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1637 |             await expect(page.locator('body')).toContainText('Forecast G');
  1638 |         });
  1639 | 
  1640 |         test('"· Forecast G" visible on HFB dashboard', async ({ page }) => {
  1641 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  1642 |             await expect(page.locator('body')).toContainText('Forecast G');
  1643 |         });
  1644 | 
  1645 |         test('"· Forecast G" visible on PA dashboard', async ({ page }) => {
  1646 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 250 });
  1647 |             await expect(page.locator('body')).toContainText('Forecast G');
  1648 |         });
  1649 |     });
  1650 | 
  1651 |     test.describe('GapToClose component', () => {
  1652 |         test('KpiSummaryCard shows "Gap to close:" label with formatted quantity and sales gap', async ({ page }) => {
  1653 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1654 |             // GapToClose in the top-level KpiSummaryCard uses label="Gap to close"
  1655 |             await expect(page.locator('body')).toContainText('Gap to close:');
  1656 |         });
  1657 | 
  1658 |         test('"Gap to close:" visible on HFB dashboard KpiSummaryCard', async ({ page }) => {
  1659 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  1660 |             await expect(page.locator('body')).toContainText('Gap to close:');
  1661 |         });
  1662 | 
  1663 |         test('"Gap to close:" visible on PA dashboard KpiSummaryCard', async ({ page }) => {
  1664 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 250 });
  1665 |             await expect(page.locator('body')).toContainText('Gap to close:');
  1666 |         });
  1667 | 
  1668 |         test('PaFamilyListRow shows "Gap:" label (GapToClose small variant) for each PA row', async ({ page }) => {
  1669 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', {
  1670 |                 hierarchyDelayMs: 250,
```