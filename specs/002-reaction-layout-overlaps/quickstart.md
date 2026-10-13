# Quickstart: validating Feature 002

Run these from the repository root. Each scenario names the requirement it proves.
The interfaces are in [contracts/](contracts/); the fixture shape is in
[data-model.md](data-model.md).

## 0. Baseline (before any source change)

```bash
node tools/layout-bench.js --write-baseline     # records tests/data/layout_corpus.json "baseline"
node tools/run-tests.js > /tmp/suite_before.log # quiet machine; note the total time (R10)
```

Expected: the per-bin numbers match exploration E10 within one molecule per bin
(fixture order, one process), and the suite gives 1678 passed, 0 failed.

## 1. Module parity (US1; FR-001–FR-004, SC-001, SC-002)

```bash
node tools/bime-cli.js export 'CCCCCCCC/C=C\CCCCCCCC(=O)O' --format svg --out /tmp/oleate.svg
node tests/test_v3_2_0_layout_quality.js        # parity, E/Z set, CLI-vs-browser coordinate identity
```

Expected:
- In the oleate figure, the C9=C10 substituents are on the same side.
- The guard's parity tests pass. Comparing coordinates from two fresh processes
  (CLI set vs `ENGINE_FILES` loaded directly) shows 0 differences.

## 2. Wedges read back correctly (US1; FR-004a, SC-002a)

```bash
node tests/test_v3_2_0_layout_quality.js        # stereo read-back group
```

Expected: every stereocentre in the corpus and in the named stereo set reads
back with its RDKit CIP label (100%). Before the change: 30/58 on the corpus.

## 3. Fold-back repair on the corpus (US2; SC-003, SC-004, SC-006)

```bash
node tools/layout-bench.js
node tools/layout-bench.js --no-repair
```

Expected, with repair:
- 31–50 atoms: ≤ 15% of molecules with crossings;
- 51–80 atoms: ≤ 35%, mean ≤ 1.0 crossings per molecule;
- total crossings −85% against the baseline;
- 0 severe clashes.

The guard test also asserts that no molecule ends worse than its `--no-repair`
run, and that ring bond lengths and angles are within 1%.

## 4. Pilot figures (US2; SC-005, FR-020)

```bash
node tests/test_v3_1_0_reaction_map_legibility.js   # Feature 001 outcomes still hold (FR-020)
for id in GDA1_HPRNStlr GGH_10FTHF7GLUl CE2872DIOer; do
  smi=$(node -e "console.log(require('./tests/data/reaction_map_pilot.json').reactions.find(r=>r.id==='$id').smiles)")
  node tools/bime-cli.js aam "$smi" --format svg --no-stamp --out bime_pilot/compare/${id}_002.svg
done
```

Expected:
- Pilot crossings fall by ≥ 75% (baseline 48 / 7 / 25), with no severe clash.
- Feature 001's suite passes after any deliberate re-pin (FR-019), and its
  SC-001/SC-002/SC-004 outcomes hold.
- By eye: the folded cores are open, and molecules stay wider than tall.

## 5. Determinism and time (SC-007, SC-009)

```bash
node tests/test_v3_2_0_layout_quality.js        # two fresh child processes produce byte-identical SVG
node tools/layout-bench.js --json               # medianMs per bin vs baseline.timing
```

Expected:
- Identical bytes across the two processes.
- Median time per bin ≤ 3× the baseline median.
- Each pilot end to end ≤ 1.5× baseline (median of 5, fresh processes).

## 6. Full gate (SC-008; R10)

```bash
node tools/run-tests.js
```

Expected:
- All suites pass. Every re-pinned value is listed with its cause in the receipt.
- Total time ≤ 1.3× the step-0 time, and the guard test ≤ 120 s.
- `node tools/release-check.js` is not required: `dist/` is unchanged.
