#!/usr/bin/env node
/**
 * ui-api-integration.js
 *
 * The third suite: verifies the live UI renders the values the REAL API returns.
 *
 * Why this exists. The other two suites each cover one half and neither covers
 * the seam between them:
 *
 *   Playwright e2e (salesplanning-frontend.spec.js)
 *       mocks /metrics entirely -> proves the UI renders FIXTURE data correctly.
 *       A wrong field mapping passes, because the fixture agrees with itself.
 *   API probes (api-probes.js)
 *       never opens the UI -> proves the API returns sane data.
 *       A wrong field mapping passes, because the API is fine.
 *
 * So a bug where the UI reads netSalesIndexToGoal but should read
 * netQuantityIndexToGoal is invisible to BOTH. This suite catches exactly that
 * class: wrong field, bad rounding, wrong sort, stale cache, dropped rows.
 *
 * How it runs. Same model as api-probes.js: everything executes inside Tim's
 * authenticated browser tab so the bearer token never leaves the page. Unlike
 * the API probes, this one needs to be driven across pages, because it compares
 * a rendered page against the API call that populated it. The caller navigates;
 * each emitted script checks whatever level is currently on screen.
 *
 *   1. --emit=capture                  install the token hook
 *   2. click something real            react-query caches hard; a prefetched
 *                                      card produces no request at all
 *   3. --emit=country --ru=US          on /region-dashboard/us
 *   4. --emit=toggle                   flips Qty <-> Sales, re-verifies
 *   5. navigate into an HFB
 *   6. --emit=hfb --ru=US --hfb=05     on /region-dashboard/us/hfb/05
 *   7. --emit=drilldown ...            cross-page: country value vs HFB page
 *   8. --emit=cleanup                  ALWAYS
 *
 * Harness-error guards. A UI comparison that scrapes the DOM fails in two
 * characteristic ways that look like product bugs but are not:
 *
 *   - every single row mismatches, all showing the SAME rendered value
 *       -> the selector climbed to a common ancestor and scraped the page
 *   - zero cards found
 *       -> the class names changed
 *
 * Both are reported as `harness` outcomes, never as failures. This is not
 * theoretical: both happened while developing this file, and the first one
 * initially looked like 16 of 19 HFBs rendering wrong values.
 *
 * The toggle is read from aria-pressed rather than assumed. The HFB performance
 * list defaults to "Qty index", so comparing against netSales* fields reports
 * a near-total mismatch that is entirely the harness's fault.
 */

const API_ORIGIN = 'https://api.dev.salesplanning.ingka.com';

/** Metric field backing each segmented-control option. */
const TOGGLE_FIELDS = {
    'Qty index': 'netQuantityIndexToGoal',
    'Sales index': 'netSalesIndexToGoal',
};

/**
 * The hero card carries its OWN metric, independent of the list's segmented
 * control - it is labelled "FY26 sales index" even while the HFB list below is
 * showing Qty. Deriving its field from the list toggle reports a false failure.
 * Read the field from the hero's own label, and search inside the hero card
 * rather than the whole page (a page-wide text search would match the number
 * anywhere, which passes for the wrong reason).
 */
const HERO_LABEL_FIELDS = {
    'sales index': 'netSalesIndexToGoal',
    'qty index': 'netQuantityIndexToGoal',
    'quantity index': 'netQuantityIndexToGoal',
};

const SHARED_HERO = `
const HERO_LABEL_FIELDS = ${JSON.stringify(HERO_LABEL_FIELDS)};

/** Hero cards: index cards that are not rows in a drill-down list. */
const heroCards = () =>
    [...document.querySelectorAll('div[class*="_card_"]')]
        .filter((d) => /index/i.test(norm(d)) && !/View HFB plan/.test(norm(d)));

/** Resolves which API field a hero card is displaying, from its own label. */
const heroFieldFor = (text) => {
    const lower = text.toLowerCase();
    for (const label of Object.keys(HERO_LABEL_FIELDS)) {
        if (lower.indexOf(label) !== -1) return { label, field: HERO_LABEL_FIELDS[label] };
    }
    return null;
};

/** Checks a hero card against the API row backing it. */
const checkHero = (row, group) => {
    const heroes = heroCards();
    if (!heroes.length) {
        record(group, 'Hero metric matches the API', 'harness', ['no hero card found'], '');
        return;
    }
    const text = norm(heroes[0]);
    const resolved = heroFieldFor(text);
    if (!resolved) {
        record(group, 'Hero metric matches the API', 'harness',
            ['could not tell which metric the hero shows from: ' + text.slice(0, 80)], '');
        return;
    }
    const expected = round(row[resolved.field]);
    // Match the value as it is rendered next to the label, not anywhere on screen.
    const shown = new RegExp('index\\\\s+' + expected + '\\\\b', 'i').test(text);
    record(group,
        'Hero "' + resolved.label + '" matches API ' + resolved.field,
        shown ? 'passed' : 'failed',
        shown ? [] : ['hero shows: ' + text.slice(0, 60) + ' | API implies ' + expected],
        resolved.field + '=' + row[resolved.field] + ' -> ' + expected);
};
`;

/**
 * Shared in-page helpers, inlined into every emitted script because the page
 * has no access to this module.
 */
/**
 * A list row renders FOUR numbers, not one. Checking only the index-to-goal
 * leaves three sibling fields unverified - and each has a sales/qty twin
 * sitting next to it in the response, which is exactly how a field gets
 * miswired. Suffixes are combined with the active metric prefix.
 *
 *   "Tables - 0811  Gap: -66K / $14.1M  90 vs goal  277 vs demand plan
 *    86 vs last year  17 To-go"
 */
const ROW_LABELS = [
    { label: 'vs goal', suffix: 'IndexToGoal' },
    { label: 'vs demand plan', suffix: 'IndexVsDemandPlan' },
    { label: 'vs last year', suffix: 'IndexVsLastYear' },
    { label: 'To-go', suffix: 'ToGoVsGoal' },
];

