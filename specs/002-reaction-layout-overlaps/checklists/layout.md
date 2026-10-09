# Layout Requirements Quality Checklist: Reaction-Figure Layout Quality

**Purpose**: Unit tests for the requirements covering module parity, the fold-back repair (ring and stereo preservation, acceptance rule, effort bound), determinism, the benchmark and guard, and re-pinning
**Created**: 2026-10-08
**Feature**: [spec.md](../spec.md)
**Audience / timing**: reviewer at Gate 1 and at PR review · **Depth**: standard

Ticked items are resolved, with the closing artifact named. Open items carry a
proposed destination, decided at Gate 1.

## Requirement Completeness

- [x] CHK001 - Is "the browser module set" defined by a single authoritative source, so that "same modules" in FR-001/FR-002 is unambiguous? [Completeness, Spec §FR-001, Assumptions] — closed by: Assumptions (`tools/editor-files.js` bundle order)
- [x] CHK002 - Does the spec require that Feature 001's outcomes (no map-number/label overlaps, no knockout boxes, contrast) still hold after the layout changes, or only that its tests are re-pinned? [Gap, Spec §FR-019] — closed by: FR-020 (Gate 1 fix)
- [x] CHK003 - Are all repair move types (rotate, reflect, lengthen pivot) and the set of allowed pivots enumerated? [Completeness, Spec §FR-006, Edge Cases] — closed by: FR-006 + Edge Cases ("Rotatable bonds")
- [x] CHK004 - Are the cases where no repair is attempted enumerated (single atoms, no rotatable bond, defect-free molecules)? [Completeness, Spec §FR-011, Edge Cases] — closed by: FR-011 + Edge Cases
- [x] CHK005 - Does the spec say whether the repair can move atoms when layout is *not* invoked (e.g. an editor user's hand-placed atoms), or only when layout runs? [Gap, Spec §FR-013] — closed by: FR-013 (repair only runs as part of layout; Gate 1 fix)
- [x] CHK006 - Are the contents of the stored corpus fixture specified (molecules, file names, atom counts, reference metrics)? [Completeness, Spec §FR-015, Key Entities] — closed by: FR-015 + Key Entities "Corpus sample"
- [x] CHK007 - Is the provenance of the stored reference metrics (toolkit, version, settings) required to be recorded with them? [Gap, Spec §FR-015] — closed by: research.md R7 (provenance block)

## Requirement Clarity

- [x] CHK008 - Is "close pair" defined consistently with the existing quality measure the acceptance rule uses? The spec defines it at 0.6 × bond length, but the measure's own close-pair threshold is 0.45 ×. [Conflict, Spec §Key Entities, §FR-009] — closed by: FR-009 + Key Entities "Layout defect" (acceptance uses the measure's thresholds; 0.6 × is the reporting metric; Gate 1 fix)
- [x] CHK009 - Is "abnormal bond length" pinned to one of the measure's two ranges (warning 0.65–1.25 × or rescue 0.55–1.45 ×)? [Ambiguity, Spec §FR-009, §FR-010, Key Entities] — closed by: FR-010 + Key Entities (warning range 0.65–1.25 ×; Gate 1 fix)
- [x] CHK010 - Is the per-molecule effort bound in FR-012 quantified (moves tried, time, or both)? [Clarity, Spec §FR-012] — closed by: research.md R6 (count-based budget)
- [x] CHK011 - Is "lowers the total score" tied to a named score with a defined tie rule (no change on equal score)? [Clarity, Spec §FR-009] — closed by: FR-009 (existing measure's penalty; original kept unless strictly better)
- [x] CHK012 - Is "stereochemistry read back from the drawing" given a measurement method (for example, perceive CIP/E-Z from 2D plus wedges and compare with the input's)? [Measurability, Spec §FR-008, §SC-006] — closed by: research.md R5 (two independent read-back stacks)
- [x] CHK013 - Are size bins defined with exact boundaries? [Clarity, Spec §Key Entities] — closed by: Key Entities "Size bin"

## Requirement Consistency

- [x] CHK014 - Are the baselines for SC-003 (exploration, pre-parity CLI) and SC-004 (same code, repair disabled) stated unambiguously and kept distinct? [Consistency, Spec §SC-003, §SC-004] — closed by: SC-003 ("Baseline: exploration E10, CLI module set"), SC-004 ("with the repair disabled")
- [x] CHK015 - SC-004 compares against "the repair disabled", but clarify removed any opt-out. Does the spec allow an internal, non-public way to disable the repair for measurement? [Conflict, Spec §SC-004, §FR-013, Clarifications] — closed by: FR-012a (internal, undocumented switch; Gate 1 fix)
- [x] CHK016 - FR-016 asks for a "benchmark command" while FR-018 forbids changing any command-line flag. Is it stated that the benchmark is a maintainer tool, not a new `bime` subcommand? [Conflict, Spec §FR-016, §FR-018] — closed by: FR-016 (maintainer script, not a `bime` subcommand; Gate 1 fix)
- [x] CHK017 - Do FR-007 (rings rigid) and FR-010 (pivot may lengthen) agree, given that pivots are acyclic? [Consistency, Spec §FR-006, §FR-007, §FR-010] — closed by: FR-006 (pivots are acyclic single bonds only)
- [x] CHK018 - Is determinism (FR-014, SC-007) scoped consistently with the known history-dependence defect? [Consistency, Spec §FR-014, Assumptions] — closed by: FR-014/SC-007 ("fresh process") + Assumptions

## Acceptance Criteria Quality

- [x] CHK019 - Are the crossing targets quantified per size bin with explicit baselines? [Measurability, Spec §SC-003, §SC-005] — closed by: SC-003, SC-005 (confirmed at clarify)
- [x] CHK020 - Is ring preservation stated with a numeric tolerance? [Measurability, Spec §SC-006] — closed by: SC-006 (1% on ring bond lengths and angles)
- [x] CHK021 - Can FR-005 (pre-built binaries behave the same) be verified objectively, and is a binary build in scope for verification? [Measurability, Spec §FR-005] — closed by: research.md R9 (widened guard + warning + unit test)
- [x] CHK022 - Is the cis/trans requirement measurable on a named set of molecules? [Measurability, Spec §SC-002] — closed by: SC-002 (corpus specified-geometry bonds + three named molecules)

## Scenario & Edge Case Coverage

- [x] CHK023 - Are unavoidable crossings (cages, bridged systems, macrocycles) addressed so that the repair doesn't chase them? [Edge Case, Spec §Edge Cases] — closed by: Edge Cases (first bullet)
- [x] CHK024 - Is the exception path specified, where every move makes things worse? [Exception Flow, Spec §FR-009, Edge Cases] — closed by: FR-009 + Edge Cases ("Repair makes things worse")
- [x] CHK025 - Are explicit hydrogens and disconnected components addressed? [Coverage, Spec §Edge Cases] — closed by: Edge Cases
- [x] CHK026 - Is the behaviour for very large molecules (above the corpus sample's range) addressed? [Edge Case, Spec §FR-012, Edge Cases] — closed by: Edge Cases (>150 atoms) + FR-012

## Non-Functional Requirements

- [x] CHK027 - Are layout and end-to-end time budgets quantified? [Non-Functional, Spec §SC-009] — closed by: SC-009 (confirmed at clarify)
- [x] CHK028 - Is a budget stated for full test-suite run time, given that every test will now load more layout modules (the suite already grew from ~150 s to 355–947 s in Feature 001)? [Gap, Non-Functional] — closed by: research.md R10 (≤1.3× suite, ≤120 s guard)
- [x] CHK029 - Is "no runtime dependency" stated, including for the reference toolkit? [Non-Functional, Spec §FR-015, §FR-018, Assumptions] — closed by: FR-015, FR-018, Assumptions (RDKit offline only)

## Dependencies & Assumptions

- [x] CHK030 - Is the assumption that the corpus sample may be committed (derived from the maintainer's files) confirmed by the maintainer? [Assumption, Spec §Assumptions] — closed by: Gate 1 decision "Yes, commit it" (Assumptions updated)
- [x] CHK031 - Is the `dist/` bundle's status explicit (browser users of `dist/` see the repair only after a release rebuild)? [Dependency, Spec §Assumptions] — closed by: Assumptions (constitution IV)
- [x] CHK032 - Is the sampling bias in the corpus (271 molecules RDKit could not sanitise were dropped) acknowledged where the thresholds are set? [Assumption, exploration Synthesis] — closed by: exploration.md Synthesis (carried forward); thresholds reference E10 explicitly
