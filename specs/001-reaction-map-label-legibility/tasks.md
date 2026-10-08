---
description: "Task list for Feature 001: reaction-map SVG label legibility"
---

# Tasks: Reaction-Map SVG Label Legibility

**Input**: design documents in `specs/001-reaction-map-label-legibility/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, and
architecture-delta.yaml (**APPROVE**, Gate 2A, 2026-10-08) ✅

**Tests**: required (constitution Principle III). Each behaviour task is preceded
by the test that verifies it.

**Organization**: grouped by user story. US1 and US2 share one test file and one
source file (`editor/ImageExport.js`), so their tasks run sequentially, not [P].

**Terminology**: "knockout rect" means the unconditional 3.0.3 rect being removed;
"patch" means the new contrast-fallback rect (spec FR-004/005).

**Narrowest suite**: `node tests/test_v3_1_0_reaction_map_legibility.js`
(abbreviated **NS** below).

## Phase 1: Setup (fixtures and baseline)

- [X] T001 Obtain the three pilot reactions (GDA1_HPRNStlr, GGH_10FTHF7GLUl,
  CE2872DIOer) as **heavy-atom** reaction SMILES. The source, chosen by the user
  at Gate 2 (2026-10-08), is
  `/media/JACK/repos/ctf/rxns/moiety_rxns/atomMapped_std/{id}.rxn` (atom-mapped
  MDL RXN). Convert them to reaction SMILES that keep the `:n` map numbers, using
  BIME's own MOL/RXN reading if it can run headless, otherwise an existing tool the
  user confirms. No new dependency enters the repository; the conversion is a
  one-off fixture step. Strip explicit H to match the pilot's "heavy" figures.
  Record the conversion method in the receipt. Write the result to
  `tests/data/reaction_map_pilot.json` as
  `{ "reactions": [ { "id", "smiles" } ], "baseline": {} }`. Add one small
  explicit-H reaction with a stereocentre bearing an explicit `[H]` (for example
  `[C@@H](...)` written as `[C@@]([H])(...)`) with `"explicitH": true`, for US3.
- [X] T002 Create `tests/test_v3_1_0_reaction_map_legibility.js` with the
  Apache-2.0 licence header and the same module loading as
  `tests/test_v2_4_13_reaction_map_svg.js`. Add measurement helpers that parse the
  output SVG: text boxes (width via the Node `measureText` rule
  `len × size × 0.6`, height = font size, from `x`/`y`/`text-anchor`), bond
  `<line>` segments with stroke width, and halo `<circle>` discs. Add overlap
  counters matching SC-002's definition (positive-area box∩box; box∩segment
  inflated by half the stroke width), excluding atom pairs closer than
  0.3 × bond length.
- [X] T003 Register the suite in `tests/test-manifest.js` after
  `test_v3_0_3_browser_export_stamp.js`.
- [X] T004 **Baseline (before any behaviour change)**: with
  `editor/ImageExport.js` still at 3.0.3, run the T002 counters on each pilot and
  write `baseline.{id}.{mapMap, mapLabel, mapBond, knockoutRects}` into
  `tests/data/reaction_map_pilot.json`. Commit-ready fixture (routes CHK015).
  In the same session, record the median of 5 `toReactionMapSVG` render times per
  pilot (mapping excluded) in the receipt notes, not in the fixture, because the
  numbers are machine-specific. This is the SC-008 baseline.
  Also, before any source edit, record the SHA-256 of the `toSVG`,
  `toPublicationSVG` and `toPrintSVG` output for phenol, pyridine and chlorobenzene
  under `pinnedSingleMolecule` in the fixture. These are the FR-018 pins, captured
  from untouched 3.0.3 code (analyze F2).

**Checkpoint**: NS runs and reports the baseline. No source is changed yet.

---

## Phase 2: Foundational (gating and pure helpers)

- [X] T005 Write the NS unit tests for the pure helpers via
  `ImageExport._legibility`. Cases: `parseColor` (`#rgb`, `#rrggbb`, `rgb()`);
  `luminance`/`contrast` (#000 vs #fff = 21, an identical pair = 1);
  `composite('#a5d8d2', 0.85, '#ffffff')`; and for `remedyColour`, the hue and
  saturation unchanged, the result ≥ threshold, and `null` (meaning a patch) when
  unreachable. Expected to FAIL until T006.
- [X] T006 Implement those pure helpers inside the IIFE in `editor/ImageExport.js`
  (research D3, D4). Expose them as `ImageExport._legibility` (frozen object).
  No change to any render path yet.
- [X] T007 Add a regression test to NS that asserts the `toSVG`,
  `toPublicationSVG` and `toPrintSVG` output hashes equal the
  `pinnedSingleMolecule` hashes captured in T004 (FR-018, pinned interface).
- [X] T008 In `editor/ImageExport.js`: `toReactionMapSVG` sets
  `opts.legibleLabels = true` and passes through `options.minContrast`
  (default 3). `_buildSVGImpl` reads both and does nothing else with them yet.
  T007 must still pass.

**Checkpoint**: helpers tested, gate wired, single-molecule output unchanged.

---

## Phase 3: User Story 1 — labels without unnecessary white boxes (P1) 🎯 MVP

**Goal**: no knockout rect where contrast already passes. Low-contrast text is
recoloured within its hue, with a tight patch as the fallback.
**Independent test**: NS "US1" block on the three pilots, plus synthetic cases.

- [X] T009 [US1] NS tests (expected to FAIL first). On each pilot:
  - every atom text item (symbol, H label, charge, isotope, map number) meets
    `contrast(drawColour, lowestFill) ≥ 3` (SC-001);
  - zero knockout rects behind text whose original colour already passes (SC-004).
  Synthetic cases:
  - (a) an O on a teal halo gets no rect;
  - (b) a forced-failing case via `minContrast: 10` recolours with the same hue;
  - (c) an unreachable case via `minContrast: 21` emits a `<rect rx="2">` patch
    sized to the text;
  - (d) `background: 'transparent'` evaluates against white.

  Also run both palettes: publication (default) and `publication: false`.
- [X] T010 [US1] In the `legibleLabels` branch of `_buildSVGImpl`
  (`editor/ImageExport.js`): build a TextItem for each label, H label, charge and
  isotope; compute the effective fill from the intersecting halo discs (D3); apply
  the remedy (D4). Emit a patch only for the fallback, never the unconditional
  `haloFill` rect. Leave the existing bond trimming (`labelRadius`) intact
  (FR-006).
- [X] T011 [US1] Apply the same contrast rule to map-number text colour
  (`#0d9488`) at its current, still-fixed position, so that US1 is complete
  independently of US2.
- [X] T012 [US1] Run NS, `node tests/test_v2_4_13_reaction_map_svg.js`,
  `node tests/test_v2_4_14_compound_labels.js` and
  `node tests/test_v2_4_7_publication_export.js`. Update **only** the assertions
  that pin the old knockout rects on the **reaction-map** path, and record each
  updated assertion in the receipt.

**Checkpoint**: US1 is shippable alone.

---

## Phase 4: User Story 2 — map numbers that don't collide (P1)

**Goal**: collision-scored placement of map numbers (D5).
**Independent test**: NS "US2" block.

- [X] T013 [US2] NS tests (expected to FAIL first). On each pilot:
  *(Criteria amended 2026-10-08 at the slice-2 stop-and-report: SC-002, SC-003 and
  FR-010 are judged on uncrowded atoms, i.e. no other atom within 0.6·BL. The
  baseline gained `mapMapU`, `mapLabelU`, `mapBondU` and `crowdedMaps`, recorded
  from 3.0.3.)*
  - map/map = 0 and map/label = 0 (SC-002);
  - map/bond ≤ floor(25% of `baseline.mapBond`), so a zero baseline must stay
    zero (SC-003, analyze F5);
  - each number's centre is nearer its own atom than any other atom (FR-010);
  - font size ≥ 75% of standard (FR-010);
  - two renders are byte-identical once the stamp metadata is stripped (SC-005).

  Synthetic cases: two adjacent mapped atoms; an atom with a bond straight down
  (the number must not sit on it); and `showMapNumbers: false` emits no map numbers
  (FR-011).
- [X] T014 [US2] Implement `placeMapNumbers` in `editor/ImageExport.js`
  (`_legibility`) following D5: candidate order from the free side, rings at d0,
  1.4·d0 and 1.8·d0, then 90% and 75% font; the weighted score; greedy order by
  crowding then atom id; the own-atom-nearest filter; and a `forced` flag. Add NS
  unit tests for scoring and tie-breaks.
- [X] T015 [US2] Wire it into the `legibleLabels` branch: collect obstacles
  (all TextItems from T010, bond segments as drawn after trimming, other atoms'
  halos, reaction-centre rings). Place every map number before emitting any map
  text, then emit each with the T011 contrast rule applied at its **final**
  position.
- [X] T016 [US2] Measure SC-008 on the same machine and in the same session as
  T004: the median of 5 `toReactionMapSVG` calls per pilot, mapping excluded,
  compared against the T004 timings. Report the ratio in the receipt. It must be
  ≤ 2. If it fails, optimise the obstacle lookup (spatial bucketing) before
  continuing. This is a manual measurement, not an automated assertion, because
  the automated suite must stay machine-independent. No option that restores 3.0.3
  rendering is added (FR-018).
- [X] T017 [US2] Re-run the T012 suites. The only differences allowed are in
  reaction-map map-number positions and colours.

**Checkpoint**: US1 and US2 together resolve problems 1 and 2.

---

## Phase 5: User Story 3 — heavy-atom figures built in (P2)

**Goal**: `Molecule.prototype.removeExplicitHydrogens()` and `aam --heavy-atoms`
(D7, contracts/api.md, contracts/cli.md).
**Independent test**: NS "US3" block. This phase is independent of US1 and US2
and touches different files.

- [X] T018 [P] [US3] NS tests (expected to FAIL first):
  - `CC[H]`-style removal increments a bracket neighbour's count, and an auto
    neighbour stays at `-1`;
  - isotopic `[2H]` is kept; `[H][H]` is kept; `[H+]` is kept; an H with two
    neighbours is kept;
  - a stereocentre with explicit `[H]` at each neighbour position k = 0…3 gives
    CIP R/S equal to the same molecule written with implicit `[C@@H]` (FR-014);
  - surviving ids are unchanged;
  - a return count is given.
- [X] T019 [P] [US3] Implement `Molecule.prototype.removeExplicitHydrogens` in
  `editor/Molecule.js` per contracts/api.md, using the existing `removeAtom` and
  `getNeighbors`.
- [X] T020 [US3] NS CLI tests that run `tools/bime-cli.js` via `child_process`:
  - `aam <explicit-H fixture> --heavy-atoms --format svg` equals
    `aam <same with H pre-removed> --format svg` with stamps stripped (SC-007);
  - `--heavy-atoms --format json` mapping contains no H ids;
  - `--heavy-atoms --format text` succeeds and its mapped-atom count excludes H
    (analyze F4);
  - `--heavy-atoms --keep-mapping` works;
  - without the flag, output equals the 3.0.3-path output (FR-015).
- [X] T021 [US3] In `tools/bime-cli.js` `cmdAam`: after a successful parse, call
  `rxn.removeExplicitHydrogens()` when `args.flags['heavy-atoms']`, before
  `resultFromExistingMapping` / `RDT.mapReaction`. Add the help line from
  contracts/cli.md to the `aam` entry in `HELP_BY_CMD`.

**Checkpoint**: all three stories done.

---

## Phase 6: Polish and closeout

- [X] T022 Run the quickstart.md steps 1–3. Run step 4 (visual) on all three
  pilots, writing to the scratchpad. Attach the before/after PNGs to the receipt
  by path.
- [X] T023 Run `node tools/run-tests.js > <log>` and report the exact pass/fail
  counts. `release-check` is not required, because `dist/` is unchanged (plan).
- [X] T024 [P] Add a `## [Unreleased]` entry to `CHANGELOG.md`: Added
  (`--heavy-atoms`, `Molecule.removeExplicitHydrogens`) and Changed (legible
  labels and map numbers in mapped-reaction SVG).
- [X] T025 [P] Document `--heavy-atoms` in `CLI.md` next to the other `aam` flags.
- [X] T026 Write the implementation receipt at
  `specs/001-reaction-map-label-legibility/agent-runs/<UTC>-label-legibility/implementation-receipt.md`
  (Prompt, Final response, Diff summary, Tests, Unresolved issues) and point
  `human-loop.md` at it.

---

## Dependencies and Execution Order

- T001 → T002 → T003 → T004 (the baseline needs the fixture and the counters).
- Phase 2 depends on Phase 1. T005 → T006; T007 → T008.
- US1 (T009–T012) depends on Phase 2.
- US2 (T013–T017) depends on US1 (same file, and it reuses T010's TextItems and
  T011's colour rule).
- US3 (T018–T021) depends only on T002/T003 (the test file). It can run alongside
  Phases 2–4, but T018 and T020 edit the shared NS file, so test edits to that file
  must be serialised.
- Phase 6 depends on all stories in the approved scope.

## Parallel Opportunities

- T018 + T019 [P]: test block vs `editor/Molecule.js`, which are different files.
- T024 + T025 [P]: CHANGELOG.md vs CLI.md.
- US3 as a whole can proceed in parallel with US1/US2 (`Molecule.js` and
  `bime-cli.js` vs `ImageExport.js`).

## Implementation Strategy

1. **MVP = Phase 1 + 2 + US1**. This removes the white boxes (the most visible
   defect). Validate on the pilots.
2. Add US2 (map-number placement). Validate SC-002, SC-003 and SC-008.
3. Add US3 (heavy atoms). Validate SC-007.
4. Closeout (Phase 6).

Each checkpoint can be approved as a separate slice at Gate 2.
