# Implementation Receipt — Feature 001, slice 2 (T013–T017, US2)

## Prompt
`/speckit-implement` (no arguments). The approved scope at Gate 3 (2026-10-08) was
"Continue: approve US2", i.e. T013–T017.

## Final response
Slice 2 (T013–T017) is implemented and verified. Map numbers now go to the
least-cluttered spot around their atom (16 directions, free side first, stepping out
and shrinking only when needed) instead of a fixed spot below it.

- Tests: new suite 27/27; affected suites 4_13, 4_14, 4_7, 4_17 and 3_0_3 all pass;
  full `node tools/run-tests.js` 1670 passed, 0 failed.
- Pilots, uncrowded atoms (3.0.3 → now): map/map 0/0/0 → 0/0/0; map/label 21/10/16
  → 0/0/0; map/bond 62/50/44 → 9/0/3; numbers nearer another atom 83+ → 0.
- All atoms, crowded included: map/label 70/28/45 → 0/0/0; map/bond 193/101/132 →
  59/0/29; map/map 9/0/1 → 11/0/6. Every residual overlap involves a layout-crowded
  atom (another atom within 0.6 bond lengths), which is Feature B.
- At the stop-and-report you chose to exclude crowded atoms. SC-002, SC-003 and
  FR-010 were amended, and the 3.0.3 baseline was re-recorded like-for-like (the
  original fields reproduced exactly).
- Render time in cold processes: 1.56× / 0.83× / 0.73× of 3.0.3 (budget 2×).
- Found, pre-existing in 3.0.3: layout and mapping depend on process history (the
  global atom-id counter), so the same SMILES can draw differently after other
  parses in one process.
- Cost: the new suite takes about 136 s standalone, and run-tests grew from about
  150 s to 542 s.

Next: Gate 3.

## Diff summary
`editor/ImageExport.js`, slice 2 only:
- module-level `_boxOverlap` and `_segInBox`, exposed in `_legibility`;
- halo discs carry an atom `id`;
- `legibleColour` records every atom-text box as an obstacle;
- `MAP_RINGS`, `mapQueue` and `placeMapNumbers()`: obstacles, free-side 16-direction
  ordering, rings, the score, the crowding order, and the forced fallback;
- on the legibility path, map numbers are queued during the atom loop, then placed
  and emitted after it in molecule order, with the contrast rule applied at the
  final position;
- the legacy path is unchanged (P1 pins pass).

`tests/test_v3_1_0_reaction_map_legibility.js`:
- crowding classification in `measure()` (`CROWDED` = 0.6) and uncrowded counters;
- pilots rendered in canonical order;
- new tests US2-0, US2-a…g;
- `--write-baseline` records the uncrowded fields.

`tests/data/reaction_map_pilot.json`: the baseline gained `mapMapU`, `mapLabelU`,
`mapBondU` and `crowdedMaps`, re-recorded on the 3.0.3 code. Existing fields and
pins are unchanged (verified).

Spec Kit artifacts (not source):
- spec.md: SC-002, SC-003, FR-010, the crowded-atoms edge case, and Clarifications;
- research.md: D5 amendment;
- tasks.md: T013 note and marks;
- human-loop.md.

## Tests
| Run | Result |
|---|---|
| `node tests/test_v3_1_0_reaction_map_legibility.js` | 27 passed, 0 failed (136 s) |
| Same suite against the 3.0.3 `ImageExport.js` (swap, restore verified with `cmp`) | 9 passed, 18 failed. US2-a: uncrowded map/label 21; US2-b: 62 > 15; US2-c: 83 nearer another atom |
| Re-baseline consistency (3.0.3) | the 7 original baseline fields × 3 pilots and the 9 pins are identical to the first recording |
| test_v2_4_13 / 4_14 / 4_7 / 4_17 / 3_0_3 | 10/0, 9/0, 11/0, 4/0, 6/0 |
| `node tools/run-tests.js` | 1670 passed, 0 failed (542.2 s) |
| `node tools/release-check.js` | not run; not required (`dist/` unchanged) |

SC-008, measured as the median of 3 cold processes per version (layout included, as
in the baseline): GDA1 10987 vs 7038 ms (1.56×), GGH 3315 vs 4017 (0.83×), CE2872
3672 vs 5026 (0.73×). *Method deviation from T016:* the same-process loop re-lays
out a different geometry each iteration because of the history-dependence, which
produced a spurious 3.3× for CE2872. Cold processes give identical layouts and a
fair comparison.

## Unresolved issues
- **Spec amendment (human decision at the stop-and-report):** layout-crowded atoms
  (another atom < 0.6·BL) are excluded from SC-002, SC-003 and FR-010. Residuals
  on all atoms remain visible: map/map 11/0/6 and map/bond 59/0/29. They depend on
  Feature B.
- **Pre-existing defect (3.0.3, not introduced here):** layout and mapping output
  depend on process history through the global atom-id counter. The suite renders
  the pilots in baseline order, but under `run-tests.js` the counts may drift
  slightly from the baseline. Worth a `docs/known-defects.md` entry at closeout
  (knowledge promotion).
- **Test cost:** the suite takes about 136 s standalone, and the full run grew from
  about 150 s to 542 s. A follow-up could cache renders across tests or use smaller
  fixtures for the synthetic checks.
- **Design changes during implementation (recorded in research D5):** 16 directions,
  a 0.75·d0 ring, and the margin-based forced fallback.
- Browser rendering is still unverified.

## Other information
After-images (session scratchpad): `scratchpad/after2/*.png`.
