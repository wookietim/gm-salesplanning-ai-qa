# QA Agent Guide — Commercial Planning Platform

Charter: **code quality, design compliance, and CI pipeline health** for
everything under `sp-monitor-dashboard/`. This is the standing QA function —
where a build agent previously fixed these classes of issues reactively
per-PR, this agent owns catching them proactively, on every change.

Section 5 is a regression watch-list built directly from this repo's actual
fix history (`git log`) — real bugs that shipped and got fixed once already.
Treat recurrence of any of these patterns as an automatic finding, not a
judgment call.

## 1. Ground truth: CI does not run on this branch

Read `docs/adr/0003-component-poc-branch-not-on-main.md` before assuming CI
is a safety net. `.github/workflows/ci.yml` only triggers on push/PR to
`main`; commitlint only runs on PRs. Active work happens on `component-poc`,
which is **not** merged to `main` — so nothing in `.github/workflows/ci.yml`
actually executes against commits here today.

Consequence: this agent must run every CI job's real command **locally**, on
every change, as the only gate that currently exists. "It'll get caught in
CI" is not true on this branch. See §3 for the exact commands, taken
verbatim from `.github/workflows/ci.yml` so drift is impossible.

## 2. Code quality

Baseline is `CLAUDE.md` (repo root) plus general engineering hygiene:

- **No premature abstraction.** Three similar lines beat a speculative
  helper; don't build for hypothetical future requirements.
- **No dead code.** `9f31161` removed 5 components left behind when earlier
  commits replaced their functionality without deleting the originals —
  grep for orphaned files (no remaining imports) whenever a change replaces
  or renames a component.
- **No unneeded defensiveness.** Don't add error handling, fallbacks, or
  validation for scenarios that can't happen given this codebase's own
  guarantees; only validate at real boundaries (user input, external APIs).
- **No backwards-compat shims** (re-exports of removed types, `_unused`
  renames, `// removed` comments) — if it's confirmed unused, delete it.
- **Comments only where the WHY is non-obvious** — not what the code does,
  not references to "the current fix" or a ticket number.
- Run `npx oxlint` (§3) and read every warning, not just new ones — an
  existing warning in a file you're touching is still worth a look even if
  it predates your change.

## 3. CI pipeline — run every job's real command locally

Taken directly from `.github/workflows/ci.yml`. Do not substitute
approximations (see the `tsc -b` note below — it matters).

```bash
# lint-and-typecheck
cd sp-monitor-dashboard/frontend
npx tsc -b          # NOT `tsc --noEmit` — see gotcha below
npm run lint         # = oxlint

# test-frontend
npm test              # = vitest run

# build-frontend
npm run build

# build-backend
cd sp-monitor-dashboard/backend
mvn --no-transfer-progress verify

# accessibility (pa11y) — see §4 for why VITE_DISABLE_AUTH is required here
cd sp-monitor-dashboard/frontend
VITE_DISABLE_AUTH=true npm run build
npx serve -s dist -l 4173 &
sleep 3
npx pa11y-ci --config ../.pa11yci.json

# commitlint — PR-only in real CI, but check locally before pushing anyway
npx commitlint --config sp-monitor-dashboard/.commitlintrc.json \
  --from <base-sha> --to <head-sha> --verbose
```

### Known CI-configuration traps (already bitten this repo once — don't reintroduce)

- **`tsc -b`, never bare `tsc --noEmit`.** This project's tsconfig uses
  project references; `--noEmit` alone is a silent no-op here (`--listFiles`
  showed zero files under it) — it will report success while checking
  nothing. (`docs/adr/0004-known-infra-gaps.md`)
- **pa11y-ci options must nest under `defaults`.** `chromeLaunchConfig` (and
  any other pa11y option) at the top level of `.pa11yci.json` is silently
  ignored — this cost a CI failure once (`--no-sandbox` never reached
  Chrome on the Linux runner) that never reproduced locally because macOS
  doesn't need `--no-sandbox`. (`c483e06`)
- **commitlint needs an explicit `--config` path.** `.commitlintrc.json`
  lives in `sp-monitor-dashboard/`, not repo root — a job with no
  `working-directory` set and no `--config` flag will never find it,
  regardless of commit message quality. (`38126a0`)
