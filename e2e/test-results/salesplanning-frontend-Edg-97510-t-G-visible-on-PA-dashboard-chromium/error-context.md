# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: salesplanning-frontend.spec.js >> Edge cases >> "· Forecast G" appears on all dashboard levels >> "· Forecast G" visible on PA dashboard
- Location: salesplanning-frontend.spec.js:1645:9

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('body')
Expected substring: "Forecast G"
Received string:    "429 Too Many Requests"
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
> 1647 |             await expect(page.locator('body')).toContainText('Forecast G');
       |                                                ^ Error: expect(locator).toContainText(expected) failed
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
  1671 |                 metricsDelayMs: 250,
  1672 |             });
  1673 |             await page.getByRole('button', { name: /Sofas.*001/ }).waitFor();
  1674 |             // GapToClose in PaFamilyListRow uses default label="Gap"
  1675 |             await expect(page.getByLabel('PA list navigation')).toContainText('Gap:');
  1676 |         });
  1677 | 
  1678 |         test('"Gap to close:" is NOT shown when quantityGap >= 0 (large variant hides when goal met)', async ({ page }) => {
  1679 |             // GapToClose large variant hides entirely when quantityGap >= 0
  1680 |             // The mock data uses negative gaps so Gap to close DOES show — this test
  1681 |             // confirms the component renders the label when there IS a gap
  1682 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1683 |             await expect(page.locator('body')).toContainText('Gap to close:');
  1684 |         });
  1685 |     });
  1686 | 
  1687 |     test.describe('ProductAreaSummaryList subtitle', () => {
  1688 |         test('PA list section shows subtitle "By gap to goal (worst first)"', async ({ page }) => {
  1689 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', {
  1690 |                 hierarchyDelayMs: 250,
  1691 |                 metricsDelayMs: 250,
  1692 |             });
  1693 |             await expect(page.getByLabel('PA list navigation')).toContainText('By gap to goal (worst first)');
  1694 |         });
  1695 | 
  1696 |         test('PA list section shows heading "PA performance"', async ({ page }) => {
  1697 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', {
  1698 |                 hierarchyDelayMs: 250,
  1699 |                 metricsDelayMs: 250,
  1700 |             });
  1701 |             await expect(page.getByLabel('PA list navigation').getByRole('heading', { level: 2 }))
  1702 |                 .toContainText('PA performance');
  1703 |         });
  1704 |     });
  1705 | 
  1706 |     test.describe('NewsInHfbList "View more" button', () => {
  1707 |         test('"View more" button behaviour: appears when items > 5, reveals remaining rows when clicked', async ({ page }) => {
  1708 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  1709 |             const newsSection = page.getByLabel('News in HFB list');
  1710 |             await newsSection.getByRole('button').first().waitFor();
  1711 | 
  1712 |             const viewMoreBtn = newsSection.getByRole('button', { name: 'View more' });
  1713 |             const count = await viewMoreBtn.count();
  1714 | 
  1715 |             if (count > 0) {
  1716 |                 // Button exists — click it and verify it disappears (all items now shown)
  1717 |                 // or more articles become visible. We check the button is gone or count increases.
  1718 |                 await viewMoreBtn.click();
  1719 |                 // After showing all items the "View more" button should either disappear
  1720 |                 // (all items visible) or a new batch of rows appeared
  1721 |                 await expect(newsSection.getByRole('button', { name: 'View more' })).toHaveCount(0)
  1722 |                     .catch(async () => {
  1723 |                         // Still showing — verify count went up (more items visible now)
  1724 |                         const afterCount = await newsSection.getByRole('button').count();
  1725 |                         expect(afterCount).toBeGreaterThanOrEqual(count);
  1726 |                     });
  1727 |             } else {
  1728 |                 // Fewer than 6 items for this HFB — "View more" correctly absent
  1729 |                 await expect(viewMoreBtn).toHaveCount(0);
  1730 |             }
  1731 |         });
  1732 |     });
  1733 | 
  1734 |     test.describe('HFB boundary values (15 and 16)', () => {
  1735 |         test('[Click] HFB 15 card navigates to the HFB 15 page', async ({ page }) => {
  1736 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1737 |             await page.getByRole('button', { name: 'View HFB plan' }).first().waitFor();
  1738 |             await page.getByRole('heading', { level: 3, name: /15\s*-/ })
  1739 |                 .locator('xpath=ancestor::div[.//button[contains(., "View HFB plan")]][1]')
  1740 |                 .getByRole('button', { name: 'View HFB plan' })
  1741 |                 .click();
  1742 |             await expect(page).toHaveURL(/\/region-dashboard\/se\/hfb\/15$/);
  1743 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 15');
  1744 |         });
  1745 | 
  1746 |         test('[Click] HFB 16 card navigates to the HFB 16 page', async ({ page }) => {
  1747 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
```