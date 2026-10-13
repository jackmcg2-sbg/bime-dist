# Human Loop State

## Current State
- Status: CLOSED (final Gate 3, 2026-10-09)
- Active feature directory: specs/002-reaction-layout-overlaps
- Last completed bundle: 4 (verification + closeout)
- Source code modified by this workflow: yes (slice 1: tools/layout-bench.js, tests/test_v3_2_0_layout_quality.js, tests/test-manifest.js, tests/data/layout_corpus.json; no editor/ change)

## Core Command Ledger
- constitution:   checked (v1.0.0, unchanged since Feature 001)
- specify:        invoked 2026-10-08 (spec.md, checklists/requirements.md 16/16)
- clarify:        invoked 2026-10-08 (3 questions; all as drafted)
- checklist:      invoked 2026-10-08 (checklists/layout.md, 32 items: 27 resolved, 5 routed to plan)
- plan:           invoked 2026-10-08 (plan.md, research.md R1–R11, data-model.md, contracts/, quickstart.md, architecture-delta.yaml)
- tasks:          invoked 2026-10-08 (24 tasks, 4 slices)
- analyze:        invoked 2026-10-08 (0 critical / 0 high / 4 medium / 2 low)
- implement:      invoked 2026-10-08/09 (slices 1–4 complete, incl. T009a, T017a, T021a)

## Human Decisions
| Date (UTC) | Gate | Option chosen | Consequence |
|---|---|---|---|
| 2026-10-08 | Gate 3 of Feature 001 (follow-up) | "lets move onto feature b" | Bundle E opened: specs/20261008-145340-reaction-layout-overlaps/exploration.md |
| 2026-10-08 | Gate E | Go (Recommended) | Directory renamed to specs/002-reaction-layout-overlaps; branch 002-reaction-layout-overlaps created from 001-reaction-map-label-legibility (d75758c) |
| 2026-10-08 | Gate E scope | A + C (Recommended) | Module parity + fold-back repair pass; options D, E out of scope |
| 2026-10-08 | clarify (reach) | Every layout (Recommended) | FR-013: repair on in editor, exports and CLI; no opt-out |
| 2026-10-08 | clarify (targets) | As drafted (Recommended) | SC-003 / SC-005 thresholds stand |
| 2026-10-08 | clarify (speed) | As drafted (Recommended) | SC-009: layout ≤3× CLI median per bin; pilot figures ≤1.5× end to end |
| 2026-10-08 | Gate 1 | Fix 6, then plan (Recommended) | spec: FR-009/FR-010/FR-012a/FR-013/FR-016/FR-020 + Key Entities amended; CHK007/010/012/021/028 routed to plan |
| 2026-10-08 | Gate 1 (CHK030) | Yes, commit it (Recommended) | corpus sample becomes a committed test fixture |
| 2026-10-08 | Planning stop-and-report (wedges) | Fix in this feature (Recommended) | spec: FR-004a, SC-002a, User Story 1 widened; research R5 |
| 2026-10-08 | Planning stop-and-report (SC-003) | Revise to evidence (Recommended) | SC-003: ≤15% / ≤35%, mean ≤1.0 at 51–80, total −85% |
| 2026-10-08 | Gate 2A | APPROVE_WITH_ADR (Recommended) | ADR-0001 written (docs/decisions/0001-node-loads-engine-module-set.md); tasks may be generated |
| 2026-10-08 | Gate 2 (analyze fixes) | Apply F1–F4, F6 (Recommended) | tasks.md: T001–T003, T007–T009, T012, T015 (US2-i), T017, T021, T022 edited |
| 2026-10-08 | Gate 2 | Slice 1: T001–T005 (Recommended) | Implementation authorised for T001–T005 only, and only once the user invokes /speckit-implement |
| 2026-10-09 | Gate 3 (slice 1) | Approve Slice 2 (Recommended) | Slice 2 = T006–T014 approved (US1: parity + wedges); requires a fresh /speckit-implement |
| 2026-10-09 | Slice-2 stop-and-report (E/Z correction defect) | Widen Slice 2 to fix it (Recommended) | T009a added; editor/sdg/CorrectGeometricConfiguration.js added to allowed files and to architecture-delta.yaml; FR-004/SC-002 unchanged; requires a fresh /speckit-implement |
| 2026-10-09 | Gate 3 (slice 2) | Approve Slice 3 (Recommended) | Slice 3 = T015–T020 approved (US2 repair + US3 report); requires a fresh /speckit-implement; timings provisional while the user's RDT pipeline loads the machine |
| 2026-10-09 | Slice-3 stop-and-report | Fix both (Recommended) | T017a added: US2-c follows SC-005's total-crossings criterion; CorrectGeometricConfiguration.js allowed for the in-ring E/Z case; requires a fresh /speckit-implement |
| 2026-10-09 | Slice-3 stop-and-report (macrocycle E/Z) | Known exception (Recommended) | spec FR-004 exception + clarification; tests list in-ring macrocycle double bonds with a cramped end (relation still checked); known-defects entry at T024 |
| 2026-10-09 | Slice-3 stop-and-report (SC-009 budget) | Relax budget to 4× for 51+ (Recommended) | spec SC-009 amended (≤50 atoms 3×, >50 atoms 4×, figures 1.5×); current code (size-based rotations, K=8) kept |
| 2026-10-09 | Gate 3 (slice 3) | Approve closeout T021–T024 (Recommended) | Slice 4 approved; requires a fresh /speckit-implement, then final Gate 3 |
| 2026-10-09 | Closeout stop-and-report (R10 test time) | Speed up the guard (Recommended) | T021a added; tests/test_v3_2_0_layout_quality.js allowed for a test-only speed change (same assertions); requires a fresh /speckit-implement |
| 2026-10-09 | Final Gate 3 | Accept and close (Recommended) | Feature 002 CLOSED; commit only on the maintainer's instruction |
| 2026-10-09 | Knowledge promotion | docs/ testing note (Recommended) | Testing rule added to docs/known-defects.md (history-dependence entry) |

