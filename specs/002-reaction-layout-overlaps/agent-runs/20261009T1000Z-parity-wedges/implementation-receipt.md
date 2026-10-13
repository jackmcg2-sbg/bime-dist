# Implementation Receipt — Feature 002, slice 2 (T006–T014 + T009a: US1)

## Prompt
`/speckit-implement` (no arguments). The scope was approved at Gate 3
(2026-10-09) as "Approve Slice 2" and widened at the slice-2 stop-and-report
("Widen Slice 2 to fix it": T009a). An earlier partial run of this slice is
recorded in `../20261009T0900Z-parity-stop/`.

## Final response
Slice 2 (US1) is done.

- **Module parity.** Command-line figures now use the same layout engine as the
  browser.
- **Cis/trans.** Every specified double bond in the corpus is drawn correctly:
  282 of 282, up from 279 before this slice. Getting there needed a fix to
  BIME's cis/trans correction:
  - a mis-drawn bond is now corrected by flipping the whole end, not one branch;
  - an end the layout had flattened (two substituents on one side, or one in
    line with the double bond) is first restored to a 120° fan.
- **Wedges.** Wedge or hash now follows the drawing. All 80 stereocentres
  (corpus plus the named set) read back as their input. Before the fix, 40 of
  80 were inverted.
- **Tests.** The guard passes 14/0, Feature 001 passes 35/0, and the full suite
  passes **1692/0**.

Two findings:
- **Severe clashes from parity.** With parity on, the browser's existing layout
  passes leave 20 severe atom clashes among the 51–80-atom molecules. The
  baseline had none, and the browser does the same today. Slice 3's repair
  targets this; the prototype cleared them.
- **CIP labels.** BIME and RDKit give opposite R/S on the input for 3 centres
  (2 in a sterol ester, 1 in a phosphoinositide). The drawing itself is right;
  this is a CIP-ranking question for a later look.

Timings from this run aren't usable. The machine was running your RDT pipeline
(load average about 40 on 12 cores). SC-009 timing waits for a quiet machine
(T021).

Next: Gate 3, to approve Slice 3 (T015–T020: fold-back repair and the
benchmark report).

## Diff summary
- `tools/editor-files.js` (T007): `UI_FILES` (7) and `ENGINE_FILES` (42) exported.
- `tests/shim.js` (T008): `loadAll()` loads `ENGINE_FILES` in bundle order, in
  place of the hand-written subset.
- `tools/bime-cli.js` (T009): the static-bundle path warns on stderr when layout
  modules are missing.
- `editor/sdg/CorrectGeometricConfiguration.js` (T009a, +111):
  - reflects the whole smaller end (`_collectEnd`), and keeps the old
    top-priority-branch reflection when the double bond is in a ring;
  - adds `_normaliseEnd`: for a specified double bond, an end whose two
    substituents aren't fanned (same side, or within 30° of the bond line) is
    rotated rigidly into a 120° fan before the E/Z check.
- `editor/sdg/NonplanarBonds.js` (T012, +68):
  - wedge vs hash comes from `_wedgeSense`, the signed volume in the parser's
    frame (heavy neighbours in `getNeighbors()` order, implicit H last);
  - candidates are tried best-score first, and degenerate ones are skipped;
  - centres with no `@`/`@@` token get no wedge;
  - the label-only `'@' → S` fallback is removed;
  - a misleading comment is corrected: the stereocentre is the *narrow* end of
    the drawn wedge.
- `editor/Layout.js` (T013): Step 16b (`NonplanarBonds.assign`) moved to the end
  of Step 16, after 16f. The step comment is updated.
- `tests/test_v3_2_0_layout_quality.js`: US1-a…f, US1-c2 and US1-c3, plus the
  helpers `checkDoubleBond`, `stereoCases` and `hasBareStar`.

## Tests
| Run | Result |
|---|---|
| T009a fail-first | US1-c2 fails (`C/C(=C/CC)CO`: both substituents of atom 1 on one side); US1-c3 fails (VITEBTENALCt) |
| After T009a, first attempt (whole-end reflection) | US1-c2 passes; regression on a macrocyclic imine (`CCC1/N=C(/O)…`, ring bond); PHEPROARGr still wrong. Diagnosed: guanidine C at 176° (N1–C–N4) *before* Step 16a |
| After T009a (ring fallback and `_normaliseEnd`) | US1-c, c2, c3 pass: 282/282 corpus E/Z |
| Narrow suites after T009a | cis_trans_depiction 3/0; sdg_quality 6/0; layout 27/0; v1_5_2_layout 7/0; chromophore 10/0; stereo_golden 8/0; Feature 001 35/0 |
| T010 `node tools/run-tests.js` | 1690 passed, 0 failed (224 s). No re-pins |
| T011 fail-first | US1-e: 39/80 wrong |
| After T012 | 3/80. All three are CIP-labeller disagreements on the *input* (BIME vs RDKit), not drawing errors. US1-e restated (below) |
| After T013 | unchanged (3 labeller disagreements, now reported as info) |
| Mutation: old `NonplanarBonds.js` (restore verified with `cmp`) | US1-e fails: 40/80 centres drawn against their `@`/`@@` |
| NS final | **14 passed, 0 failed** |
| T014 Feature 001 / full suite | 35/0; **1692 passed, 0 failed** (796 s under load average 38–43; see `suite_t014.log`) |
| Bench 51–80, parity, no repair: new vs old `CorrectGeometricConfiguration` | identical: 86.5% with crossings, mean 11.92, **severe 20** both ways. The clashes come from parity, not T009a |
| `node tools/release-check.js` | not run; not required (`dist/` unchanged) |

## Unresolved issues
- **Severe clashes with parity** (20 in 51–80 atoms). These are existing browser
  behaviour, now visible in the CLI. Slice 3's repair must clear them
  (SC-004/SC-005).
- **CIP labeller disagreements on the input:** CRBS_PTCSA_TEOStlr #27 and #39,
  G3PI45DP_12OCTAtrr #35. RDKit (`rdCIPLabeler`) says S, BIME `CIPStereo` says R.
  Which is right hasn't been checked. Candidate for `docs/known-defects.md` at
  closeout (T024), as an "unverified disagreement".
- **US1-b is weaker than intended.** Both sides now load through the same shim,
  so it guards `loadEditor`'s extra requires only, not real browser-bundle
  parity. The `dist/` bundle is built from older source and can't be compared.
- **Timing unusable** in this run (load from the user's RDT pipeline). SC-009
  and R10 are deferred to T021 on a quiet machine.

## Other information
**Deviations.**
1. **US1-e restated.** The spec's "reads back with its input configuration" is
   checked two ways:
   - against the input's own `@`/`@@`, for every centre;
   - against the RDKit R/S label, wherever BIME's and RDKit's CIP labels on the
     input agree. Disagreements are listed as info.
   This is because CIP ranking is outside this feature, and a labeller
   disagreement is not a drawing error. The mutation check shows the test still
   catches the original defect.
2. **`_normaliseEnd` scope.** It goes beyond "reflect the whole end". It was
   needed to fix the PHEPROARGr case, as T009a required ("wherever it lies"),
   and stays inside `CorrectGeometricConfiguration.js`. It acts only on
   specified double bonds with a degenerate end.
3. **Architecture delta (V-B input).**
   - `editor/sdg/CorrectGeometricConfiguration.js` is now in the delta,
     approved at the stop-and-report.
   - `editor/Layout.js` received only the Step 16b move in this slice.
   - No new dependency edges.