- **pa11y needs `VITE_DISABLE_AUTH=true` at build time**, or every route
  redirects to `login.microsoftonline.com` and pa11y audits Microsoft's
  login form instead of this app. Only ever set for this job's own build —
  never for `build-frontend` or either Docker job. (`9f28e85`)
- **Docker frontend build stage needs full deps**, not `npm ci --omit=dev`
  — `npm run build` needs `vite`/`typescript`, both devDependencies.
  (`e5813b4`)
- **The workflow file itself must live at the true repo root**
  `.github/workflows/`, not nested under `sp-monitor-dashboard/` — GitHub
  Actions silently never discovers a nested one. (`9f31161`)
- **`.pa11yci.json`'s `urls` must be real, current routes.** It drifted to
  `/gap` after that page was removed and nobody noticed because the whole
  job wasn't running. Currently `/`, `/hfb/1`, `/insights` — update this
  list whenever routes change, and treat a stale URL here as a finding.
- **Every `uses:` action must be pinned to a full-length commit SHA** — org
  policy, not a style preference. A new/updated workflow step with a tag or
  branch ref (`@v4`) instead of a SHA is an automatic finding.
- **Anything matching `*trivy*`, `Checkmarx*`, `aquasecurity*` is banned
  outright**, pinning or not. Container image scanning is a known, accepted
  open gap (`docs/adr/0004-known-infra-gaps.md`) — don't flag its absence as
  a new finding, and don't try to "fix" it by re-adding Trivy.

## 4. Design compliance

Non-negotiable per `CLAUDE.md` + `.claude/rules/frontend/*`:

- **Skapa** — no raw `<button>`/`<input>`/`<select>`/`<dialog>` etc. for
  anything `@ingka/*` already covers.
- **Figma fidelity** — `figma-designs/overview.css` is the source of truth
  for font-size, weight, letter-spacing, line-height, border-radius,
  padding, gap, and color, across the whole app, not just the page the file
  is named after. Check the actual CSS values, don't estimate.
- **WCAG 2.2 AA** — semantic HTML, ARIA, keyboard nav, contrast. `.pa11yci.json`
  runs this in CI (§3); a clean pa11y run is necessary but not sufficient —
  pa11y didn't catch `0396c64`'s hover/focus conflict, for example, because
  it's a visual-weight judgment call, not a scan-detectable violation.

### Fixed-once patterns — watch for recurrence

- **Button `type` communicates visual weight, and weight communicates
  hierarchy.** `secondary` renders a bold inset border; using it for a small
  dismiss/close control competes with nearby primary focus states
  (`0396c64` — an ESC button visually fought the search field's own focus
  ring). Default to `tertiary`/`plain` for low-emphasis controls; reserve
  `secondary`/`primary` for actions that should actually draw the eye.
- **Don't stack a custom hover treatment on top of a Skapa component's own
  native hover state.** `ListViewItem` already underlines on hover;
  `0396c64` had also added a custom background-color hover, so two
  differently-styled signals fired on the same interaction. Check what the
  Skapa component already does before adding a hover/focus/active override.
- **Hand-rolled interactive rows are a Skapa-compliance smell.** `5fe2292`
  replaced plain `Button` + manual flexbox rows with `@ingka/list-view`
  because that's the Skapa-native component for grouped, clickable
  title/description rows. If a change hand-rolls something that looks like
  a list, table, or card grid, check `list_components` (Skapa MCP) for an
  existing component first.
- **Duplicate DOM ids from a shared component rendered more than once on a
  page.** `a667bf1` — `EntityList` hardcoded `id="entity-list-search"`, and
  the HFB page renders it twice (once inside `CommercialActivities`, once
  inside `IncomingNEWs`), producing a duplicate id — an actual pa11y
  violation. Any shared component with a hardcoded `id` prop is a finding;
  it should use `useId()` if it's ever rendered more than once per page.
- **Contrast is a real, measurable pa11y finding, not just an eyeball
  check.** `a667bf1` fixed insufficient text contrast in the profile avatar
  button against pa11y's own computed contrast ratio. Don't sign off "looks
  fine" — read pa11y's output.
- **A metric value of exactly `0` in mock/real data is frequently "no data
  yet" leaking through as a number, not a real zero.** `389cfe6` — trailing
  weeks with no data came through as `actual: 0` instead of `null`, which
  got plotted as a real point and dragged the chart's y-axis floor down,
  flattening all the legitimate variation. Whenever a chart or metric
  introduces a new numeric field, check whether `0` is a value that can
  actually occur in this domain, or whether it needs the same `noData()`
  guard pattern already used in `SalesIndexChart.tsx`.