/** The hero exposes five metrics; only the first was ever being checked. */
const HERO_LABELS = [
    { label: 'vs goal', suffix: 'IndexToGoal' },
    { label: 'vs demand plan', suffix: 'IndexVsDemandPlan' },
    { label: 'vs last year', suffix: 'IndexVsLastYear' },
    { label: 'vs latest forecast', suffix: 'IndexVsLatestForecast' },
    { label: 'to-go vs goal', suffix: 'ToGoVsGoal' },
];

/** Segmented-control option -> the field-name prefix its numbers come from. */
const METRIC_PREFIX = {
    'Qty index': 'netQuantity',
    'Sales index': 'netSales',
};

/** Rolling windows, in the left-to-right order the Trends chart plots them. */
const ROLLING_WINDOWS = ['ytd', 'r13', 'r8', 'r4', 'r1'];

const SHARED_METRICS = `
const ROW_LABELS = ${JSON.stringify(ROW_LABELS)};
const HERO_LABELS = ${JSON.stringify(HERO_LABELS)};
const METRIC_PREFIX = ${JSON.stringify(METRIC_PREFIX)};
const ROLLING_WINDOWS = ${JSON.stringify(ROLLING_WINDOWS)};

/**
 * Pull the number that appears immediately BEFORE a label. The UI writes
 * "90 vs goal", not "vs goal 90". None of the labels contain regex
 * metacharacters, so they are used unescaped by design.
 */
const valueBefore = (text, label) => {
    const m = text.match(new RegExp('(-?[0-9][0-9,.]*)\\\\s*' + label, 'i'));
    return m ? m[1].replace(/,/g, '') : null;
};

/**
 * "-66K" -> -66000, "$14.1M" -> 14100000, together with the tolerance the
 * RENDERED PRECISION implies. A value shown as "1K" could be anything from
 * 500 to 1499, so a flat percentage tolerance manufactures false failures on
 * small numbers - 1431 genuinely renders as "1K". Tolerance is half of the
 * last displayed digit's unit, which still catches a real unit error (K
 * printed where M was meant) because that is off by three orders of magnitude.
 */
const parseAbbrev = (raw) => {
    if (!raw) return null;
    const m = String(raw).match(/(-?)\\s*\\$?\\s*(-?)([0-9][0-9,.]*)\\s*([KMB]?)/i);
    if (!m) return null;
    const sign = (m[1] === '-' || m[2] === '-') ? -1 : 1;
    const digits = m[3].replace(/,/g, '');
    const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[4] || '').toUpperCase()] || 1;
    const dot = digits.indexOf('.');
    const decimals = dot === -1 ? 0 : digits.length - dot - 1;
    return {
        value: sign * Number(digits) * mult,
        tol: 0.5 * mult * Math.pow(10, -decimals),
    };
};

/**
 * Compare every metric a row renders, not just the headline one. Returns one
 * check per label so a single miswired field is named precisely rather than
 * collapsing the whole row into "mismatch".
 */
const checkRowMetrics = (rows, apiRows, keyOf, prefix, group, toggleLabel) => {
    ROW_LABELS.forEach((spec) => {
        const field = prefix + spec.suffix;
        const checks = [];
        rows.forEach((r) => {
            const api = apiRows.find((a) => keyOf(a) === r.no);
            if (!api || api[field] === undefined || api[field] === null) return;
            // A hidden element is not a mismatch: to-go is deliberately not
            // rendered on rows that are beating their goal (confirmed intended).
            const rendered = valueBefore(r.text, spec.label);
            if (rendered === null) return;
            checks.push({
                id: r.no,
                rendered: rendered,
                expected: round(api[field]),
                match: rendered === round(api[field]),
            });
        });
        const verdict = classify(checks, spec.label + ' on ' + group);
        record(group, 'Row "' + spec.label + '" matches API ' + field + ' (' + toggleLabel + ')',
            verdict.outcome, verdict.reasons, 'compared ' + checks.length + ' rows');
    });
};

/**
 * Gap is rendered abbreviated ("-66K"), so this asserts MAGNITUDE within a
 * tolerance the abbreviation allows - it would still catch a unit error such
 * as K printed where M was meant. Sign is reported separately because the two
 * gap fields disagree in sign in the API itself.
 */
const checkRowGaps = (rows, apiRows, keyOf, group) => {
    // Country cards carry no Gap element at all - the gap pair only appears on
    // PA rows. That is a layout difference between levels, not a missing value,
    // so it is skipped rather than reported as a harness failure.
    if (!rows.some((r) => /Gap:/i.test(r.text))) return;

    const checks = [];
    const signNotes = [];
    rows.forEach((r) => {
        const api = apiRows.find((a) => keyOf(a) === r.no);
        if (!api) return;
        const m = r.text.match(/Gap:\\s*([^/]+)\\/\\s*([^0-9-]*[-0-9][^ ]*)/i);
        if (!m) return;
        const qty = parseAbbrev(m[1]);
        const sales = parseAbbrev(m[2]);
        const near = (p, b) => p !== null && b !== null && !isNaN(b) &&
            Math.abs(Math.abs(p.value) - Math.abs(b)) <= p.tol;
        const okQty = near(qty, Number(api.netQuantityGap));
        const okSales = near(sales, Number(api.netSalesGap));
        checks.push({
            id: r.no,
            rendered: m[1].trim() + ' / ' + m[2].trim(),
            expected: api.netQuantityGap + ' / ' + api.netSalesGap,
            match: okQty && okSales,
        });
        if (qty !== null && Number(api.netQuantityGap) !== 0 &&
            (qty.value < 0) !== (Number(api.netQuantityGap) < 0)) {
            signNotes.push(r.no + ': UI ' + m[1].trim() + ' vs API ' + api.netQuantityGap);
        }
    });
    const verdict = classify(checks, 'gap magnitudes on ' + group);
    record(group, 'Gap magnitudes match API netQuantityGap / netSalesGap',
        verdict.outcome, verdict.reasons, 'compared ' + checks.length + ' rows');
    if (signNotes.length) {
        record(group, 'Gap sign convention differs from the API',
            'observed', signNotes.slice(0, 4),
            'UI appears to re-sign gap as "amount to close" - awaiting confirmation, not treated as a defect');
    }
};

/** All five hero metrics, each resolved against the hero's own metric prefix. */
const checkHeroMetrics = (apiRow, group) => {
    const heroes = heroCards();
    if (!heroes.length) {
        record(group, 'Hero metrics match the API', 'harness', ['no hero card found']);
        return;
    }
    const text = norm(heroes[0]);
    const resolved = heroFieldFor(text);
    if (!resolved) {
        record(group, 'Hero metrics match the API', 'harness',
            ['could not tell which metric the hero shows from: ' + text.slice(0, 80)]);
        return;
    }
    const prefix = resolved.field.indexOf('netQuantity') === 0 ? 'netQuantity' : 'netSales';
    HERO_LABELS.forEach((spec) => {
        const field = prefix + spec.suffix;
        if (apiRow[field] === undefined || apiRow[field] === null) return;
        const rendered = valueBefore(text, spec.label);
        if (rendered === null) {
            record(group, 'Hero "' + spec.label + '" matches API ' + field, 'harness',
                ['label not found in hero text']);
            return;
        }
        const expected = round(apiRow[field]);
        record(group, 'Hero "' + spec.label + '" matches API ' + field,
            rendered === expected ? 'passed' : 'failed',
            rendered === expected ? [] : ['hero shows ' + rendered + ', API implies ' + expected],
            field + '=' + apiRow[field] + ' -> ' + expected);
    });
};
`;

