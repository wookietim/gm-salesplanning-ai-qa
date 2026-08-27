/**
 * API probe suite for the gm-salesplanning metrics API.
 *
 * ── How this runs (it is not a normal test runner) ───────────────────────────
 * The API requires a real bearer token from an interactive SSO login with MFA,
 * so it cannot run unattended. Instead this file is injected into Tim's already
 * authenticated browser page via the shared browser canvas
 * (`evaluate_javascript`), where a valid token already exists.
 *
 * The token is never extracted. The harness lifts the `Authorization` header
 * off a genuine in-flight app request into a page-scoped variable, uses it for
 * the probes inside the page, and returns only status codes and short response
 * previews. Nothing secret crosses back into the agent transcript.
 *
 * Usage (from the agent):
 *   1. Read this file, take the string exported by `buildProbeScript()`, and
 *      pass it as the `script` argument to the canvas `evaluate_javascript`
 *      action against the authenticated page.
 *   2. Feed the returned JSON to `publish-api-confluence.js`.
 *   3. ALWAYS run `buildCleanupScript()` afterwards to restore `window.fetch`
 *      and delete the captured header.
 *
 * See RUNBOOK §7.
 */

'use strict';

const API_ORIGIN = 'https://api.dev.salesplanning.ingka.com';

/**
 * Metric types the backend actually accepts. Confirmed against the live API:
 * anything outside this list comes back 400 "No enum constant
 * com.gm.salesplanning.metrics.core.MetricType.<name>".
 */
const METRICS = ['KPI_SUMMARY', 'WEEKLY_SALES_TREND', 'ROLLING_SALES_TREND'];

/**
 * Names that look like metric types in the frontend but are NOT sent to the API.
 * Do not probe these as endpoints - they will 400, and that is correct.
 *
 *   HFB_PERFORMANCE / PA_PERFORMANCE - client-side labels. The frontend calls
 *     KPI_SUMMARY and reshapes `data.children` into performance rows
 *     (see fetchPaSalesPerformanceForHfb in services/metrics/sales-performance/api.ts).
 *   ITEM_RANGE - not wired to a backend at all yet; the frontend returns fixture
 *     data behind a TODO in services/metrics/item-range/api.ts.
 */
const CLIENT_SIDE_ONLY_METRICS = ['HFB_PERFORMANCE', 'PA_PERFORMANCE', 'ITEM_RANGE'];

/**
 * Levels the API itself reports as valid. Discovered from its own 400 message:
 * "Unsupported level 'galaxy'. Allowed values: country, hfb, pa, pra".
 * Note `pra` is accepted by the API but not visibly used by the UI.
 */
const LEVELS = ['country', 'hfb', 'pa', 'pra'];

/**
 * Probe definitions.
 *
 * `expect` describes what a correct API *should* do. Where the intended
 * behaviour is genuinely unknown, the probe is marked `observe: true` so it is
 * reported as an observation rather than asserted as a pass/fail — several UI
 * "findings" already turned out to be intended behaviour, so the suite should
 * not manufacture more of those.
 */
