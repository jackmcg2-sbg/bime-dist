# Implementation Review

## Summary

Feature 002 has three parts:

1. **Module parity.** Node (the tests and the CLI) loads the browser's layout
   engine, `ENGINE_FILES`, under ADR-0001. This fixes cis bonds drawn trans in
   the CLI.
2. **Wedge fix.** Wedge or hash follows the drawn geometry; today 28 of 58
   corpus stereocentres are drawn inverted.
3. **Fold-back repair.** A bounded, deterministic step inside layout that moves
   whole subtrees rigidly (reflect, stretch or rotate about acyclic single
   bonds) to remove crossings and close pairs.

The planning prototypes cut total crossings in the corpus by 90%, and pilot
crossings went 48/7/20 → 1/1/0, with no molecule worse.

## Embedded Core Commands Completed

- constitution: checked (v1.0.0)
- specify: spec.md; requirements.md 16/16
- clarify: 3 questions (reach, targets, speed), all answered as drafted
- checklist: layout.md, 32/32 resolved (6 spec fixes at Gate 1, 5 closed by research)
- plan: plan.md, research R1–R11, data-model, contracts, quickstart, plus two planning stop-and-reports (wedges, SC-003)
- architecture review: architecture-delta.yaml, APPROVE_WITH_ADR, ADR-0001 written
- tasks: 24 tasks, 4 slices
- analyze: 0 critical / 0 high / 4 medium / 2 low (below)

## Architecture Verdict (Gate 2A)

- Verdict: APPROVE_WITH_ADR
- ADR required / written: yes / `docs/decisions/0001-node-loads-engine-module-set.md` (Accepted)
- Date (UTC): 2026-10-08

## Cross-Artifact Analysis Summary

| ID | Severity | Finding | Proposed fix |
|---|---|---|---|
| F1 | MEDIUM | FR-018 (no new flags, signatures or dependencies) has no check | T021: diff `bime help` output; grep the new and changed files for new requires |
| F2 | MEDIUM | FR-013 browser path never exercised | T022: Clean a pilot molecule in `workbench.html`; coordinates should match the CLI |
| F3 | MEDIUM | FR-012 effort bound untested | Add NS US2-i: a 320-atom molecule skips the repair; a 120-atom molecule stays under the evaluation cap |
| F4 | MEDIUM | US2-b is a per-metric no-worse check, but the planned guard checks only the penalty | T017: the final guard also requires each reporting metric ≤ before, or restores |
| F5 | LOW | Few corpus stereo or E/Z cases | None (named sets cover it) |
| F6 | LOW | Tasks cite few FR IDs | Add FR IDs to T002, T007–T009, T012 and T017 |

## Proposed Implementation Scope

- **Tasks proposed**: T001–T024.
- **First independently testable slice**: Slice 1 (T001–T005). It builds the
  fixture, the benchmark, the baseline and the guard skeleton, with no behaviour
  change. The MVP behaviour slice is Slice 2 (T006–T014, US1: parity and
  wedges together).
- **Files likely to change**:
  - `editor/Layout.js`
  - `editor/sdg/NonplanarBonds.js`
  - `tools/editor-files.js`
  - `tests/shim.js`
  - `tools/bime-cli.js`
  - `tests/test-manifest.js`
  - `CHANGELOG.md`, `CLI.md`
- **New files**:
  - `tests/test_v3_2_0_layout_quality.js`
  - `tests/data/layout_corpus.json`
  - `tools/layout-bench.js`
  - `specs/002-reaction-layout-overlaps/fixture-gen/layout_corpus_build.py`
- **Files that should NOT change**:
  - `dist/*`, `versions.json`, SRI and the manifest
  - every HTML page's script list
  - `editor/ImageExport.js`, `editor/MolfileWriter.js`, `editor/SmilesWriter.js`
  - `FILES` order in `tools/editor-files.js`
  - `tests/data/reaction_map_pilot.json`, except a re-pin listed under FR-019

## Tests and Validation Expected (narrowest first)

1. `node tests/test_v3_2_0_layout_quality.js` (NS)
2. `node tests/test_v3_1_0_reaction_map_legibility.js` (F1; FR-020)
3. `node tools/run-tests.js` (baseline 1678/0; time ≤ 1.3× the T003 baseline)
4. `node tools/layout-bench.js` with and without `--no-repair` (SC-003, SC-004)
5. Quickstart scenarios 0–6; a visual check of the pilots
6. `node tools/release-check.js`: not required (`dist/` unchanged)

## Blocking Issues

None.

## Acceptable Risks

- **Per-molecule thresholds.** SC-003 relies on prototype evidence (13.6% /
  33.8% against ≤15% / ≤35%). The margin is small at 31–50 atoms. T018 sets
  the stop-and-report rule.
- **Time budget.** Under load the prototype measured close to the 3× budget at
  51–80 atoms. T003 and T021 re-measure on a quiet machine, and the R6 levers
  exist if needed.
- **Parity changes every Node layout.** The suite passes with parity emulated
  (1678/0), but layout tests are sparse, so changes outside the pilots and the
  corpus can't be ruled out.
- **Branch base.** 002 is branched from the unmerged 001 branch.
- **Browser users of the shipped `dist/`** see the change only after a release
  rebuild.

## Human Approval

- Approved: yes (Slice 1 only)
- Approved option: Approve only the first independently testable slice
- Approved tasks/scope: T001–T005 (setup, fixture, benchmark, baseline, guard skeleton; no behaviour change). Analyze fixes F1–F4 and F6 applied to tasks.md first.
- Required implementation invocation per constitution: `/speckit-implement`
- Date (UTC): 2026-10-08
