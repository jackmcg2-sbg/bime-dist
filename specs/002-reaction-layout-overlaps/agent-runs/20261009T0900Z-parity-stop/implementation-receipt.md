# Implementation Receipt — Feature 002, slice 2 (partial: T006–T009; stopped at T010)

## Prompt
`/speckit-implement` (no arguments). The approved scope at Gate 3 (2026-10-09)
was "Approve Slice 2": T006–T014.

## Final response
Stop-and-report. Module parity is in: T006–T009 are done.
- The CLI and tests now load the browser's layout engine (`ENGINE_FILES`, ADR-0001).
- The named cis/trans molecules (cis-2-butene, maleate, oleate and the rest)
  are now drawn correctly from the CLI.
- The CLI and the engine module set lay out identically, checked in fresh
  processes.
- A pre-built binary missing the layout modules now prints a warning.

T010 cannot pass. US1-c (SC-002: every specified double bond drawn as specified)
fails on 2 of 282 corpus double bonds. The cause is an existing bug in
`editor/sdg/CorrectGeometricConfiguration.js`, which is outside the approved
files.
- When a double bond is drawn the wrong way round, it reflects only the
  highest-priority branch, not the whole end. On a carbon with two
  substituents, both then sit on the same side. Minimal reproduction:
  `C/C(=C/CC)CO` (Z); end 1 is drawn with both substituents on side −1.
- Corpus cases: VITEBTENALCt (prenyl chain), and PHEPROARGr (`[H]/N=C(/N)…`,
  drawn E instead of Z). The minimal imine draws correctly, so the second case
  is unexplained. The candidates are the same correction, or a later layout
  step on a larger molecule.
- The browser has the same bug today.

The slice is waiting on a human decision. T011–T014 (wedges) were not started.

## Diff summary
- `tools/editor-files.js`: `UI_FILES` (7 modules) and `ENGINE_FILES` (42) exported (T007).
- `tests/shim.js`: `loadAll()` loads `ENGINE_FILES` in bundle order, replacing
  the hand-written subset. The header comment is updated (T008).
- `tools/bime-cli.js`: the static-bundle short-circuit warns once on stderr when
  `SDG`, `SDGLayout`, `SMSDLayout` or `Templates` is missing (T009).
- `tests/test_v3_2_0_layout_quality.js`: US1-a…d (T006), plus a `hasBareStar` helper.
- `tests/data/layout_corpus.json` and the generator: new per-molecule `ez`
  pairs (RDKit-derived), the oracle for US1-c. Regenerated with
  `--keep-baseline`; baseline, molecules, metrics and stereo labels verified
  unchanged. 287 pairs.

## Tests
| Run | Result |
|---|---|
| NS before T007–T009 (fail-first) | US1-a/b fail (no `ENGINE_FILES`); US1-c fails (cis-2-butene, maleate, oleate drawn trans); US1-d fails (no warning) |
| NS after T007–T009 | 9 passed, 1 failed: US1-c, 2/282 corpus double bonds (above) |
| US1-c oracle iterations | (1) BIME `assignEZ` on coordinates: 23 unlabelled imines, an oracle gap, so it was replaced. (2) RDKit pairs: 7 failures, 5 of them from molecules with a bare `*` (indices shift; known parser defect), so those are skipped. (3) 2 real failures |
| `node tools/run-tests.js` | not run. The slice stopped before T010 |

## Unresolved issues
- **Decision needed.** The `CorrectGeometricConfiguration` defect (above)
  blocks SC-002 and FR-004.
- **US1-b is weaker than intended.** Both the CLI and the engine path now go
  through `shim.loadAll()` → `ENGINE_FILES`, so the test confirms that
  `loadEditor`'s extra requires change nothing. It can't compare against the
  real browser bundle: `dist/` is built from older source.
- The bare `*` parser defect (slice 1) also affects index-based checks. Four
  molecules are skipped, and the count is visible in the test.

## Other information
**Deviations.**
- The fixture gained `ez` pairs, and the generator gained `--keep-baseline`. This
  is a test-oracle change inside approved test files; the data model will be
  updated if the slice continues.
- `.specify/feature.json` shows as modified only because the feature pointer now
  names 002.
