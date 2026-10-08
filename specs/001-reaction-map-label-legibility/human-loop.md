# Human Loop State

## Current State
- Status: CLOSED (final Gate 3, 2026-10-08)
- Active feature directory: specs/001-reaction-map-label-legibility
- Last completed bundle: 4 (verification + closeout)
- Source code modified by this workflow: yes (editor/ImageExport.js, tests/test-manifest.js, plus new test and fixture)

## Core Command Ledger
- constitution:   checked (v1.0.0)
- specify:        invoked 2026-10-08
- clarify:        invoked 2026-10-08 (2 questions + FR-004 from specify)
- checklist:      invoked 2026-10-08 (checklists/rendering.md, 24 items)
- plan:           invoked 2026-10-08 (plan.md, research.md, data-model.md, contracts/, quickstart.md, architecture-delta.yaml)
- tasks:          invoked 2026-10-08 (26 tasks)
- analyze:        invoked 2026-10-08 (0 critical / 0 high / 2 medium / 5 low)
- implement:      invoked 2026-10-08 (slice T001–T012 complete)

## Human Decisions
| Date (UTC) | Gate | Option chosen | Consequence |
|---|---|---|---|
| 2026-10-08 | Bundle 0 scoping | Two features (Recommended) | Feature A = label contrast + map-number placement + heavy-atom option; Feature B = overlap-free layout (later) |
| 2026-10-08 | Bundle 0 base | origin/main v3.0.3 (Recommended) | speckit-setup commit rebased onto 84a44be (v3.0.3); feature branched from it |
| 2026-10-08 | Bundle 0 H-strip | External, fold into BIME | Heavy-atom-only option added to Feature A (Story 3) |
| 2026-10-08 | clarify | Default-on (Recommended) | New legibility rules always on; no legacy flag |
| 2026-10-08 | clarify | ≤ 2× 3.0.3 time (Recommended) | SC-008 render budget |
| 2026-10-08 | Gate 1 | Continue to plan (Recommended) | Proceed to Bundle 2 (plan + architecture delta), stop at Gate 2A |
| 2026-10-08 | Gate 1 side decision (.gitignore) | Keep, drop those 2 lines | .claude/ and .specify/ lines removed by agent; bime_pilot/ and .venv stay ignored (manual edit, to be committed alongside with attribution) |
| 2026-10-08 | Gate 2A | APPROVE (Recommended) | Tasks may be generated; no ADR required |
| 2026-10-08 | Gate 2 | First slice: T001–T012 | Implementation authorised for T001–T012 only, and only once the user invokes /speckit-implement |
| 2026-10-08 | Gate 2 (analyze fixes) | Apply F1–F5 (Recommended) | spec.md Story 3 + FR-013 and tasks.md T004/T007/T013/T020 edited |
| 2026-10-08 | Gate 2 (fixtures) | /media/JACK/repos/ctf/rxns/moiety_rxns/atomMapped_std | T001 unblocked; RXN→SMILES conversion step added to T001 |
| 2026-10-08 | Gate 3 (slice T001–T012) | Continue: approve US2 (Recommended) | Next slice T013–T017 approved; implementation requires a fresh /speckit-implement |
| 2026-10-08 | Slice-2 stop-and-report (SC-002) | Exclude crowded atoms (Recommended) | spec SC-002/SC-003/FR-010 and the edge case amended (0.6 × bond length); tests follow; code unchanged |
| 2026-10-08 | Gate 3 (slice 2) | Approve US3 (Recommended) | Slice 3 = T018–T021 approved; requires a fresh /speckit-implement |
| 2026-10-08 | Gate 3 (slice 3) | Approve closeout T022–T026 (Recommended) | Slice 4 = T022–T026 approved; requires a fresh /speckit-implement, then Bundle 4 verification |
| 2026-10-08 | Final Gate 3 | Accept and close Feature A (Recommended) | Feature closed; commit only on the user's instruction |
| 2026-10-08 | Knowledge promotion | Layout history-dependence, Node text width = 0 | Both written to docs/known-defects.md |
| 2026-10-08 | specify clarification (FR-004) | Recolour, patch fallback (Recommended) | Same-hue lightness shift first; tight canvas-colour patch only if no shade meets 3:1 |

