# Plan: SH6 NTv5.4

**Generated**: 2026-03-06
**Branch**: `NTv5.4`
**Estimated Complexity**: Very High
**Planning Scope**: Trust fixes, compare workspace redesign, coach redesign, visible navigation/search, modularization, worker-first engine, durable browser storage, retained rendering, virtualization, and the first full SH6 agent platform.

## Overview

NTv5.4 should turn SH6 from a strong static report tool into a trustworthy, investigation-first analysis system.

The roadmap is intentionally sequenced:

1. Fix correctness and trust gaps first.
2. Reframe the product around investigation workflows rather than report browsing.
3. Rebuild the engine under the existing product so the UI and agent system can scale.
4. Add the agent layer on top of a normalized, provenance-aware analysis model.

This plan does **not** assume a framework migration. The preferred direction is:

- Keep static deployment.
- Move from one monolithic script to native ES modules.
- Use module workers and browser storage APIs.
- Add retained rendering and virtualization surgically rather than replacing the whole UI stack.

## Goals

- Make SH6 reliable enough to be trusted for serious scoring analysis.
- Make compare mode the primary analytical workspace.
- Give every major insight provenance, confidence, and next-step actions.
- Make large-log and multi-log workflows performant on normal laptops.
- Establish a clean platform for agentic analysis, not ad hoc feature islands.

## Non-Goals

- No rewrite to React/Vue/Svelte in NTv5.4.
- No hard dependency on a backend for core report generation.
- No attempt to replace live operating loggers as the primary product thesis.
- No broad visual redesign without workflow gains.

## Success Criteria

- Duplicate and multiplier handling are contest-correct for supported scorers.
- Compare score views never mix metric semantics implicitly.
- Compare workspace supports locked time ranges, cross-highlighting, largest-delta jumps, and saved perspectives.
- `main.js` is reduced to bootstrap/compatibility logic; core logic lives in modules.
- Parse, derive, scoring, spot indexing, and archive querying run off the main thread.
- Long tables are virtualized and heavy reports stop full-container rerendering.
- Agents run against a normalized analysis snapshot and emit ranked, provenance-aware actions.

## Proposed Target Layout

Use native ES modules and module workers under a new app structure:

```text
app/
  bootstrap.js
  compat/
    legacy-main-bridge.js
  core/
    app-state.js
    event-bus.js
    report-registry.js
    session-state.js
    compare-workspace-state.js
  domain/
    parser/
    derive/
    scoring/
    geography/
    enrichment/
    spots/
    rbn/
    archive/
  storage/
    indexeddb.js
    opfs-worker.js
    cache-policy.js
  ui/
    shell/
    reports/
    workspace/
    coach/
    agents/
    shared/
  workers/
    parse-worker.js
    derive-worker.js
    scoring-worker.js
    archive-worker.js
    spots-worker.js
    rbn-worker.js
  agents/
    engine/
    specs/
    implementations/
```

Migration path:

- Keep `main.js` initially as the entrypoint.
- Gradually extract modules and route legacy calls through a compatibility bridge.
- Switch `index.html` to a module bootstrap only after parity is proven.

## Sprint 0: Foundations And Guardrails

**Goal**: Lock scope, reduce migration risk, and create the contracts needed for safe refactoring.

**Demo/Validation**:
- Branch exists and baseline plan is committed.
- New architecture and agent contracts are documented.
- Existing smoke tests run and current failures are triaged, not ignored.

### Task 0.1: Freeze Baseline Findings
- **Location**: `ntv5-4-plan.md`, `docs/architecture/`, `docs/testing/`
- **Description**:
  - Record the current trust, performance, correctness, and UX findings that NTv5.4 is intended to fix.
  - Include the current DXer smoke mismatch as explicit plan debt.
- **Dependencies**: none
- **Acceptance Criteria**:
  - Baseline issues are enumerated and prioritized.
  - The plan distinguishes test drift from confirmed runtime defects.
