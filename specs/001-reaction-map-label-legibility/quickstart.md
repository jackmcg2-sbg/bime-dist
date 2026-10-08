# Quickstart: validating Feature 001

Prerequisites: Node, the repo at this branch, and the pilot reaction SMILES
fixture in `tests/data/` (see research D8/D8a).

1. Narrowest suite (new):
   `node tests/test_v3_1_0_reaction_map_legibility.js`
   Expected: all pass. The suite prints the overlap counts per pilot, against the
   committed 3.0.3 baseline (SC-002, SC-003), plus a contrast audit (SC-001,
   SC-004), a determinism check (SC-005), a heavy-atom equivalence check (SC-007)
   and a timing ratio (SC-008).
2. Affected existing suites (must still pass):
   `node tests/test_v2_4_13_reaction_map_svg.js`
   `node tests/test_v2_4_14_compound_labels.js`
   `node tests/test_v2_4_7_publication_export.js`
   `node tests/test_v2_4_17_publication_kekule.js`
3. Full suite: `node tools/run-tests.js > /tmp/bime-tests.log 2>&1; tail -20 /tmp/bime-tests.log`
4. Visual check (manual), one per pilot:
   `node bin/bime aam "<pilot SMILES>" --heavy-atoms --format svg --out /tmp/<id>.svg`
   Open the file and compare it with `bime_pilot/<id>_heavy.svg`. Expect no white
   boxes on halos, and map numbers clear of each other and of labels.
5. Single-molecule export is unchanged: covered by step 2
   (`test_v2_4_7` D1/E3 pins).