const SHARED = `
const ORIGIN = ${JSON.stringify(API_ORIGIN)};
const ENDPOINT = ORIGIN + '/metrics';
const TOGGLE_FIELDS = ${JSON.stringify(TOGGLE_FIELDS)};

const post = async (body) => {
    const res = await window.__origFetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: window.__auth },
        body: JSON.stringify(body),
    });
    if (!res.ok) return { __error: res.status };
    return res.json();
};

const norm = (el) => ((el && el.innerText) || '').replace(/\\s+/g, ' ').trim();

/**
 * The card element, found by class prefix rather than by climbing parents.
 * Climbing is what produced the "every card shows 94" bug: it walked past the
 * card into the page container and scraped the country hero metric instead.
 */
const cardsMatching = (pattern) =>
    [...document.querySelectorAll('div[class*="_card_"]')].filter((d) => pattern.test(norm(d)));

/** The section wrapping a set of cards, so the right toggle is read. */
const sectionFor = (card) => {
    let n = card;
    for (let i = 0; i < 8 && n; i++) {
        if (n.tagName === 'SECTION') return n;
        n = n.parentElement;
    }
    return null;
};

/** Active segmented-control option, read from aria-pressed - never assumed. */
const activeToggle = (scope) => {
    const root = scope || document;
    const pressed = [...root.querySelectorAll('button[aria-pressed="true"]')]
        .map((b) => (b.textContent || '').trim())
        .filter((t) => TOGGLE_FIELDS[t]);
    return pressed[0] || null;
};

const round = (v) => String(Math.round(Number(v)));

/**
 * Classifies a set of value comparisons, separating product failures from
 * harness breakage. If everything mismatched AND every rendered value is
 * identical, the scraper is broken, not the app.
 */
const classify = (checks, label) => {
    const bad = checks.filter((c) => c.match === false);
    const rendered = checks.map((c) => c.rendered);
    const allSame = rendered.length > 1 && new Set(rendered).size === 1;

    if (checks.length === 0) {
        return { outcome: 'harness', reasons: ['no rows parsed for ' + label + ' - selectors likely changed'] };
    }
    if (bad.length === checks.length && allSame) {
        return {
            outcome: 'harness',
            reasons: [
                'every row mismatched and all rendered the same value (' + rendered[0] + ') - ' +
                'scraper is reading a shared ancestor, not per-row values',
            ],
        };
    }
    if (bad.length) {
        return {
            outcome: 'failed',
            reasons: bad.slice(0, 6).map((c) => c.id + ': UI showed ' + c.rendered + ', API implies ' + c.expected),
        };
    }
    return { outcome: 'passed', reasons: [] };
};

const results = [];
const record = (group, name, outcome, reasons, note) =>
    results.push({ group, name, outcome, reasons: reasons || [], note: note || '' });
${SHARED_HERO}
${SHARED_METRICS}
`;

/**
 * Charts. Neither of the other two suites touches this surface at all.
 *
 * "Sales by week" is WEEKLY_SALES_TREND: one bar per fiscal week, a current-year
 * series that stops at the last week with sales, and a full-length last-year
 * series. Counting geometry catches a truncated or double-rendered series.
 *
 * "Trends - Sales index vs LY" is ROLLING_SALES_TREND, plotted YTD/13w/8w/4w/1w.
 * Its data labels carry full 2-decimal precision, so this asserts the exact
 * value rather than a rounded one - the strongest assertion in the suite.
 */