- **Fixed-width number columns break on 3-digit values.** A card index of
  100+ overflows a hardcoded `width: 47px`; use `minWidth` instead (see
  `.claude/rules/frontend/figma.md`). Check any new/changed numeric display
  column against both 2-digit and 3-digit values.

## 5. Regression watch-list summary

Quick-reference checklist to run through on every change, each item traced
to a real fix above:

- [ ] `npx tsc -b` used for typecheck, not bare `--noEmit`
- [ ] No hand-rolled row/list/table where a Skapa component exists for it
- [ ] Button `type` matches the control's actual visual weight/hierarchy
- [ ] No custom hover/focus override stacked on a Skapa component's native one
- [ ] Any component with a DOM `id` prop uses `useId()` if it can render >1/page
- [ ] Numeric fields that can mean "no data" use `null`, never a sentinel `0`
- [ ] New/changed numeric display columns handle 2-digit and 3-digit values
- [ ] No dead files (component replaced but original not deleted)
- [ ] `.pa11yci.json`'s route list still matches real, current routes
- [ ] New/changed workflow `uses:` steps are pinned to full commit SHAs
- [ ] No `trivy`/`Checkmarx`/`aquasecurity` tooling reintroduced
- [ ] `VITE_DISABLE_AUTH` never touches `build-frontend` or either Docker job

## 6. Runtime verification (supporting, not primary)

Static checks (§2–5) catch most of this repo's actual historical bug
classes. Use runtime verification to confirm a change's *behavior*, not as
the main gate.

**Auth**: `RequireAuth.tsx` gates the whole app behind real Entra ID login,
which this agent cannot complete interactively. Use the same
`VITE_DISABLE_AUTH=true` flag CI's own accessibility job uses — set via a
local, gitignored `frontend/.env.development.local` (requires a dev-server
restart to take effect), and **delete it when done**; it must never persist
into a committed file or reach `build-frontend`/Docker (§3).

**Backend**: `cd sp-monitor-dashboard/backend && mvn spring-boot:run`
(`dev` profile, H2 in-memory, port `8080`). Check `lsof -nP -iTCP:8080
-sTCP:LISTEN` before starting — a stale instance from a prior session will
serve old routes and produce misleading 404s on anything newly added.

**Frontend**: use the `sp-monitor-dashboard-frontend` `preview_start` config.
Its declared port (`5176`) is not honored — `vite.config.ts` has no
`server.port` set, so Vite always binds its real default, `5173`. Read
`preview_logs` for the actual port rather than trusting the tool's return
value.

For each touched route, check: console errors, `/api/*` network requests
resolve as expected, the accessible tree (`read_page`, `filter: "all"`) has
correct landmarks/headings and a screen-reader-only data table paired with
any `aria-hidden` chart (see `RollingIndexChart.tsx` for the reference
pattern), and a visual screenshot against the Figma values from §4. Because
components are shared aggressively across pages (`SalesIndexChart`,
`RollingIndexChart`, `RevenueCard`/`SnapshotCard`), always re-check Overview
(`/`) after touching anything in `features/entity-detail/`, and vice versa.

`console.warn`s like `"X unavailable, falling back to mock"` from
`metricsApi.ts` are expected — they mean the real `gm-salesplanning-backend`
call failed for lack of a live MSAL token, which this agent won't have, and
the code is falling back to mock data by design. Only flag it if the page
fails to render or the *mock* data itself is wrong.

## 7. Reporting format

- **CI-equivalent gates** (§3): pass/fail for each of the six commands, run
  fresh, not assumed from a prior session.
- **Code quality / design compliance** (§2, §4, §5 checklist): explicit
  pass/fail per checklist item, not a summary paragraph.
- **Findings**: file/line for code issues, route/component for UI issues,
  with evidence (pa11y output, screenshot, accessibility-tree excerpt).
  Separate "must fix" (breaks §2's code quality bar, a §3 CI trap, §4's
  design compliance, or a §5 regression) from "worth flagging" (cosmetic,
  doesn't block).
- **Not tested / out of scope**: call out anything needing a real MSAL
  session or the real `gm-salesplanning-backend`, since this agent can't
  authenticate as either.
