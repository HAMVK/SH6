# NTv5.4 vs main

Comparison baseline:
- `main`: `697d90c`
- `NTv5.4`: `12f4d2a`
- ahead by `42` commits
- diff size: `96 files changed, 29300 insertions(+), 8816 deletions(-)`

## Executive summary

`NTv5.4` is a large architectural branch, not a narrow feature branch. It moves SH6 away from a mostly monolithic `main.js` application toward a modular browser runtime with worker-backed analysis, retained rendering, durable storage, compare-workspace tooling, investigation flows, and a much broader smoke-test net.

The branch also closes several trust and startup gaps:
- contest scoring edge cases were corrected
- the left menu now initializes before optional runtimes
- `file://` startup is handled explicitly instead of leaving the UI in a broken half-loaded state
- the `Log` report no longer gets stuck on `Preparing Log...`

## Major change areas

### 1. Trust, scoring, and startup resilience

Representative commits:
- `a425995 feat(trust): fix scoring duplicates and zero-point mults`
- `4696f6a fix(init): build navigation before optional runtimes`
- `bbbc73a fix(startup): handle file protocol explicitly`
- `12f4d2a fix(log): restore retained table model wiring`

Main outcomes:
- Duplicate and zero-point multiplier logic were corrected in the scoring path.
- Navigation startup no longer depends on every optional runtime loading successfully first.
- `file://` runs now show a clear recovery state with local-server instructions.
- The `Log` report path is protected from the retained-runtime wiring bug that left the view stuck on `Preparing Log...`.
- Report-render failures now degrade into an error state instead of leaving `aria-busy` and the loading shell stuck forever.

Primary files:
- [main.js](/Users/simon/github/SH6/main.js)
- [modules/ui/navigation-runtime.js](/Users/simon/github/SH6/modules/ui/navigation-runtime.js)
- [modules/reports/retained-runtime.js](/Users/simon/github/SH6/modules/reports/retained-runtime.js)
- [data/contest_scoring_spec.json](/Users/simon/github/SH6/data/contest_scoring_spec.json)
- [scripts/run-local-web.sh](/Users/simon/github/SH6/scripts/run-local-web.sh)

### 2. Engine and analysis-core extraction

Representative commits:
- `cde06cd feat(engine): workerize shared analysis core`
- `70d8e65 feat(engine): add durable storage and retained rendering foundations`

Main outcomes:
- Shared analysis logic moved into a dedicated analysis core.
- Parse/derive workloads can run through a worker-backed task engine instead of blocking the main thread as heavily.
- Engine fallbacks were preserved, so SH6 can still degrade gracefully if worker execution fails.

Primary files:
- [modules/analysis/core.js](/Users/simon/github/SH6/modules/analysis/core.js)
- [modules/engine/task-worker.js](/Users/simon/github/SH6/modules/engine/task-worker.js)
- [worker.js](/Users/simon/github/SH6/worker.js)

### 3. Retained rendering and virtualized long reports

Representative commits:
- `5999356 perf(reports): retain and virtualize summary tables`
- `1480c25 perf(compare): retain more compare workspaces`
- `909b76f perf(review): retain passed-qso and error reports`
- `2903e41 refactor(reports): extract retained report runtime`
- `79b1b06 fix(ui): add virtual table shell styles`

Main outcomes:
- Long reports now keep retained roots instead of always replacing the full report container.
- Virtualized rendering was added for heavier tables, especially the `Log` path and long summary/review reports.
- Coach and agent workspaces remain mounted across updates, reducing view churn.
- The retained-report mechanism is centralized instead of being hidden inside `main.js`.

Primary files:
- [modules/reports/retained-runtime.js](/Users/simon/github/SH6/modules/reports/retained-runtime.js)
- [modules/ui/virtual-table.js](/Users/simon/github/SH6/modules/ui/virtual-table.js)
- [style.css](/Users/simon/github/SH6/style.css)
- [main.js](/Users/simon/github/SH6/main.js)

### 4. Compare workspace and investigation UX

Representative commits:
- `955f79b feat(workspace): add compare time locks and ranked coach actions`
- `1335f97 refactor(compare): extract workspace renderer module`
- `398e01a refactor(compare): extract compare controller runtime`
- `f910b71 feat(agents): add actionable investigation perspectives`
- `ad875c7 feat(agents): add agent briefing workspace`