const PROBES = [
    // ── Happy path: every metric at its natural level ─────────────────────────
    {
        group: 'Metrics — happy path',
        name: 'KPI_SUMMARY at country level returns data',
        body: { metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'US' } },
        expect: { status: 200, nonEmpty: true },
    },
    {
        group: 'Metrics — happy path',
        name: 'KPI_SUMMARY at HFB level returns data',
        body: {
            metric: 'KPI_SUMMARY',
            level: 'hfb',
            filters: { retailUnitCode: 'US', hfbNo: '05' },
        },
        expect: { status: 200, nonEmpty: true },
    },
    {
        group: 'Metrics — happy path',
        name: 'KPI_SUMMARY at PA level returns data',
        body: {
            metric: 'KPI_SUMMARY',
            level: 'pa',
            filters: { retailUnitCode: 'US', paNo: '0511' },
        },
        expect: { status: 200, nonEmpty: true },
    },
    {
        group: 'Metrics — happy path',
        name: 'Country KPI_SUMMARY carries HFB children (source of the HFB performance table)',
        body: { metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'US' } },
        expect: { status: 200, nonEmptyChildren: true },
    },
    {
        group: 'Metrics — happy path',
        name: 'HFB KPI_SUMMARY carries PA children (source of the PA performance table)',
        body: {
            metric: 'KPI_SUMMARY',
            level: 'hfb',
            filters: { retailUnitCode: 'US', hfbNo: '05' },
        },
        expect: { status: 200, nonEmptyChildren: true },
    },
    {
        group: 'Metrics — happy path',
        name: 'WEEKLY_SALES_TREND at country level returns data',
        body: {
            metric: 'WEEKLY_SALES_TREND',
            level: 'country',
            filters: { retailUnitCode: 'US' },
        },
        expect: { status: 200, nonEmpty: true },
    },
    {
        group: 'Metrics — happy path',
        name: 'ROLLING_SALES_TREND at country level returns data',
        body: {
            metric: 'ROLLING_SALES_TREND',
            level: 'country',
            filters: { retailUnitCode: 'US' },
        },
        expect: { status: 200, nonEmpty: true },
    },
    {
        group: 'Metrics — happy path',
        name: 'Client-side-only metric names are not backend metrics',
        description:
            'HFB_PERFORMANCE, PA_PERFORMANCE and ITEM_RANGE are frontend labels, not MetricType ' +
            'values. This guards the boundary: they should keep being rejected until a real ' +
            'endpoint exists, at which point this probe should be replaced with a happy path.',
        body: { metric: 'ITEM_RANGE', level: 'hfb', filters: { retailUnitCode: 'US', hfbNo: '05' } },
        expect: { status: 400 },
    },

    // ── Input validation ──────────────────────────────────────────────────────
    {
        group: 'Input validation',
        name: 'Unknown metric name is rejected',
        body: { metric: 'NOT_A_REAL_METRIC', level: 'country', filters: { retailUnitCode: 'US' } },
        expect: { status: 400 },
    },
    {
        group: 'Input validation',
        name: 'Unsupported level is rejected and lists valid values',
        body: { metric: 'KPI_SUMMARY', level: 'galaxy', filters: { retailUnitCode: 'US' } },
        expect: { status: 400, bodyIncludes: 'country, hfb, pa, pra' },
    },
    {
        group: 'Input validation',
        name: "Missing 'filters' is rejected",
        body: { metric: 'KPI_SUMMARY', level: 'country' },
        expect: { status: 400 },
    },
    {
        group: 'Input validation',
        name: "Missing 'metric' is rejected",
        body: { level: 'country', filters: { retailUnitCode: 'US' } },
        expect: { status: 400 },
    },
    {
        group: 'Input validation',
        name: 'Empty JSON body is rejected',
        body: {},
        expect: { status: 400 },
    },
    {
        group: 'Input validation',
        name: 'Malformed JSON is rejected (not a 500)',
        rawBody: '{"metric":"KPI_SUMMARY",',
        expect: { statusIn: [400, 422] },
    },
    {
        group: 'Input validation',
        name: 'Wrong type for filters (string instead of object) is rejected',
        body: { metric: 'KPI_SUMMARY', level: 'country', filters: 'US' },
        expect: { statusIn: [400, 422] },
    },
    {
        group: 'Input validation',
        name: 'HFB level without hfbNo does not 500',
        body: { metric: 'KPI_SUMMARY', level: 'hfb', filters: { retailUnitCode: 'US' } },
        expect: { statusBelow: 500 },
    },

    // ── Authentication / authorisation ────────────────────────────────────────
    {
        group: 'Authentication',
        name: 'Request without Authorization header is refused',
        body: { metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'US' } },
        noAuth: true,
        expect: { statusIn: [401, 403] },
    },
    {
        group: 'Authentication',
        name: 'Malformed bearer token is refused',
        body: { metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'US' } },
        authOverride: 'Bearer not-a-real-token',
        expect: { statusIn: [401, 403] },
    },
    {
        group: 'Authentication',
        name: 'Empty bearer token is refused',
        body: { metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'US' } },
        authOverride: 'Bearer ',
        expect: { statusIn: [401, 403] },
    },
    {
        group: 'Authentication',
        name: 'Token in the wrong scheme (Basic) is refused',
        body: { metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'US' } },
        authOverride: 'Basic dXNlcjpwYXNz',
        expect: { statusIn: [401, 403] },
    },

    // ── Unknown identifiers ───────────────────────────────────────────────────
    {
        group: 'Unknown identifiers',
        name: 'Nonexistent region returns an empty result rather than an error',
        body: { metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'XX' } },
        expect: { statusBelow: 500 },
        observe: true,
        note: 'Returns 200 with empty arrays and is markedly slower than a real region, which suggests the query runs before finding nothing. Confirm whether 200-empty (rather than 404) is the intended contract.',
    },
    {
        group: 'Unknown identifiers',
        name: 'Nonexistent HFB number returns an empty result rather than an error',
        body: {
            metric: 'KPI_SUMMARY',
            level: 'hfb',
            filters: { retailUnitCode: 'US', hfbNo: '99' },
        },
        expect: { statusBelow: 500 },
        observe: true,
    },

    // ── Injection-shaped input (should be treated as ordinary data) ───────────
    {
        group: 'Injection-shaped input',
        name: 'SQL-ish retailUnitCode is handled safely',
        body: {
            metric: 'KPI_SUMMARY',
            level: 'country',
            filters: { retailUnitCode: "US'; DROP TABLE metrics;--" },
        },
        expect: { statusBelow: 500 },
    },
    {
        group: 'Injection-shaped input',
        name: 'Very long retailUnitCode is handled safely',
        body: {
            metric: 'KPI_SUMMARY',
            level: 'country',
            filters: { retailUnitCode: 'U'.repeat(2000) },
        },
        expect: { statusBelow: 500 },
    },

    // ── Method handling ───────────────────────────────────────────────────────
    {
        group: 'Method handling',
        name: 'GET on /metrics is rejected cleanly',
        method: 'GET',
        noBody: true,
        expect: { statusBelow: 500 },
    },
];

