# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: salesplanning-frontend.spec.js >> Acceptance criteria from Jira stories >> SSPLAN-637 — HFB list page >> HFB list heading reads "HFB performance"
- Location: salesplanning-frontend.spec.js:1249:9

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
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
  1138 |     test('defaults to Qty index and shows all four metric options', async ({ page }) => {
  1139 |         const paSection = page.getByLabel('PA list navigation');
  1140 |         await expect(paSection.getByRole('button', { name: 'Qty index' })).toHaveAttribute('aria-pressed', 'true');
  1141 |         await expect(paSection.getByRole('button', { name: 'Qty', exact: true })).toBeVisible();
  1142 |         await expect(paSection.getByRole('button', { name: 'Sales index' })).toBeVisible();
  1143 |         await expect(paSection.getByRole('button', { name: 'Sales', exact: true })).toBeVisible();
  1144 |     });
  1145 | 
  1146 |     test('switches to Sales index metric and PA rows remain visible', async ({ page }) => {
  1147 |         const paSection = page.getByLabel('PA list navigation');
  1148 |         await paSection.getByRole('button', { name: 'Sales index' }).click();
  1149 |         await expect(paSection.getByRole('button', { name: 'Sales index' })).toHaveAttribute('aria-pressed', 'true');
  1150 |         await expect(paSection.getByRole('button', { name: 'Qty index' })).toHaveAttribute('aria-pressed', 'false');
  1151 |         await expect(paSection.getByRole('button', { name: /Sofas.*001/ })).toBeVisible();
  1152 |     });
  1153 | 
  1154 |     test('switches to Qty metric', async ({ page }) => {
  1155 |         const paSection = page.getByLabel('PA list navigation');
  1156 |         await paSection.getByRole('button', { name: 'Qty', exact: true }).click();
  1157 |         await expect(paSection.getByRole('button', { name: 'Qty', exact: true })).toHaveAttribute('aria-pressed', 'true');
  1158 |     });
  1159 | 
  1160 |     test('switches to Sales metric', async ({ page }) => {
  1161 |         const paSection = page.getByLabel('PA list navigation');
  1162 |         await paSection.getByRole('button', { name: 'Sales', exact: true }).click();
  1163 |         await expect(paSection.getByRole('button', { name: 'Sales', exact: true })).toHaveAttribute('aria-pressed', 'true');
  1164 |     });
  1165 | });
  1166 | 
  1167 | test.describe('NewsInHfbList component (HFB dashboard)', () => {
  1168 |     test.beforeEach(async ({ page }) => {
  1169 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { metricsDelayMs: 250 });
  1170 |     });
  1171 | 
  1172 |     test('renders the section heading and item rows after data loads', async ({ page }) => {
  1173 |         const newsSection = page.getByLabel('News in HFB list');
  1174 |         await expect(newsSection).toBeVisible();
  1175 |         await expect(newsSection.getByText(/NEWs in HFB 01/i)).toBeVisible();
  1176 |         // NewsArticle rows render as buttons
  1177 |         await expect(newsSection.getByRole('button').first()).toBeVisible();
  1178 |     });
  1179 | 
  1180 |     test('shows all four SegmentControl metric options and defaults to Qty index', async ({ page }) => {
  1181 |         const newsSection = page.getByLabel('News in HFB list');
  1182 |         await expect(newsSection.getByRole('button', { name: 'Qty index' })).toHaveAttribute('aria-pressed', 'true');
  1183 |         await expect(newsSection.getByRole('button', { name: 'Qty', exact: true })).toBeVisible();
  1184 |         await expect(newsSection.getByRole('button', { name: 'Sales index' })).toBeVisible();
  1185 |         await expect(newsSection.getByRole('button', { name: 'Sales', exact: true })).toBeVisible();
  1186 |     });
  1187 | 
  1188 |     test('switches metric type via SegmentControl and list remains visible', async ({ page }) => {
  1189 |         const newsSection = page.getByLabel('News in HFB list');
  1190 |         await newsSection.getByRole('button', { name: 'Sales index' }).click();
  1191 |         await expect(newsSection.getByRole('button', { name: 'Sales index' })).toHaveAttribute('aria-pressed', 'true');
  1192 |         await expect(newsSection.getByRole('button', { name: 'Qty index' })).toHaveAttribute('aria-pressed', 'false');
  1193 |         await expect(newsSection.getByRole('button').first()).toBeVisible();
  1194 |     });
  1195 | 
  1196 |     test('shows error message when item range data fails', async ({ page, context }) => {
  1197 |         // Re-navigate with itemRangeError flag
  1198 |         await context.clearCookies();
  1199 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', {
  1200 |             metricsDelayMs: 250,
  1201 |             itemRangeError: true,
  1202 |         });
  1203 |         // fetchItemRangeForHfb uses explicit Promise.resolve — interceptor works
  1204 |         await expect(
  1205 |             page.getByLabel('News in HFB list'),
  1206 |         ).toContainText('Item range data is currently unavailable. Please try again later.', { timeout: 20000 });
  1207 |     });
  1208 | });
  1209 | 
  1210 | test.describe('Empty states', () => {
  1211 |     test('HfbList shows empty state when no HFBs are returned', async ({ page }) => {
  1212 |         // The HFB list maps from the KPI_SUMMARY children at country level, so
  1213 |         // returning no children triggers the real empty state.
  1214 |         await gotoBypassAuth(page, '/region-dashboard/se/', { emptyChildren: true });
  1215 |         await expect(page.getByText('No HFB entries were returned for this region.')).toBeVisible({
  1216 |             timeout: 20000,
  1217 |         });
  1218 |     });
  1219 | 
  1220 |     test('ProductAreaSummaryList shows empty state when no PAs are returned', async ({ page }) => {
  1221 |         // Likewise the PA list maps from the KPI_SUMMARY children at hfb level.
  1222 |         await gotoBypassAuth(page, '/region-dashboard/se/hfb/01', { emptyChildren: true });
  1223 |         await expect(page.getByText('No PA entries were returned for this HFB.')).toBeVisible({
  1224 |             timeout: 20000,
  1225 |         });
  1226 |     });
  1227 | });
  1228 | 
  1229 | test.describe('Acceptance criteria from Jira stories', () => {
  1230 |     /**
  1231 |      * SSPLAN-637 — Sales Planning Tool Landing Page HFB List
  1232 |      * AC: HFBs shown in a list sorted "By gap to goal (worst first)"
  1233 |      * Alan's comment: subtitle "By gap to goal (worst first)" was missing in initial impl.
  1234 |      */
  1235 |     test.describe('SSPLAN-637 — HFB list page', () => {
  1236 |         test.beforeEach(async ({ page }) => {
  1237 |             await gotoBypassAuth(page, '/region-dashboard/se/', { metricsDelayMs: 250 });
> 1238 |             await page.getByRole('button', { name: 'View HFB plan' }).first().waitFor();
       |                                                                               ^ Error: locator.waitFor: Test timeout of 30000ms exceeded.
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
  1337 |             await page.getByLabel('Sales by week').waitFor();
  1338 |         });
```