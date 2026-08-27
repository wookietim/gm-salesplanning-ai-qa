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

    // Recharts animates bars in, so an immediate read can catch a partly
    // rendered series (39 bars read as 34). Wait for the count to hold steady
    // across two consecutive samples before trusting it.
    let bars = weekChart.querySelectorAll('.recharts-bar-rectangle').length;
    for (let s = 0; s < 12; s++) {
        await new Promise((r) => setTimeout(r, 250));
        const next = weekChart.querySelectorAll('.recharts-bar-rectangle').length;
        if (next === bars && next > 0) break;
        bars = next;
    }

    const withSales = rows.filter((r) => Number(r.weeklyNetSalesCy) > 0).length;
    const completed = currentWeek
        ? rows.filter((r) => Number(r.weeklyNetSalesCy) > 0 && String(r.ikeaWeek) <= String(currentWeek)).length
        : null;

    // Bar count depends on the toggle. In value mode ("Sales"/"Qty") the chart
    // draws a bar for every week the API returned, future weeks included (at
    // zero height). In index mode ("Sales index"/"Qty index") there is no index
    // for a week that has not happened, so only completed weeks get a bar.
    // Verified live: 39 bars in Sales mode vs 34 in Qty index mode, against 39
    // API weeks of which 34 were completed.
    const indexMode = [...(sectionFor(weekChart) || weekChart)
        .querySelectorAll('button[aria-pressed="true"]')]
        .some((b) => /index/i.test((b.textContent || '').trim()));
    const expectedBars = (indexMode && completed !== null) ? completed : rows.length;
    record('Weekly chart', 'One bar per week the chart can plot in its current mode',
        rows.length === 0 ? 'harness' : (bars === expectedBars ? 'passed' : 'failed'),
        bars === expectedBars ? [] : [
            'bars ' + bars + ', expected ' + expectedBars,
            'chart is in ' + (indexMode ? 'index' : 'value') + ' mode',
            'API returned ' + rows.length + ' week(s), ' + completed + ' of them completed (current week ' + currentWeek + ')',
        ],
        'mode=' + (indexMode ? 'index' : 'value') + ', API rows=' + rows.length +
            ', completed=' + completed + ', bars=' + bars);

    // Point counts per plotted line. The current-year line legitimately stops
    // at the last week with sales; last year runs the full span.
    const counts = [...weekChart.querySelectorAll('.recharts-line-curve')]
        .map((p) => ((p.getAttribute('d') || '').match(/[ML]/g) || []).length)
        .sort((a, b) => a - b);

    record('Weekly chart', 'Last-year series spans every week the API returned',
        counts.length === 0 ? 'harness' : (counts.indexOf(rows.length) !== -1 ? 'passed' : 'failed'),
        counts.indexOf(rows.length) !== -1 ? [] : ['line point counts ' + JSON.stringify(counts) + ', expected one of them to be ' + rows.length],
        'point counts ' + JSON.stringify(counts));

    // How the series handles weeks that have not happened yet. Recharts plots
    // every category in the dataset, so the point count alone is always
    // rows.length and proves nothing. What matters is the VALUE plotted for
    // future weeks: dropping to the zero baseline reads visually as "sales
    // fell to nothing" rather than "no data yet".
    const futureWeeks = currentWeek
        ? rows.filter((r) => String(r.ikeaWeek) > String(currentWeek)).length
        : 0;

    if (!currentWeek) {
        record('Weekly chart', 'Weeks after the current one are not plotted as real values',
            'harness', ['current week unavailable from KPI_SUMMARY']);
    } else if (futureWeeks === 0) {
        record('Weekly chart', 'Weeks after the current one are not plotted as real values',
            'passed', [], 'API returned no weeks beyond ' + currentWeek);
    } else {
        const curves = [...weekChart.querySelectorAll('.recharts-line-curve')]
            .map((p) => (p.getAttribute('d') || '')
                .split(/[ML]/).slice(1)
                .map((s) => Number(s.split(',')[1])))
            .filter((ys) => ys.length === rows.length);
        const atBaseline = curves.length > 0 && curves.every((ys) => {
            const base = Math.max.apply(null, ys);
            return ys.slice(rows.length - futureWeeks).every((y) => Math.abs(y - base) < 0.5);
        });
        record('Weekly chart', 'Weeks after the current one are not plotted as real values',
            curves.length === 0 ? 'harness' : (atBaseline ? 'observed' : 'passed'),
            atBaseline ? [
                'the last ' + futureWeeks + ' week(s) sit beyond the current week (' + currentWeek + ')',
                'both series are drawn down to the zero baseline across those weeks rather than stopping',
                'worth confirming a flat line at zero is the intended way to show "not yet happened"',
            ] : [],
            futureWeeks + ' future week(s), curves=' + curves.length);
    }

    // --- Bar VALUES, not just bar count ---------------------------------
    //
    // Counting bars proves the series is the right LENGTH. It says nothing
    // about what each bar plots: every bar could carry week 1's figure, or
    // the weeks could be reversed, and all three checks above still pass.
    //
    // Recharts does not write the datum anywhere readable, so the value is
    // recovered from the bar's pixel height. Absolute heights depend on the
    // axis scale, so each bar is normalised against the tallest bar and
    // compared with the API value normalised against the largest API value.
    // Ratios cancel the scale factor out.
    //
    // The bars plot LAST YEAR, not the current year - established by
    // correlating every numeric field in the response against the rendered
    // heights, where weeklyNetSalesLy matched with zero deviation across all
    // 39 weeks and the runner-up was out by 0.0992.
    const BAR_FIELDS = { Sales: 'weeklyNetSalesLy', Qty: 'weeklyNetQuantityLy' };
    const chartToggle = (() => {
        const sec = sectionFor(weekChart) || weekChart;
        const on = [...sec.querySelectorAll('button[aria-pressed="true"]')]
            .map((b) => (b.textContent || '').trim());
        return on.find((t) => BAR_FIELDS[t]) || null;
    })();

    if (!chartToggle) {
        // "Qty index" / "Sales index" put the chart into index mode, where the
        // bars no longer plot a raw weekly value. Not a failure - the check
        // simply does not apply, and claiming otherwise would be a false pass.
        record('Weekly chart', 'Bar heights match the API week by week', 'harness',
            ['chart is in index mode, or the toggle could not be read - bar values not comparable'],
            'value check skipped');
    } else {
        const barField = BAR_FIELDS[chartToggle];
        const geom = [...weekChart.querySelectorAll('.recharts-bar-rectangle')]
            .map((b) => {
                const p = b.querySelector('path,rect');
                return p ? { x: Number(p.getAttribute('x')), h: Number(p.getAttribute('height')) } : null;
            })
            .filter((b) => b && isFinite(b.x) && isFinite(b.h))
            .sort((a, b) => a.x - b.x);

        const apiVals = rows.map((r) => Math.abs(Number(r[barField])));
        const maxH = Math.max.apply(null, geom.map((g) => g.h));
        const maxV = Math.max.apply(null, apiVals);
        const spread = new Set(apiVals.map((v) => Math.round(v))).size;

        if (geom.length !== rows.length || !isFinite(maxH) || maxH <= 0 || !isFinite(maxV) || maxV <= 0) {
            record('Weekly chart', 'Bar heights match the API week by week', 'harness',
                ['read ' + geom.length + ' bar geometries for ' + rows.length + ' API weeks'],
                'could not measure bars');
        } else if (spread < 2) {
            // Every week identical: normalising makes any ordering look right,
            // so a pass here would be meaningless.
            record('Weekly chart', 'Bar heights match the API week by week', 'harness',
                ['every API value for ' + barField + ' is identical - normalised comparison cannot discriminate'],
                'no spread in API data');
        } else {
            // Tolerance is 1% of the tallest bar. Observed worst deviation on a
            // healthy run is 0, so this is loose enough for sub-pixel rounding
            // and far tighter than any real mis-plot.
            const TOL = 0.01;
            const bad = [];
            let worst = 0;
            for (let i = 0; i < rows.length; i++) {
                const expected = apiVals[i] / maxV;
                const actual = geom[i].h / maxH;
                const delta = Math.abs(expected - actual);
                if (delta > worst) worst = delta;
                if (delta > TOL) {
                    bad.push('week ' + rows[i].ikeaWeek + ': plotted ' + actual.toFixed(3) +
                        ' of full height, API implies ' + expected.toFixed(3));
                }
            }
            record('Weekly chart',
                'Bar heights match the API week by week',
                bad.length ? 'failed' : 'passed',
                bad.slice(0, 6),
                'compared ' + rows.length + ' weeks against ' + barField +
                    ' (toggle: ' + chartToggle + '), worst deviation ' + worst.toFixed(4) +
                    ' of full height, tolerance ' + TOL);
        }
    }
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
        } else {
            // Without this the check simply disappears from the run and the
            // totals shift with nothing to explain why. Say so instead.
            record('Trends chart',
                'Second series (labelled "vs goal") is the reciprocal of the first',
                'harness',
                [!lists[1]
                    ? 'chart rendered only one label row, so there is no second series to compare'
                    : 'second label row has ' + lists[1].length + ' points, first has ' + shown.length],
                '');
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
} else if (field) {
    record('Country → HFB list',
        'Card order matches API sorted by ' + field + ' ascending (worst first)',
        'harness', ['no HFB cards were parsed, so there is no order to compare'], '');
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

// The toggle must be read from the PA section itself. The weekly chart has its
// own identical-looking control, and reading from document scope returns
// whichever appears first in the DOM - which is the chart's. That silently
// compares Qty-rendered rows against netSales* fields and manufactures a full
// set of false failures.
const paSection = paButtons.length ? sectionFor(paButtons[0].el) : null;
const toggleScope = paSection || document;
const toggle = activeToggle(paSection) || activeToggle(null);
const field = TOGGLE_FIELDS[toggle];
// Mirrors the country list's guard at the top of its own checks: if the toggle
// or the rows are missing, every PA check below is skipped, so record why once
// rather than letting them vanish from the run without explanation.
if (!field || !parsed.length) {
    record('HFB → PA list', 'PA row checks could not be run', 'harness',
        [!field
            ? 'could not determine the active toggle; found: ' + JSON.stringify(toggle)
            : 'no PA rows were parsed from the page'], '');
}
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

// PA ordering. The country list asserts its card order; the PA list below an
// HFB never did, so a level that sorted correctly at the top and wrongly one
// level down would pass the suite. The heading states "By gap to goal (worst
// first)", which is the same ascending sort the country cards use.
//
// Reported as an observation rather than a failure: ordering is presentation,
// and ties in the sort key have no defined order, so a strict sequence
// comparison can differ from the API for entirely legitimate reasons.
if (field && parsed.length > 1) {
    const domOrder = parsed.map((p) => p.no);
    const apiOrder = kids.slice()
        .sort((a, b) => Number(a[field]) - Number(b[field]))
        .map((k) => k.paNo);
    const same = JSON.stringify(domOrder) === JSON.stringify(apiOrder);

    // A tie means two PAs share the sort key, so either sequence is correct.
    const values = kids.map((k) => Number(k[field]));
    const ties = values.length - new Set(values).size;

    record('HFB → PA list',
        'PA order matches API sorted by ' + field + ' ascending (worst first)',
        same ? 'passed' : 'observed',
        same ? [] : [
            'UI order: ' + domOrder.slice(0, 8).join(', '),
            'API order: ' + apiOrder.slice(0, 8).join(', '),
            ties ? ties + ' PA(s) share a sort value, so their relative order is undefined' :
                'no ties in the sort key',
        ],
        'compared ' + domOrder.length + ' PAs (toggle: ' + toggle + ')' +
            (same ? '' : ' - ordering is presentation, raised as a question not a defect'));
} else if (field && parsed.length === 1) {
    record('HFB → PA list',
        'PA order matches API sorted by ' + field + ' ascending (worst first)',
        'harness', ['only one PA row on the page, so there is no order to compare'], '');
}

// The same rows, read again under the OTHER metric. Everything above runs on
// whichever toggle happened to be active, which in practice is always "Qty
// index". A field miswired only on the sales side - netSales* rendered where
// netQuantity* was meant, or vice versa - is invisible until the toggle is
// flipped, which is exactly the class of bug this suite exists to catch.
if (parsed.length) {
    const other = Object.keys(TOGGLE_FIELDS).find((t) => t !== toggle);
    const btn = other
        ? [...toggleScope.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === other)
        : null;

    if (!btn) {
        record('HFB → PA list', 'PA rows re-checked under the other metric', 'harness',
            ['could not find a "' + other + '" toggle button on the HFB page'], '');
    } else {
        const previous = toggle;
        btn.click();
        await new Promise((r) => setTimeout(r, 1200));

        const nowToggle = activeToggle(paSection) || activeToggle(null);
        const nowField = TOGGLE_FIELDS[nowToggle];

        if (nowToggle !== other || !nowField) {
            record('HFB → PA list', 'PA rows re-checked under the other metric', 'harness',
                ['clicked "' + other + '" but the active toggle reads "' + nowToggle + '"'], '');
        } else {
            const reparsed = [...document.querySelectorAll('button')]
                .map((b) => norm(b))
                .filter((t) => /-\\s*\\d{4}\\b/.test(t))
                .map((t) => ({
                    no: (t.match(/-\\s*(\\d{4})\\b/) || [])[1],
                    idx: (t.match(/(\\d+)\\s*vs goal/) || [])[1],
                    text: t,
                }))
                .filter((p) => p.no);

            const checks = reparsed.map((p) => {
                const k = kids.find((x) => x.paNo === p.no);
                if (!k) return { id: p.no, rendered: p.idx, expected: null, match: false };
                return { id: p.no, rendered: p.idx, expected: round(k[nowField]), match: p.idx === round(k[nowField]) };
            });
            const c = classify(checks, 'PA rows under ' + nowToggle);
            record('HFB → PA list',
                'Displayed PA index matches API ' + nowField + ' (toggle: ' + nowToggle + ')',
                c.outcome, c.reasons, 'compared ' + checks.length + ' rows after switching metric');

            const prefix2 = METRIC_PREFIX[nowToggle];
            if (prefix2 && reparsed.length) {
                checkRowMetrics(reparsed, kids, (k) => k.paNo, prefix2, 'HFB → PA list', 'toggle: ' + nowToggle);
            }
        }

        // Always put the control back, so later scripts see the page as they
        // expect it. Leaving it flipped would silently change what the
        // drill-down and chart emitters compare against.
        const back = [...toggleScope.querySelectorAll('button')]
            .find((b) => (b.textContent || '').trim() === previous);
        if (back) { back.click(); await new Promise((r) => setTimeout(r, 800)); }
    }
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

/**
 * Do the children add up to the parent?
 *
 * Every other check in this suite compares ONE number against ONE field. This
 * compares a number against the sum of its parts, which is the only assertion
 * here capable of catching a dropped or double-counted row: if one HFB went
 * missing from the aggregate, every individual HFB check would still pass.
 *
 * Deliberately reported as an observation, never a failure. The country total
 * and the per-HFB rows are served from independently refreshed caches - the
 * skew was measured at 28.4h and confirmed as intended on 2026-08-27 - so a
 * small discrepancy is expected. A failure here would just recreate the noise
 * that decision removed. What it is really watching for is a gross error: a
 * whole HFB absent from the sum shows up as a percentage, not a rounding tail.
 */
function buildAggregationScript(retailUnitCode) {
    return `
${SHARED}
if (!window.__auth) return JSON.stringify({ error: 'no auth captured' });

const RU = ${JSON.stringify(retailUnitCode)};

const country = await post({ metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: RU } });
if (country.__error) return JSON.stringify({ error: 'API returned ' + country.__error });

const parent = country.data && country.data.data && country.data.data[0];
const kids = (country.data && country.data.children) || [];

if (!parent || kids.length === 0) {
    record('Aggregation', 'Country total reconciles with the sum of its HFBs', 'harness',
        ['no parent row or no children in the country response'], '');
} else {
    // Only additive quantities can be summed. Indices are ratios and averaging
    // them would be arithmetically meaningless, so they are excluded outright
    // rather than compared with a wide tolerance.
    const ADDITIVE = [
        'netSales', 'netQuantity',
        'netSalesGoal', 'netQuantityGoal',
        'netSalesGap', 'netQuantityGap',
    ];

    const fields = ADDITIVE.filter((f) =>
        parent[f] !== undefined && parent[f] !== null && !isNaN(Number(parent[f])) &&
        kids.every((k) => k[f] !== undefined && k[f] !== null && !isNaN(Number(k[f]))));

    if (!fields.length) {
        record('Aggregation', 'Country total reconciles with the sum of its HFBs', 'harness',
            ['none of the additive fields are present on both the parent and every child'],
            'looked for ' + ADDITIVE.join(', '));
    } else {
        // 1% absorbs cache skew and rounding. A missing HFB out of 19 moves the
        // total by roughly 5%, so this still catches the failure that matters.
        const TOL_PCT = 1;
        const drifted = [];
        const summary = [];

        fields.forEach((f) => {
            const total = Number(parent[f]);
            const sum = kids.reduce((a, k) => a + Number(k[f]), 0);
            if (total === 0) return;
            const pct = Math.abs((sum - total) / total) * 100;
            summary.push(f + ' off by ' + pct.toFixed(3) + '%');
            if (pct > TOL_PCT) {
                drifted.push(f + ': ' + kids.length + ' HFBs sum to ' + Math.round(sum) +
                    ', country reports ' + Math.round(total) + ' (' + pct.toFixed(2) + '%)');
            }
        });

        record('Aggregation',
            'Country total reconciles with the sum of its ' + kids.length + ' HFBs',
            drifted.length ? 'observed' : 'passed',
            drifted.slice(0, 6),
            'checked ' + fields.join(', ') + '; ' + summary.join('; ') +
                (drifted.length
                    ? ' - levels refresh independently, so drift is expected; raised as a question'
                    : ''));
    }
}

return JSON.stringify({ level: 'aggregation', ru: RU, ranAt: new Date().toISOString(), results });
`.trim();
}

/**
 * What does the UI do when the API fails?
 *
 * Every other check in this suite assumes the happy path and asserts that a
 * value is correct. This one breaks the API on purpose and asks whether the
 * screen tells the truth about it. That is a different and arguably more
 * important question: a wrong number is visible, whereas a screen that quietly
 * keeps showing yesterday's figures during an outage looks perfectly healthy.
 *
 * SAFETY. This runs against a live shared browser tab, so the override is
 * installed and removed inside a try/finally with an independent watchdog
 * timer as a second line of defence. The stub is scoped to /metrics calls only
 * - authentication and static assets are passed straight through - and the
 * function verifies the restore before reporting anything. If the restore
 * cannot be confirmed the run reports a harness error rather than a result.
 */
function buildResilienceScript(retailUnitCode, hfbNo) {
    return `
${SHARED}
if (!window.__auth) return JSON.stringify({ error: 'no auth captured' });

const RU = ${JSON.stringify(retailUnitCode)};
const HFB = ${JSON.stringify(hfbNo)};

const before = norm(document.body);
const realFetch = window.fetch;
let restored = false;
const restore = () => { if (!restored) { window.fetch = realFetch; restored = true; } };
const watchdog = setTimeout(restore, 25000);

let blocked = 0;
let after = '';
let navigated = false;

try {
    window.fetch = async function (...args) {
        const req = args[0];
        const url = String(typeof req === 'string' ? req : (req && req.url));
        if (url.indexOf('api.dev.salesplanning') !== -1) {
            blocked++;
            return new Response('{"error":"forced by QA resilience check"}',
                { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
        return realFetch.apply(this, args);
    };

    // Navigate to an HFB that has NOT been visited in this session. A cached
    // entity would render from react-query's store and prove nothing about
    // error handling.
    const card = [...document.querySelectorAll('div[class*="_card_"]')]
        .find((d) => new RegExp('^' + HFB + ' - ').test(norm(d)));
    const btn = card && card.querySelector('button');
    if (btn) {
        navigated = true;
        btn.click();
        await new Promise((r) => setTimeout(r, 7000));
        after = norm(document.body);
    }
} finally {
    clearTimeout(watchdog);
    restore();
}

if (window.fetch !== realFetch) {
    record('Resilience', 'API failure handling', 'harness',
        ['fetch override could not be restored - aborting without a verdict'], '');
} else if (!navigated) {
    record('Resilience', 'API failure handling', 'harness',
        ['no card for HFB ' + HFB + ' on this page, so no uncached request was made'], '');
} else if (blocked === 0) {
    record('Resilience', 'API failure handling', 'harness',
        ['no API call was intercepted - the view was served entirely from cache'], '');
} else {
    const stuckLoading = /Loading /i.test(after);
    const saysError = /(error|failed|unavailable|try again|retry|something went wrong)/i.test(after);
    const hasNumbers = /sales index\\s+\\d/i.test(after);

    // Does the page admit that something went wrong?
    record('Resilience',
        'A failed API call surfaces an error rather than an endless loading state',
        saysError ? 'passed' : 'observed',
        saysError ? [] : [
            'with ' + blocked + ' API calls returning 500, the page shows ' +
                (stuckLoading ? 'a persistent loading state' : 'neither data nor an error') +
                ' and no error message or retry control',
            'rendered: ' + after.slice(0, 160),
        ],
        'blocked ' + blocked + ' calls on an uncached entity' +
            (saysError ? '' : ' - is an indefinite loading state the intended behaviour?'));

    // The more dangerous variant: confidently displaying figures that could
    // not have been refreshed, with nothing marking them as stale.
    record('Resilience',
        'A failed API call does not present unrefreshed figures as current',
        hasNumbers ? 'observed' : 'passed',
        hasNumbers ? [
            'metrics are still rendered after ' + blocked + ' failed calls, with no staleness indicator',
            'rendered: ' + after.slice(0, 160),
        ] : [],
        hasNumbers
            ? 'serving cached data during an outage may be intended, but nothing tells the user the figures are not current'
            : 'no metric values rendered while the API was failing');
}

return JSON.stringify({ level: 'resilience', ru: RU, hfb: HFB, ranAt: new Date().toISOString(), results });
`.trim();
}

/**
 * Loading a URL cold, rather than clicking into it.
 *
 * Every other check reaches its page by clicking, which runs the client-side
 * route transition and often serves data react-query already holds. A user
 * arriving from a bookmark or a shared link takes a different path entirely:
 * full document load, fresh store, first fetch driven by the URL rather than
 * by a click handler. A filter mis-parsed from the URL - or a level defaulting
 * to the country instead of the requested HFB - is invisible to every other
 * check in this suite.
 *
 * This one is destructive by nature: a full load wipes window.__auth and the
 * helper block, so it must run LAST, and the caller has to re-capture the
 * token afterwards.
 */
function buildDeepLinkScript(retailUnitCode, hfbNo) {
    return `
${SHARED}
if (!window.__auth) return JSON.stringify({ error: 'no auth captured' });

const RU = ${JSON.stringify(retailUnitCode)};
const HFB = ${JSON.stringify(hfbNo)};

const hfb = await post({ metric: 'KPI_SUMMARY', level: 'hfb', filters: { retailUnitCode: RU, hfbNo: HFB } });
if (hfb.__error) return JSON.stringify({ error: 'API returned ' + hfb.__error });
const row = hfb.data && hfb.data.data && hfb.data.data[0];
const kids = (hfb.data && hfb.data.children) || [];

const text = norm(document.body);
const path = location.pathname;

// The URL must actually have selected the requested entity.
const onRightPage = new RegExp('/hfb/' + HFB + '(?:$|/)').test(path);
record('Deep link',
    'A cold load of /hfb/' + HFB + ' lands on that HFB',
    onRightPage ? 'passed' : 'failed',
    onRightPage ? [] : ['URL resolved to ' + path],
    'path=' + path);

// It must have fetched data for that entity, not silently fallen back to the
// country view - which would still look like a working page.
const hasTitle = new RegExp('HFB\\\\s*' + HFB + '\\\\b').test(text);
record('Deep link',
    'The page identifies itself as HFB ' + HFB,
    hasTitle ? 'passed' : 'failed',
    hasTitle ? [] : ['no "HFB ' + HFB + '" heading found: ' + text.slice(0, 140)],
    'checked page heading after a full document load');

// And the values must be the same ones a clicked navigation produces.
if (row) {
    checkHeroMetrics(row, 'Deep link');
}

// The child rows must be present too - a cold load that renders the hero but
// no list is a partial failure that a heading check alone would pass.
const rendered = [...document.querySelectorAll('button')]
    .map((b) => norm(b))
    .filter((t) => /-\\s*\\d{4}\\b/.test(t)).length;
record('Deep link',
    'A cold load renders the PA list, not just the header',
    kids.length === 0 ? 'harness' : (rendered === kids.length ? 'passed' : 'failed'),
    rendered === kids.length ? [] : ['API returned ' + kids.length + ' PAs, cold load rendered ' + rendered],
    'API children=' + kids.length + ', DOM rows=' + rendered);

return JSON.stringify({ level: 'deeplink', ru: RU, hfb: HFB, ranAt: new Date().toISOString(), results });
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

/**
 * Absent metrics.
 *
 * Live data genuinely contains nulls: at the time of writing HFB 70 "Home
 * Appliances" carries null for its forecast fields and, coherently, null for
 * the indices derived from them. It means "no forecast exists", not "the data
 * is broken".
 *
 * The question this asks is not whether the API is right — it is whether the UI
 * tells the truth about an absent number. Showing a dash is honest. Showing 0,
 * or an empty cell that looks like a rendering glitch, is not: a planner reading
 * "0" against a forecast will think the forecast is zero rather than missing,
 * and that is a decision made on a number that does not exist.
 *
 * Run this on the page for the level being checked.
 */
function buildNullsScript(retailUnitCode, level, filters) {
    return `
${SHARED}
if (!window.__auth) return JSON.stringify({ error: 'no auth captured - run capture and trigger a real request first' });

const RU = ${JSON.stringify(retailUnitCode)};
const LEVEL = ${JSON.stringify(level)};
const FILTERS = ${JSON.stringify(filters)};

const kpi = await post({ metric: 'KPI_SUMMARY', level: LEVEL, filters: FILTERS });
if (kpi.__error) return JSON.stringify({ error: 'API returned ' + kpi.__error });

const rows = ((kpi.data || {}).data) || [];
const kids = ((kpi.data || {}).children) || [];
const IDENTITY = ['retailUnitCode', 'hfbNo', 'hfbName', 'paNo', 'paName', 'generatedAt', 'mart', 'currentIkeaWeek'];

const nullFieldsOf = (r) => Object.keys(r || {}).filter((k) => IDENTITY.indexOf(k) === -1 && r[k] === null);

const ownNulls = rows.length ? nullFieldsOf(rows[0]) : [];
const kidsWithNulls = kids.map((k) => ({ id: k.hfbNo || k.paNo, fields: nullFieldsOf(k) }))
    .filter((k) => k.fields.length);

// 1. Establish whether there is anything to check at all. If the API happens to
//    return a complete row today, say so plainly rather than passing vacuously.
const anyNulls = ownNulls.length + kidsWithNulls.length;
if (!anyNulls) {
    record('Absent metrics', 'Absent-metric rendering could not be exercised', 'harness',
        ['no null metric fields were present in this response'],
        'Nothing to assert: every metric had a value at ' + LEVEL + ' for ' + JSON.stringify(FILTERS) +
        '. Re-run against a level that currently has an incomplete forecast.');
    return JSON.stringify({ level: LEVEL, ru: RU, ranAt: new Date().toISOString(), results });
}

// 2. Internal coherence: if a source figure is missing, anything derived from
//    it should be missing too. A null forecast with a non-null "vs forecast"
//    index would mean a number was invented somewhere.
if (rows.length) {
    const r = rows[0];
    const incoherent = [];
    for (const f of Object.keys(r)) {
        const m = f.match(/^(netSales|netQuantity)Index(VsLatestForecast|VsDemandPlan|VsLastYear)$/);
        if (!m) continue;
        const sourceMap = { VsLatestForecast: 'ForecastYtd', VsDemandPlan: 'DemandPlanYtd', VsLastYear: 'LastYearYtd' };
        const source = m[1] + sourceMap[m[2]];
        if (r[source] === null && r[f] !== null) {
            incoherent.push(f + '=' + r[f] + ' but ' + source + ' is null');
        }
    }
    record('Absent metrics', 'A derived index is absent whenever its source figure is absent',
        incoherent.length ? 'failed' : 'passed', incoherent,
        'checked the derived indices on the ' + LEVEL + ' row');
}

// 3. The real question: what does the screen actually show?
const pageText = norm(document.body);
const LIES = [
    { pattern: /\\bNaN\\b/, label: 'NaN' },
    { pattern: /\\bundefined\\b/, label: 'undefined' },
    { pattern: /\\bnull\\b/, label: 'the literal word null' },
    { pattern: /\\bInfinity\\b/, label: 'Infinity' },
];
const leaked = LIES.filter((l) => l.pattern.test(pageText)).map((l) => l.label);
record('Absent metrics', 'No raw JavaScript non-value is printed on the page',
    leaked.length ? 'failed' : 'passed',
    leaked.map((l) => 'page displays ' + l),
    'the API returned ' + anyNulls + ' row(s) carrying null metrics, so any unguarded formatting ' +
    'would surface here');

// 4. Absent values must not be dressed up as zero. Look at the cards for the
//    specific children the API says are incomplete.
if (kidsWithNulls.length) {
    const cards = cardsMatching(/View HFB plan|vs goal/);
    const suspect = [];
    for (const k of kidsWithNulls) {
        const card = cards.find((c) => new RegExp('^' + k.id + '\\\\s*-').test(norm(c)));
        if (!card) continue;
        const text = norm(card);
        // A card whose forecast is unknown should not be claiming a flat zero.
        if (/\\b0\\s*vs (goal|forecast)\\b/i.test(text)) {
            suspect.push(k.id + ' has null ' + k.fields.slice(0, 2).join('/') + ' but renders "0 vs ..."');
        }
    }
    record('Absent metrics', 'An absent figure is not rendered as zero',
        suspect.length ? 'observed' : 'passed', suspect,
        suspect.length
            ? 'Zero and "not forecast" mean very different things to a planner. Raised as a question ' +
              'because a genuine zero is also possible - worth confirming which this is.'
            : 'checked ' + kidsWithNulls.length + ' child row(s) the API reports as incomplete');
}

// 5. An incomplete row should still render — a missing forecast must not take
//    the whole card or row off the screen.
if (kidsWithNulls.length) {
    const missing = kidsWithNulls.filter((k) => pageText.indexOf(String(k.id)) === -1).map((k) => k.id);
    record('Absent metrics', 'Rows with missing metrics are still displayed',
        missing.length ? 'failed' : 'passed',
        missing.map((m) => 'row ' + m + ' has null metrics and does not appear on the page'),
        'a partial row should degrade to a dash, not vanish');
}

record('Absent metrics', 'Fields the API reported as absent', 'observed', [],
    'Own row: ' + (ownNulls.length ? ownNulls.join(', ') : 'none') + '. ' +
    'Children with absent metrics: ' +
    (kidsWithNulls.length ? kidsWithNulls.map((k) => k.id + ' (' + k.fields.length + ')').join(', ') : 'none') +
    '. Recorded so the data condition behind the checks above is visible.');

return JSON.stringify({ level: LEVEL, ru: RU, ranAt: new Date().toISOString(), results });
`.trim();
}

/**
 * The IKEA week shown in the NavigationBar against the week the API reports.
 *
 * `currentIkeaWeek` travels on every KPI_SUMMARY row and the charts already use
 * it to decide how many points to plot, but nothing has ever checked it against
 * the week printed in the header. If those two disagree the whole dashboard is
 * captioned with the wrong week, which is the kind of error nobody notices until
 * a number is quoted in a meeting.
 */
function buildWeekScript(retailUnitCode) {
    return `
${SHARED}
if (!window.__auth) return JSON.stringify({ error: 'no auth captured - run capture and trigger a real request first' });

const RU = ${JSON.stringify(retailUnitCode)};
const kpi = await post({ metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: RU } });
if (kpi.__error) return JSON.stringify({ error: 'API returned ' + kpi.__error });

const row = (((kpi.data || {}).data) || [])[0] || {};
const apiWeek = row.currentIkeaWeek == null ? null : String(row.currentIkeaWeek);

if (!apiWeek) {
    record('Current week', 'Week comparison could not be made', 'harness',
        ['the API response carried no currentIkeaWeek'], '');
    return JSON.stringify({ ru: RU, ranAt: new Date().toISOString(), results });
}

// The header prints something like "Week 34", but the word and the number sit in
// separate text nodes, so this has to read rendered text off an element rather
// than walking text nodes. The nav bar is a plain div with a hashed class name,
// so match on the class prefix and fall back to the whole page.
const navEl = document.querySelector('[class*="navigationBar"]')
    || document.querySelector('nav, header')
    || document.body;
const shown = (norm(navEl).match(/[Ww]eek\\s*(\\d{1,3})/) || [])[1] || null;

// currentIkeaWeek is a full fiscal week id such as 202634; the header shows the
// week number alone.
const apiWeekNo = apiWeek.length > 2 ? apiWeek.slice(-2).replace(/^0/, '') : apiWeek.replace(/^0/, '');
const weekMatches = shown !== null && String(Number(shown)) === String(Number(apiWeekNo));

// A difference here is not automatically wrong: the header may show the week the
// business is currently trading in while the API reports the last week with
// settled figures. Record it as an observation and let a human judge.
record('Current week', 'The header week matches the week the API reports',
    shown === null ? 'harness' : (weekMatches ? 'passed' : 'observed'),
    shown === null ? ['no "Week NN" text found on the page'] : [],
    shown === null
        ? 'API currentIkeaWeek=' + apiWeek + ', header=(not found)'
        : (weekMatches
            ? 'API currentIkeaWeek=' + apiWeek + ', header shows week ' + shown + ' - they agree'
            : 'API currentIkeaWeek=' + apiWeek + ' (week ' + apiWeekNo + ') but the header shows week ' + shown
                + '. Worth confirming which one the page is meant to show - the header may be the week now in progress while the API reports the last week with complete figures.'));

// The same value must not drift between levels within one page load.
const hfb = await post({ metric: 'KPI_SUMMARY', level: 'hfb', filters: { retailUnitCode: RU, hfbNo: '05' } });
const hfbWeek = hfb.__error ? null : ((((hfb.data || {}).data) || [])[0] || {}).currentIkeaWeek;
record('Current week', 'The API reports the same current week at country and HFB level',
    hfbWeek == null ? 'harness' : (String(hfbWeek) === apiWeek ? 'passed' : 'failed'),
    hfbWeek == null ? ['HFB level returned no currentIkeaWeek'] :
        (String(hfbWeek) === apiWeek ? [] : ['country says ' + apiWeek + ', hfb says ' + hfbWeek]),
    'country=' + apiWeek + ', hfb=' + hfbWeek);

return JSON.stringify({ ru: RU, ranAt: new Date().toISOString(), results });
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
    aggregation: (a) => buildAggregationScript(a.ru || 'US'),
    resilience: (a) => buildResilienceScript(a.ru || 'US', a.hfb || '12'),
    deeplink: (a) => buildDeepLinkScript(a.ru || 'US', a.hfb || '05'),
    nulls: (a) =>
        buildNullsScript(
            a.ru || 'US',
            a.hfb ? 'hfb' : 'country',
            a.hfb
                ? { retailUnitCode: a.ru || 'US', hfbNo: a.hfb }
                : { retailUnitCode: a.ru || 'US' }
        ),
    week: (a) => buildWeekScript(a.ru || 'US'),
    cleanup: () => buildCleanupScript(),
};

/**
 * Every emitted script begins with the same SHARED prelude and ends with its own
 * `return JSON.stringify(...)`. Pushing twelve of them into the page one at a
 * time costs dozens of round trips, so `--emit=all` inlines each body - minus
 * its duplicate prelude - into a separate async closure over one shared
 * `results` array. Each closure's own return value is discarded; what matters is
 * that `record` has already appended to the array they all close over.
 *
 * Each group is wrapped in try/catch so one broken group cannot abort the rest.
 *
 * Navigation is the subtle part. Individually these scripts are run by a caller
 * who navigates between them - each one simply checks whatever is on screen. Run
 * back to back they inherit whatever page the previous group left behind, which
 * silently produces false failures: the HFB-05 group scraping an HFB-08 page
 * reports "0511 Mattresses not rendered" and looks exactly like a product bug.
 * So every group declares the page it needs and the runner navigates there
 * first, through the SPA router rather than a full reload, which would tear down
 * the captured token.
 */
const ALL_STEPS = [
    { name: 'country', path: (a) => `/region-dashboard/${(a.ru || 'US').toLowerCase()}` },
    { name: 'week', path: (a) => `/region-dashboard/${(a.ru || 'US').toLowerCase()}` },
    { name: 'nulls', path: (a) => `/region-dashboard/${(a.ru || 'US').toLowerCase()}` },
    { name: 'aggregation', path: (a) => `/region-dashboard/${(a.ru || 'US').toLowerCase()}` },
    { name: 'charts', path: (a) => `/region-dashboard/${(a.ru || 'US').toLowerCase()}` },
    { name: 'stale', path: (a) => `/region-dashboard/${(a.ru || 'US').toLowerCase()}` },
    { name: 'toggle', path: (a) => `/region-dashboard/${(a.ru || 'US').toLowerCase()}` },
    // Needs the country page so it can click a card for an HFB it has not
    // visited yet - a cached entity would never issue the request it blocks.
    { name: 'resilience', path: (a) => `/region-dashboard/${(a.ru || 'US').toLowerCase()}` },
    { name: 'hfb', path: (a) => `/region-dashboard/${(a.ru || 'US').toLowerCase()}/hfb/${a.hfb || '05'}` },
    { name: 'drilldown', path: (a) => `/region-dashboard/${(a.ru || 'US').toLowerCase()}/hfb/${a.hfb || '05'}` },
    { name: 'leaf', path: (a) => `/region-dashboard/${(a.ru || 'US').toLowerCase()}/hfb/${a.hfb || '08'}/pa/${a.pa || '0811'}` },
    { name: 'deeplink', path: (a) => `/region-dashboard/${(a.ru || 'US').toLowerCase()}/hfb/${a.hfb || '05'}` },
];

function buildAllScript(args) {
    const prelude = SHARED.trim();

    const nav = `
/**
 * Move the SPA to a path without reloading the document. A real reload would
 * drop window.__auth and the fetch hook, so the router is driven directly.
 */
const goto = async (path) => {
    if (location.pathname === path) return;
    history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
    await new Promise((r) => setTimeout(r, 5000));
};`;

    const bodies = ALL_STEPS.map((step) => {
        const stepArgs = step.name === 'leaf'
            ? Object.assign({}, args, { hfb: args.hfb || '08', pa: args.pa || '0811' })
            : args;
        const emitted = EMITTERS[step.name](stepArgs).trim();
        const body = emitted.startsWith(prelude) ? emitted.slice(prelude.length) : emitted;
        return `
// ---- ${step.name} ----
try {
    await goto(${JSON.stringify(step.path(stepArgs))});
    await (async () => {
${body}
    })();
} catch (e) {
    record('${step.name}', 'The ${step.name} group ran to completion', 'harness',
        ['the group threw before finishing: ' + (e && e.message ? e.message : String(e))], '');
}`;
    }).join('\n');

    return `
${prelude}
${nav}
${bodies}
return JSON.stringify({ ru: ${JSON.stringify(args.ru || 'US')}, ranAt: new Date().toISOString(), results });
`.trim();
}

EMITTERS.all = (a) => buildAllScript(a);

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