/**
 * Consistency checks that compare two live responses. These are the checks most
 * likely to catch a genuine defect, because they compare the API against itself
 * rather than against my assumptions about intended behaviour.
 */
const CONSISTENCY = [
    {
        group: 'Cross-level consistency',
        name: 'HFBs listed as country children resolve at hfb level',
        describe:
            'The country KPI_SUMMARY response advertises HFB children. Each of those hfbNo values should also return rows when queried directly at hfb level.',
    },
    {
        group: 'Cross-level consistency',
        name: 'HFB KPI_SUMMARY matches the same HFB inside the country response',
        describe:
            'Requesting HFB 05 directly should return the same index values as HFB 05 appearing as a child of the country response.',
    },
];

/**
 * Builds the self-contained script injected into the authenticated page.
 * Everything must be inlined, because the page has no access to this module.
 */
function buildProbeScript() {
    return `
const ORIGIN = ${JSON.stringify(API_ORIGIN)};
const ENDPOINT = ORIGIN + '/metrics';
const PROBES = ${JSON.stringify(PROBES)};

if (!window.__auth) {
    return JSON.stringify({ error: 'No captured Authorization header. Run the capture step first.' });
}

const evaluate = (probe, status, text) => {
    const e = probe.expect || {};
    const reasons = [];
    if (e.status !== undefined && status !== e.status) {
        reasons.push('expected status ' + e.status + ', got ' + status);
    }
    if (e.statusIn && e.statusIn.indexOf(status) === -1) {
        reasons.push('expected one of [' + e.statusIn.join(', ') + '], got ' + status);
    }
    if (e.statusBelow !== undefined && !(status < e.statusBelow)) {
        reasons.push('expected status below ' + e.statusBelow + ', got ' + status);
    }
    if (e.bodyIncludes && text.indexOf(e.bodyIncludes) === -1) {
        reasons.push('response did not contain ' + JSON.stringify(e.bodyIncludes));
    }
    if (e.nonEmpty) {
        let empty = false;
        try {
            const j = JSON.parse(text);
            const rows = j && j.data && j.data.data;
            empty = Array.isArray(rows) && rows.length === 0;
        } catch (err) {
            reasons.push('response was not valid JSON');
        }
        if (empty) reasons.push('response contained zero data rows');
    }
    if (e.nonEmptyChildren) {
        try {
            const j = JSON.parse(text);
            const kids = j && j.data && j.data.children;
            if (!Array.isArray(kids)) reasons.push('response had no data.children array');
            else if (kids.length === 0) reasons.push('response contained zero children');
        } catch (err) {
            reasons.push('response was not valid JSON');
        }
    }
    return reasons;
};

const results = [];
for (const probe of PROBES) {
    const headers = {};
    if (!probe.noBody) headers['Content-Type'] = 'application/json';
    if (probe.authOverride) headers.Authorization = probe.authOverride;
    else if (!probe.noAuth) headers.Authorization = window.__auth;

    const init = { method: probe.method || 'POST', headers };
    if (!probe.noBody) {
        init.body = probe.rawBody !== undefined ? probe.rawBody : JSON.stringify(probe.body);
    }

    const started = Date.now();
    try {
        const res = await window.__origFetch(ENDPOINT, init);
        const text = await res.text();
        const reasons = evaluate(probe, res.status, text);
        results.push({
            group: probe.group,
            name: probe.name,
            status: res.status,
            ms: Date.now() - started,
            bytes: text.length,
            observe: !!probe.observe,
            note: probe.note || null,
            outcome: probe.observe ? 'observed' : (reasons.length ? 'failed' : 'passed'),
            reasons,
            preview: text.slice(0, 200),
        });
    } catch (err) {
        results.push({
            group: probe.group,
            name: probe.name,
            status: null,
            ms: Date.now() - started,
            observe: !!probe.observe,
            outcome: 'failed',
            reasons: ['request threw: ' + String(err).slice(0, 160)],
            preview: '',
        });
    }
}

// ── Cross-level consistency, comparing the API against itself ────────────────
const post = async (body) => {
    const res = await window.__origFetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: window.__auth },
        body: JSON.stringify(body),
    });
    return res.ok ? res.json() : null;
};

try {
    const country = await post({ metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'US' } });

    const childNos = ((country && country.data && country.data.children) || [])
        .map((r) => r.hfbNo).filter(Boolean).sort();

    // Every HFB the country response advertises as a child should also resolve
    // when queried directly at hfb level. Sampled, to stay gentle on the host.
    const sample = childNos.slice(0, 3);
    const unresolved = [];
    for (const no of sample) {
        const one = await post({ metric: 'KPI_SUMMARY', level: 'hfb', filters: { retailUnitCode: 'US', hfbNo: no } });
        const rows = (one && one.data && one.data.data) || [];
        if (rows.length === 0) unresolved.push(no);
    }
    const agree = childNos.length > 0 && unresolved.length === 0;

    results.push({
        group: 'Cross-level consistency',
        name: 'HFBs listed as country children resolve at hfb level',
        status: 200,
        outcome: agree ? 'passed' : 'failed',
        reasons: childNos.length === 0
            ? ['country response listed no HFB children']
            : (unresolved.length ? ['listed as a child but returned no rows at hfb level: [' + unresolved.join(',') + ']'] : []),
        preview: 'children=' + childNos.length + ', sampled=' + sample.length + ', unresolved=' + unresolved.length,
    });

    // Compare every shared field, not a hand-picked few. Note the API serialises
    // numeric values as strings, so compare stringified - filtering on
    // typeof === 'number' matches nothing and yields a vacuous pass.
    const SKIP_FIELDS = ['generatedAt'];
    for (const hfbNo of sample) {
        const hfbDirect = await post({ metric: 'KPI_SUMMARY', level: 'hfb', filters: { retailUnitCode: 'US', hfbNo } });
        const directRow = hfbDirect && hfbDirect.data && hfbDirect.data.data && hfbDirect.data.data[0];
        const childRow = ((country && country.data && country.data.children) || []).find((r) => r.hfbNo === hfbNo);
        const label = 'HFB ' + hfbNo + ' requested directly matches the same HFB inside the country response';

        if (!directRow || !childRow) {
            results.push({
                group: 'Cross-level consistency',
                name: label,
                status: 200,
                outcome: 'observed',
                reasons: [],
                note: 'Could not compare: one of the two responses had no row for this HFB.',
                preview: 'directRow=' + !!directRow + ', childRow=' + !!childRow,
            });
            continue;
        }

        const fields = Object.keys(childRow).filter(
            (k) => SKIP_FIELDS.indexOf(k) === -1 && directRow[k] !== undefined
        );
        const diffs = fields
            .filter((f) => String(directRow[f]) !== String(childRow[f]))
            .map((f) => f + ': direct=' + directRow[f] + ' vs child=' + childRow[f]);

        // Country-level and HFB-level aggregates are cached independently and
        // refresh on their own schedules, so the same HFB can be served from
        // snapshots generated hours apart (confirmed intended, Tim 2026-08-27).
        // Drift between two different snapshots is expected; drift between two
        // rows stamped with the SAME instant is a genuine inconsistency.
        const sameSnapshot = String(childRow.generatedAt) === String(directRow.generatedAt);
        const skewHours = (childRow.generatedAt && directRow.generatedAt)
            ? Math.abs(Number(directRow.generatedAt) - Number(childRow.generatedAt)) / 3600
            : null;
        const stampNote = sameSnapshot
            ? 'same snapshot'
            : 'snapshots ' + (skewHours === null ? 'differ' : skewHours.toFixed(1) + 'h apart');

        // Zero fields compared means the shapes diverged - that is a real signal,
        // not a pass.
        results.push({
            group: 'Cross-level consistency',
            name: label,
            status: 200,
            outcome: fields.length === 0
                ? 'failed'
                : diffs.length
                    ? (sameSnapshot ? 'failed' : 'observed')
                    : 'passed',
            reasons: fields.length === 0
                ? ['no shared fields between the two rows - response shapes diverged']
                : diffs,
            note: diffs.length && !sameSnapshot
                ? 'The two levels were served from independently cached snapshots ' +
                  stampNote + ', so this drift is expected refresh lag rather than a defect.'
                : null,
            preview: 'compared ' + fields.length + ' fields, ' + diffs.length +
                ' differed, ' + stampNote,
        });
    }
} catch (err) {
    results.push({
        group: 'Cross-level consistency',
        name: 'Cross-level comparison',
        status: null,
        outcome: 'failed',
        reasons: ['comparison threw: ' + String(err).slice(0, 160)],
        preview: '',
    });
}

const totals = {
    total: results.length,
    passed: results.filter((r) => r.outcome === 'passed').length,
    failed: results.filter((r) => r.outcome === 'failed').length,
    observed: results.filter((r) => r.outcome === 'observed').length,
};

return JSON.stringify({ target: ORIGIN, ranAt: new Date().toISOString(), totals, results });
`.trim();
}

