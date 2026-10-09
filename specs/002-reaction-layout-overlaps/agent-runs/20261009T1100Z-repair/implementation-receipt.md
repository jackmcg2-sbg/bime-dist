# Implementation Receipt — Feature 002, slice 3 (partial: T015–T017, T020; stopped at T018/T019)

## Prompt
`/speckit-implement` (no arguments). The approved scope at Gate 3 (2026-10-09)
was "Approve Slice 3": T015–T020.

## Final response
Stop-and-report. The fold-back repair (Step 16R) is implemented, and it meets
the corpus targets:
- molecules with crossings: 51–80 atoms 29.7% (target ≤35%), 31–50 atoms 13.6%
  (target ≤15%);
- mean crossings at 51–80 atoms: 0.65 (target ≤1.0);
- total crossings: 1,201 → 106, −91% (target −85%);
- severe clashes: 0 (44 with parity alone).

The suite has two failures:
1. **US2-c, GGH pilot: 7 → 2 crossings** (target ≤1). Cutting the stretch move
   from 1.2 to 1.15 bond lengths, to keep the existing `test_layout.js` bound
   (≤1.2×), cost one pilot crossing. GDA1 48 → 11 and CE2872 25 → 1 pass.
2. **US2-e, AM1CCSitr.** A specified double bond inside the cyclosporin-like
   macrocycle has a collapsed end. It's the same with the repair off, so the
   repair didn't cause it. The fix belongs in
   `CorrectGeometricConfiguration.js`, which is outside Slice 3's files.

SC-009 timing can't be judged while the machine is loaded. Under load, the
repair roughly doubles the median layout time at 51–80 atoms.

## Diff summary
- `editor/Layout.js`:
  - `Layout.options.foldBackRepair` (internal) and `Layout._lastRepairStats`;
  - Step 16R `runFoldBackRepair` after 16a, and also when Step 16 is disabled;
  - `foldBackRepair`: pivots, reflect / stretch-to-1.15 BL / rotate (±30…180°)
    moves, incremental scoring, greedy steps with a K=8 escape, a budget (60
    iterations, 8 escapes, 50k evaluations, skip >300 atoms), an E/Z-signature
    guard, and a final guard (quality and every defect count no worse).
- `tests/test_v3_2_0_layout_quality.js`: US2-a…i, corpus on/off runs in fresh
  child processes (same history), and an `NS_ONLY` filter.

## Tests
| Run | Result |
|---|---|
| US2 fail-first (no repair) | a, c, i fail; e fails (pre-existing); b, d, f, g, h pass |
| In-process on/off comparison | confounded by layout history (HMR_0849 3→7 close pairs with no repair). Moved to two fresh children |
| First repair (stretch 1.2 BL) | US2 8/9 (only e failed); pilots 48→5, 7→1, 25→1; but `test_layout.js` clotrimazole and umeclidinium failed (max bond 36.0 > 1.2×) |
| Stretch 0.15 offset | clotrimazole fixed; umeclidinium 36.01 (pivot already about 1.05 BL) |
| Stretch to target 1.15 BL | `test_layout.js` 27/0; bench: 2.5% / 13.6% / 29.7% / 83.3% with crossings by bin; 106 crossings in total; severe 0 |
| `node tools/run-tests.js` (final) | **failed 2**: US2-c (GGH 7→2), US2-e (AM1CCSitr). Everything else passes; 501 s under load 9–15 |
| Feature 001 | 35/0 |

## Unresolved issues
- US2-c GGH pilot (2 > 1), and US2-e AM1CCSitr: a decision is needed.
- SC-009 timing: needs a quiet machine.

## Addendum — second run, 2026-10-09 (T017a)
- (a) Done. US2-c follows SC-005's total criterion: pilots 80 → 14 total (−82.5%),
  no severe clash. The test passes.
- (b) Diagnosis corrected. The AM1CCSitr end (atom 49) is fanned *before*
  Step 16a. The E/Z correction's ring fallback collapses it: it reflects only
  the exocyclic O across the axis. Both double-bond atoms and their other
  substituents are macrocycle ring atoms, and the drawn ring conformation
  contradicts the specified E. So either the relation is correct with a
  collapsed end (current), or the end is clean with the relation wrong. A
  correct drawing needs macrocycle re-layout that honours E/Z: ring placement,
  exploration option D, out of scope.
- Code added under T017a(b): `_normaliseEnd` now swings a single exocyclic
  substituent to the open side when an in-ring end is unfanned before
  correction. It doesn't trigger for AM1CCSitr; there's no corpus case for it
  yet.
- Stopped for a human decision. The marker is cleared.

## Addendum — third run, 2026-10-09 (T017a done; T018 stop-and-report)
- T017a done. US2-e lists AM1CCSitr under the macrocycle exception, with the
  relation checked. US1-c, c2, c3 and US2-e pass.
- SC-009 measured on a quieter machine (load 3–5, 3-run medians), as multiples
  of the baseline layout time:

| Variant | 31–50 %cross | 51–80 %cross | 51–80 time | 81+ time |
|---|---|---|---|---|
| full rotations, K=8 | 13.6 | 29.7 | 3.28× | 3.33× |
| lever 1 (reduced rotations everywhere) | **15.2 ✗** | 32.4 | 2.89× | 2.98× |
| lever 1 by size (>50 atoms), K=8 (**current**) | 13.6 | 32.4 | 2.89–3.48× (load-dependent) | 2.98–3.59× |
| + lever 2 (K=4) | 13.6 | **35.1 ✗** | 2.66–2.98× | 2.76–3.13× |

- Parity alone (no repair), 51–80: 204 ms = 2.1× the baseline. Most of the
  budget goes to loading the browser's engine, not to the repair.
- Pilot figures end to end (median of 3): 1.11× / 0.88× / 0.77× (budget 1.5×), met.
- Stopped per T018: the levers can't hold both SC-003 and the per-bin SC-009
  budget with a margin larger than the timing noise. Current code: size-based
  rotations, K=8.
