# Implementation Receipt — Feature 001, slice 3 (T018–T021, US3)

## Prompt
`/speckit-implement` (no arguments). The approved scope at Gate 3 (2026-10-08) was
"Approve US3", i.e. T018–T021.

## Final response
Slice 3 (T018–T021) is implemented and verified. BIME now does the hydrogen
stripping your external script did: `bime aam … --heavy-atoms` removes explicit H
atoms before mapping, for every output format. For library use there is
`Molecule.prototype.removeExplicitHydrogens()`.

- Kept as drawn: isotopic H (D, T), charged H, H₂ and H⁺, and any H not bonded to
  exactly one heavy atom.
- Stereocentres keep their R/S label wherever the explicit H was written. A test
  checks all 4 positions, and disabling the parity flip makes 2 of the 4 fail.
- `--heavy-atoms --format svg` is byte-identical to running the same reaction with
  the H removed by hand (SC-007).
- Tests: new suite 35/35; cli, hcount, round-trip, stereo-golden and the
  reaction-map suites pass; full `node tools/run-tests.js` 1678 passed, 0 failed.

Remaining for Feature A: closeout T022–T026 (quickstart validation, CHANGELOG, CLI.md,
final receipt). Next: Gate 3.

## Diff summary
- `editor/Molecule.js` (+44): `Molecule.prototype.removeExplicitHydrogens()`, as in
  contracts/api.md.
  - Exemptions are covered by the rule "one heavy neighbour, no isotope, no
    charge", which implies a non-H-only component.
  - A neighbour with an explicit H count gets +1; an auto neighbour stays auto.
  - A chiral auto-H neighbour is pinned to its computed count first.
  - The parity flip is applied when `(n−1−k)` is odd.
  - Removal goes through `removeAtom`.
- `tools/bime-cli.js` (+4): `cmdAam` calls `rxn.removeExplicitHydrogens()` under
  `--heavy-atoms` after the parse check and before mapping or `--keep-mapping`.
  The `aam` help gains one line.
- `tests/test_v3_1_0_reaction_map_legibility.js`: US3-a…h (unit, CIP, ids, an
  oracle check of the hand-stripped fixture, CLI json/text/svg/keep-mapping).

## Tests
| Run | Result |
|---|---|
| `node tests/test_v3_1_0_reaction_map_legibility.js` (before T019/T021) | US3-a…d and f…h failed as intended; US3-e (oracle) passed |
| same, after | 35 passed, 0 failed |
| Mutation: parity flip disabled in `Molecule.js` (restore verified with `cmp`) | 2 of 4 neighbour positions give the wrong R/S, so US3-c catches it |
| SC-007 byte check | `aam <explicit-H> --heavy-atoms --format svg --no-stamp` is byte-identical to the hand-stripped reaction |
| test_v2_0_62_cli / test_hcount / test_round_trip / test_v3_0_1_stereo_golden / test_v2_4_13 | 22/0, 10/0, 25/0, 8/0, 10/0 |
| `node tools/run-tests.js` | 1678 passed, 0 failed (354.9 s) |
| `node tools/release-check.js` | not run; not required (`dist/` unchanged) |

## Unresolved issues
- A chiral atom with an auto H count (possible from MOL import, not from SMILES)
  is pinned to an explicit count when an explicit H is folded into it. No test
  covers this: no SMILES input can produce it.
- The flag is honoured for every `aam` format (by design, FR-012). It is not
  offered on `bime export`, which is outside this feature.
- The stop-and-report items from slice 2 still stand: layout history-dependence,
  and test-suite runtime.

## Other information
None.