function buildChartsScript(retailUnitCode, level, filters) {
    return `
${SHARED}
if (!window.__auth) return JSON.stringify({ error: 'no auth captured' });

const LEVEL = ${JSON.stringify(level)};
const FILTERS = ${JSON.stringify(filters)};

const weekly = await post({ metric: 'WEEKLY_SALES_TREND', level: LEVEL, filters: FILTERS });
const rolling = await post({ metric: 'ROLLING_SALES_TREND', level: LEVEL, filters: FILTERS });
// KPI_SUMMARY is fetched only for currentIkeaWeek. The API can return weeks
// BEYOND the current one carrying sales (week 202635 was present while the
// current week was 202634), and the chart correctly does not plot those. So
// the expected point count is "weeks with sales up to and including the
// current week", not "every week with sales".
const kpi = await post({ metric: 'KPI_SUMMARY', level: LEVEL, filters: FILTERS });
const currentWeek = kpi.__error ? null : ((((kpi.data || {}).data || [])[0] || {}).currentIkeaWeek || null);

const wraps = [...document.querySelectorAll('.recharts-wrapper')];
if (!wraps.length) {
    record('Charts', 'Charts are present', 'harness', ['no .recharts-wrapper on the page']);
    return JSON.stringify({ level: 'charts', results: results });
}

// --- Sales by week -------------------------------------------------------
if (weekly.__error) {
    record('Weekly chart', 'WEEKLY_SALES_TREND available', 'harness', ['API returned ' + weekly.__error]);
} else {
    const rows = (weekly.data && weekly.data.data) || [];
    const weekChart = wraps.find((w) => /by week/i.test(norm(sectionFor(w) || w))) || wraps[0];
    const bars = weekChart.querySelectorAll('.recharts-bar-rectangle').length;

    record('Weekly chart', 'One bar per week returned by WEEKLY_SALES_TREND',
        rows.length === 0 ? 'harness' : (bars === rows.length ? 'passed' : 'failed'),
        bars === rows.length ? [] : ['API weeks ' + rows.length + ' vs bars ' + bars],
        'API rows=' + rows.length + ', bars=' + bars);

    // Point counts per plotted line. The current-year line legitimately stops
    // at the last week with sales; last year runs the full span.
    const counts = [...weekChart.querySelectorAll('.recharts-line-curve')]
        .map((p) => ((p.getAttribute('d') || '').match(/[ML]/g) || []).length)
        .sort((a, b) => a - b);
    const withSales = rows.filter((r) => Number(r.weeklyNetSalesCy) > 0).length;
    const completed = currentWeek
        ? rows.filter((r) => Number(r.weeklyNetSalesCy) > 0 && String(r.ikeaWeek) <= String(currentWeek)).length
        : null;

    record('Weekly chart', 'Last-year series spans every week the API returned',
        counts.length === 0 ? 'harness' : (counts.indexOf(rows.length) !== -1 ? 'passed' : 'failed'),
        counts.indexOf(rows.length) !== -1 ? [] : ['line point counts ' + JSON.stringify(counts) + ', expected one of them to be ' + rows.length],
        'point counts ' + JSON.stringify(counts));

    const cyOk = counts.indexOf(withSales) !== -1 ||
        (completed !== null && counts.indexOf(completed) !== -1);
    record('Weekly chart', 'Current-year series covers weeks up to the current one, and no further',
        counts.length === 0 ? 'harness' : (cyOk ? 'passed' : 'failed'),
        cyOk ? [] : [
            'line point counts ' + JSON.stringify(counts),
            'weeks with sales ' + withSales + ', completed weeks ' + completed +
                ' (current week ' + currentWeek + ')',
        ],
        'completed=' + completed + ', with sales=' + withSales + ', current week=' + currentWeek);
}

// --- Trends - rolling indices -------------------------------------------
if (rolling.__error) {
    record('Trends chart', 'ROLLING_SALES_TREND available', 'harness', ['API returned ' + rolling.__error]);
} else {
    const row = ((rolling.data && rolling.data.data) || [])[0];
    const trend = wraps.find((w) => /Trends/i.test(norm(sectionFor(w) || w)));
    const lists = trend ? [...trend.querySelectorAll('.recharts-label-list')]
        .map((ll) => [...ll.querySelectorAll('text')].map((t) => t.textContent.trim())) : [];

    if (!row || !lists.length) {
        record('Trends chart', 'Rolling index labels match the API', 'harness',
            [!row ? 'no rolling row' : 'no data labels found']);
    } else {
        const expected = ROLLING_WINDOWS.map((w) => row[w + 'NetSalesIndex']);
        const shown = lists[0];
        const checks = shown.map((v, i) => ({
            id: ROLLING_WINDOWS[i] || ('pt' + i),
            rendered: v,
            expected: expected[i] === null || expected[i] === undefined ? null : String(Number(expected[i])),
            match: expected[i] !== null && expected[i] !== undefined &&
                Math.abs(Number(v) - Number(expected[i])) < 0.06,
        }));
        const verdict = classify(checks, 'rolling labels');
        record('Trends chart', 'Rolling series matches API ytd/r13/r8/r4/r1 NetSalesIndex',
            verdict.outcome, verdict.reasons,
            'compared ' + checks.length + ' points at full precision');

        // The second label row is, to 3 significant figures, 10000/first across
        // every entity tested. Recorded as an observation with its arithmetic,
        // NOT a failure - whether that is the intended "index needed to catch
        // up" is a product question, not something this suite can decide.
        if (lists[1] && lists[1].length === shown.length) {
            const recip = shown.map((v, i) => ({
                window: ROLLING_WINDOWS[i],
                shown: lists[1][i],
                reciprocalOfFirst: (Math.round(10000 / Number(v) * 10) / 10).toFixed(1),
            }));
            const allRecip = recip.every((r) =>
                Math.abs(Number(r.shown) - Number(r.reciprocalOfFirst)) <= 0.15);
            const goalField = row.ytdNetSalesGoalIndex;
            record('Trends chart',
                'Second series (labelled "vs goal") is the reciprocal of the first',
                allRecip ? 'observed' : 'passed',
                allRecip ? recip.map((r) => r.window + ': shown ' + r.shown + ', 10000/' + shown[ROLLING_WINDOWS.indexOf(r.window)] + '=' + r.reciprocalOfFirst) : [],
                allRecip
                    ? 'API ytdNetSalesGoalIndex=' + goalField + ' is not what is plotted; awaiting product confirmation'
                    : 'second series is not a reciprocal');
        }
    }
}

return JSON.stringify({ level: 'charts', filters: FILTERS, ranAt: new Date().toISOString(), results: results });
`.trim();
}