## Approved Implementation Scope
- Approved: yes (Slice 1 done; Slice 2 approved 2026-10-09)
- Scope: slice:Phase 5 (closeout)
- Tasks approved: T021–T024 + T021a (T022–T023 done)
- Tasks deferred: none
- Files allowed: tests/test_v3_2_0_layout_quality.js (T021a, test-only speed), CHANGELOG.md, CLI.md, docs/known-defects.md, bime_pilot/compare/*, Spec Kit artifacts
- Files not allowed: editor/*, tools/*, tests/* behaviour changes (only if a closeout check fails → stop and report), dist/*, HTML pages

## Pointers
- Exploration: specs/002-reaction-layout-overlaps/exploration.md (+ exploration/ scripts and data)
- Implementation receipt(s): agent-runs/20261008T1615Z-setup-baseline/implementation-receipt.md; agent-runs/20261009T0900Z-parity-stop/implementation-receipt.md; agent-runs/20261009T1000Z-parity-wedges/implementation-receipt.md; agent-runs/20261009T1100Z-repair/implementation-receipt.md; agent-runs/20261009T1130Z-repair-final/implementation-receipt.md; agent-runs/20261009T1140Z-closeout/implementation-receipt.md
- Implementation review: specs/002-reaction-layout-overlaps/implementation-review.md

## Checklist routing at Gate 1
- CHK007 → plan: closed by research R7
- CHK010 → plan: closed by research R6
- CHK012 → plan: closed by research R5
- CHK021 → plan: closed by research R9
- CHK028 → plan: closed by research R10
- layout.md: 32/32 resolved after planning
- requirements.md: 16/16 resolved

## Continuation log
| Date (UTC) | Run | Unchecked approved tasks before → after | Decision |
|---|---|---|---|
| 2026-10-08 | slice 1 (/speckit-implement) | 5 → 0 (T006–T024 not approved) | finished; marker cleared; Gate 3 |
| 2026-10-09 | slice 2 (/speckit-implement, 2nd run) | 6 → 0 (T009a, T010–T014; T015–T024 not approved) | finished; marker cleared; Gate 3 |
| 2026-10-09 | slice 2 (/speckit-implement) | 9 → 5 (T010–T014 open) | stop-and-report fired (T010: US1-c fails on CorrectGeometricConfiguration defect, file outside approved scope); marker cleared |

## Architecture reconciliation (V-B, closeout)
- Approved and implemented: all delta modules incl. CorrectGeometricConfiguration.js (stop-and-report additions) and ADR-0001.
- Approved but not implemented: conditional reaction_map_pilot.json re-pin (not needed).
- Implemented but not approved (drift): edge tools/layout-bench.js → tools/bime-cli.js (declared → tests/shim.js); Layout._lastRepairStats (internal, test-only).
- Existing violations worsened: none.

## Knowledge promotion (Bundle 4)
- SMILES parser drops bare `*` → docs/known-defects.md
- BIME vs RDKit CIP disagreements (unverified) → docs/known-defects.md
- Macrocycle in-ring E/Z cramped-end exception → docs/known-defects.md (+ spec FR-004 exception)
- Layout history-dependence reaching E/Z → docs/known-defects.md
- Node loads the engine module set → ADR-0001 (docs/decisions/)
- Test practice: compare layouts only across fresh processes with identical history → docs/known-defects.md (testing rule under history-dependence), per maintainer

## Open Risks and Ambiguities
- Pre-existing: SmilesParser drops a bare `*` wildcard atom (4 corpus molecules); to known-defects at closeout.
- SC-009 margin tight at 51–80 atoms (budget 288 ms on a quiet machine); slice-2 timings unusable (user's RDT pipeline load ~40); measure in T021 on a quiet machine.
- Parity brings 20 severe clashes in the 51–80 bin (browser behaviour); slice 3 repair must clear them.
- CIP labeller disagreements (BIME vs RDKit) on 3 input centres; unverified; closeout candidate for known-defects.
- Hooks: per-phase optional git-commit hooks are deferred; commit only on the
  maintainer's instruction (same practice as Feature 001).
- Branch base: 002 branches from the unmerged 001 branch, so a PR for 002 will
  include 001's commits unless 001 is merged first.
- Module parity (A) changes the layout every existing test sees, because the test
  shim gains the browser's modules. Pinned outputs are expected to move (FR-019).
