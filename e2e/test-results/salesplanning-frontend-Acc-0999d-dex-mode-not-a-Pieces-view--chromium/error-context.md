# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: salesplanning-frontend.spec.js >> Acceptance criteria from Jira stories >> SSPLAN-623 — SalesByWeek legend conditional rendering >> "actual sales" legend is HIDDEN in Sales index mode (not a Pieces view)
- Location: salesplanning-frontend.spec.js:1368:9

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: locator.waitFor: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByLabel('Sales by week') to be visible

```

# Page snapshot

```yaml
- generic [active] [ref=e1]: 429 Too Many Requests
```

# Test source

```ts
  1237 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1238 |             await page.getByRole('button', { name: 'View HFB plan' }).first().waitFor();
  1239 |         });
  1240 | 
  1241 |         test('HFB list section subtitle reads "By gap to goal (worst first)"', async ({ page }) => {
  1242 |             await expect(page.getByLabel('HFB list navigation')).toContainText('By gap to goal (worst first)');
  1243 |         });
  1244 | 
  1245 |         test('HFB list renders all 16 HFBs as clickable cards', async ({ page }) => {
  1246 |             await expect(page.getByRole('button', { name: 'View HFB plan' })).toHaveCount(16);
  1247 |         });
  1248 | 
  1249 |         test('HFB list heading reads "HFB performance"', async ({ page }) => {
  1250 |             await expect(page.getByLabel('HFB list navigation').getByRole('heading', { level: 2 }))
  1251 |                 .toContainText('HFB performance');
  1252 |         });
  1253 |     });
  1254 | 
  1255 |     /**
  1256 |      * SSPLAN-628 — Sales Planning Tool Landing Page Greeting
  1257 |      * AC: Personalized greeting with user name displayed at country level.
  1258 |      * NavigationBar shows "Welcome {givenName}" at country level.
  1259 |      */
  1260 |     test.describe('SSPLAN-628 — Personalized greeting', () => {
  1261 |         test('NavigationBar shows "Welcome {givenName}" at country level', async ({ page }) => {
  1262 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1263 |             // WelcomeUser component renders "Welcome {givenName}" in the NavigationBar
  1264 |             await expect(page.locator('body')).toContainText('Welcome Test');
  1265 |         });
  1266 | 
  1267 |         test('Greeting is replaced by breadcrumbs (not welcome text) on HFB level', async ({ page }) => {
  1268 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  1269 |             await expect(page.getByLabel('Breadcrumb')).toBeVisible();
  1270 |             await expect(page.locator('body')).not.toContainText('Welcome Test');
  1271 |         });
  1272 | 
  1273 |         test('Greeting is replaced by breadcrumbs (not welcome text) on PA level', async ({ page }) => {
  1274 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 250 });
  1275 |             await expect(page.getByLabel('Breadcrumb')).toBeVisible();
  1276 |             await expect(page.locator('body')).not.toContainText('Welcome Test');
  1277 |         });
  1278 |     });
  1279 | 
  1280 |     /**
  1281 |      * SSPLAN-691 — Segmented Control QTY/Price Toggle
  1282 |      * AC: Toggle appears on ALL levels (Country, HFB, PA) with all four options.
  1283 |      * Scenario 1-4: QTY Index, QTY, Sales Index, Sales — each button becomes active.
  1284 |      */
  1285 |     test.describe('SSPLAN-691 — Segmented Control on all levels', () => {
  1286 |         test('SegmentControl with all 4 options appears in SalesByWeek on the country dashboard', async ({ page }) => {
  1287 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1288 |             const chart = page.getByLabel('Sales by week');
  1289 |             for (const label of ['Qty index', 'Qty', 'Sales index', 'Sales']) {
  1290 |                 await expect(chart.getByRole('button', { name: label, exact: true })).toBeVisible();
  1291 |             }
  1292 |         });
  1293 | 
  1294 |         test('SegmentControl with all 4 options appears in SalesByWeek on the HFB dashboard', async ({ page }) => {
  1295 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  1296 |             const chart = page.getByLabel('Sales by week');
  1297 |             for (const label of ['Qty index', 'Qty', 'Sales index', 'Sales']) {
  1298 |                 await expect(chart.getByRole('button', { name: label, exact: true })).toBeVisible();
  1299 |             }
  1300 |         });
  1301 | 
  1302 |         test('SegmentControl with all 4 options appears in SalesByWeek on the PA dashboard', async ({ page }) => {
  1303 |             await gotoBypassAuth(page, '/region-dashboard/se/hfb/01/pa/001', { metricsDelayMs: 250 });
  1304 |             const chart = page.getByLabel('Sales by week');
  1305 |             for (const label of ['Qty index', 'Qty', 'Sales index', 'Sales']) {
  1306 |                 await expect(chart.getByRole('button', { name: label, exact: true })).toBeVisible();
  1307 |             }
  1308 |         });
  1309 | 
  1310 |         test('Selecting each metric option highlights only that button (aria-pressed=true)', async ({ page }) => {
  1311 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
  1312 |             const chart = page.getByLabel('Sales by week');
  1313 | 
  1314 |             for (const label of ['Qty index', 'Qty', 'Sales index', 'Sales']) {
  1315 |                 await chart.getByRole('button', { name: label, exact: true }).click();
  1316 |                 await expect(chart.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
  1317 |                 // All other buttons should be inactive
  1318 |                 for (const other of ['Qty index', 'Qty', 'Sales index', 'Sales']) {
  1319 |                     if (other !== label) {
  1320 |                         await expect(chart.getByRole('button', { name: other, exact: true })).toHaveAttribute('aria-pressed', 'false');
  1321 |                     }
  1322 |                 }
  1323 |             }
  1324 |         });
  1325 |     });
  1326 | 
  1327 |     /**
  1328 |      * SSPLAN-623 — Show Weekly Sales vs Latest Financial Forecast
  1329 |      * AC: "actual sales" legend item appears ONLY in QTY and Sales modes.
  1330 |      * In QTY Index / Sales Index modes the actual line is hidden (index comparison only).
  1331 |      * Forecast legend item ("latest forecast") is always present.
  1332 |      * Ref: Ethan's comment — forecast only when view is Pieces, not index.
  1333 |      */
  1334 |     test.describe('SSPLAN-623 — SalesByWeek legend conditional rendering', () => {
  1335 |         test.beforeEach(async ({ page }) => {
  1336 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
> 1337 |             await page.getByLabel('Sales by week').waitFor();
       |                                                    ^ Error: locator.waitFor: Test timeout of 30000ms exceeded.
  1338 |         });
  1339 | 
  1340 |         test('"last year sales" legend item is always visible in all metric modes', async ({ page }) => {
  1341 |             const chart = page.getByLabel('Sales by week');
  1342 |             for (const label of ['Qty index', 'Qty', 'Sales index', 'Sales']) {
  1343 |                 await chart.getByRole('button', { name: label, exact: true }).click();
  1344 |                 await expect(chart).toContainText('last year');
  1345 |             }
  1346 |         });
  1347 | 
  1348 |         test('"latest forecast" legend item is always visible in all metric modes', async ({ page }) => {
  1349 |             const chart = page.getByLabel('Sales by week');
  1350 |             for (const label of ['Qty index', 'Qty', 'Sales index', 'Sales']) {
  1351 |                 await chart.getByRole('button', { name: label, exact: true }).click();
  1352 |                 await expect(chart).toContainText('latest forecast');
  1353 |             }
  1354 |         });
  1355 | 
  1356 |         test('"actual sales" legend shows in Sales mode (Pieces)', async ({ page }) => {
  1357 |             const chart = page.getByLabel('Sales by week');
  1358 |             await chart.getByRole('button', { name: 'Sales', exact: true }).click();
  1359 |             await expect(chart).toContainText('actual sales');
  1360 |         });
  1361 | 
  1362 |         test('"actual sales" legend shows in Qty mode (Pieces)', async ({ page }) => {
  1363 |             const chart = page.getByLabel('Sales by week');
  1364 |             await chart.getByRole('button', { name: 'Qty', exact: true }).click();
  1365 |             await expect(chart).toContainText('actual sales');
  1366 |         });
  1367 | 
  1368 |         test('"actual sales" legend is HIDDEN in Sales index mode (not a Pieces view)', async ({ page }) => {
  1369 |             const chart = page.getByLabel('Sales by week');
  1370 |             await chart.getByRole('button', { name: 'Sales index' }).click();
  1371 |             await expect(chart).not.toContainText('actual sales');
  1372 |         });
  1373 | 
  1374 |         test('"actual sales" legend is HIDDEN in Qty index mode (not a Pieces view)', async ({ page }) => {
  1375 |             const chart = page.getByLabel('Sales by week');
  1376 |             await chart.getByRole('button', { name: 'Qty index' }).click();
  1377 |             await expect(chart).not.toContainText('actual sales');
  1378 |         });
  1379 |     });
  1380 | 
  1381 |     /**
  1382 |      * SSPLAN-646 — Show Actual Sales vs Financial Forecast on HFB Level
  1383 |      * Erin's comment: "When user clicks on sales on the HFB level page, the forecast line
  1384 |      * should disappear because we don't have the forecast at the HFB level."
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
```