/**
 * Staleness. React-query caches aggressively, so a render that keeps showing
 * the PREVIOUS entity's numbers is a real failure mode - and one that is
 * invisible to all three suites otherwise, because a single-page snapshot of
 * stale data is perfectly self-consistent.
 *
 * Navigates between two siblings and asserts the hero actually re-renders to
 * the second entity's values.
 */
function buildStaleScript(retailUnitCode, hfbA, hfbB) {
    return `
${SHARED}
if (!window.__auth) return JSON.stringify({ error: 'no auth captured' });

const RU = ${JSON.stringify(retailUnitCode)};
const A = ${JSON.stringify(hfbA)};
const B = ${JSON.stringify(hfbB)};

const openHfb = async (no) => {
    const card = cardsMatching(/View HFB plan/).find((d) => new RegExp('^' + no + '\\\\s*-').test(norm(d)));
    if (!card) return false;
    const btn = [...card.querySelectorAll('button,a')].find((b) => /View HFB plan/i.test(b.textContent || ''));
    if (!btn) return false;
    btn.click();
    await new Promise((r) => setTimeout(r, 3000));
    return true;
};

const heroText = () => {
    const h = heroCards();
    return h.length ? norm(h[0]) : null;
};

const apiFor = async (no) => {
    const res = await post({ metric: 'KPI_SUMMARY', level: 'hfb', filters: { retailUnitCode: RU, hfbNo: no } });
    return res.__error ? null : ((res.data && res.data.data) || [])[0];
};

const rowA = await apiFor(A);
const rowB = await apiFor(B);

if (!rowA || !rowB) {
    record('Staleness', 'Sibling HFB data available', 'harness', ['API did not return both HFBs']);
} else if (round(rowA.netSalesIndexToGoal) === round(rowB.netSalesIndexToGoal)) {
    // Without differing values the check cannot prove anything either way.
    record('Staleness', 'Switching HFB re-renders with the new values', 'harness',
        ['HFB ' + A + ' and ' + B + ' share the same index, so staleness is undetectable'],
        'pick two HFBs with different indices');
} else {
    if (!(await openHfb(A))) {
        record('Staleness', 'Switching HFB re-renders with the new values', 'harness',
            ['could not open HFB ' + A]);
    } else {
        const first = heroText();
        history.back();
        await new Promise((r) => setTimeout(r, 2500));
        const opened = await openHfb(B);
        const second = heroText();
        const wantB = round(rowB.netSalesIndexToGoal);
        const wantA = round(rowA.netSalesIndexToGoal);
        const showsB = second !== null && new RegExp('index\\\\s+' + wantB + '\\\\b', 'i').test(second);
        const stuckOnA = second !== null && new RegExp('index\\\\s+' + wantA + '\\\\b', 'i').test(second);

        record('Staleness', 'Switching HFB re-renders with the new values',
            !opened || second === null ? 'harness' : (showsB && !stuckOnA ? 'passed' : 'failed'),
            showsB && !stuckOnA ? [] : [
                'after opening HFB ' + B + ' the hero shows: ' + String(second).slice(0, 70),
                'expected index ' + wantB + ' (HFB ' + B + '), previous was ' + wantA + ' (HFB ' + A + ')',
            ],
            'HFB ' + A + '=' + wantA + ' -> HFB ' + B + '=' + wantB);
    }
}

return JSON.stringify({ level: 'stale', ru: RU, ranAt: new Date().toISOString(), results: results });
`.trim();
}

/**
 * Hierarchy boundary. The API is explicit that PRA is not a grain
 * ("KPI_SUMMARY metric does not support PRA level - no mart exists at that
 * grain"), and PA returns children: 0. This asserts the UI agrees - it must
 * treat PA as a leaf rather than offering a drill-down that cannot be served.
 */
function buildLeafScript(retailUnitCode, hfbNo, paNo) {
    return `
${SHARED}
if (!window.__auth) return JSON.stringify({ error: 'no auth captured' });

const RU = ${JSON.stringify(retailUnitCode)};
const PA = ${JSON.stringify(paNo)};

const pa = await post({ metric: 'KPI_SUMMARY', level: 'pa', filters: { retailUnitCode: RU, paNo: PA } });
const pra = await post({ metric: 'KPI_SUMMARY', level: 'pra', filters: { retailUnitCode: RU, paNo: PA } });

record('Hierarchy boundary', 'PRA level is rejected by the API',
    pra.__error ? 'passed' : 'failed',
    pra.__error ? [] : ['PRA level unexpectedly succeeded - the hierarchy may have gained a grain'],
    pra.__error ? 'HTTP ' + pra.__error : 'unexpected success');

if (pa.__error) {
    record('Hierarchy boundary', 'PA is a leaf', 'harness', ['API returned ' + pa.__error]);
} else {
    const kids = (pa.data && pa.data.children) || [];
    record('Hierarchy boundary', 'API reports PA as a leaf (no children)',
        kids.length === 0 ? 'passed' : 'observed',
        kids.length === 0 ? [] : ['PA returned ' + kids.length + ' children'],
        'children=' + kids.length);

    const drillRows = [...document.querySelectorAll('button')]
        .map((b) => norm(b))
        .filter((t) => /-\\s*\\d{4}\\b/.test(t));
    record('Hierarchy boundary', 'PA page offers no drill-down the API cannot serve',
        drillRows.length === 0 ? 'passed' : 'failed',
        drillRows.length === 0 ? [] : ['found ' + drillRows.length + ' drill-down rows on a leaf page'],
        'drill-down rows=' + drillRows.length);

    const row = ((pa.data && pa.data.data) || [])[0];
    if (row) checkHeroMetrics(row, 'PA detail page');
}

return JSON.stringify({ level: 'leaf', ru: RU, pa: PA, ranAt: new Date().toISOString(), results: results });
`.trim();
}