## Approved Implementation Scope
- Approved: yes (slices)
- Scope: slice 1 = Phases 1–2 + US1 (DONE); slice 2 = US2
- Tasks approved: T001–T012 (done), T013–T017 (done), T018–T021 (done), T022–T026 (approved at Gate 3 for slice 3, 2026-10-08)
- Tasks deferred: none
- Files allowed: CHANGELOG.md and CLI.md (closeout), editor/Molecule.js and tools/bime-cli.js (slice 3), editor/ImageExport.js, tests/test_v3_1_0_reaction_map_legibility.js (new), tests/data/reaction_map_pilot.json (new), tests/test-manifest.js, reaction-map assertions in tests/test_v2_4_13_reaction_map_svg.js and tests/test_v2_4_14_compound_labels.js
- Files not allowed: dist/*, versions.json, package.json, tools/editor-files.js, *.html, editor/Renderer.js, editor/sdg/*, editor/Layout.js, editor/SmilesParser.js, tests/test_v2_4_7_publication_export.js

## Pointers
- Exploration: none — direct request (see spec.md Exploration field)
- Implementation receipt(s): specs/001-reaction-map-label-legibility/agent-runs/20261008T1050Z-label-legibility/implementation-receipt.md ; specs/001-reaction-map-label-legibility/agent-runs/20261008T1300Z-map-number-placement/implementation-receipt.md ; specs/001-reaction-map-label-legibility/agent-runs/20261008T1500Z-heavy-atoms/implementation-receipt.md ; specs/001-reaction-map-label-legibility/agent-runs/20261008T1700Z-closeout/implementation-receipt.md
- Implementation review: specs/001-reaction-map-label-legibility/implementation-review.md

## Checklist Routing (Principle II-B)
- requirements.md: 16/16 resolved.
- rendering.md: 21/24 resolved; 3 routed:
  - CHK008 → plan: RESOLVED in research.md D5
  - CHK010 → plan: RESOLVED in research.md D6
  - CHK015 (3.0.3 baseline overlap fixture for SC-003) → tasks: T004

## Stop-and-report conditions inside the approved scope
- FIRED 2026-10-08 (slice 2): US2 acceptance tests (SC-002, SC-003, FR-010) fail on GDA1_HPRNStlr and CE2872DIOer, and ONLY for map atoms that have another atom closer than 0.6 x bond length (layout crowding, the Feature B defect). Excluding those atoms, all targets are met on all three pilots: map/map 0, map/label 0, nearer-another-atom 0, map/bond 9/0/3 (3.0.3: 193/101/132). The spec's exclusion threshold is 0.3 x bond length. Changing it is a spec decision for the human. RESOLVED: the user chose "Exclude crowded atoms"; spec amended.
- FOUND 2026-10-08 (pre-existing in 3.0.3, not introduced): layout and mapping output depend on process history (the global atom-id counter). The same SMILES lays out differently cold vs after other parses. Verified on the 3.0.3 ImageExport.js too. The suite now renders pilots in baseline order; under run-tests.js (shared process) counts may drift slightly from the baseline.

## Open Risks and Ambiguities
- DEVIATION (implementation, 2026-10-08): Node text measurement returns 0 (shim stub), so on the legibility path T010 also replaces bond trimming at labelled atoms with heuristic-width trimming. Without it, removing the knockout rect would expose bond stubs inside labels (FR-006). The change is confined to editor/ImageExport.js behind legibleLabels; toSVG is unchanged. Research F7/D6 corrected.
- Resolved at Gate 2: fixture source = /media/JACK/repos/ctf/rxns/moiety_rxns/atomMapped_std (atom-mapped RXN, which needs converting to SMILES in T001).
- Agent-context update script deliberately NOT run: the constitution forbids feature context in CLAUDE.md.
- The working tree carries an uncommitted, manual .gitignore edit adding bime_pilot/, .venv, .claude/ and .specify/. Ignoring .claude/ and .specify/ conflicts with the tracked Spec Kit setup: new files such as .specify/feature.json go unversioned. Resolved at Gate 1: the .claude/ and .specify/ lines were removed at the user's direction.
- SC-002 excludes coincident atom pairs (< 0.3 × bond length); those depend on Feature B.
- (Corrected during plan) Bonds are already trimmed at labels in 3.0.3; FR-006 is now a "keep doing this" requirement. FR-012 was revised: the programmatic option is a pre-mapping operation, not an option on the figure export.

## Continuation Iterations
| Date (UTC) | Unchecked before | Unchecked after | Decision |
|---|---|---|---|
| 2026-10-08 | 26 (12 in approved scope) | 14 (0 in approved scope) | STOP: every approved task (T001–T012) is [X]; T013–T026 are outside the approved scope (deferred at Gate 2) and are not implemented by continuation. In-flight marker removed. Hand to Gate 3. |
| 2026-10-08 (slice 2) | 14 (5 in approved scope) | 9 (0 in approved scope) | STOP: T013–T017 are all [X] and the suite passes (27/27; run-tests 1670/0). The stop-and-report on SC-002 was resolved by the human ("Exclude crowded atoms"). T018–T026 are outside the approved scope. Marker removed. Hand to Gate 3. |
| 2026-10-08 (slice 3) | 9 (4 in approved scope) | 5 (0 in approved scope) | STOP: T018–T021 are all [X]; suite 35/35; run-tests 1678/0. T022–T026 are outside the approved scope. Marker removed. Hand to Gate 3. |
| 2026-10-08 (closeout) | 5 (5 in approved scope) | 0 | STOP: every task in tasks.md is [X]; final run-tests 1678/0 (quiet machine). Predicate satisfied. Marker removed. Hand to final Gate 3. |

## Architecture Reconciliation (Bundle 4, Principle V-B)
Observed against architecture-delta.yaml (APPROVE, Gate 2A):
- **Approved and implemented:**
  - editor/ImageExport.js: legibility branch gated on legibleLabels, private helpers exposed as `_legibility`, options.minContrast;
  - editor/Molecule.js: removeExplicitHydrogens;
  - tools/bime-cli.js: aam --heavy-atoms plus its help line;
  - tests/test-manifest.js: registers the new suite;
  - new test file and fixture;
  - toSVG, toPublicationSVG and toPrintSVG byte-identical (9 pinned hashes pass);
  - no change to dist/, versions.json, package.json, tools/editor-files.js, *.html, Renderer.js, sdg/*, Layout.js, SmilesParser.js or test_v2_4_7 (git diff on those paths is empty).
- **Approved but not implemented:** none.
- **Implemented but not approved (drift):** none at module or edge level. Recorded design deviations inside approved files:
  - (1) the 0.6×size text-width fallback and the matching bond trim on the legibility path (Node measures text as 0 px wide);
  - (2) research D5 amended: 16 directions, a 0.75·d0 ring, and the margin-based forced fallback;
  - (3) `_boxOverlap` and `_segInBox` added to `_legibility`, which is internal;
  - (4) CHANGELOG.md and CLI.md edited, approved at the closeout gate; these are docs, not modules.
- **Existing violations worsened:** none architectural. Non-architectural: full test-suite runtime grew from about 150 s to 355–947 s.
- New dependency edges: none (no new require or global imports in the diff).

## Knowledge Promotion (Bundle 4, step 7)
| Item | Decision | Destination |
|---|---|---|
| Layout/mapping depend on process history (global atom-id counter); pre-existing | Promoted (user) | docs/known-defects.md |
| Node text measures 0 px (tests/shim.js stub), affecting the single-molecule exports | Promoted (user) | docs/known-defects.md |
| Flaky timing test `test_substructure_extended` "50-atom alkane < 100ms" | Not promoted (user's choice). Recorded in the closeout receipt only | this feature only |
| Slow new test suite (~136 s; run-tests 150 s → 355–947 s) | Not promoted (user's choice). Recorded in the slice-2 and closeout receipts | this feature only |
| Spec Kit hook skill `speckit-implement-continuation-*` is a broken symlink (target `.specify-dev/` missing); the command was run from `.specify/extensions/implement-continuation/commands/` | Not offered for promotion. Surfaced to the user at closeout | this feature only |