Main outcomes:
- Compare mode became a real workspace with time locks, saved perspectives, and reusable compare actions.
- Competitor coach and agent briefing were turned into retained investigation surfaces instead of ordinary static reports.
- Workspace behavior is now implemented in dedicated compare modules rather than inside menu/report glue code.

Primary files:
- [modules/compare/workspace-ui.js](/Users/simon/github/SH6/modules/compare/workspace-ui.js)
- [modules/compare/controller-runtime.js](/Users/simon/github/SH6/modules/compare/controller-runtime.js)
- [modules/agents/runtime.js](/Users/simon/github/SH6/modules/agents/runtime.js)
- [modules/reports/investigation-workspace.js](/Users/simon/github/SH6/modules/reports/investigation-workspace.js)

### 5. Storage, sessions, and durable browser state

Representative commits:
- `2371b2d refactor(session): extract codec and perspective modules`
- `73d7bca refactor(storage): extract durable storage runtime`

Main outcomes:
- Session payload handling and permalink encoding are now modularized.
- Saved compare perspectives became a dedicated subsystem.
- Durable browser storage handling moved into runtime modules and persistence helpers.
- Autosave/session restore behavior is more explicit and testable.

Primary files:
- [modules/session/codec.js](/Users/simon/github/SH6/modules/session/codec.js)
- [modules/session/perspectives.js](/Users/simon/github/SH6/modules/session/perspectives.js)
- [modules/storage/runtime.js](/Users/simon/github/SH6/modules/storage/runtime.js)
- [modules/storage/persistence.js](/Users/simon/github/SH6/modules/storage/persistence.js)

### 6. Navigation, load panel, archive, and export decomposition

Representative commits:
- `907523a refactor(ui): extract navigation runtime`
- `dac5234 refactor(ui): extract load panel runtime`
- `291e2ab refactor(ui): extract analysis controls runtime`
- `9eeb75f refactor(archive): extract archive client module`
- `cbe0980 refactor(archive): extract archive search runtime`
- `104eda5 refactor(export): extract export runtime module`

Main outcomes:
- Navigation/search, load-slot actions, compare-count controls, archive client/search, and export behavior all moved out of `main.js`.
- Startup orchestration is now composed from runtime modules with smaller, testable seams.
- The branch added direct smoke coverage around those extracted subsystems.

Primary files:
- [modules/ui/navigation-runtime.js](/Users/simon/github/SH6/modules/ui/navigation-runtime.js)
- [modules/ui/load-panel-runtime.js](/Users/simon/github/SH6/modules/ui/load-panel-runtime.js)
- [modules/ui/analysis-controls-runtime.js](/Users/simon/github/SH6/modules/ui/analysis-controls-runtime.js)
- [modules/archive/client.js](/Users/simon/github/SH6/modules/archive/client.js)
- [modules/archive/search-runtime.js](/Users/simon/github/SH6/modules/archive/search-runtime.js)
- [modules/export/runtime.js](/Users/simon/github/SH6/modules/export/runtime.js)

### 7. Coach, CQ API, and investigation actions

Representative commits:
- `6adc585 refactor(coach): extract cq api and competitor runtime`
- `7b62dab refactor(ui): extract investigation actions runtime`

Main outcomes:
- CQ API history loads and competitor coach orchestration were extracted into a dedicated runtime.
- Investigation actions are now centralized and reusable.
- Coach output moved closer to ranked, actionable post-analysis flows.

Primary files:
- [modules/coach/runtime.js](/Users/simon/github/SH6/modules/coach/runtime.js)
- [modules/ui/investigation-actions-runtime.js](/Users/simon/github/SH6/modules/ui/investigation-actions-runtime.js)

### 8. Spots and RBN subsystem split

Representative commits:
- `041d298 refactor(spots): extract spots data runtime`
- `af0ea1a refactor(spots): extract spots actions runtime`
- `4a6598f refactor(spots): extract rbn compare runtime`
- `989cc0b refactor(spots): extract rbn compare model runtime`
- `82b6b5e refactor(spots): extract rbn compare view runtime`
- `dc5d2c3 refactor(spots): extract rbn compare chart runtime`
- `3a60474 refactor(spots): extract signal export runtime`
- `9661c26 refactor(spots): extract compare workspace runtime`
- `769d3cd refactor(spots): extract drilldown runtime`
- `23cb3e9 refactor(spots): extract coach summary runtime`
- `54f72b9 refactor(spots): extract diagnostics runtime`
- `b428304 refactor(spots): extract chart runtime`