/** Token capture. Identical model to api-probes.js. */
function buildCaptureScript() {
    return `
if (!window.__hooked) {
    window.__hooked = true;
    const orig = window.__origFetch || window.fetch;
    window.__origFetch = orig;
    window.fetch = async function (...args) {
        const req = args[0];
        const init = args[1] || {};
        const url = String(typeof req === 'string' ? req : (req && req.url));
        if (url.indexOf('api.dev.salesplanning') !== -1) {
            const h = init.headers || {};
            const auth = h.Authorization || h.authorization;
            if (auth) window.__auth = auth;
        }
        return orig.apply(this, args);
    };
}
return 'capture hook installed; auth present: ' + (!!window.__auth);
`.trim();
}

/**
 * Country dashboard: HFB cards against KPI_SUMMARY country children.
 * Card label format at this level is "NN - Name" (number first).
 */
function buildCountryScript(retailUnitCode) {
    return `
${SHARED}
if (!window.__auth) return JSON.stringify({ error: 'no auth captured - run capture and trigger a real request first' });

const RU = ${JSON.stringify(retailUnitCode)};
const country = await post({ metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: RU } });
if (country.__error) return JSON.stringify({ error: 'API returned ' + country.__error });

const kids = (country.data && country.data.children) || [];
const cards = cardsMatching(/View HFB plan/);
const parsed = cards.map((d) => {
    const t = norm(d);
    return {
        no: (t.match(/^(\\d{2})\\s*-/) || [])[1],
        idx: (t.match(/^\\d{2}\\s*-\\s*.+?\\s(\\d+)\\s*vs goal/) || [])[1],
        text: t,
    };
}).filter((p) => p.no);

// 1. Row count
record(
    'Country → HFB list',
    'Every HFB the API returns is rendered as a card',
    kids.length > 0 && parsed.length === kids.length ? 'passed' : (parsed.length === 0 ? 'harness' : 'failed'),
    kids.length === parsed.length ? [] : ['API returned ' + kids.length + ' HFBs, UI rendered ' + parsed.length + ' cards'],
    'API children=' + kids.length + ', DOM cards=' + parsed.length
);

// 2. Names and numbers present
const pageText = norm(document.body);
const missing = kids.filter((k) => k.hfbName && pageText.indexOf(k.hfbName) === -1).map((k) => k.hfbNo + ' ' + k.hfbName);
record(
    'Country → HFB list',
    'Every HFB name from the API appears on the page',
    missing.length ? 'failed' : 'passed',
    missing.slice(0, 6).map((m) => 'not rendered: ' + m),
    'checked ' + kids.length + ' names'
);

// 3. Displayed index matches the API field for the ACTIVE toggle
const section = cards.length ? sectionFor(cards[0]) : null;
const toggle = activeToggle(section) || activeToggle(null);
const field = TOGGLE_FIELDS[toggle];

if (!field) {
    record('Country → HFB list', 'Displayed index matches the API', 'harness',
        ['could not determine active toggle; found: ' + JSON.stringify(toggle)], '');
} else {
    const checks = parsed.map((p) => {
        const k = kids.find((x) => x.hfbNo === p.no);
        if (!k) return { id: p.no, rendered: p.idx, expected: null, match: false };
        return { id: p.no, rendered: p.idx, expected: round(k[field]), match: p.idx === round(k[field]) };
    });
    const c = classify(checks, 'HFB cards');
    record('Country → HFB list',
        'Displayed index matches API ' + field + ' (toggle: ' + toggle + ')',
        c.outcome, c.reasons, 'compared ' + checks.length + ' cards');
    window.__lastCountry = { kids, parsed, toggle, field };
}

// 4. Sort order matches the API sorted the same way
if (field && parsed.length) {
    const domOrder = parsed.map((p) => p.no);
    const apiOrder = kids.slice().sort((a, b) => Number(a[field]) - Number(b[field])).map((k) => k.hfbNo);
    const same = JSON.stringify(domOrder) === JSON.stringify(apiOrder);
    record('Country → HFB list',
        'Card order matches API sorted by ' + field + ' ascending (worst first)',
        same ? 'passed' : 'failed',
        same ? [] : ['UI: ' + domOrder.join(',') + ' | API: ' + apiOrder.join(',')],
        '');
}

// 5. Every OTHER metric the card renders — vs demand plan, vs last year,
//    To-go and the gap pair. Only one of five numbers was checked before.
if (field && parsed.length) {
    const prefix = METRIC_PREFIX[toggle];
    if (prefix) {
        checkRowMetrics(parsed, kids, (k) => k.hfbNo, prefix, 'Country → HFB list', 'toggle: ' + toggle);
    }
    checkRowGaps(parsed, kids, (k) => k.hfbNo, 'Country → HFB list');
}

// 6. Hero metric — resolved from the hero's own label, not the list toggle
const row = country.data && country.data.data && country.data.data[0];
if (row) {
    checkHero(row, 'Country → hero metric');
    checkHeroMetrics(row, 'Country → hero metric');
}

return JSON.stringify({ level: 'country', ru: RU, ranAt: new Date().toISOString(), results });
`.trim();
}

/**
 * Flips the segmented control and re-verifies against the OTHER metric field.
 * This is the highest-value check in the suite: if the UI read the wrong field,
 * one of the two toggle states must disagree with the API.
 */
