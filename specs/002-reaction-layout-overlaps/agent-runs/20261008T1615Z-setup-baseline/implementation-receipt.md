# Implementation Receipt — Feature 002, slice 1 (T001–T005, setup and baseline)

## Prompt
`/speckit-implement` (no arguments). The approved scope at Gate 2 (2026-10-08) was
"Slice 1: T001–T005", with analyze fixes F1–F4 and F6 applied to tasks.md first.

## Final response
Slice 1 (T001–T005) is done. Nothing in BIME's behaviour has changed yet: this
slice adds the measuring tools and records the "before" numbers.

- **Corpus fixture** (`tests/data/layout_corpus.json`, 95 KB): 367 molecules,
  exactly the exploration's sample. Each has RDKit reference numbers and its 58
  stereocentres' R/S labels. It also has the stereo set (alanine ×2, lactate,
  glucose, testosterone, cholesterol) and the cis/trans set (6 molecules).
  The generator is an offline RDKit script kept beside the spec.
- **Benchmark** (`tools/layout-bench.js`): a per-size-bin report next to the
  baseline and RDKit columns. It is not a `bime` command.
- **Baseline**, on unchanged code, matching the exploration exactly:
  - molecules with crossings: 39.4% at 31–50 atoms, 85.1% at 51–80 atoms;
  - 1,201 crossings in total;
  - pilot crossings 48 / 7 / 25;
  - median layout time 96 ms at 51–80 atoms;
  - pilot figures end to end 10.9 / 6.9 / 10.0 s;
  - full suite 251 s.
- **Guard test** (`tests/test_v3_2_0_layout_quality.js`): 6 helper self-tests.
  The stereo read-back calibration fails when its sign is deliberately flipped.
- Full suite: 1684 passed, 0 failed.

Two things to know:
- **SMILES wildcard.** BIME drops a bare `*` wildcard atom while parsing (4
  corpus molecules). This is a pre-existing bug, and it will go to the
  known-defects list at closeout.
- **Speed budget.** On a quiet machine the layout budget for 51–80-atom
  molecules is 3 × 96 = 288 ms, which is tight against the prototype. Slice 3
  will measure it properly.

Next: Gate 3, to approve Slice 2 (T006–T014: module parity plus the wedge fix).

## Diff summary
- New: `specs/002-reaction-layout-overlaps/fixture-gen/layout_corpus_build.py` (T001).
  Offline only; needs RDKit; runs from `.venv`.
- New: `tests/data/layout_corpus.json` (T001 data; T003 `baseline` block).
- New: `tools/layout-bench.js` (T002).
- New: `tests/test_v3_2_0_layout_quality.js` (T004): helpers and self-tests H1–H6.
- Modified: `tests/test-manifest.js` (T005), one line after the Feature 001
  suite. Registered *after* the baseline suite run, so the "before" time
  excludes the guard.
- Spec Kit: `data-model.md` validation note on the `atoms` field (see
  Deviations); `tasks.md` T001–T005 marked `[X]`.
- **Untouched**, as required by Gate 2: `editor/*`, `tests/shim.js`,
  `tools/bime-cli.js`, `tools/editor-files.js`, `dist/*`, HTML pages.

## Tests
| Run | Result |
|---|---|
| T001: `layout_corpus_build.py …/atomMapped_std` | 367 molecules, 271 dropped (RDKit sanitise); molecule list identical to `exploration/data/corpus_mols.tsv` (file, atoms, SMILES); 58 stereocentres in 14 molecules |
| T002 smoke: `node tools/layout-bench.js --bin 16-30` | 11.6% / 0.36 / 1.01, as E10 |
| T003: `node tools/layout-bench.js --write-baseline` (3 corpus runs, 5 pilot runs) | `bench_baseline.txt` here. Per bin (with crossings %, mean crossings, median ms): 2–15: 0 / 0 / 1.2 · 16–30: 11.6 / 0.36 / 7.2 · 31–50: 39.4 / 2.06 / 19.5 · 51–80: 85.1 / 12.93 / 96.1 · 81+: 100 / 10.67 / 210. Totals: 1,201 crossings, 2,273 close pairs, 2 severe |
| T003 pilots (fresh processes) | GDA1 48 crossings / 76 close; GGH 7 / 27; CE2872 25 / 45 / 2 severe (as exploration E2) |
| T003 pilot end-to-end, median of 5 | GDA1 10,872 ms; GGH 6,916 ms; CE2872 9,960 ms (i5-12500 ×12, node v18.19.1) |
| T003 `bime help` + each `help <cmd>` | `bime_help.txt` here (55 lines), for the F1 check in T021 |
| T003 pre-feature suite (quiet; manifest without the guard) | `suite_before.log`: 1678 passed, 0 failed, **251 s** (R10 baseline) |
| `node tests/test_v3_2_0_layout_quality.js` | 6 passed, 0 failed (1.4 s) |
| Mutation: read-back sign flipped (`READBACK_POSITIVE`), restore verified with `cmp` | H3 fails ("L-alanine atom 1 reads back S"), so the calibration is real |
| `node tools/run-tests.js` | **1684 passed, 0 failed** (266 s) |
| `node tools/release-check.js` | not run; not required (`dist/` unchanged) |

## Unresolved issues
- **Bare `*` wildcard dropped by `SmilesParser`.** It reports "Unexpected
  character" and builds no atom. Four corpus molecules are affected
  (FUCGALFUCGALACGLCGALGLUSIDEt, HMR_7168 ×2, HMR_9492). This is pre-existing
  and outside scope. H1 tolerates exactly this error and checks one missing
  atom per bare `*`. It goes to `docs/known-defects.md` at closeout (T024).
- **No pilot stereocentres.** The pilots' heavy-atom SMILES carry no specified
  stereocentres, so the stereo set holds only the six named molecules.
  SC-002a's "stereocentres in the three pilot reactions" is empty, not
  skipped.
- **SC-009 margin.** On a quiet machine the 51–80 layout median is 96 ms, so
  the budget is 288 ms. The prototype (parity plus repair) measured about
  280 ms under load. This is tight; research R6's levers are ready.
- **Bench label.** `layout-bench.js` prints "repair: on" even before the repair
  exists, because the flag only reports whether `--no-repair` was passed.
  Harmless; becomes accurate in slice 3.

## Other information
**Deviations** (for the V-B reconciliation at closeout):
1. `tools/layout-bench.js` loads the engine through
   `tools/bime-cli.js` `loadEditor()`, a new edge bench → bime-cli. The
   architecture delta declared bench → `tests/shim.js`. This was chosen so the
   benchmark measures exactly the CLI's module set without a second list
   (ADR-0001). It reaches the shim transitively.
2. The fixture's `atoms` field is RDKit's atom count of the stored SMILES,
   including an explicit `[H]` kept for double-bond stereo (23 molecules). It is
   not a pure heavy-atom count. This keeps the exploration's (E10) binning, and
   `data-model.md` is updated to say so.
3. The receipt directory also holds the T003 artifacts (`bench_baseline.txt`,
   `bime_help.txt`, `suite_before.log`).

**Process note.** Earlier in this session, during planning, an RDKit-based
extraction script (now T001's generator) was run against the maintainer's
corpus directory. It is read-only there.
