# Implementation Review

## Summary
Feature 001 makes BIME's atom-mapped reaction SVG legible:

- contrast-aware element labels (no white box unless needed; same-hue recolour,
  with a patch as fallback);
- collision-scored map-number placement;
- built-in heavy-atom stripping (`aam --heavy-atoms`,
  `Molecule.removeExplicitHydrogens`).

It is scoped to the reaction-map export. Single-molecule SVG is pinned unchanged.
Overlapping bonds and atoms caused by layout belong to Feature B (not started).

## Embedded Core Commands Completed
- constitution: checked (v1.0.0)
- specify: done (3 stories, FR-001…018, SC-001…008)
- clarify: done (3 answers: remedy order, default-on, 2× render budget)
- checklist: requirements.md 16/16; rendering.md 23/24 resolved, with CHK015 routed to T004
- plan: done (research D1–D8, data-model, contracts/api.md, contracts/cli.md, quickstart)
- architecture review: Gate 2A **APPROVE**
- tasks: 26 tasks (T001–T026)
- analyze: 0 critical, 0 high, 2 medium (F1, F2), 5 low (F3–F7)

## Architecture Verdict (Gate 2A)
- Verdict: APPROVE
- ADR required / written: no / n/a
- Date (UTC): 2026-10-08

## Cross-Artifact Analysis Summary
| ID | Severity | Classification | Proposed fix |
|---|---|---|---|
| F1 | MEDIUM | should-fix | Reword spec Story 3 scenario 1 to match revised FR-012 |
| F2 | MEDIUM | should-fix | Move the T007 hash capture into Phase 1, before any source edit |
| F3 | LOW | should-fix | Add "charged H" to the FR-013 exemptions (matches contract) |
| F4 | LOW | should-fix | Add `--format text` to T020 |
| F5 | LOW | should-fix | SC-003 check: a zero baseline stays zero |
| F6 | LOW | acceptable | Terminology note only |
| F7 | LOW | acceptable | SC-008 is a manual measurement (machine-dependent) |

## Proposed Implementation Scope
- Tasks proposed: T001–T026
- First independently testable slice: **Phases 1–2 + US1 (T001–T012)**, which
  removes the unnecessary white boxes
- Files likely to change: `editor/ImageExport.js`, `editor/Molecule.js`,
  `tools/bime-cli.js`, `tests/test-manifest.js`,
  `tests/test_v3_1_0_reaction_map_legibility.js` (new),
  `tests/data/reaction_map_pilot.json` (new), and possibly reaction-map assertions
  in `tests/test_v2_4_13_reaction_map_svg.js` / `tests/test_v2_4_14_compound_labels.js`;
  `CHANGELOG.md`, `CLI.md`
- Files that should NOT change: `dist/*`, `versions.json`, `package.json`,
  `tools/editor-files.js`, any `*.html` page, `editor/Renderer.js`, `editor/sdg/*`,
  `editor/Layout.js`, `editor/SmilesParser.js`, `tests/test_v2_4_7_publication_export.js`

## Tests and Validation Expected
1. `node tests/test_v3_1_0_reaction_map_legibility.js` (narrowest)
2. `node tests/test_v2_4_13_reaction_map_svg.js`, `test_v2_4_14_compound_labels.js`,
   `test_v2_4_7_publication_export.js`, `test_v2_4_17_publication_kekule.js`
3. `node tools/run-tests.js` (full source suite). `release-check` is not required,
   because `dist/` is unchanged.
4. Manual: quickstart step 4 visual comparison against `bime_pilot/*_heavy.svg`,
   plus the SC-008 timing ratio.

## Blocking Issues
- None remaining. Resolved at Gate 2: fixture source = /media/JACK/repos/ctf/rxns/moiety_rxns/atomMapped_std, and analyze F1–F5 were applied. The original note follows.
- **T001 fixture source**: the three pilot reactions must be supplied as
  heavy-atom reaction SMILES. Candidate RXN files exist in `../combexp/aam/data/`
  and `../reconXmoieties/results/`, but which one fed the pilot, and how it was
  converted to SMILES, is the user's knowledge.

## Acceptable Risks
- The contrast figures in research.md are hand estimates until T004 and T009
  measure them.
- Browser text metrics differ from the Node heuristic, so browser figures may place
  numbers slightly differently. They are still deterministic per environment.
- Atoms that coincide because of layout (Feature B) can still cause collisions. They
  are excluded from SC-002 and visible as `forced` placements.

## Human Approval
- Approved: yes (slice)
- Approved option: First slice: T001–T012
- Approved tasks/scope: T001–T012 (Phases 1–2 + US1), done. T013–T017 (US2), done. T018–T021 (US3), done. T022–T026 (closeout) approved at Gate 3 on 2026-10-08.
- Required implementation invocation per constitution: `/speckit-implement`
  (or "Run the Spec Kit implementation phase for the active feature")
- Date (UTC): 2026-10-08