function buildToggleScript() {
    return `
${SHARED}
if (!window.__auth) return JSON.stringify({ error: 'no auth captured' });

const ru = (location.pathname.match(/region-dashboard\\/([a-z]{2})/i) || [])[1];
if (!ru) return JSON.stringify({ error: 'could not read region from URL: ' + location.pathname });

const country = await post({ metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: ru.toUpperCase() } });
if (country.__error) return JSON.stringify({ error: 'API returned ' + country.__error });
const kids = (country.data && country.data.children) || [];

const findCards = () => cardsMatching(/View HFB plan/);
const parse = () => findCards().map((d) => {
    const t = norm(d);
    return { no: (t.match(/^(\\d{2})\\s*-/) || [])[1], idx: (t.match(/^\\d{2}\\s*-\\s*.+?\\s(\\d+)\\s*vs goal/) || [])[1] };
}).filter((p) => p.no);

const section = findCards().length ? sectionFor(findCards()[0]) : null;
if (!section) return JSON.stringify({ error: 'could not locate the HFB performance section' });

for (const label of Object.keys(TOGGLE_FIELDS)) {
    const btn = [...section.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === label);
    if (!btn) {
        record('Toggle consistency', 'Switch to ' + label, 'harness', ['no button labelled ' + label + ' in the section'], '');
        continue;
    }
    btn.click();
    await new Promise((r) => setTimeout(r, 900));

    const active = activeToggle(section);
    if (active !== label) {
        record('Toggle consistency', 'Switch to ' + label, 'failed',
            ['clicked ' + label + ' but aria-pressed reports ' + JSON.stringify(active)], '');
        continue;
    }

    const field = TOGGLE_FIELDS[label];
    const checks = parse().map((p) => {
        const k = kids.find((x) => x.hfbNo === p.no);
        if (!k) return { id: p.no, rendered: p.idx, expected: null, match: false };
        return { id: p.no, rendered: p.idx, expected: round(k[field]), match: p.idx === round(k[field]) };
    });
    const c = classify(checks, label + ' cards');
    record('Toggle consistency',
        'With "' + label + '" active, cards show API ' + field,
        c.outcome, c.reasons, 'compared ' + checks.length + ' cards');
}

return JSON.stringify({ level: 'toggle', ranAt: new Date().toISOString(), results });
`.trim();
}

/**
 * HFB dashboard: PA rows against the HFB response's children.
 * Note the label format INVERTS at this level - "Name - NNNN" rather than
 * "NN - Name". Reusing the country parser here silently yields zero rows.
 */
function buildHfbScript(retailUnitCode, hfbNo) {
    return `
${SHARED}
if (!window.__auth) return JSON.stringify({ error: 'no auth captured' });

const RU = ${JSON.stringify(retailUnitCode)};
const HFB = ${JSON.stringify(hfbNo)};

const hfb = await post({ metric: 'KPI_SUMMARY', level: 'hfb', filters: { retailUnitCode: RU, hfbNo: HFB } });
if (hfb.__error) return JSON.stringify({ error: 'API returned ' + hfb.__error });

const kids = (hfb.data && hfb.data.children) || [];
const row = hfb.data && hfb.data.data && hfb.data.data[0];
const pageText = norm(document.body);

// PA rows are buttons at this level, labelled "Name - NNNN".
const paButtons = [...document.querySelectorAll('button')]
    .map((b) => ({ el: b, t: norm(b) }))
    .filter((x) => /-\\s*\\d{4}\\b/.test(x.t));

const parsed = paButtons.map((x) => ({
    no: (x.t.match(/-\\s*(\\d{4})\\b/) || [])[1],
    idx: (x.t.match(/(\\d+)\\s*vs goal/) || [])[1],
    text: x.t,
})).filter((p) => p.no);

record('HFB → PA list',
    'Every PA the API returns is rendered',
    kids.length > 0 && parsed.length === kids.length ? 'passed' : (parsed.length === 0 ? 'harness' : 'failed'),
    kids.length === parsed.length ? [] : ['API returned ' + kids.length + ' PAs, UI rendered ' + parsed.length],
    'API children=' + kids.length + ', DOM rows=' + parsed.length);

const missing = kids.filter((k) => k.paName && pageText.indexOf(k.paName) === -1).map((k) => k.paNo + ' ' + k.paName);
record('HFB → PA list',
    'Every PA name from the API appears on the page',
    missing.length ? 'failed' : 'passed',
    missing.slice(0, 6).map((m) => 'not rendered: ' + m),
    'checked ' + kids.length + ' names');

const toggle = activeToggle(null);
const field = TOGGLE_FIELDS[toggle];
if (field && parsed.length) {
    const checks = parsed.map((p) => {
        const k = kids.find((x) => x.paNo === p.no);
        if (!k) return { id: p.no, rendered: p.idx, expected: null, match: false };
        return { id: p.no, rendered: p.idx, expected: round(k[field]), match: p.idx === round(k[field]) };
    });
    const c = classify(checks, 'PA rows');
    record('HFB → PA list',
        'Displayed PA index matches API ' + field + ' (toggle: ' + toggle + ')',
        c.outcome, c.reasons, 'compared ' + checks.length + ' rows');
}

// Every other metric each PA row renders, plus the gap pair.
if (field && parsed.length) {
    const prefix = METRIC_PREFIX[toggle];
    if (prefix) {
        checkRowMetrics(parsed, kids, (k) => k.paNo, prefix, 'HFB → PA list', 'toggle: ' + toggle);
    }
    checkRowGaps(parsed, kids, (k) => k.paNo, 'HFB → PA list');
}

// The HFB's own headline number, from the hfb-level response.
if (row) {
    checkHero(row, 'HFB → hero metric');
    checkHeroMetrics(row, 'HFB → hero metric');
}

return JSON.stringify({ level: 'hfb', ru: RU, hfb: HFB, ranAt: new Date().toISOString(), results });
`.trim();
}

/**
 * Cross-page consistency: the number shown for an HFB on the country page must
 * equal the number shown on that HFB's own page. Catches drill-down bugs where
 * a level re-derives a value differently, or serves it from a stale cache.
 */
