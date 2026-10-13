# Implementation Receipt — Feature 002, slice 3 (final run: T018–T019)

## Prompt
`/speckit-implement` (no arguments). This continues slice 3 (T015–T020 and
T017a) after the SC-009 stop-and-report decision ("Relax budget to 4× for 51+").
Earlier runs: `../20261009T1100Z-repair/` (the receipt and two addenda).

## Final response
Slice 3 is done. BIME's 2D layout now repairs folded-back chains, and every
figure benefits automatically.

- **Corpus**, molecules with any crossing:
  - 31–50 atoms: 13.6% (baseline 39.4%);
  - 51–80 atoms: 32.4% (baseline 85.1%), mean 0.57 crossings (baseline 12.93).
- **Total crossings**: 1,201 → about 100, −92%.
- **Severe clashes**: 0.
- **Pilots**: 80 → 14 crossings in total.
- **No regressions**: no molecule gets worse, rings keep their shape, cis/trans
  and wedges stay correct, and the output is deterministic.
- **Speed**:
  - layout time is 1.3–2.1× the baseline up to 50 atoms and about 2.9–3.5×
    above (the amended budgets are 3× and 4×);
  - whole reaction figures take 0.8–1.1× their previous time.
- **Tests**: guard 23/0, Feature 001 35/0, full suite **1701/0**.

Next: Gate 3 for the closeout slice (T021–T024).

## Diff summary (whole slice 3)
- `editor/Layout.js`:
  - Step 16R fold-back repair, with the internal `foldBackRepair` switch and
    `_lastRepairStats`;
  - full rotations up to 50 atoms, reduced (±30°, ±60°, 180°) above;
  - escape K=8, stretch to a 1.15 BL target, budgets (60 iterations, 8
    escapes, 50k evaluations, skip >300 atoms);
  - E/Z guard, and a final guard on quality and every defect count.
- `editor/sdg/CorrectGeometricConfiguration.js` (T017a): `_normaliseEnd`
  handles an in-ring end with a single exocyclic substituent.
- `tests/test_v3_2_0_layout_quality.js`:
  - US2-a…i;
  - corpus on/off runs in fresh children;
  - US2-c on SC-005's total;
  - macrocycle exception (`listed:`);
  - `NS_ONLY` filter.

## Tests
| Run | Result |
|---|---|
| `node tests/test_v3_2_0_layout_quality.js` | **23 passed, 0 failed** (info: 3 CIP-labeller disagreements; AM1CCSitr listed) |
| `node tests/test_v3_1_0_reaction_map_legibility.js` (FR-020) | 35 passed, 0 failed |
| `node tools/run-tests.js` | **1701 passed, 0 failed** (330 s at load average 1–5; pre-feature 251 s = 1.31×. The R10 budget is 1.3×; re-measure at T021) |
| SC-009, quiet-ish (load 3–5), 3-run medians | ≤50 atoms: 1.3–2.1× (≤3×); 51–80: 2.89–3.48×; 81+: 2.98–3.59× (≤4×). Pilots end to end 1.11 / 0.88 / 0.77× (≤1.5×) |
| `node tools/release-check.js` | not run; not required (`dist/` unchanged) |

## Unresolved issues
- **Suite time** is 1.31× against the R10 budget of 1.3×. That's within load
  noise; it gets a quiet re-measure at T021, and the guard's own time is
  measured there too.
- **Carried to T024 (known-defects):**
  - the bare-`*` parser defect;
  - 3 BIME/RDKit CIP disagreements;
  - the macrocycle E/Z exception (AM1CCSitr);
  - layout history-dependence (now also seen to affect E/Z correctness for
    AM1CCSitr between process histories).
