# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: salesplanning-frontend.spec.js >> Edge cases >> Browser back/forward navigation >> browser back after region→HFB navigation returns to region dashboard
- Location: salesplanning-frontend.spec.js:1786:9

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.waitFor: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'View HFB plan' }).first() to be visible

```

# Page snapshot

```yaml
- generic [active] [ref=e1]: 429 Too Many Requests
```

# Test source

```ts
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
  1748 |             await page.getByRole('button', { name: 'View HFB plan' }).first().waitFor();
  1749 |             await page.getByRole('heading', { level: 3, name: /16\s*-/ })
  1750 |                 .locator('xpath=ancestor::div[.//button[contains(., "View HFB plan")]][1]')
  1751 |                 .getByRole('button', { name: 'View HFB plan' })
  1752 |                 .click();
  1753 |             await expect(page).toHaveURL(/\/region-dashboard\/se\/hfb\/16$/);
  1754 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 16');
  1755 |         });
  1756 | 
  1757 |         test('[Direct URL] /hfb/15 renders HFB 15 with correct breadcrumb', async ({ page }) => {
  1758 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/15', { metricsDelayMs: 250 });
  1759 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 15');
  1760 |             await expect(page.getByLabel('Breadcrumb').getByText('HFB 15'))
  1761 |                 .toHaveAttribute('aria-current', 'page');
  1762 |         });
  1763 | 
  1764 |         test('[Direct URL] /hfb/16 renders HFB 16 — not HFB 15 or any other', async ({ page }) => {
  1765 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/16', { metricsDelayMs: 250 });
  1766 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 16');
  1767 |             await expect(page.getByRole('heading', { level: 1 })).not.toContainText('HFB 15');
  1768 |         });
  1769 |     });
  1770 | 
  1771 |     test.describe('SalesByWeek loading state on HFB and PA pages', () => {
  1772 |         test('SalesByWeek shows Loading trend data... while metrics are fetching on HFB page', async ({ page }) => {
  1773 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 1000 });
  1774 |             await expect(page.getByLabel('Sales by week').getByRole('status'))
  1775 |                 .toContainText('Loading trend data...');
  1776 |         });
  1777 | 
  1778 |         test('SalesByWeek shows Loading trend data... while metrics are fetching on PA page', async ({ page }) => {
  1779 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 1000 });
  1780 |             await expect(page.getByLabel('Sales by week').getByRole('status'))
  1781 |                 .toContainText('Loading trend data...');
  1782 |         });
  1783 |     });
  1784 | 
  1785 |     test.describe('Browser back/forward navigation', () => {
  1786 |         test('browser back after region→HFB navigation returns to region dashboard', async ({ page }) => {
  1787 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
> 1788 |             await page.getByRole('button', { name: 'View HFB plan' }).first().waitFor();
       |                                                                               ^ Error: locator.waitFor: Test timeout of 30000ms exceeded.
  1789 |             await page.getByRole('heading', { level: 3, name: /01\s*-/ })
  1790 |                 .locator('xpath=ancestor::div[.//button[contains(., "View HFB plan")]][1]')
  1791 |                 .getByRole('button', { name: 'View HFB plan' })
  1792 |                 .click();
  1793 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
  1794 | 
  1795 |             await page.goBack();
  1796 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('SE Sales');
  1797 |         });
  1798 | 
  1799 |         test('browser forward after back restores the HFB page', async ({ page }) => {
  1800 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1801 |             await page.getByRole('button', { name: 'View HFB plan' }).first().waitFor();
  1802 |             await page.getByRole('heading', { level: 3, name: /01\s*-/ })
  1803 |                 .locator('xpath=ancestor::div[.//button[contains(., "View HFB plan")]][1]')
  1804 |                 .getByRole('button', { name: 'View HFB plan' })
  1805 |                 .click();
  1806 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
  1807 | 
  1808 |             await page.goBack();
  1809 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('SE Sales');
  1810 | 
  1811 |             await page.goForward();
  1812 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
  1813 |         });
  1814 | 
  1815 |         test('browser back after HFB→PA navigation returns to HFB page', async ({ page }) => {
  1816 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', {
  1817 |                 hierarchyDelayMs: 250,
  1818 |                 metricsDelayMs: 250,
  1819 |             });
  1820 |             await page.getByRole('button', { name: /Sofas.*001/ }).click();
  1821 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('PA 001');
  1822 | 
  1823 |             await page.goBack();
  1824 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
  1825 |         });
  1826 | 
  1827 |         test('three-level back: PA → HFB → Region via browser back button', async ({ page }) => {
  1828 |             // Start at region dashboard so all three levels are in browser history
  1829 |             await gotoBypassAuth(page, '/region-dashboard/se/', {
  1830 |                 hierarchyDelayMs: 250,
  1831 |                 metricsDelayMs: 250,
  1832 |             });
  1833 |             await page.getByRole('button', { name: 'View HFB plan' }).first().waitFor();
  1834 |             // Navigate to HFB 01 via card click (adds history entry)
  1835 |             await page.getByRole('heading', { level: 3, name: /01\s*-/ })
  1836 |                 .locator('xpath=ancestor::div[.//button[contains(., "View HFB plan")]][1]')
  1837 |                 .getByRole('button', { name: 'View HFB plan' })
  1838 |                 .click();
  1839 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
  1840 |             await page.getByRole('button', { name: /Sofas.*001/ }).waitFor();
  1841 |             // Navigate to PA 001 via row click (adds history entry)
  1842 |             await page.getByRole('button', { name: /Sofas.*001/ }).click();
  1843 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('PA 001');
  1844 | 
  1845 |             // Now go back three levels via browser button
  1846 |             await page.goBack();
  1847 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('HFB 01');
  1848 | 
  1849 |             await page.goBack();
  1850 |             await expect(page.getByRole('heading', { level: 1 })).toContainText('SE Sales');
  1851 |         });
  1852 |     });
  1853 | });
  1854 | 
  1855 | test.describe('Accessibility basics', () => {
  1856 |     test('region dashboard — h1, section landmarks, and live regions', async ({ page }) => {
  1857 |         await gotoBypassAuth(page, '/region-dashboard/se/', { hfbDelayMs: 500, metricsDelayMs: 500 });
  1858 |         await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  1859 |         await expect(page.getByLabel('HFB list navigation')).toBeVisible();
  1860 |         await expect(page.getByLabel('HFB list navigation').getByRole('status'))
  1861 |             .toContainText('Loading HFB performance...');
  1862 |     });
  1863 | 
  1864 |     test('HFB dashboard — breadcrumb nav and PA list landmark', async ({ page }) => {
  1865 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { hierarchyDelayMs: 500, metricsDelayMs: 500 });
  1866 |         await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  1867 |         await expect(page.getByLabel('Breadcrumb')).toBeVisible();
  1868 |         await expect(page.getByLabel('PA list navigation')).toBeVisible();
  1869 |         await expect(page.getByText('Loading PA performance...')).toBeVisible();
  1870 |     });
  1871 | 
  1872 |     test('PA dashboard — h1 and breadcrumb navigation', async ({ page }) => {
  1873 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 500 });
  1874 |         await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  1875 |         await expect(page.getByLabel('Breadcrumb')).toBeVisible();
  1876 |         await expect(page.getByLabel('Sales by week')).toBeVisible();
  1877 |     });
  1878 | });
  1879 | 
  1880 | test.describe('HeroMetric component', () => {
  1881 |     // Country-level KpiSummaryCard: compareNumber=94, goalValue=100 (hardcoded in SalesGraphsRow)
  1882 |     // metricToGoal(94, 100) → index=94, difference=-6, performance='below'
  1883 |     test.beforeEach(async ({ page }) => {
  1884 |         await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1885 |     });
  1886 | 
  1887 |     test('shows the rounded index value (94) in the country-level KpiSummaryCard', async ({ page }) => {
  1888 |         await expect(page.locator('body')).toContainText('94');
```