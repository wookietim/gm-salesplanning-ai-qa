#!/usr/bin/env node
/**
 * repro-steps.js
 *
 * Turns a UI <-> API integration result into numbered steps a person can follow
 * by hand, in a browser, with no scripts and no checkout.
 *
 * Why this exists. A result row says "Row 'vs goal' matches API
 * netQuantityIndexToGoal - passed". That is only trustworthy to someone who can
 * reproduce it. Without steps, every question about a row costs a conversation
 * with whoever ran the suite, and an observation nobody can re-check gets quietly
 * ignored. These steps are the difference between a report and evidence.
 *
 * Honest limitation, stated on the page rather than hidden. This suite exists to
 * compare the SCREEN against the API. Seeing the API value by hand means opening
 * DevTools -> Network, because the endpoint is a POST that needs the session's
 * bearer token, so it cannot be opened in a tab or pasted into curl without
 * extracting the token first. Reading a request that the app already made is the
 * least awkward manual route, so it is what the steps use. Checks that are purely
 * about the screen say so and never mention DevTools.
 */

const APP_ORIGIN = 'https://dev.salesplanning.ingka.com';
const API_ORIGIN = 'https://api.dev.salesplanning.ingka.com';

const DEFAULT_HFB = '05';
const LEAF_HFB = '08';
const LEAF_PA = '0811';

/** Where each group was exercised, mirroring ALL_STEPS in ui-api-integration.js. */
function contextFor(group, ru) {
  const unit = String(ru || 'US').toUpperCase();
  const slug = unit.toLowerCase();

  const country = {
    url: `${APP_ORIGIN}/region-dashboard/${slug}`,
    body: { metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: unit } },
  };
  const hfb = {
    url: `${APP_ORIGIN}/region-dashboard/${slug}/hfb/${DEFAULT_HFB}`,
    body: {
      metric: 'KPI_SUMMARY',
      level: 'hfb',
      filters: { retailUnitCode: unit, hfbNo: DEFAULT_HFB },
    },
  };
  const leaf = {
    url: `${APP_ORIGIN}/region-dashboard/${slug}/hfb/${LEAF_HFB}/pa/${LEAF_PA}`,
    body: {
      metric: 'KPI_SUMMARY',
      level: 'pa',
      filters: { retailUnitCode: unit, paNo: LEAF_PA },
    },
  };

  const map = {
    'Country → HFB list': country,
    'Country → hero metric': country,
    'Current week': country,
    'Absent metrics': country,
    Aggregation: country,
    'Weekly chart': country,
    'Trends chart': country,
    Staleness: country,
    'Toggle consistency': country,
    Resilience: country,
    'HFB → PA list': hfb,
    'HFB → hero metric': hfb,
    'Drill-down consistency': hfb,
    'Hierarchy boundary': leaf,
    'PA detail page': leaf,
    'Deep link': hfb,
  };

  return Object.assign({ unit, slug }, map[group] || country);
}

const json = (body) => JSON.stringify(body);

/** Open the app at the page the check ran on. */
const openPage = (ctx) => [
  `Sign in to <code>${APP_ORIGIN}</code> in Chrome and let SSO complete.`,
  `Go to <code>${ctx.url}</code> and wait for the figures to finish loading.`,
];

/**
 * Read one API response by hand. Kept to three steps so it does not swamp the
 * one or two steps that are actually about the check.
 */
const openApi = (ctx, body) => [
  'Open DevTools (F12) and select the <strong>Network</strong> tab. Type ' +
    '<code>metrics</code> into the filter box, then reload the page (F5).',
  `Click the <code>POST</code> to <code>${API_ORIGIN}/metrics</code> whose ` +
    `<strong>Payload</strong> is <code>${json(body || ctx.body)}</code>.`,
  'Open its <strong>Response</strong> (or Preview) tab. Everything below is read from ' +
    'that JSON.',
];

/** The API field a check names, e.g. "... matches API netSalesIndexToGoal". */
function fieldIn(name) {
  const pair = name.match(/API\s+(net[A-Za-z]+)\s*\/\s*(net[A-Za-z]+)/);
  if (pair) return [pair[1], pair[2]];
  const one = name.match(/API\s+(net[A-Za-z]+)/);
  return one ? [one[1]] : [];
}

/** The segmented control a check ran under, if any. */
function toggleIn(name) {
  const m = name.match(/toggle:\s*([^)]+)\)/);
  return m ? m[1].trim() : null;
}

const toggleStep = (label, scope) =>
  `In the ${scope} section, click the <strong>${label}</strong> option in the ` +
  'segmented control above the list, and wait for the numbers to change.';