Main outcomes:
- The spots/RBN feature area was broken into data, actions, compare UI, charting, diagnostics, exports, and RBN compare layers.
- This removed one of the highest-risk monoliths from `main.js`.
- The subsystem now has modular seams for future work instead of relying on one large renderer/controller path.

Primary files:
- [modules/spots/data-runtime.js](/Users/simon/github/SH6/modules/spots/data-runtime.js)
- [modules/spots/actions-runtime.js](/Users/simon/github/SH6/modules/spots/actions-runtime.js)
- [modules/spots/compare-runtime.js](/Users/simon/github/SH6/modules/spots/compare-runtime.js)
- [modules/spots/drilldown-runtime.js](/Users/simon/github/SH6/modules/spots/drilldown-runtime.js)
- [modules/spots/diagnostics-runtime.js](/Users/simon/github/SH6/modules/spots/diagnostics-runtime.js)
- [modules/spots/charts-runtime.js](/Users/simon/github/SH6/modules/spots/charts-runtime.js)
- [modules/spots/coach-summary-runtime.js](/Users/simon/github/SH6/modules/spots/coach-summary-runtime.js)
- [modules/spots/rbn-compare-runtime.js](/Users/simon/github/SH6/modules/spots/rbn-compare-runtime.js)
- [modules/spots/rbn-compare-model-runtime.js](/Users/simon/github/SH6/modules/spots/rbn-compare-model-runtime.js)
- [modules/spots/rbn-compare-view-runtime.js](/Users/simon/github/SH6/modules/spots/rbn-compare-view-runtime.js)
- [modules/spots/rbn-compare-chart-runtime.js](/Users/simon/github/SH6/modules/spots/rbn-compare-chart-runtime.js)
- [modules/spots/signal-export-runtime.js](/Users/simon/github/SH6/modules/spots/signal-export-runtime.js)

## Test and audit expansion

Representative additions:
- [scripts/run-log-report-smoke.sh](/Users/simon/github/SH6/scripts/run-log-report-smoke.sh)
- [scripts/run-file-protocol-startup-smoke.sh](/Users/simon/github/SH6/scripts/run-file-protocol-startup-smoke.sh)
- [scripts/run-init-navigation-resilience-smoke.sh](/Users/simon/github/SH6/scripts/run-init-navigation-resilience-smoke.sh)
- [scripts/run-session-codec-smoke.sh](/Users/simon/github/SH6/scripts/run-session-codec-smoke.sh)
- focused runtime smoke pages under [tests](/Users/simon/github/SH6/tests)

Branch impact:
- Startup, navigation, archive search, storage, export, compare controller, retained rendering, session codec, coach flows, spots, RBN compare, and the loaded `Log` report all gained dedicated browser-smoke or runtime-smoke coverage.
- Verification is now aligned to the extracted module boundaries instead of relying mainly on broad manual checks.

## Net effect on SH6

Before `NTv5.4`:
- most behavior lived in `main.js`
- large report paths and external integrations were tightly coupled
- startup and render failures could leave the UI partially initialized

After `NTv5.4`:
- `main.js` is still important, but acts much more like an orchestrator
- major subsystems now live in dedicated runtime modules
- long reports render more efficiently
- compare mode is more investigation-oriented
- startup and report failure modes are more explicit and recoverable

## Recommended review order

If you want to review the branch efficiently:
1. [ntv5-4-plan.md](/Users/simon/github/SH6/ntv5-4-plan.md)
2. [NTv5.4-vs-main-overview.md](/Users/simon/github/SH6/NTv5.4-vs-main-overview.md)
3. [main.js](/Users/simon/github/SH6/main.js)
4. [modules/ui/navigation-runtime.js](/Users/simon/github/SH6/modules/ui/navigation-runtime.js)
5. [modules/reports/retained-runtime.js](/Users/simon/github/SH6/modules/reports/retained-runtime.js)
6. [modules/analysis/core.js](/Users/simon/github/SH6/modules/analysis/core.js)
7. [modules/compare/controller-runtime.js](/Users/simon/github/SH6/modules/compare/controller-runtime.js)
8. [modules/spots/data-runtime.js](/Users/simon/github/SH6/modules/spots/data-runtime.js)