/**
 * Captures the Authorization header off a genuine app request. Must be injected
 * BEFORE navigating to an uncached route, then the app must be made to issue a
 * request (react-query caches hard — drilling into a PA reliably triggers one).
 */
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
 * Restores the page. ALWAYS run this — it removes the captured bearer token
 * from the page context.
 */
function buildCleanupScript() {
    return `
if (window.__origFetch) window.fetch = window.__origFetch;
for (const k of ['__auth', '__apiLog', '__origFetch', '__hooked']) {
    try { delete window[k]; } catch (e) { window[k] = undefined; }
}
return JSON.stringify({
    authGone: typeof window.__auth === 'undefined',
    hookGone: typeof window.__hooked === 'undefined',
});
`.trim();
}

module.exports = {
    API_ORIGIN,
    METRICS,
    LEVELS,
    PROBES,
    CONSISTENCY,
    buildProbeScript,
    buildCaptureScript,
    buildCleanupScript,
};

// Allow `node api-probes.js --emit=probe|capture|cleanup` so the agent can pipe
// the script straight into the canvas without hand-copying it.
if (require.main === module) {
    const arg = (process.argv.find((a) => a.startsWith('--emit=')) || '--emit=probe').split('=')[1];
    const map = {
        probe: buildProbeScript,
        capture: buildCaptureScript,
        cleanup: buildCleanupScript,
    };
    if (!map[arg]) {
        console.error(`Unknown --emit target '${arg}'. Use probe, capture or cleanup.`);
        process.exit(1);
    }
    process.stdout.write(map[arg]());
}
