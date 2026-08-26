# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: salesplanning-frontend.spec.js >> HeroMetric component >> shows a performance badge with "pt" suffix (points relative to goal)
- Location: salesplanning-frontend.spec.js:1895:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('body')
Expected pattern: /\d+pt/
Received string:  "429 Too Many Requests"
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
  1889 |     });
  1890 | 
  1891 |     test('shows "vs goal" label in the hero metric', async ({ page }) => {
  1892 |         await expect(page.locator('body')).toContainText('vs goal');
  1893 |     });
  1894 | 
  1895 |     test('shows a performance badge with "pt" suffix (points relative to goal)', async ({ page }) => {
  1896 |         // Badge text is "6pt" (large variant, absolute difference) for compareNumber=94
> 1897 |         await expect(page.locator('body')).toContainText(/\d+pt/);
       |                                            ^ Error: expect(locator).toContainText(expected) failed
  1898 |     });
  1899 | });
  1900 | 
  1901 | test.describe('MetricRowCell numeric values', () => {
  1902 |     test('country KpiSummaryCard shows specific numeric metric values (vsLatestForecast=98, toGo=106)', async ({ page }) => {
  1903 |         await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1904 |         // vsLatestForecast: 98 — unique value easy to verify
  1905 |         await expect(page.locator('body')).toContainText('98');
  1906 |         // toGo vs goal: 106
  1907 |         await expect(page.locator('body')).toContainText('106');
  1908 |     });
  1909 | 
  1910 |     test('PaFamilyListRow shows numeric values alongside metric labels', async ({ page }) => {
  1911 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', {
  1912 |             hierarchyDelayMs: 250,
  1913 |             metricsDelayMs: 250,
  1914 |         });
  1915 |         await page.getByRole('button', { name: /Sofas.*001/ }).waitFor();
  1916 |         const paSection = page.getByLabel('PA list navigation');
  1917 |         // PA mock values are in range 78–125 — verify numeric content exists
  1918 |         await expect(paSection).toContainText(/\d+/);
  1919 |     });
  1920 | });
  1921 | 
  1922 | test.describe('NewsArticle sub-components', () => {
  1923 |     test.beforeEach(async ({ page }) => {
  1924 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  1925 |         await page.getByLabel('News in HFB list').getByRole('button').first().waitFor();
  1926 |     });
  1927 | 
  1928 |     test('ChecksRow shows "Has demand plan" label in article rows', async ({ page }) => {
  1929 |         await expect(page.getByLabel('News in HFB list')).toContainText('Has demand plan');
  1930 |     });
  1931 | 
  1932 |     test('ChecksRow shows "Has price" label in article rows', async ({ page }) => {
  1933 |         await expect(page.getByLabel('News in HFB list')).toContainText('Has price');
  1934 |     });
  1935 | 
  1936 |     test('SalesStatusRow shows "Sales start date:" in article rows', async ({ page }) => {
  1937 |         await expect(page.getByLabel('News in HFB list')).toContainText('Sales start date:');
  1938 |     });
  1939 | 
  1940 |     test('SalesStatusRow shows "Ready to sell" or "Not ready to sell" status', async ({ page }) => {
  1941 |         const news = page.getByLabel('News in HFB list');
  1942 |         const readyCount = await news.getByText('Ready to sell').count();
  1943 |         const notReadyCount = await news.getByText('Not ready to sell').count();
  1944 |         expect(readyCount + notReadyCount).toBeGreaterThan(0);
  1945 |     });
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
```