- **Validation**:
  - `node --check main.js`
  - `./scripts/run-cq-api-browser-smoke.sh`
  - `./scripts/run-dxer-mode-smoke.sh`

### Task 0.2: Define Core Contracts
- **Location**: `docs/architecture/ntv5-4-contracts.md`
- **Description**:
  - Define contracts for:
    - normalized `AnalysisSnapshot`
    - `CompareWorkspaceState`
    - `ScoringResult`
    - `AgentFinding`
    - `ActionCard`
    - `SourceProvenance`
  - Include versioning strategy.
- **Dependencies**: Task 0.1
- **Acceptance Criteria**:
  - Every planned subsystem depends on one shared snapshot model.
- **Validation**:
  - Manual schema review

### Task 0.3: Define Migration Rules
- **Location**: `docs/architecture/ntv5-4-migration-rules.md`
- **Description**:
  - Set rules for extracting code from `main.js`.
  - Require each extraction to preserve behavior and land behind parity checks.
  - Define compatibility layer boundaries.
- **Dependencies**: Task 0.2
- **Acceptance Criteria**:
  - Refactor tasks can be delegated without “big bang rewrite” risk.
- **Validation**:
  - Manual review against existing code map

## Sprint 1: Trust And Scoring Correctness

**Goal**: Fix the analytical trust gaps before adding higher-level intelligence.

**Demo/Validation**:
- Supported contests treat duplicates correctly.
- Zero-point QSOs can still grant multipliers where contest rules require it.
- Compare views clearly separate computed/claimed/logged metrics.
- Score provenance is visible in the Main report and compare cards.

### Task 1.1: Add Golden Scoring Fixture Matrix
- **Location**: `tests/scoring/`, `data/scoring-fixtures/`
- **Description**:
  - Create small deterministic fixtures for:
    - duplicate handling
    - same-country zero-point QSO with valid mult
    - same-band/per-band/per-mode mult scope
    - fuzzy contest resolution edge cases
  - Include supported contest cases with expected outputs.
- **Dependencies**: Sprint 0
- **Acceptance Criteria**:
  - Fixture runner can validate expected `computed_score`, `computed_multiplier_total`, and assumptions.
- **Validation**:
  - New scoring test script passes

