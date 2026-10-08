# Implementation Receipt — Feature 001, closeout slice (T022–T026)

## Prompt
`/speckit-implement` (no arguments). The approved scope at Gate 3 (2026-10-08) was
"Approve closeout T022–T026".

## Final response
Feature A is complete: all 26 tasks are done, and the closeout checks pass.

- Docs: a CHANGELOG `[Unreleased]` entry (Added: `--heavy-atoms`; Changed: legible
  mapped-reaction figures), and `CLI.md` documents `--heavy-atoms` with a working
  example (checked: it maps and renders).
- Final full `node tools/run-tests.js`: 1678 passed, 0 failed, on a quiet machine.
  The earlier run had 1 failure in `test_substructure_extended.js` ("CCC in 50-atom
  alkane < 100ms": 119 ms). That run overlapped image rendering, and the test is
  flaky on this machine. Timed directly, the operation is not slower: median 16.4 ms
  now vs 25.8 ms on 3.0.3. The test does not load the changed rendering code.
- Visual check: before/after images of all three pilots against `bime_pilot/*_heavy.svg`
  show no white boxes and map numbers clear of each other in uncrowded regions.
  Folded regions remain crowded (Feature B).
- Architecture: the observed change matches the approved delta. No pinned path
  changed, and no new module or dependency edge was added.

Next: Bundle 4 knowledge promotion and the final Gate 3.

## Diff summary
- `CHANGELOG.md`: a new `## [Unreleased]` section with Added and Changed entries.
- `CLI.md`: a paragraph on contrast-aware labels and map-number placement, a
  `--heavy-atoms` example, and a flag-table row.
- No source change in this slice.

## Tests
| Run | Result |
|---|---|
| Quickstart 1: `node tests/test_v3_1_0_reaction_map_legibility.js` | 35/0 (slice 3; no source change since) |
| Quickstart 2: affected suites (4_13, 4_14, 4_7, 4_17, 3_0_3) | all pass (slices 2–3; no source change since) |
| Quickstart 3 / T023: `node tools/run-tests.js` with concurrent rendering | 1677 passed, 1 failed (`test_substructure_extended` timing, 119 ms) |
| `node tests/test_substructure_extended.js` × 5, original 3.0.3 sources vs current | 5/5 vs 4/5 pass (1 at 106 ms). The test does not load `ImageExport.js`; its only difference is an unused method in `Molecule.js` |
| Direct timing of that operation, 30 runs | current median 16.4 ms (p90 35.3); 3.0.3 median 25.8 ms (p90 50.2) |
| `node tools/run-tests.js`, quiet machine (final) | **1678 passed, 0 failed** (646.8 s) |
| Quickstart 4 (visual) | `scratchpad/final/*_compare.png`, checked by eye |
| CLI.md example | `aam '[H]OC(=O)C.[H]OCC>>CC(=O)OCC.[H]O[H]' --heavy-atoms`: mapped, renders |
| `node tools/release-check.js` | not run; not required (`dist/` unchanged) |

## Unresolved issues
- `test_substructure_extended.js` "50-atom alkane < 100ms" is a pre-existing flaky
  wall-clock test (cold first call, `Date.now()`, fixed 100 ms). It fails under load
  on this machine. It is not caused by this feature (see the timing above).
- The test suite is slow: full runs took 355–947 s this session, against about
  150 s before the feature. The new suite alone takes about 136 s.
- Carried forward:
  - layout and mapping depend on process history (pre-existing);
  - layout-crowded atoms are excluded from SC-002 and SC-003 (Feature B);
  - browser rendering is unverified;
  - the auto-H chiral atom path is untested.
- The CHANGELOG entry is under `[Unreleased]`. No version bump or `dist/` rebuild,
  as planned: that belongs to a release.

## Other information
Before/after images: `scratchpad/final/{GDA1_HPRNStlr,GGH_10FTHF7GLUl,CE2872DIOer}_compare.png`
(top: original pilot from 3.0.3; bottom: now).
