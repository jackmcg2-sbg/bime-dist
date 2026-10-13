---
description: "Task list for Feature 002: reaction-figure layout quality"
---

# Tasks: Reaction-Figure Layout Quality

**Input**: design documents in `specs/002-reaction-layout-overlaps/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/,
quickstart.md, and architecture-delta.yaml (**APPROVE_WITH_ADR**, Gate 2A,
2026-10-08; ADR-0001 written) ✅

**Tests**: required (constitution Principle III). Each behaviour task follows the
test that verifies it, and that test must fail first.

**Organization**: grouped by user story. US1 has two parts:
- US1a, module parity;
- US1b, wedges.

They ship in one slice, because parity without the wedge fix would put inverted
wedges into CLI figures (plan, "Suggested slicing").

**Narrowest suite**: `node tests/test_v3_2_0_layout_quality.js` (abbreviated
**NS**). Feature 001's suite, `node tests/test_v3_1_0_reaction_map_legibility.js`,
is **F1**.

## Phase 1: Setup (fixture, benchmark, baseline) — before any behaviour change

- [X] T001 [P] (FR-015) Write `specs/002-reaction-layout-overlaps/fixture-gen/layout_corpus_build.py`
  (offline; needs RDKit from `.venv`). Inputs: the `atomMapped_std` directory.
  Output: `tests/data/layout_corpus.json`, following data-model.md.
  - **Sampling**: the exploration's rule (every 57th file, sorted; map numbers
    cleared; H removed by a SMILES round-trip; unique SMILES; drop molecules
    RDKit cannot sanitise). The result must reproduce
    `exploration/data/corpus_mols.tsv` (367 molecules).
  - **Per molecule**: RDKit reference metrics, plus RDKit CIP labels per
    stereocentre with `atomIndex` in SMILES order.
  - **`stereoSet`** (SC-002a): L-alanine, D-alanine, L-lactate, α-D-glucose,
    testosterone, cholesterol, and every specified stereocentre in the three
    pilots' heavy-atom SMILES (each pilot component as its own entry).
  - **`ezSet`** (SC-002): cis-2-butene, trans-2-butene, maleate, fumarate,
    oleate, elaidate.
  - **`provenance`** block (research R7).
  - Run it once and commit the JSON. Record the command in the receipt.
- [X] T002 [P] Write `tools/layout-bench.js` (contracts/cli.md; FR-016). Apache-2.0
  header.
  - Load the engine the same way `tools/bime-cli.js` `loadEditor()` does (call
    it, or mirror it through `tests/shim.js`), so it measures whatever module set
    the CLI has at that moment.
  - Lay out every fixture molecule in one process, in fixture order. Compute the
    reporting metric (data-model "Layout defect").
  - Print the per-bin table (now | baseline | RDKit). Flags: `--json`,
    `--no-repair` (sets `Layout.options.foldBackRepair = false`; harmless before
    the option exists), `--bin`, and `--write-baseline` (writes `baseline.perBin`).
- [X] T003 **Baseline (no editor/ or loader change yet)**. Each step writes or
  records one of these (also capture `bime help` and each `bime help <cmd>` to
  the receipt for the F1 check in T021):
  - `node tools/layout-bench.js --write-baseline` → `baseline.perBin`, plus
    `baseline.moduleSet = "cli-3.1-pre"`. Check it against exploration E10, which
    it must match within one molecule per bin.
  - Pilot metrics for the three pilot reaction figures (crossings, close pairs,
    severe clashes, with the measure.js definitions) → `baseline.pilots`.
  - Medians, recorded in `baseline.timing` and in the receipt (machine-specific):
    - median layout ms per bin, from 3 bench runs;
    - each pilot's end-to-end `bime aam … --format svg` time, as the median of 5
      fresh processes.
  - Quiet-machine `node tools/run-tests.js` total time → receipt (R10 baseline).
- [X] T004 Create `tests/test_v3_2_0_layout_quality.js` with the Apache-2.0
  header and shim loading. Add helpers, independent of the code under test:
  - the reporting metric (crossings, close pairs, severe clashes, abnormal bonds);
  - an E/Z side check;
  - a **stereo read-back** helper (research R5 b): wedge z plus 2D neighbour
    angles plus parse-order neighbours give `@`/`@@`; apply it to a copy, run
    `CIPStereo.assignRS`, and return R/S per atom;
  - a ring-geometry snapshot comparer (bond lengths and internal angles, 1%);
  - a child-process runner (fresh `node` per run) for determinism and parity checks.
- [X] T005 Register NS in `tests/test-manifest.js` after
  `test_v3_1_0_reaction_map_legibility.js`.

**Checkpoint**: the fixture and baseline are committed-ready, NS runs with helper
self-tests only, and no `editor/`, `tests/shim.js` or `tools/bime-cli.js` change
has been made.

## Phase 2: User Story 1 — correct stereochemistry in every figure (P1) 🎯 MVP

**Goal**: the CLI and tests run the browser's layout engine. Cis/trans is drawn
as specified, and wedges read back as the input's configuration.

**Independent test**: NS groups US1-a…f; quickstart scenarios 1–2.

### US1a — module parity

- [X] T006 [US1] Tests in NS. Each must fail on current code, except the
  invariant test, which needs T007:
  - **US1-a** — `ENGINE_FILES` ∪ `UI_FILES` = `FILES`, the two are disjoint, and
    `ENGINE_FILES` is in bundle order.
  - **US1-b** (SC-001) — two fresh processes give identical coordinates on the
    pilots plus a 40-molecule fixture subset (every 9th molecule). One process
    uses the CLI's `loadEditor()`; the other loads `ENGINE_FILES` directly.
  - **US1-c** (SC-002) — every `ezSet` entry, laid out through the CLI loader,
    is drawn with its expected cis/trans geometry. So is every fixture double
    bond with specified geometry.
  - **US1-d** (R9) — with the globals pre-populated and `SDG` missing,
    `loadEditor()` writes the one-line warning to stderr. With the full set,
    there is no warning and no reload.
- [X] T007 [US1] (FR-001, FR-002) `tools/editor-files.js`: export `UI_FILES` and `ENGINE_FILES`
  (data-model). `FILES` and `scriptTags` stay unchanged.
- [X] T008 [US1] (FR-001–FR-003) `tests/shim.js`: `loadAll()` also loads `ENGINE_FILES` in order.
  Keep the static-bundle short-circuit and idempotence (ADR-0001).
- [X] T009 [US1] (FR-005) `tools/bime-cli.js` `loadEditor()`: also require `SDG`,
  `SDGLayout`, `SMSDLayout` and `Templates` in the short-circuit test, and print
  the R9 warning when a static bundle lacks them.
- [X] T009a [US1] (FR-004; *added at the slice-2 stop-and-report, 2026-10-09*)
  Fix `editor/sdg/CorrectGeometricConfiguration.js` so a mis-drawn double bond is
  corrected by reflecting the **whole** smaller end: every substituent of the
  pivot atom and their subtrees, not only the highest-priority branch. That way
  a carbon with two substituents never ends up with both on one side.
  Diagnose and fix the PHEPROARGr case (`[H]/N=C(/N)…` drawn E instead of Z),
  wherever it lies. Add regression tests to NS:
  - **US1-c2**: `C/C(=C/CC)CO` and `C/C(=C\CC)CO`, both ends correct with their
    substituents on opposite sides;
  - **US1-c3**: the two corpus molecules by name.
  Write the tests first and confirm they fail.
- [X] T010 [US1] Run NS (US1-a…d pass), then F1, then `node tools/run-tests.js`.
  Research R1 expects no re-pin. Any re-pin is listed with its cause (FR-019).

### US1b — wedges from geometry

- [X] T011 [US1] Tests in NS. They must fail on current code:
  - **US1-e** (SC-002a) — every `stereoSet` centre and every fixture centre reads
    back (T004 helper) with its RDKit CIP label. Today 30 of 58 fixture centres do.
  - **US1-f** — every drawn wedge or hash starts at a stereocentre, and no
    stereocentre with a specified configuration is left without one, unless
    `NonplanarBonds` already finds no eligible bond today. Those cases are
    listed, not failed.
- [X] T012 [US1] (FR-004a) `editor/sdg/NonplanarBonds.js` `assignTetrahedral`: keep the
  bond choice. Choose wedge or hash from 2D geometry and the centre's `@`/`@@`
  over its neighbours in parse order, with an implicit H in its SMILES slot
  (research R5). Remove the label fallback (`'@' → S`).
- [X] T013 [US1] `editor/Layout.js`: move Step 16b (`NonplanarBonds.assign`) to
  the end of Step 16, after 16f (research R2). Update the step comments.
- [X] T014 [US1] Run NS (US1-a…f), F1, and `node tools/run-tests.js`. List any
  re-pins (FR-019). Write the slice receipt.

**Checkpoint**: US1 is complete. CLI figures draw correct cis/trans and correct
wedges, and they match the browser.

## Phase 3: User Story 2 — large molecules without folded-back chains (P1)

**Goal**: the fold-back repair (Step 16R) removes crossings and close pairs
without touching ring geometry or stereo.

**Independent test**: NS groups US2-a…h; quickstart scenarios 3–5.

- [X] T015 [US2] Tests in NS. They must fail on current code, except US2-d,
  US2-e and US2-g, which guard against regressions:
  - **US2-a** (SC-003) — corpus per-bin thresholds against `baseline`:
    - 31–50 atoms: ≤15% of molecules with crossings;
    - 51–80 atoms: ≤35%, and mean crossings ≤1.0;
    - total crossings −85%.
    On failure, name the 10 worst molecules.
  - **US2-b** (SC-004) — for each molecule, crossings, close pairs and severe
    clashes are each ≤ the same molecule's values with
    `Layout.options.foldBackRepair = false`.
  - **US2-c** (SC-005) — pilot figure crossings fall ≥75% against
    `baseline.pilots`, with 0 severe clashes.
  - **US2-d** (SC-006, FR-007) — ring bond lengths and internal angles match
    within 1% with and without repair, on every fixture molecule with a ring.
  - **US2-e** (FR-008) — `ezSet`, plus fixture double bonds with specified
    geometry, keep their geometry with the repair on. US1-e still passes.
  - **US2-f** (FR-011) — a molecule with no defects without repair (for example
    phenol, ibuprofen, glucose) gets byte-identical coordinates with the repair on.
  - **US2-g** (SC-007, FR-014) — two fresh child processes rendering each pilot
    figure produce byte-identical SVG, with the stamp excluded.
  - **US2-h** (FR-010) — no bond outside 0.65–1.25 × BL is introduced by the
    repair on any fixture molecule.
  - **US2-i** (FR-012; *analyze F3*) — a synthetic branched component of 320
    heavy atoms lays out with the repair skipped. A 120-atom fixture-like
    molecule finishes with the internal evaluation counter ≤ 50,000 (exposed
    read-only for tests, for example `Layout._lastRepairStats`).
- [X] T016 [US2] `editor/Layout.js`: add the internal option
  `Layout.options.foldBackRepair` (default `true`; undocumented; FR-012a).
  Comment it as measurement-only.
- [X] T017 [US2] (FR-006, FR-009, FR-012, FR-013) `editor/Layout.js`: implement the repair as private functions,
  run as Step 16R after 16a and before 16c (research R2, R3, R4, R6):
  - pivot and subtree discovery;
  - reflect, stretch and rotate moves;
  - incremental moved-vs-fixed scoring;
  - greedy steepest descent with first-wins ties;
  - escape (K = 8, at most 8 times);
  - budget (60 iterations, 50,000 evaluations, skip above 300 atoms);
  - the E/Z guard on each move;
  - a final `LayoutQuality` keep-if-not-worse guard. *(analyze F4)* The guard
    also requires each reporting metric (crossings, close pairs, severe clashes)
    to be ≤ its pre-repair value; otherwise it restores the original.
  It is deterministic: no `Math.random`, no clock in decisions.
- [X] T017a [US2] (*added at the slice-3 stop-and-report, 2026-10-09*) Two fixes:
  - (a) US2-c is checked against the spec's SC-005: the **total** pilot
    crossings fall ≥75%, plus no severe clash per pilot. The test had asked for
    −75% per pilot.
  - (b) `editor/sdg/CorrectGeometricConfiguration.js` `_normaliseEnd`: a
    specified double bond *in a ring* whose end has one exocyclic substituent
    that isn't fanned (e.g. AM1CCSitr atom 49) gets that exocyclic subtree
    rotated rigidly to the open side, opposite the sum of the ring-neighbour
    and partner directions.
  US2-e must then pass in the full-corpus process order.
  *Outcome (2026-10-09):* (b) is impossible for AM1CCSitr without macrocycle re-layout. Per the maintainer's "Known exception" decision, US1-c3/US2-e/checkDoubleBond treat a cramped end on a double bond whose ring contains both atoms and ≥8 atoms as a listed exception (the relation is still checked), and T024 records it in docs/known-defects.md.
- [X] T018 [US2] Run NS. If US2-a misses a threshold, or quickstart 5 shows the
  SC-009 time over budget, apply only the research R6 levers, in order. If that
  still fails, **stop and report**. Do not change thresholds or widen scope
  without a human decision.
- [X] T019 [US2] Run NS, F1 (FR-020: Feature 001's SC-001, SC-002 and SC-004
  outcomes still hold on the pilots), then `node tools/run-tests.js`. List every
  re-pin with its cause (FR-019). Write the slice receipt.

**Checkpoint**: US2 is complete. Pilot and corpus figures are repaired.

## Phase 4: User Story 3 — benchmark and guard (P2)

US3 is delivered by T001–T005 (fixture, benchmark, baseline, guard skeleton) and
by NS groups US2-a and US2-b (thresholds and the no-worse guard). One task remains:

- [X] T020 [US3] Quickstart scenario 3: run `tools/layout-bench.js` with and
  without `--no-repair`. Paste both tables into the receipt and confirm they
  match NS's assertions.

## Phase 5: Polish and closeout

- [X] T021 Quickstart scenarios 0–6 end to end:
  - SC-009 times against `baseline.timing` (median per bin ≤3×; pilots ≤1.5×,
    median of 5, fresh processes);
  - full-suite time ≤1.3× the T003 time, and NS ≤120 s (R10);
  - *(analyze F1, FR-018)*: `bime help` and `bime help <cmd>` output is identical
    to the T003 capture, and no new `require` in the changed or new files reaches
    outside `editor/`, `tools/`, `tests/` or Node built-ins.
- [X] T022 Visual check: render the three pilots to PNG, before (Feature 001)
  and after, under `bime_pilot/compare/`. Check by eye that the cores are open,
  molecules stay wider than tall, and labels and map numbers are clean.
  *(analyze F2, FR-013)*: open `workbench.html` in a browser, load one pilot
  component's SMILES, run Clean, and confirm the drawing matches the CLI
  layout. Coordinates are equal under the same module set; record any
  difference as a finding.
- [X] T023 `CHANGELOG.md` `[Unreleased]`:
  - **Fixed**: cis double bonds drawn trans from the CLI; inverted wedges.
  - **Changed**: fold-back repair in 2D layout; Node loads the engine module set
    (ADR-0001).
  Add one line to `CLI.md` noting that CLI layout now matches the browser.
- [X] T021a (*added at the closeout stop-and-report, 2026-10-09*) Speed up the
  NS test (test-only; same assertions). Run the corpus on/off child runs in
  parallel, and remove duplicated fresh-process layouts (US1-b, US1-c and US2-g
  reuse shared child output where possible). Target: NS ≤120 s and the full
  suite ≤1.3× the T003 time (R10), on a quiet machine. Then re-run the T021
  timing for the suite.
- [X] T024 Final closeout receipt (constitution ledger). Update
  `human-loop.md` pointers. Re-check `docs/known-defects.md`: history-dependence
  remains, and nothing about wedges needs recording, since they are fixed.

## Dependencies and order

- Phase 1 comes first. T001 ∥ T002, then T003 (needs both), then T004, then T005.
  T003 must precede any change to `editor/`, `tests/shim.js` or
  `tools/bime-cli.js`.
- Phase 2: T006 → T007 → T008 → T009 → T010, then T011 → T012 → T013 → T014.
- Phase 3 needs Phase 2, because the repair is measured with the parity engine:
  T015 → T016 → T017 → T018 → T019.
- Phase 4 (T020) needs Phase 3. Phase 5 needs all of them.
- Parallel: only T001 ∥ T002. Every later task touches NS or `Layout.js`.

## Proposed slices (Gate 2)

1. **Slice 1**: T001–T005 (setup and baseline; no behaviour change).
2. **Slice 2**: T006–T014 (US1, MVP: parity and wedges together).
3. **Slice 3**: T015–T020 (US2 repair and US3 report).
4. **Slice 4**: T021–T024 (closeout).