### Task 1.2: Refactor Duplicate Logic Into Scorer Policy
- **Location**: `app/domain/scoring/duplicate-policy.js`, legacy bridge in `main.js`
- **Description**:
  - Replace the current contest-specific duplicate shortcut in [`main.js:4977`](/Users/simon/github/SH6/main.js#L4977).
  - Each scorer or rule set declares:
    - whether dupes score
    - whether dupes can create mults
    - whether dupes remain visible as analytical events
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Duplicate policy is explicit and testable per scorer.
- **Validation**:
  - Fixture matrix
  - Manual sample log review

### Task 1.3: Decouple Multiplier Credit From Point Credit
- **Location**: `app/domain/scoring/multiplier-policy.js`, legacy bridge in `main.js`
- **Description**:
  - Replace the early skip at [`main.js:5172`](/Users/simon/github/SH6/main.js#L5172).
  - Support contests where valid zero-point QSOs can still create multiplier credit.
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Multiplier evaluation no longer depends on `points > 0` alone.
- **Validation**:
  - Zero-point multiplier fixtures

### Task 1.4: Make Contest Resolution Deterministic And Visible
- **Location**: `app/domain/scoring/rule-resolver.js`, Main report UI
- **Description**:
  - Keep current folder-first resolution.
  - Downgrade fuzzy alias matches to explicit advisory resolution.
  - Expose:
    - rule id
    - detection method
    - confidence basis
    - source file version
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Users can see how SH6 chose a rule.
- **Validation**:
  - Manual with archive logs and header-only logs

### Task 1.5: Separate Compare Score Modes
- **Location**: `app/ui/workspace/compare-metric-mode.js`, compare report renderers
- **Description**:
  - Replace implicit fallback mixing near [`main.js:18742`](/Users/simon/github/SH6/main.js#L18742).
  - Add explicit compare metric modes:
    - `Computed`
    - `Claimed`
    - `Logged / Effective`
- **Dependencies**: Task 1.4
- **Acceptance Criteria**:
  - Compare summaries and insights always label the metric family in use.
- **Validation**:
  - 2-log and 4-log compare walkthrough

### Task 1.6: Add Score Provenance UI
- **Location**: `app/ui/reports/main/`, `app/ui/shared/provenance/`
- **Description**:
  - Add trust badges for:
    - rule source
    - confidence
    - fallback path
    - degraded state from missing `cty.dat`, `MASTER.DTA`, or unofficial data
- **Dependencies**: Task 1.5
- **Acceptance Criteria**:
  - Main and compare surfaces show provenance without overwhelming the user.
- **Validation**:
  - Manual with supported, unsupported, and degraded states

## Sprint 2: Compare Workspace V2

**Goal**: Turn compare from parallel report rendering into an investigation workspace.

**Demo/Validation**:
- Users can lock time ranges across slots.
- Hovering/focusing one panel cross-highlights related data in others.
- Largest-delta actions jump directly into the most relevant report/section.
- Saved perspectives can restore a named compare workspace state.

### Task 2.1: Introduce Compare Workspace State Model
- **Location**: `app/core/compare-workspace-state.js`
- **Description**:
  - Add state for:
    - locked time range
    - selected time bucket
    - cross-highlight target
    - focused slots
    - active insight chips
    - saved perspectives metadata
- **Dependencies**: Sprint 0 contracts
- **Acceptance Criteria**:
  - Compare interactions stop relying on ad hoc globals.
- **Validation**:
  - Unit tests for state transitions

### Task 2.2: Locked Time Ranges
- **Location**: `app/ui/workspace/time-range-lock.js`, relevant reports
- **Description**:
  - Add persistent range locking for:
    - Log compare
    - QSO/point time reports
    - Spots/RBN views
  - Support reset and “pin current bucket” actions.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - One range selection can drive multiple compare reports.
- **Validation**:
  - Manual 4-log walkthrough

### Task 2.3: Cross-Highlighting
- **Location**: `app/ui/workspace/cross-highlight.js`
- **Description**:
  - Hover/focus a time bucket, country, zone, rival, or band/hour cell in one panel and highlight the corresponding region in sibling panels.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Cross-panel relationships are visible without re-querying manually.
- **Validation**:
  - Manual with Log, Rates, Countries by time, Spots

### Task 2.4: Largest-Delta Jumps
- **Location**: `app/ui/workspace/insight-strip.js`
- **Description**:
  - Build quick actions such as:
    - largest score delta
    - largest multiplier delta
    - highest missed-rate bucket
    - weakest spot-response bucket
  - Jump directly to the right report and filter context.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Compare workspace can answer “where should I look first?”
- **Validation**:
  - Manual with 2-log and 4-log compare

### Task 2.5: Saved Perspectives
- **Location**: `app/core/session-state.js`, `app/storage/indexeddb.js`, session UI
- **Description**:
  - Add named workspace perspectives:
    - slot layout
    - report focus
    - filters
    - time lock
    - compare metric mode
    - active insights
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Users can save and restore investigation states without exporting full sessions every time.
- **Validation**:
  - Save/load perspective roundtrip

## Sprint 3: Coach And Navigation Redesign

**Goal**: Replace passive report pages with action-first guidance and visible navigation tools.

**Demo/Validation**:
- Command/search is visible and keyboard reachable.
- Coach pages surface ranked actions above tables.
- Empty and unsupported states propose recovery paths.

### Task 3.1: Visible Command/Search Navigation
- **Location**: `index.html`, `app/ui/shell/nav-search.js`, `style.css`
- **Description**:
  - Add the missing visible nav search control.
  - Reuse existing search logic currently wired in JS/CSS but not rendered in HTML.
  - Add a command palette action model for reports, perspectives, and agent actions.
- **Dependencies**: Sprint 2 state model preferred, but can start earlier
- **Acceptance Criteria**:
  - Search is visible in the sidebar and accessible via `/` and `Ctrl/Cmd+K`.
- **Validation**:
  - Keyboard-only navigation walkthrough

### Task 3.2: Ranked Coach Action Cards
- **Location**: `app/ui/coach/`, `competitor-coach.js` extraction path, spots coach path
- **Description**:
  - Reframe coach surfaces around:
    - top action
    - why it matters
    - confidence
    - direct jump/load action
  - Keep raw tables below the fold.
- **Dependencies**: Sprint 1 provenance
- **Acceptance Criteria**:
  - Coach pages feel like decision surfaces, not enhanced reports.
- **Validation**:
  - Manual with competitor and spots use cases

### Task 3.3: Empty And Unsupported State Recovery
- **Location**: `app/ui/shared/state-blocks.js`
- **Description**:
  - Standardize state blocks for:
    - unsupported contest
    - no cohort rows
    - no spot buckets
    - degraded enrichment
    - missing local logs in imported sessions
  - Every state includes one or more next actions.
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - No important page ends in a dead end.
- **Validation**:
  - Manual failure-state walkthrough

### Task 3.4: Session Curator UI
- **Location**: `app/ui/session/curator.js`
- **Description**:
  - Add “curate this session” actions that generate:
    - recommended perspectives
    - next reports to inspect
    - shareable debrief starting points
- **Dependencies**: Sprint 2 perspectives
- **Acceptance Criteria**:
  - Session tools move from storage-only to workflow support.
- **Validation**:
  - Manual session roundtrip

## Sprint 4: Modularization Of The App Core

**Goal**: Break the monolith into maintainable modules without breaking the product.

**Demo/Validation**:
- `main.js` becomes a thin bootstrap/compat layer.
- Extracted modules own state, parsing, scoring, reports, storage, and workers.
- Existing smoke coverage still passes after each slice.

### Task 4.1: Extract Core State And Session Modules
- **Location**: `app/core/`
- **Description**:
  - Extract:
    - application state
    - session serialization
    - compare slot state
    - navigation state
  - Keep a compatibility facade for legacy call sites.
- **Dependencies**: Sprint 0 contracts
- **Acceptance Criteria**:
  - Core state mutations no longer live inline in `main.js`.
- **Validation**:
  - Smoke tests

### Task 4.2: Extract Scoring Domain
- **Location**: `app/domain/scoring/`
- **Description**:
  - Move scoring logic, resolver, duplicate policy, multiplier policy, and provenance to their own domain module.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Scoring can be tested independently of UI rendering.
- **Validation**:
  - Scoring fixture suite

### Task 4.3: Extract Archive, Spots, And RBN Domains
- **Location**: `app/domain/archive/`, `app/domain/spots/`, `app/domain/rbn/`
- **Description**:
  - Isolate data-fetch and data-shaping logic from UI code.
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - UI depends on domain services rather than raw fetch blocks.
- **Validation**:
  - Existing smoke tests

### Task 4.4: Extract Report Registry
- **Location**: `app/core/report-registry.js`, `app/ui/reports/`
- **Description**:
  - Introduce report definitions with:
    - id
    - title
    - group
    - compare support
    - filter support
    - render function
    - interaction binding
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Report routing no longer depends on giant switch growth.
- **Validation**:
  - Manual nav/report parity

## Sprint 5: Worker-First Analysis Engine

**Goal**: Move heavy work off the main thread and establish staged analysis.

**Demo/Validation**:
- Parse, derive, scoring, spot indexing, and archive querying run in workers.
- Main thread stays responsive during load and compare workflows.

### Task 5.1: Introduce Worker Message Contracts
- **Location**: `app/workers/worker-contracts.js`
- **Description**:
  - Define request/response payloads for:
    - parse
    - derive
    - scoring
    - archive query
    - spots index
    - RBN index
- **Dependencies**: Sprint 0 contracts
- **Acceptance Criteria**:
  - Worker APIs are stable and versioned.
- **Validation**:
  - Contract tests

### Task 5.2: Parse Worker
- **Location**: `app/workers/parse-worker.js`
- **Description**:
  - Move log parsing and base normalization off the main thread.
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Large log load does not block basic shell interaction.
- **Validation**:
  - Performance budget checks

### Task 5.3: Derive And Scoring Workers
- **Location**: `app/workers/derive-worker.js`, `app/workers/scoring-worker.js`
- **Description**:
  - Move `buildDerived`-equivalent stages and scoring computation off the main thread.
  - Refactor derivation into staged indexes instead of one monolith.
- **Dependencies**: Task 5.2, Sprint 1
- **Acceptance Criteria**:
  - Derive/scoring can rerun incrementally and asynchronously.
- **Validation**:
  - Response time measurement on large multi-slot sessions

### Task 5.4: Archive Worker
- **Location**: `app/workers/archive-worker.js`
- **Description**:
  - Move shard open/query logic off the main thread.
  - Prepare for HTTP VFS or lighter index migration later.
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Archive search no longer blocks the UI.
- **Validation**:
  - Archive search on large result sets

### Task 5.5: Spots And RBN Workers
- **Location**: `app/workers/spots-worker.js`, `app/workers/rbn-worker.js`
- **Description**:
  - Move spot parsing/indexing and RBN aggregation out of UI rendering code.
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Filtering and recomputation are incremental and memoized.
- **Validation**:
  - 4-log spots/RBN compare walkthrough

## Sprint 6: Durable Storage And Offline Data

**Goal**: Replace fragile in-memory/localStorage-only behavior with real browser persistence.

**Demo/Validation**:
- Sessions, perspectives, derived snapshots, and caches survive reloads.
- Large data can be stored without choking `localStorage`.

### Task 6.1: IndexedDB Storage Layer
- **Location**: `app/storage/indexeddb.js`
- **Description**:
  - Store:
    - sessions
    - perspectives
    - derived snapshots
    - archive result caches
    - enrichment caches
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - `localStorage` is reduced to tiny preferences only.
- **Validation**:
  - Persistence roundtrip tests

### Task 6.2: OPFS Worker For Large Assets
- **Location**: `app/storage/opfs-worker.js`
- **Description**:
  - Use OPFS for:
    - raw log blobs
    - large derived caches
    - future local archive shards
  - Keep access in a dedicated worker.
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
  - Large local assets do not bloat memory-only state.
- **Validation**:
  - Load/reload large session benchmarks

### Task 6.3: Storage Policy And Migration
- **Location**: `app/storage/cache-policy.js`
- **Description**:
  - Define what lives in memory, IndexedDB, OPFS, and URL state.
  - Add versioned migration for old sessions.
- **Dependencies**: Tasks 6.1-6.2
- **Acceptance Criteria**:
  - Storage behavior is explainable and reversible.
- **Validation**:
  - Old session import compatibility test

## Sprint 7: Retained Rendering And Virtualization

**Goal**: Remove full-container rendering as the default pattern and make long reports scale.

**Demo/Validation**:
- Heavy reports update in place.
- Long tables scroll smoothly with virtualization.
- Compare pages stop rebuilding every panel on small interaction changes.

### Task 7.1: Report Shell Retention
- **Location**: `app/ui/reports/report-shell.js`
- **Description**:
  - Keep stable shell regions for:
    - toolbars
    - filters
    - summary cards
    - tables/charts
  - Update only the changed regions.
- **Dependencies**: Sprint 4 report registry
- **Acceptance Criteria**:
  - `viewContainer.innerHTML` replacement is no longer the default.
- **Validation**:
  - Render instrumentation before/after comparison

### Task 7.2: Virtualized Table Engine
- **Location**: `app/ui/shared/virtual-table/`
- **Description**:
  - Add row windowing and data-driven sort for:
    - Log
    - All callsigns
    - Passed QSOs
    - Dupes
    - Not in master
    - Possible errors
    - heavy compare tables
- **Dependencies**: Task 7.1
- **Acceptance Criteria**:
  - Sorting happens on data, not DOM rows.
- **Validation**:
  - Large-log manual perf checks

### Task 7.3: Incremental Chart And Map Updates
- **Location**: `app/ui/reports/charts/`, `app/ui/reports/map/`
- **Description**:
  - Update only affected series/layers.
  - Prepare dense-map path using canvas or aggregated layers.
- **Dependencies**: Sprint 5 workers
- **Acceptance Criteria**:
  - Charts and maps no longer rerender wholesale on every filter change.
- **Validation**:
  - Compare perf measurements

## Sprint 8: Agent Platform Core

**Goal**: Create a single engine and contract that all SH6 agents use.

**Demo/Validation**:
- One agent runtime can execute multiple agent specs against the same normalized snapshot.
- Findings are ranked, deduplicated, provenance-aware, and actionable.

### Task 8.1: Agent Runtime
- **Location**: `app/agents/engine/`
- **Description**:
  - Build runtime for:
    - agent registration
    - dependency graph
    - finding ranking
    - provenance merging
    - stale/degraded data handling
- **Dependencies**: Sprint 0 contracts, Sprint 5 snapshot pipeline
- **Acceptance Criteria**:
  - Agents use one shared execution model.
- **Validation**:
  - Engine unit tests

### Task 8.2: Agent UI Surface
- **Location**: `app/ui/agents/`
- **Description**:
  - Add:
    - agent inbox / findings panel
    - ranked action cards
    - evidence drawers
    - direct jump actions
- **Dependencies**: Task 8.1
- **Acceptance Criteria**:
  - Agent findings feel native to the workflow, not bolted on.
- **Validation**:
  - Manual compare and session walkthrough

### Task 8.3: Agent Provenance And Trust Badges
- **Location**: `app/ui/agents/provenance.js`
- **Description**:
  - Every finding includes:
    - confidence
    - data freshness
    - official/unofficial status
    - impacted slots
    - impacted reports
- **Dependencies**: Task 8.1, Sprint 1 provenance
- **Acceptance Criteria**:
  - Users can judge whether to trust a suggestion.
- **Validation**:
  - Manual degraded-data scenarios

## Sprint 9: First-Wave Agents

**Goal**: Land the highest-value agents first.

**Demo/Validation**:
- SH6 can explain score deltas, missed multipliers, rate issues, rival gaps, and data hygiene risks with evidence and jump actions.

### Task 9.1: Score Auditor
- **Location**: `app/agents/implementations/score-auditor.js`
- **Dependencies**: Sprint 1, Sprint 8
- **Acceptance Criteria**:
  - Explains claimed vs computed differences line-by-line.
- **Validation**:
  - Fixture-based score discrepancy review

### Task 9.2: Multiplier Hunter
- **Location**: `app/agents/implementations/multiplier-hunter.js`
- **Dependencies**: Sprint 1, Sprint 8
- **Acceptance Criteria**:
  - Ranks missed multipliers by score impact and likelihood.
- **Validation**:
  - Manual sample sessions

### Task 9.3: Rate Coach
- **Location**: `app/agents/implementations/rate-coach.js`
- **Dependencies**: Sprint 2, Sprint 8
- **Acceptance Criteria**:
  - Highlights dead time, momentum drop, and strongest recovery windows.
- **Validation**:
  - Rate report cross-checks

### Task 9.4: Rival Scout
- **Location**: `app/agents/implementations/rival-scout.js`
- **Dependencies**: Sprint 2, Sprint 3, Sprint 8
- **Acceptance Criteria**:
  - Explains where nearby rivals outperformed the user and what to inspect next.
- **Validation**:
  - Competitor coach comparison walkthrough

### Task 9.5: Log Hygiene
- **Location**: `app/agents/implementations/log-hygiene.js`
- **Dependencies**: Sprint 1, Sprint 8
- **Acceptance Criteria**:
  - Flags busted calls, exchange anomalies, ambiguous duplicates, and suspicious metadata.
- **Validation**:
  - Malicious and malformed fixture logs

## Sprint 10: Second-Wave Agents

**Goal**: Expand from score/rival analysis into historical, propagation, and workflow guidance.

**Demo/Validation**:
- Historical, operational, and workflow agents can coexist in one prioritized queue.

### Task 10.1: Archive Miner
- **Location**: `app/agents/implementations/archive-miner.js`
- **Acceptance Criteria**:
  - Finds comparable historical logs and patterns by contest/callsign/category.

### Task 10.2: Propagation Analyst
- **Location**: `app/agents/implementations/propagation-analyst.js`
- **Acceptance Criteria**:
  - Correlates performance with spots, RBN, grayline, and prediction feeds.

### Task 10.3: Operating Style Analyst
- **Location**: `app/agents/implementations/operating-style-analyst.js`
- **Acceptance Criteria**:
  - Explains run vs S&P balance, transition timing, and style-driven outcomes.

### Task 10.4: Session Curator
- **Location**: `app/agents/implementations/session-curator.js`
- **Acceptance Criteria**:
  - Builds recommended perspectives and investigation paths automatically.

### Task 10.5: Rules Interpreter
- **Location**: `app/agents/implementations/rules-interpreter.js`
- **Acceptance Criteria**:
  - Converts scoring rules and assumptions into plain-language explanations.

### Task 10.6: Data Provenance Agent
- **Location**: `app/agents/implementations/data-provenance-agent.js`
- **Acceptance Criteria**:
  - Warns when a finding depends on unofficial, stale, degraded, or heuristic data.

## Sprint 11: Debrief And Publishing Agents

**Goal**: Turn SH6 from an analysis environment into a debrief system.

**Demo/Validation**:
- Users can build a postmortem from findings and export it with evidence.

### Task 11.1: Postmortem Writer
- **Location**: `app/agents/implementations/postmortem-writer.js`
- **Acceptance Criteria**:
  - Generates structured debrief drafts from agent findings and saved perspectives.

### Task 11.2: Debrief Notebook Integration
- **Location**: `app/ui/session/debrief-notebook.js`
- **Acceptance Criteria**:
  - Users can pin charts, findings, notes, and exports into one postmortem flow.

## Agent Specifications

### Shared Agent Contract

Every agent consumes:

- `AnalysisSnapshot`
  - loaded slots
  - normalized QSO indexes
  - scoring results
  - compare workspace state
  - saved perspectives
  - external enrichments
  - provenance records

Every agent emits:

- `AgentFinding`
  - `agentId`
  - `title`
  - `summary`
  - `severity`
  - `priority`
  - `confidence`
  - `impact`
  - `affectedSlots[]`
  - `evidence[]`
  - `actions[]`
  - `sources[]`
  - `staleness`
  - `requiresOfficialData`

Every `Action` must support one of:

- jump to report
- apply compare focus
- lock time range
- load rival log
- create perspective
- open evidence table
- pin to debrief

### Agent Specs

| Agent | Core Question | Required Inputs | Primary Outputs | UI Surface | Validation |
| --- | --- | --- | --- | --- | --- |
| Score Auditor | Why does claimed differ from computed? | `ScoringResult`, per-QSO scoring details, rule provenance | discrepancy findings, assumptions, disputed QSOs | Main, compare strip, evidence drawer | scoring fixtures |
| Multiplier Hunter | Which missed mults matter most? | scored QSOs, dupes, multiplier rules, spots/history | ranked missed mult actions | coach panel, compare workspace | sample sessions |
| Rate Coach | Where did rate collapse or momentum change? | time-series, breaks, compare state | dead time, recovery windows, rate actions | rates, compare strip | rate report cross-check |
| Rival Scout | Where did rivals beat me? | compare slots, archive rival loads, scoring mode | rival gap actions, report jumps | competitor coach, compare strip | rival walkthrough |
| Log Hygiene | What in this log is risky or suspicious? | dupes, possible errors, not-in-master, exchange parser | anomaly findings, cleanup actions | hygiene panel | malformed fixtures |
| Archive Miner | What do historical logs reveal? | archive index, historical sessions, contest meta | comparable logs, trend findings | archive panel, coach | archive query tests |
| Propagation Analyst | What role did propagation and spotting play? | spots, RBN, grayline/prediction inputs | explanation findings, opportunity gaps | spots/RBN workspace | correlated sample review |
| Operating Style Analyst | How did run vs S&P behavior affect outcome? | rate windows, frequency behavior, QSO sequence | style classification, change suggestions | compare workspace | sample sessions |
| Session Curator | What should I inspect next? | current findings, perspectives, open reports | saved paths, recommended views | session/perspectives | session roundtrip |
| Postmortem Writer | How do I summarize this contest? | pinned findings, perspectives, evidence | debrief draft | debrief notebook | manual debrief review |
| Rules Interpreter | What do these contest rules mean here? | rule provenance, scoring assumptions | plain-language explanations | scoring drawers | fixture cross-check |
| Data Provenance Agent | Should I trust this finding? | all provenance records, freshness, official/unofficial flags | trust warnings and caveats | every finding card | degraded-data scenarios |

## Testing Strategy

- Keep existing browser smoke coverage running during every sprint.
- Add a new scoring fixture suite before touching scoring behavior.
- Add worker contract tests before moving logic off the main thread.
- Add persistence roundtrip tests for sessions, perspectives, and caches.
- Add large-log performance regression checks with budget targets.
- Add malicious-input tests for session import, permalink state, archive metadata, and external enrichment payloads.

## Performance Budgets

- Parse 10k QSOs without blocking input for more than 50 ms chunks.
- Derive/scoring should run asynchronously and stream progress.
- Report switch median under 50 ms after data is ready.
- No full report container replacement for high-frequency interactions.
- Large table scroll should remain smooth with virtualization.

## Risks And Gotchas

- The scope is too large for a single uninterrupted coding push. NTv5.4 should be delivered in multiple reviewable slices.
- Native ES modules and module workers are the preferred path, but deployment/browser support expectations must be confirmed before removing compatibility shims.
- IndexedDB plus OPFS adds real complexity; the persistence model must be explicitly versioned.
- Agent quality will be poor if provenance and scoring correctness are not finished first.
- Compare workspace V2 can easily become visually noisy if cross-highlighting and insights are not tightly prioritized.
- The existing iframe deployment split between `s53m.com` and GitHub Pages should be revisited before security hardening lands.

## Rollback Plan

- Keep each sprint committable and reversible.
- Preserve the legacy `main.js` bridge until report parity is proven.
- Feature-flag:
  - Compare Workspace V2
  - new storage layer
  - worker-first pipeline
  - agent surfaces
- Maintain export/session backward compatibility until migration scripts are stable.

## Readiness

We are ready to start **Sprint 1 immediately**.

Before starting the deepest parts of Sprints 4-7, three decisions should be confirmed:

1. Deployment model:
   - Keep the `s53m.com` iframe wrapper, or move the actual app to one controlled origin?
2. Module strategy:
   - Native ES modules only, or add a bundling step?
3. Privacy policy:
   - Remove analytics entirely, or keep only coarse non-identifying telemetry?

Those are not blockers for the trust fixes, but they do affect the longer refactor path.