/** The row label a check asserts, e.g. Row "vs goal". */
function rowLabelIn(name) {
  const m = name.match(/Row\s+"([^"]+)"/);
  return m ? m[1] : null;
}

/** Hero card label, e.g. Hero "vs demand plan". */
function heroLabelIn(name) {
  const m = name.match(/Hero\s+"([^"]+)"/);
  return m ? m[1] : null;
}

/**
 * Per-check steps. Falls through a small set of shapes (hero card, list row,
 * ordering, count) before reaching the group-specific special cases, because
 * most of the 70-odd checks are one of those shapes with a different field.
 */
function stepsFor(result, payload) {
  const group = result.group || '';
  const name = result.name || '';
  const ctx = contextFor(group, payload && payload.ru);
  const fields = fieldIn(name);
  const toggle = toggleIn(name);
  const hero = heroLabelIn(name);
  const row = rowLabelIn(name);

  const listScope = group.indexOf('HFB → PA') === 0 ? 'PA' : 'HFB';
  const childKey = listScope === 'PA' ? 'paNo' : 'hfbNo';
  const childNoun = listScope === 'PA' ? 'product area' : 'HFB';
  const childCode = listScope === 'PA' ? 'four-digit code' : 'two-digit code';

  // ---- special cases first, where the shape-based steps would be wrong ----

  if (group === 'Trends chart' && /reciprocal/.test(name)) {
    return openPage(ctx).concat([
      'Scroll to the <strong>"Trends - Sales index vs LY"</strong> chart.',
      'Read the two rows of numbers printed on the lines. The upper row is the sales ' +
        'index for YTD, 13w, 8w, 4w and 1w; the lower row is the series labelled ' +
        '<strong>"vs goal"</strong>.',
      'On a calculator, divide <code>10000</code> by each number in the upper row.',
      'Compare each answer with the number below it. If they match to one decimal ' +
        'place, the "vs goal" series is the first row inverted and carries no ' +
        'independent information — that is the observation.',
      'Note: at country level the lower row may print fewer labels than the upper one, ' +
        'in which case the comparison cannot be made and the check reports a harness ' +
        'note instead of a verdict.',
    ]);
  }

  if (group === 'Trends chart') {
    return openPage(ctx)
      .concat(['Scroll to the <strong>"Trends - Sales index vs LY"</strong> chart and read the five numbers printed on the upper line.'])
      .concat(openApi(ctx, { metric: 'ROLLING_SALES_TREND', level: 'country', filters: { retailUnitCode: ctx.unit } }))
      .concat([
        'In <code>data.data[0]</code>, read <code>ytdNetSalesIndex</code>, ' +
          '<code>r13NetSalesIndex</code>, <code>r8NetSalesIndex</code>, ' +
          '<code>r4NetSalesIndex</code> and <code>r1NetSalesIndex</code>.',
        'Compare each with the label above it, left to right. They should agree to two ' +
          'decimal places — these labels are exact, not rounded.',
      ]);
  }

  if (group === 'Weekly chart') {
    return openPage(ctx)
      .concat(['Scroll to the <strong>"Sales by week"</strong> chart.'])
      .concat(openApi(ctx, { metric: 'WEEKLY_SALES_TREND', level: 'country', filters: { retailUnitCode: ctx.unit } }))
      .concat([
        'Count the entries in <code>data.data</code> — that is how many fiscal weeks the ' +
          'API returned.',
        /bar per week/.test(name)
          ? 'Count the bars on the chart. The count should match the weeks the chart is ' +
            'currently plotting.'
          : /last-year/i.test(name)
          ? 'Hover the last-year line and check it runs across every week, not just the ' +
            'weeks with current-year sales.'
          : /after the current one/i.test(name)
          ? 'Find the current week on the axis. Weeks to the right of it should have no ' +
            'current-year bar — a zero-height bar is fine, a plotted value is not.'
          : 'Hover a few bars and compare the tooltip value with the matching week entry ' +
            'in <code>data.data</code>.',
      ]);
  }

  if (group === 'Aggregation') {
    return openPage(ctx)
      .concat(openApi(ctx))
      .concat([
        'Read the country figure from <code>data</code> (the top level of the response, ' +
          'not the children).',
        'Add up the same field across every entry in <code>data.children</code> — there ' +
          'are 19 HFBs.',
        'Compare the two. They are not expected to be identical: the country total is ' +
          'calculated independently rather than summed, so a percentage gap is the ' +
          'normal result and is recorded as an observation, not a failure.',
      ]);
  }

  if (group === 'Current week' && /header week/.test(name)) {
    return openPage(ctx)
      .concat(['Read the week shown in the page header, e.g. "Week 35".'])
      .concat(openApi(ctx))
      .concat([
        'Find <code>currentIkeaWeek</code> in the response. It is in the form ' +
          '<code>YYYYWW</code>, so <code>202634</code> means week 34 of 2026.',
        'Compare the two week numbers. A difference of one is the known observation — ' +
          'the header and the data may be describing different weeks.',
      ]);
  }

  if (group === 'Current week') {
    return openPage(ctx)
      .concat(openApi(ctx))
      .concat([
        'Note <code>currentIkeaWeek</code> from this country response.',
        `Go to <code>${APP_ORIGIN}/region-dashboard/${ctx.slug}/hfb/${DEFAULT_HFB}</code> ` +
          'and repeat the Network step for the HFB request.',
        'The two <code>currentIkeaWeek</code> values should be identical — the two levels ' +
          'must not disagree about what "now" is.',
      ]);
  }

  if (group === 'Absent metrics' && /reported as absent/.test(name)) {
    return openPage(ctx)
      .concat(openApi(ctx))
      .concat([
        'Scan <code>data.children</code> for fields whose value is <code>null</code>.',
        'This row is a record of which figures the API reported as absent at the time of ' +
          'the run. It is an observation about the data, not a defect — it exists so the ' +
          'other absent-metric checks can be interpreted.',
      ]);
  }

  if (group === 'Absent metrics') {
    const what = /raw JavaScript/.test(name)
      ? 'Use Ctrl+F on the page and search for <code>null</code>, <code>undefined</code> ' +
        'and <code>NaN</code>. None should appear as visible text.'
      : /as zero/.test(name)
      ? 'For a metric the API returned as <code>null</code>, check the page shows a dash ' +
        'or blank rather than <code>0</code> — a null rendered as zero reads as real data.'
      : /still displayed/.test(name)
      ? 'Find a card whose API entry has a null metric and confirm the card is still on ' +
        'the page rather than dropped from the list.'
      : 'For any metric the API returned as <code>null</code>, confirm the index derived ' +
        'from it is also blank rather than calculated from a missing number.';
    return openPage(ctx).concat(openApi(ctx)).concat([what]);
  }

  if (group === 'Staleness') {
    return openPage(ctx).concat([
      `Click into an HFB, then use the breadcrumb to come back and open a different one.`,
      'Watch the figures on the page. They must change to the new HFB\'s values.',
      'The failure this catches is the previous HFB\'s numbers staying on screen after ' +
        'the switch, which looks like real data for the wrong entity.',
    ]);
  }

  if (group === 'Toggle consistency') {
    const label = /Qty/.test(name) ? 'Qty index' : 'Sales index';
    const field = /Qty/.test(name) ? 'netQuantityIndexToGoal' : 'netSalesIndexToGoal';
    return openPage(ctx)
      .concat([
        toggleStep(label, 'HFB performance'),
        'Note the number on any HFB card and the two-digit HFB number next to it.',
      ])
      .concat(openApi(ctx))
      .concat([
        `Find that HFB in <code>data.children</code> by its <code>hfbNo</code> and read ` +
          `<code>${field}</code>.`,
        'Rounded to a whole number, it should equal the number on the card. The point of ' +
          'this check is that the toggle changes which field is displayed, not just the ' +
          'label.',
      ]);
  }

  if (group === 'Resilience') {
    return openPage(ctx).concat([
      'Open DevTools (F12) → <strong>Network</strong> and set the throttling dropdown to ' +
        '<strong>Offline</strong>.',
      'Click into an HFB you have not opened yet in this session, so the app has to ' +
        'request it rather than serve it from cache.',
      /endless loading/.test(name)
        ? 'Watch what appears. An error message is the correct behaviour. A spinner that ' +
          'never resolves is the observation this check records.'
        : 'Check that no figures from the previous page are left on screen presented as ' +
          'though they belong to the new one.',
      'Set throttling back to <strong>No throttling</strong> when finished.',
    ]);
  }

  if (group === 'Hierarchy boundary') {
    if (/PRA level is rejected/.test(name) || /leaf/.test(name)) {
      return openPage(ctx)
        .concat(openApi(ctx, { metric: 'KPI_SUMMARY', level: 'pra', filters: { retailUnitCode: ctx.unit, paNo: LEAF_PA } }))
        .concat([
          'There will be no such request, because the app never asks for a level below ' +
            'product area. That is the point of the check.',
          'To confirm the boundary directly, look at the <code>level: "pa"</code> response ' +
            'for this page and check that <code>data.children</code> is empty or absent — ' +
            'the API reports product area as a leaf.',
        ]);
    }
    return openPage(ctx).concat([
      `On the product area page for PA ${LEAF_PA}, look for any card, link or row that ` +
        'would drill down further.',
      'There should be none. The UI must not offer a level the API cannot serve.',
    ]);
  }

  if (group === 'Drill-down consistency' && /identical whether/.test(name)) {
    const unit = ctx.unit;
    return [
      `Sign in to <code>${APP_ORIGIN}</code> in Chrome and let SSO complete.`,
      `Go to <code>${APP_ORIGIN}/region-dashboard/${ctx.slug}</code>.`,
    ]
      .concat(openApi(ctx, { metric: 'KPI_SUMMARY', level: 'country', filters: { retailUnitCode: unit } }))
      .concat([
        `In <code>data.children</code>, find the entry with ` +
          `<code>hfbNo: "${DEFAULT_HFB}"</code> and note its index values.`,
        `Now go to <code>${APP_ORIGIN}/region-dashboard/${ctx.slug}/hfb/${DEFAULT_HFB}</code> ` +
          'and repeat the Network step for that page\'s own request.',
        'Compare the same fields. The figures for HFB ' + DEFAULT_HFB + ' should be ' +
          'identical whether they arrive inside the country response or from the HFB\'s ' +
          'own call. A difference means the two paths disagree about the same entity.',
      ]);
  }

  if (group === 'Deep link' && /cold load/.test(name)) {
    return [
      `Sign in to <code>${APP_ORIGIN}</code> in Chrome and let SSO complete.`,
      `Paste <code>${ctx.url}</code> into the address bar and press Enter. Do not ` +
        'navigate there by clicking — this must be a fresh page load.',
      /renders the PA list/.test(name)
        ? 'Wait for loading to finish and confirm the product area list is populated, not ' +
          'just the header and an empty body.'
        : `Confirm the page lands on HFB ${DEFAULT_HFB} rather than redirecting to the ` +
          'country dashboard.',
    ];
  }

  if (group === 'Deep link' && /identifies itself/.test(name)) {
    return [
      `Sign in to <code>${APP_ORIGIN}</code> in Chrome and let SSO complete.`,
      `Paste <code>${ctx.url}</code> into the address bar and press Enter.`,
      `Read the page heading and breadcrumb. Both should name HFB ${DEFAULT_HFB}.`,
    ];
  }

  // ---- shape-based steps ----

  if (hero) {
    const field = fields[0] || 'the matching field';
    const where =
      group === 'PA detail page'
        ? `product area ${LEAF_PA}`
        : group === 'Deep link'
        ? `HFB ${DEFAULT_HFB} (loaded cold from the address bar)`
        : group.indexOf('Country') === 0
        ? `country ${ctx.unit}`
        : `HFB ${DEFAULT_HFB}`;
    return openPage(ctx)
      .concat([
        `At the top of the page for ${where}, find the large summary card and read the ` +
          `figure labelled <strong>"${hero}"</strong>.`,
      ])
      .concat(openApi(ctx))
      .concat([
        `In <code>data</code> (the top level, not <code>children</code>), read ` +
          `<code>${field}</code>.`,
        'Rounded to a whole number it should equal the figure on the card.',
        'The hero card carries its own metric and is not controlled by the list toggle ' +
          'below it, so read its label rather than assuming which index it shows.',
      ]);
  }

  if (row) {
    const field = fields[0] || 'the matching field';
    return openPage(ctx)
      .concat(toggle ? [toggleStep(toggle, `${listScope} performance`)] : [])
      .concat([
        `Pick any ${childNoun} row in the list and note its number (the ${childCode} ` +
          `at the start of the row).`,
        `In that row, read the figure labelled <strong>"${row}"</strong>.`,
      ])
      .concat(openApi(ctx))
      .concat([
        `In <code>data.children</code>, find the entry whose <code>${childKey}</code> ` +
          `equals the number you noted, and read <code>${field}</code>.`,
        'Rounded to a whole number it should equal the figure in the row. Repeat for a ' +
          'second row — a single match can be a coincidence when several rows share a value.',
      ]);
  }

  if (/order matches API/.test(name)) {
    const field = fields[0] || 'netQuantityIndexToGoal';
    return openPage(ctx)
      .concat(toggle ? [toggleStep(toggle, `${listScope} performance`)] : [])
      .concat([
        `Write down the ${childNoun} numbers in the order they appear down the page.`,
      ])
      .concat(openApi(ctx))
      .concat([
        `Sort <code>data.children</code> by <code>${field}</code>, smallest first.`,
        'The two orders should match — the list is meant to lead with the worst performer.',
      ]);
  }

  if (/is rendered as a card|is rendered$/.test(name)) {
    return openPage(ctx)
      .concat([`Count the ${childNoun} cards on the page.`])
      .concat(openApi(ctx))
      .concat([
        'Count the entries in <code>data.children</code>.',
        'The two counts should be equal — nothing the API returned may be missing from ' +
          'the page, and nothing may be rendered twice.',
      ]);
  }

  if (/name from the API appears/.test(name)) {
    return openPage(ctx)
      .concat(openApi(ctx))
      .concat([
        `Take each name from <code>data.children</code> and use Ctrl+F to find it on the ` +
          'page.',
        'Every one should be present. This catches a card rendering the right number ' +
          'against the wrong name.',
      ]);
  }

  if (/Displayed (PA )?index matches/.test(name)) {
    const field = fields[0] || 'netQuantityIndexToGoal';
    return openPage(ctx)
      .concat(toggle ? [toggleStep(toggle, `${listScope} performance`)] : [])
      .concat([
        `Note the large index number on any ${childNoun} card, and the card's number.`,
      ])
      .concat(openApi(ctx))
      .concat([
        `Find that entry in <code>data.children</code> by <code>${childKey}</code> and ` +
          `read <code>${field}</code>.`,
        'Rounded to a whole number it should equal the number on the card.',
      ]);
  }

  if (/Gap is displayed exactly when/.test(name)) {
    return openPage(ctx)
      .concat([
        `Go through every ${childNoun} and note which ones show a gap line ` +
          '(labelled <code>Gap to close:</code> on cards, <code>Gap:</code> on list rows) ' +
          'and which show none at all.',
      ])
      .concat(openApi(ctx))
      .concat([
        'For each entry in <code>data.children</code>, read <code>netQuantityGap</code>.',
        'A <strong>positive</strong> value means actuals are still short of the goal, so a gap ' +
          'line must be shown. A value of zero or below means the goal is already met, so no ' +
          'line should appear.',
        'Line up the two lists. On the live US country dashboard they are inverted: the only two ' +
          'HFBs showing a gap (01 and 10) are the two whose gap is <em>negative</em>, and the ' +
          '17 that are genuinely short show nothing. See SSPLAN-908.',
      ]);
  }

  if (/Gap magnitudes match/.test(name)) {
    return openPage(ctx)
      .concat([`Note the gap figure on any ${childNoun} row, ignoring its sign.`])
      .concat(openApi(ctx))
      .concat([
        `In <code>data.children</code>, read <code>${fields[0] || 'netQuantityGap'}</code> ` +
          `and <code>${fields[1] || 'netSalesGap'}</code> for that entry.`,
        'The magnitudes should match once the UI\'s thousands abbreviation is expanded ' +
          '(for example <code>107K</code> against <code>107073</code>).',
      ]);
  }

  if (/Gap sign convention/.test(name)) {
    return openPage(ctx)
      .concat([`Note a gap figure on a ${childNoun} row including its sign, e.g. -107K.`])
      .concat(openApi(ctx))
      .concat([
        'Read the same gap field for that entry in <code>data.children</code>.',
        'The magnitudes agree but the signs are opposite: the UI renders the gap as its own ' +
          'negation, so the API\'s positive "still short of goal" becomes a negative on screen.',
        'This was recorded as an observation until SSPLAN-908 confirmed the UI hides and shows ' +
          'the gap line based on that same sign, so it is now treated as a defect.',
      ]);
  }

  if (/ran to completion/.test(name)) {
    return [
      'This row is emitted by the harness itself, not by a check against the product.',
      'It appears when a group threw an error before finishing, and the message in the ' +
        'Evidence column is the exception. Re-run the suite to reproduce it; there is ' +
        'nothing to inspect by hand in the app.',
    ];
  }

  // Anything unmatched still gets an honest, usable fallback rather than silence.
  return openPage(ctx)
    .concat(openApi(ctx))
    .concat([
      `Compare what the page shows for this check against ` +
        (fields.length
          ? `<code>${fields.join('</code> and <code>')}</code> in the response.`
          : 'the corresponding value in the response.'),
      'This check does not yet have hand-written steps. If you need them, say so and ' +
        'they will be added.',
    ]);
}

module.exports = { stepsFor, contextFor, APP_ORIGIN, API_ORIGIN };
