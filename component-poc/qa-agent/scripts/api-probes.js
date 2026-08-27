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

    // ── Authorisation: is the token actually verified, not just present? ──────
    // These derive from the real captured token, so they prove the service does
    // more than check that a header exists. `authMutate` is applied inside the
    // page, where the live token is available.
    {
        group: 'Authorisation',
        name: 'A token with an altered signature is refused',
        description:
            'Takes the real bearer token and changes only its signature segment. If this is ' +
            'accepted, the service is not verifying the signature and any token can be forged.',
        body: { metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'US' } },
        authMutate: 'signature',
        expect: { statusIn: [401, 403] },
    },
    {
        group: 'Authorisation',
        name: 'A token with an altered payload is refused',
        description:
            'Changes a byte of the claims segment while leaving the signature intact. A verified ' +
            'token must fail here, because the signature no longer covers the payload.',
        body: { metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'US' } },
        authMutate: 'payload',
        expect: { statusIn: [401, 403] },
    },
    {
        group: 'Authorisation',
        name: 'An alg=none token is refused',
        description:
            'The classic JWT downgrade: re-header the real claims with {"alg":"none"} and drop ' +
            'the signature. Libraries that honour alg=none accept anything.',
        body: { metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'US' } },
        authMutate: 'algNone',
        expect: { statusIn: [401, 403] },
    },
    {
        group: 'Authorisation',
        name: 'An expired token is refused with 401, not a 500',
        description:
            'Rewrites exp to a time in the past. The service should reject it as unauthorised ' +
            'rather than fail while parsing it.',
        body: { metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'US' } },
        authMutate: 'expired',
        expect: { statusIn: [401, 403] },
    },
    {
        group: 'Authorisation',
        name: 'A truncated token is refused',
        body: { metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'US' } },
        authMutate: 'truncate',
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
    {
        group: 'Method handling',
        name: 'PUT on /metrics is rejected cleanly',
        method: 'PUT',
        body: { metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'US' } },
        expect: { statusBelow: 500 },
    },
    {
        group: 'Method handling',
        name: 'PATCH on /metrics is rejected cleanly',
        method: 'PATCH',
        body: { metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'US' } },
        expect: { statusBelow: 500 },
    },
    {
        group: 'Method handling',
        name: 'DELETE on /metrics is rejected cleanly',
        method: 'DELETE',
        noBody: true,
        expect: { statusBelow: 500 },
    },

    // ── Coverage the UI never exercises ───────────────────────────────────────
    {
        group: 'Metrics — coverage',
        name: 'PRA level is accepted, not a 500',
        description:
            'The API lists `pra` among its valid levels but the frontend never requests it. ' +
            'Whether it should return rows for a PA filter is unknown, so this observes rather ' +
            'than asserts - it only insists the level does not blow up.',
        body: {
            metric: 'KPI_SUMMARY',
            level: 'pra',
            filters: { retailUnitCode: 'US', hfbNo: '05', paNo: '0511' },
        },
        expect: { statusBelow: 500 },
        observe: true,
        note: 'Answered clearly: 400 with "KPI_SUMMARY metric does not support PRA level - no mart exists at that grain." So `pra` is a valid level name but only for metrics that have a mart at that grain. Worth confirming which metric, if any, is meant to use it.',
    },
    {
        group: 'Metrics — coverage',
        name: 'WEEKLY_SALES_TREND at HFB level returns data',
        body: {
            metric: 'WEEKLY_SALES_TREND',
            level: 'hfb',
            filters: { retailUnitCode: 'US', hfbNo: '05' },
        },
        expect: { status: 200, nonEmpty: true },
    },
    {
        group: 'Metrics — coverage',
        name: 'WEEKLY_SALES_TREND at PA level returns data',
        body: {
            metric: 'WEEKLY_SALES_TREND',
            level: 'pa',
            filters: { retailUnitCode: 'US', paNo: '0511' },
        },
        expect: { status: 200, nonEmpty: true },
    },
    {
        group: 'Metrics — coverage',
        name: 'ROLLING_SALES_TREND at HFB level returns data',
        body: {
            metric: 'ROLLING_SALES_TREND',
            level: 'hfb',
            filters: { retailUnitCode: 'US', hfbNo: '05' },
        },
        expect: { status: 200, nonEmpty: true },
    },
    {
        group: 'Metrics — coverage',
        name: 'KPI_SUMMARY for a second market (GB) returns data',
        body: { metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'GB' } },
        expect: { status: 200, nonEmpty: true },
    },
    {
        group: 'Metrics — coverage',
        name: 'A GB request returns GB rows, not the previous market',
        description:
            'Guards against a caching or scoping bug serving one market the data of another. ' +
            'Every row and child in the response must carry the requested retailUnitCode.',
        body: { metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'GB' } },
        expect: { status: 200, rowsMatch: { retailUnitCode: 'GB' } },
    },
    {
        group: 'Metrics — coverage',
        name: 'KPI_SUMMARY at GB HFB level returns GB rows',
        body: {
            metric: 'KPI_SUMMARY',
            level: 'hfb',
            filters: { retailUnitCode: 'GB', hfbNo: '05' },
        },
        expect: { status: 200, nonEmpty: true, rowsMatch: { retailUnitCode: 'GB' } },
    },

    // ── Filter handling ───────────────────────────────────────────────────────
    {
        group: 'Filter handling',
        name: 'Unknown filter keys do not cause a 500',
        body: {
            metric: 'KPI_SUMMARY',
            level: 'country',
            filters: { retailUnitCode: 'US', notARealFilter: 'x', anotherOne: 42 },
        },
        expect: { statusBelow: 500 },
        observe: true,
        note: 'Silently ignoring unknown filters means a typo in a filter name returns unfiltered data rather than an error. Worth confirming which behaviour is intended.',
    },
    {
        group: 'Filter handling',
        name: 'Numeric hfbNo (5) is handled like the string "05"',
        description:
            'The UI always sends zero-padded strings. A numeric 5 should either be coerced or ' +
            'rejected - it should not silently return a different HFB or an empty set.',
        body: { metric: 'KPI_SUMMARY', level: 'hfb', filters: { retailUnitCode: 'US', hfbNo: 5 } },
        expect: { statusBelow: 500 },
        observe: true,
        note: 'Returns 200 with zero rows rather than HFB 05 or an error. A client that forgets to zero-pad gets an empty dashboard and no indication that it asked the wrong question.',
    },
    {
        group: 'Filter handling',
        name: 'Lowercase retailUnitCode is handled consistently',
        body: { metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'us' } },
        expect: { statusBelow: 500 },
        observe: true,
        note: 'Market codes are case-sensitive: lowercase "us" returns 200 with zero rows and echoes retailUnitCode back as "us". Note this is the opposite of `level`, which is case-insensitive.',
    },
    {
        group: 'Filter handling',
        name: 'Uppercase level name is handled, not 500',
        body: { metric: 'KPI_SUMMARY', level: 'COUNTRY', filters: { retailUnitCode: 'US' } },
        expect: { statusBelow: 500 },
        observe: true,
        note: 'Accepted: uppercase `level` returns full data. Combined with the case-sensitive retailUnitCode above, the two fields follow opposite rules - worth making consistent.',
    },
    {
        group: 'Filter handling',
        name: 'A paNo that does not belong to the given hfbNo does not 500',
        description:
            'PA 0511 sits under HFB 05. Pairing it with HFB 07 is a contradiction; the API ' +
            'should reject it or return nothing, but not error and not silently ignore one half.',
        body: {
            metric: 'KPI_SUMMARY',
            level: 'pa',
            filters: { retailUnitCode: 'US', hfbNo: '07', paNo: '0511' },
        },
        expect: { statusBelow: 500 },
        observe: true,
        note: 'Returns 200 with zero rows. The contradiction is neither rejected nor resolved in favour of one filter - the caller just gets nothing back.',
    },
    {
        group: 'Filter handling',
        name: 'null filters is rejected cleanly',
        body: { metric: 'KPI_SUMMARY', level: 'country', filters: null },
        expect: { statusBelow: 500 },
    },
    {
        group: 'Filter handling',
        name: 'An array body instead of an object is rejected cleanly',
        rawBody: '[{"metric":"KPI_SUMMARY"}]',
        expect: { statusBelow: 500 },
    },

    // ── Payload limits ────────────────────────────────────────────────────────
    // These bodies are generated inside the page rather than inlined here, so
    // the emitted script stays small enough to transfer.
    {
        group: 'Payload limits',
        name: 'A deeply nested filters object does not 500',
        description: 'Guards against unbounded recursion in JSON parsing or mapping.',
        rawBodyGen: 'deepNest',
        expect: { statusBelow: 500 },
    },
    {
        group: 'Payload limits',
        name: 'A very large body is rejected or handled, not a 500',
        rawBodyGen: 'largePadding',
        expect: { statusBelow: 500 },
    },

    // ── Content negotiation ───────────────────────────────────────────────────
    {
        group: 'Content negotiation',
        name: 'A text/plain body is rejected cleanly',
        contentType: 'text/plain',
        rawBody: JSON.stringify({
            metric: 'KPI_SUMMARY',
            level: 'country',
            filters: { retailUnitCode: 'US' },
        }),
        expect: { statusBelow: 500 },
    },
    {
        group: 'Content negotiation',
        name: 'Accept: text/html still yields JSON or a clean refusal',
        body: { metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'US' } },
        accept: 'text/html',
        expect: { statusBelow: 500 },
    },

    // ── Information disclosure ────────────────────────────────────────────────
    {
        group: 'Information disclosure',
        name: 'A malformed request does not leak a stack trace',
        description:
            'Error bodies should describe the problem without exposing internal frames, which ' +
            'reveal framework versions and package layout to an attacker.',
        rawBody: '{"metric":"KPI_SUMMARY","level":"country","filters":{"retailUnitCode":',
        expect: {
            statusBelow: 500,
            notBodyIncludes: ['at com.gm', 'Caused by:', 'org.springframework.web', '.java:'],
        },
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
    // `description` documents intent for whoever reads this file; it is never
    // read at runtime, so it is stripped from the payload that ships to the page.
    const runtimeProbes = PROBES.map(({ description, ...rest }) => rest);
    return `
const ORIGIN = ${JSON.stringify(API_ORIGIN)};
const ENDPOINT = ORIGIN + '/metrics';
const PROBES = ${JSON.stringify(runtimeProbes)};

if (!window.__auth) {
    return JSON.stringify({ error: 'No captured Authorization header. Run the capture step first.' });
}

const evaluate = (probe, res, text, ms) => {
    const e = probe.expect || {};
    const status = res ? res.status : null;
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
    if (e.notBodyIncludes) {
        for (const bad of e.notBodyIncludes) {
            if (text.indexOf(bad) !== -1) {
                reasons.push('response leaked ' + JSON.stringify(bad));
            }
        }
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
    // Every row AND child must carry the expected field value. A market-scoping
    // bug would show up as rows from the wrong retail unit.
    if (e.rowsMatch) {
        try {
            const j = JSON.parse(text);
            const rows = ((j && j.data && j.data.data) || [])
                .concat((j && j.data && j.data.children) || []);
            if (rows.length === 0) {
                reasons.push('no rows to check ' + JSON.stringify(e.rowsMatch) + ' against');
            }
            for (const [field, want] of Object.entries(e.rowsMatch)) {
                const wrong = rows.filter((r) => String(r[field]) !== String(want));
                if (wrong.length) {
                    reasons.push(
                        wrong.length + ' of ' + rows.length + ' rows had ' + field + '=' +
                        String(wrong[0][field]) + ', expected ' + want
                    );
                }
            }
        } catch (err) {
            reasons.push('response was not valid JSON');
        }
    }
    if (e.maxMs !== undefined && ms > e.maxMs) {
        reasons.push('took ' + ms + 'ms, budget ' + e.maxMs + 'ms');
    }
    return reasons;
};

// Bodies too large or repetitive to inline in the emitted script.
const generateBody = (kind) => {
    if (kind === 'deepNest') {
        return '{"metric":"KPI_SUMMARY","level":"country","filters":{"retailUnitCode":"US","n":' +
            '{"n":'.repeat(200) + 'null' + '}'.repeat(200) + '}}';
    }
    if (kind === 'largePadding') {
        return JSON.stringify({
            metric: 'KPI_SUMMARY',
            level: 'country',
            filters: { retailUnitCode: 'US', padding: 'x'.repeat(500000) },
        });
    }
    return '{}';
};

// Derives a deliberately invalid token from the real one. Everything here stays
// in the page; nothing is logged, and the mutated tokens are useless by design.
const b64urlEncode = (obj) =>
    btoa(JSON.stringify(obj)).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
const b64urlDecode = (s) => {
    const pad = s.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(pad + '='.repeat((4 - (pad.length % 4)) % 4)));
};
const flipChar = (s, i) => {
    const c = s[i];
    const alt = c === 'A' ? 'B' : 'A';
    return s.slice(0, i) + alt + s.slice(i + 1);
};

const mutateAuth = (auth, kind) => {
    const raw = String(auth).replace(/^Bearer\\s+/i, '');
    const parts = raw.split('.');
    if (parts.length !== 3) return null;
    const [head, payload, sig] = parts;
    if (kind === 'signature') {
        return 'Bearer ' + head + '.' + payload + '.' + flipChar(sig, 5);
    }
    if (kind === 'payload') {
        return 'Bearer ' + head + '.' + flipChar(payload, 10) + '.' + sig;
    }
    if (kind === 'truncate') {
        return 'Bearer ' + raw.slice(0, Math.floor(raw.length / 2));
    }
    if (kind === 'algNone') {
        return 'Bearer ' + b64urlEncode({ alg: 'none', typ: 'JWT' }) + '.' + payload + '.';
    }
    if (kind === 'expired') {
        const claims = b64urlDecode(payload);
        claims.exp = Math.floor(Date.now() / 1000) - 86400;
        claims.iat = claims.exp - 3600;
        return 'Bearer ' + head + '.' + b64urlEncode(claims) + '.' + sig;
    }
    return null;
};

const results = [];
for (const probe of PROBES) {
    const headers = {};
    if (!probe.noBody) headers['Content-Type'] = probe.contentType || 'application/json';
    if (probe.accept) headers.Accept = probe.accept;

    if (probe.authOverride) headers.Authorization = probe.authOverride;
    else if (probe.authMutate) {
        const mutated = mutateAuth(window.__auth, probe.authMutate);
        if (!mutated) {
            results.push({
                group: probe.group,
                name: probe.name,
                status: null,
                outcome: 'harness',
                reasons: ['could not derive a ' + probe.authMutate + ' token from the captured one'],
                preview: '',
            });
            continue;
        }
        headers.Authorization = mutated;
    } else if (!probe.noAuth) headers.Authorization = window.__auth;

    const init = { method: probe.method || 'POST', headers };
    if (!probe.noBody) {
        init.body = probe.rawBodyGen !== undefined
            ? generateBody(probe.rawBodyGen)
            : probe.rawBody !== undefined ? probe.rawBody : JSON.stringify(probe.body);
    }

    const started = Date.now();
    try {
        const res = await window.__origFetch(ENDPOINT, init);
        const text = await res.text();
        const ms = Date.now() - started;
        const reasons = evaluate(probe, res, text, ms);
        results.push({
            group: probe.group,
            name: probe.name,
            status: res.status,
            ms,
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

// ── Response contract: is a 200 actually shaped the way the UI needs? ────────
// Nothing above this point checks the body of a successful response beyond
// "has at least one row", so a field could turn null or vanish and every probe
// would still pass.
const NUMERIC_FIELDS = [
    'netSalesYtd', 'netQuantityYtd', 'netSalesYtdLy', 'netQuantityYtdLy',
    'netSalesGoalYtd', 'netQuantityGoalYtd', 'netSalesGoalFy', 'netQuantityGoalFy',
    'netSalesForecastYtd', 'netQuantityForecastYtd',
    'netSalesDemandPlanYtd', 'netQuantityDemandPlanYtd',
    'netSalesIndexVsDemandPlan', 'netQuantityIndexVsDemandPlan',
    'netSalesGap', 'netSalesIndexToGoal', 'netSalesToGoVsGoal',
    'netQuantityGap', 'netQuantityIndexToGoal', 'netQuantityToGoVsGoal',
    'netSalesIndexVsLastYear', 'netSalesIndexVsLatestForecast',
    'netQuantityIndexVsLastYear', 'netQuantityIndexVsLatestForecast',
];
const IDENTITY_FIELDS = ['retailUnitCode', 'fiscalYear', 'currentIkeaWeek'];

const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));

const add = (group, name, ok, reasons, preview, opts) => {
    results.push({
        group,
        name,
        status: 200,
        outcome: (opts && opts.observe) ? 'observed' : (ok ? 'passed' : 'failed'),
        reasons: ok ? [] : reasons,
        note: (opts && opts.note) || null,
        preview: preview || '',
    });
};

try {
    const country = await post({ metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'US' } });
    const row = country && country.data && country.data.data && country.data.data[0];
    const kids = (country && country.data && country.data.children) || [];

    if (!row) {
        add('Response contract', 'Country KPI_SUMMARY returns a row to inspect', false,
            ['no row returned, so no contract checks could run'], '');
    } else {
        const missing = IDENTITY_FIELDS.concat(NUMERIC_FIELDS)
            .filter((f) => row[f] === undefined);
        add('Response contract', 'Every documented field is present', missing.length === 0,
            ['absent from the response: [' + missing.join(', ') + ']'],
            'checked ' + (IDENTITY_FIELDS.length + NUMERIC_FIELDS.length) + ' fields');

        // A null is the API saying "there is no such figure", which is different
        // from a value it cannot express. Only the latter is a defect.
        const nulled = NUMERIC_FIELDS.filter((f) => row[f] === null || row[f] === '');
        add('Response contract', 'Fields the API reports as unavailable', true, [],
            nulled.length ? 'null fields: [' + nulled.join(', ') + ']' : 'no null metrics on this row',
            nulled.length ? {
                observe: true,
                note: 'These metrics came back null rather than as a number. That is most likely ' +
                      '"no figure exists for this entity" rather than an error, but the UI needs ' +
                      'to render it as a blank rather than as a zero.',
            } : null);

        const notNumeric = NUMERIC_FIELDS.filter(
            (f) => row[f] !== undefined && row[f] !== null && row[f] !== '' && !isFinite(num(row[f]))
        );
        add('Response contract', 'Every populated numeric field parses as a finite number',
            notNumeric.length === 0,
            ['not numeric: [' + notNumeric.map((f) => f + '=' + row[f]).join(', ') + ']'],
            'the API serialises numbers as strings, so these are parsed before comparison');

        const week = String(row.currentIkeaWeek || '');
        const weekOk = /^[0-9]{6}$/.test(week) && Number(week.slice(4)) >= 1 && Number(week.slice(4)) <= 53;
        add('Response contract', 'currentIkeaWeek is a plausible YYYYWW value', weekOk,
            ['got ' + JSON.stringify(row.currentIkeaWeek)], 'currentIkeaWeek=' + week);

        // ── Arithmetic the API should be internally consistent about ─────────
        // Every index is actual/basis*100, rounded to 2dp; every gap is measured
        // against the FULL-YEAR goal, not the YTD goal. Both relations were
        // confirmed against live US values before being asserted here.
        const INDEX_RULES = [
            ['netSalesIndexToGoal', 'netSalesYtd', 'netSalesGoalYtd'],
            ['netQuantityIndexToGoal', 'netQuantityYtd', 'netQuantityGoalYtd'],
            ['netSalesIndexVsLastYear', 'netSalesYtd', 'netSalesYtdLy'],
            ['netQuantityIndexVsLastYear', 'netQuantityYtd', 'netQuantityYtdLy'],
            ['netSalesIndexVsLatestForecast', 'netSalesYtd', 'netSalesForecastYtd'],
            ['netQuantityIndexVsLatestForecast', 'netQuantityYtd', 'netQuantityForecastYtd'],
            ['netSalesIndexVsDemandPlan', 'netSalesYtd', 'netSalesDemandPlanYtd'],
            ['netQuantityIndexVsDemandPlan', 'netQuantityYtd', 'netQuantityDemandPlanYtd'],
        ];
        const indexOff = [];
        for (const [field, actual, basis] of INDEX_RULES) {
            const want = (num(row[actual]) / num(row[basis])) * 100;
            const got = num(row[field]);
            if (!isFinite(want) || !isFinite(got)) continue;
            if (Math.abs(want - got) > 0.05) {
                indexOff.push(field + ': reported ' + got + ', ' + actual + '/' + basis + '*100 = ' + want.toFixed(2));
            }
        }
        add('Arithmetic consistency', 'Every index equals actual divided by its basis, times 100',
            indexOff.length === 0, indexOff,
            'checked ' + INDEX_RULES.length + ' index fields against their own inputs');

        const GAP_RULES = [
            ['netSalesGap', 'netSalesGoalFy', 'netSalesYtd', 'netSalesToGoVsGoal'],
            ['netQuantityGap', 'netQuantityGoalFy', 'netQuantityYtd', 'netQuantityToGoVsGoal'],
        ];
        const gapOff = [];
        const pctOff = [];
        for (const [gapField, goalFy, actual, pctField] of GAP_RULES) {
            const wantGap = num(row[goalFy]) - num(row[actual]);
            const gotGap = num(row[gapField]);
            if (isFinite(wantGap) && isFinite(gotGap)) {
                const tol = Math.max(1, Math.abs(wantGap) * 1e-6);
                if (Math.abs(wantGap - gotGap) > tol) {
                    gapOff.push(gapField + ': reported ' + gotGap + ', ' + goalFy + ' - ' + actual + ' = ' + wantGap);
                }
            }
            const wantPct = (gotGap / num(row[goalFy])) * 100;
            const gotPct = num(row[pctField]);
            if (isFinite(wantPct) && isFinite(gotPct) && Math.abs(wantPct - gotPct) > 0.05) {
                pctOff.push(pctField + ': reported ' + gotPct + ', ' + gapField + '/' + goalFy + '*100 = ' + wantPct.toFixed(2));
            }
        }
        add('Arithmetic consistency', 'Gap equals the full-year goal minus actual', gapOff.length === 0, gapOff,
            'netSalesGap and netQuantityGap are measured against GoalFy, not GoalYtd');
        add('Arithmetic consistency', 'The "to go vs goal" percentage matches its own gap', pctOff.length === 0, pctOff,
            'checked both sales and quantity');

        // Not asserted - the YTD goal exceeding the full-year goal looks odd but
        // may be a deliberate phasing artefact. Recorded for a human to judge.
        const ytdOverFy = num(row.netSalesGoalYtd) > num(row.netSalesGoalFy);
        add('Arithmetic consistency', 'Relationship between the YTD goal and the full-year goal',
            true, [],
            'netSalesGoalYtd=' + row.netSalesGoalYtd + ', netSalesGoalFy=' + row.netSalesGoalFy,
            ytdOverFy ? {
                observe: true,
                note: 'The year-to-date goal is larger than the full-year goal. That may be intended ' +
                      'phasing, but it means "gap to close" is measured against a smaller number than ' +
                      'the goal already used for the year-to-date index. Worth a product answer.',
            } : null);
    }

    // ── Children: the rows behind every table in the UI ──────────────────────
    const nos = kids.map((k) => k.hfbNo);
    const dupes = nos.filter((n, i) => nos.indexOf(n) !== i);
    add('Response contract', 'Country children contain no duplicate HFB numbers',
        dupes.length === 0, ['duplicated hfbNo: [' + [...new Set(dupes)].join(', ') + ']'],
        'children=' + kids.length);

    const unnamed = kids.filter((k) => !k.hfbName || !String(k.hfbName).trim());
    add('Response contract', 'Every HFB child carries a display name',
        unnamed.length === 0,
        [unnamed.length + ' children had no hfbName, e.g. hfbNo=' + (unnamed[0] || {}).hfbNo],
        'children=' + kids.length);

    // Same distinction as above: a null metric on a child is the API reporting
    // "no figure", whereas an unparseable value would be a real defect.
    const childNulls = kids.filter((k) => NUMERIC_FIELDS.some((f) => k[f] === null || k[f] === ''));
    add('Response contract', 'Child rows reporting an unavailable metric', true, [],
        childNulls.length
            ? childNulls.length + ' of ' + kids.length + ' children have at least one null metric, e.g. HFB ' +
              childNulls[0].hfbNo + ' (' + childNulls[0].hfbName + '): [' +
              NUMERIC_FIELDS.filter((f) => childNulls[0][f] === null || childNulls[0][f] === '').join(', ') + ']'
            : 'every child has a value for every metric',
        childNulls.length ? {
            observe: true,
            note: 'Where the forecast is null the matching "vs latest forecast" index is null too, ' +
                  'so the response is internally consistent - it is reporting an absent figure, ' +
                  'not a broken one. The question for the UI is whether that renders as a blank ' +
                  'rather than as a zero or a dash that looks like real data.',
        } : null);

    const shapeOdd = kids.filter((k) => NUMERIC_FIELDS.some(
        (f) => k[f] !== undefined && k[f] !== null && k[f] !== '' && !isFinite(num(k[f]))
    ));
    add('Response contract', 'Every populated child metric is numerically well formed',
        shapeOdd.length === 0,
        [shapeOdd.length + ' children had a non-numeric metric, e.g. hfbNo=' + (shapeOdd[0] || {}).hfbNo],
        'children=' + kids.length);
} catch (err) {
    add('Response contract', 'Contract and arithmetic checks', false,
        ['checks threw: ' + String(err).slice(0, 160)], '');
}

// ── Determinism: the same question twice should give the same answer ─────────
try {
    const a = await post({ metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'US' } });
    const b = await post({ metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'US' } });
    const strip = (j) => {
        const c = JSON.parse(JSON.stringify(j));
        const scrub = (o) => {
            if (Array.isArray(o)) o.forEach(scrub);
            else if (o && typeof o === 'object') { delete o.generatedAt; Object.values(o).forEach(scrub); }
        };
        scrub(c);
        return JSON.stringify(c);
    };
    const same = a && b && strip(a) === strip(b);
    add('Determinism', 'Two identical requests return identical data', !!same,
        ['the two responses differed once generatedAt was removed'],
        'compared full payloads with generatedAt stripped');
} catch (err) {
    add('Determinism', 'Two identical requests return identical data', false,
        ['comparison threw: ' + String(err).slice(0, 160)], '');
}

// ── Concurrency: a modest burst, which the dashboard itself produces ─────────
try {
    const N = 5;
    const started = Date.now();
    const settled = await Promise.all(Array.from({ length: N }, () =>
        window.__origFetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: window.__auth },
            body: JSON.stringify({ metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'US' } }),
        }).then((r) => r.status).catch(() => null)
    ));
    const elapsed = Date.now() - started;
    const bad = settled.filter((s) => s !== 200);
    add('Concurrency', N + ' simultaneous requests all succeed', bad.length === 0,
        ['non-200 statuses: [' + bad.join(', ') + ']'],
        'statuses=[' + settled.join(', ') + '], wall clock ' + elapsed + 'ms');
    add('Concurrency', 'A burst does not trigger rate limiting', settled.indexOf(429) === -1,
        ['at least one request was rate limited (429)'],
        'no 429 seen at N=' + N, settled.indexOf(429) === -1 ? null : { observe: true });
} catch (err) {
    add('Concurrency', 'Burst behaviour', false, ['burst threw: ' + String(err).slice(0, 160)], '');
}

// ── Transport headers: what this harness genuinely cannot answer ─────────────
// The probes run inside the page, and a browser only hands JavaScript the
// headers a server opts into via Access-Control-Expose-Headers. Asserting that
// a security header is "missing" from here would be a false finding - it may be
// present on the wire and simply invisible. Recorded as a harness limit so the
// gap is visible rather than silently unchecked.
try {
    const res = await window.__origFetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: window.__auth },
        body: JSON.stringify({ metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: 'US' } }),
    });
    await res.text();
    const visible = [];
    res.headers.forEach((v, k) => visible.push(k));
    results.push({
        group: 'Transport security',
        name: 'Security headers cannot be inspected from inside the page',
        status: res.status,
        outcome: 'harness',
        reasons: [
            'CORS exposes only ' + visible.length + ' header(s) to scripts: [' + visible.join(', ') + ']',
        ],
        note: 'Checking for strict-transport-security, x-content-type-options and similar needs a ' +
              'request made outside the browser - curl or a CI step - where the full response head ' +
              'is readable. Flagged so this is a known gap rather than an unnoticed one.',
        preview: 'exposed headers: ' + visible.join(', '),
    });
} catch (err) {
    results.push({
        group: 'Transport security',
        name: 'Security headers cannot be inspected from inside the page',
        status: null,
        outcome: 'harness',
        reasons: ['header inspection threw: ' + String(err).slice(0, 160)],
        preview: '',
    });
}

const totals = {
    total: results.length,
    passed: results.filter((r) => r.outcome === 'passed').length,
    failed: results.filter((r) => r.outcome === 'failed').length,
    observed: results.filter((r) => r.outcome === 'observed').length,
    harness: results.filter((r) => r.outcome === 'harness').length,
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