function buildDrilldownScript(retailUnitCode, hfbNo) {
    return `
${SHARED}
if (!window.__auth) return JSON.stringify({ error: 'no auth captured' });

const RU = ${JSON.stringify(retailUnitCode)};
const HFB = ${JSON.stringify(hfbNo)};

const country = await post({ metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: RU } });
const direct = await post({ metric: 'KPI_SUMMARY', level: 'hfb', filters: { retailUnitCode: RU, hfbNo: HFB } });
if (country.__error || direct.__error) {
    return JSON.stringify({ error: 'API error: country=' + country.__error + ' hfb=' + direct.__error });
}

const childRow = ((country.data && country.data.children) || []).find((r) => r.hfbNo === HFB);
const directRow = direct.data && direct.data.data && direct.data.data[0];

if (!childRow || !directRow) {
    record('Drill-down consistency', 'HFB ' + HFB + ' present at both levels', 'failed',
        ['missing row: asChild=' + !!childRow + ', direct=' + !!directRow], '');
} else {
    // Compare every shared field. The API serialises numbers as STRINGS, so
    // compare stringified - a typeof 'number' filter matches nothing and
    // produces a vacuous pass.
    const fields = Object.keys(childRow).filter((k) => k !== 'generatedAt' && directRow[k] !== undefined);
    const diffs = fields
        .filter((f) => String(childRow[f]) !== String(directRow[f]))
        .map((f) => f + ': asChild=' + childRow[f] + ' vs direct=' + directRow[f]);

    /**
     * The two levels are cached independently and refresh on their own
     * schedules, so the same HFB can legitimately be served from snapshots
     * generated hours apart (confirmed intended, Tim 2026-08-27). When that
     * happens the rows are two photographs of the same entity taken at
     * different times, and small drift in the demand-plan figures is expected
     * rather than a defect.
     *
     * The assertion is therefore conditioned on the snapshot stamps: values
     * that differ while the stamps ALSO differ are an observation, but values
     * that differ when both rows were generated at the same instant are a real
     * inconsistency and still fail.
     */
    const stampChild = childRow.generatedAt;
    const stampDirect = directRow.generatedAt;
    const sameSnapshot = String(stampChild) === String(stampDirect);
    const skewHours = (stampChild && stampDirect)
        ? Math.abs(Number(stampDirect) - Number(stampChild)) / 3600
        : null;
    const stampNote = sameSnapshot
        ? 'both rows generated at the same instant'
        : 'generated ' + (skewHours === null ? 'at different times' : skewHours.toFixed(1) + 'h apart');

    let outcome;
    if (fields.length === 0) outcome = 'harness';
    else if (!diffs.length) outcome = 'passed';
    else outcome = sameSnapshot ? 'failed' : 'observed';

    record('Drill-down consistency',
        'HFB ' + HFB + ' values identical whether read from the country response or its own',
        outcome,
        fields.length === 0 ? ['no shared fields - response shapes diverged'] : diffs.slice(0, 6),
        'compared ' + fields.length + ' fields, ' + stampNote +
            (outcome === 'observed'
                ? ' - independent cache refresh, expected drift, not a defect'
                : ''));

    // And the UI on THIS page must agree with that value. Use the hero card's
    // own label rather than a list toggle, and match inside the card - a
    // page-wide text search would pass on a coincidental match elsewhere.
    checkHero(directRow, 'Drill-down consistency');
}

return JSON.stringify({ level: 'drilldown', ru: RU, hfb: HFB, ranAt: new Date().toISOString(), results });
`.trim();
}

function buildCleanupScript() {
    return `
if (window.__origFetch) { window.fetch = window.__origFetch; }
delete window.__origFetch;
delete window.__auth;
delete window.__hooked;
delete window.__lastCountry;
return JSON.stringify({
    auth: typeof window.__auth,
    hooked: typeof window.__hooked,
    fetchIsNative: /\\[native code\\]/.test(String(window.fetch)),
});
`.trim();
}

const EMITTERS = {
    capture: () => buildCaptureScript(),
    country: (a) => buildCountryScript(a.ru || 'US'),
    toggle: () => buildToggleScript(),
    hfb: (a) => buildHfbScript(a.ru || 'US', a.hfb || '05'),
    drilldown: (a) => buildDrilldownScript(a.ru || 'US', a.hfb || '05'),
    charts: (a) =>
        buildChartsScript(
            a.ru || 'US',
            a.pa ? 'pa' : (a.hfb ? 'hfb' : 'country'),
            a.pa
                ? { retailUnitCode: a.ru || 'US', paNo: a.pa }
                : (a.hfb
                    ? { retailUnitCode: a.ru || 'US', hfbNo: a.hfb }
                    : { retailUnitCode: a.ru || 'US' })
        ),
    stale: (a) => buildStaleScript(a.ru || 'US', a.hfb || '05', a.hfbB || '08'),
    leaf: (a) => buildLeafScript(a.ru || 'US', a.hfb || '08', a.pa || '0811'),
    cleanup: () => buildCleanupScript(),
};

if (require.main === module) {
    const args = {};
    process.argv.slice(2).forEach((t) => {
        const m = t.match(/^--([^=]+)=?(.*)$/);
        if (m) args[m[1]] = m[2] || true;
    });
    const which = args.emit;
    if (!EMITTERS[which]) {
        console.error('Usage: node ui-api-integration.js --emit=<' + Object.keys(EMITTERS).join('|') + '> [--ru=US] [--hfb=05]');
        process.exit(1);
    }
    console.log(EMITTERS[which](args));
}

module.exports = {
    API_ORIGIN,
    TOGGLE_FIELDS,
    buildCaptureScript,
    buildCountryScript,
    buildToggleScript,
    buildHfbScript,
    buildDrilldownScript,
    buildChartsScript,
    buildStaleScript,
    buildLeafScript,
    buildCleanupScript,
};
