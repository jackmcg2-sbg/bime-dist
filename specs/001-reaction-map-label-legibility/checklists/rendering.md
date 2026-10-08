# Rendering Requirements Quality Checklist: Reaction-Map SVG Label Legibility

**Purpose**: Unit tests for the requirements covering the contrast rule, map-number placement, heavy-atom stripping, determinism and compatibility
**Created**: 2026-10-08
**Feature**: [spec.md](../spec.md)
**Audience / timing**: reviewer at Gate 1 and at PR review · **Depth**: standard

## Requirement Completeness

- [x] CHK001 - Does the spec define the effective fill when one text item straddles several fills (part halo, part canvas, or two overlapping halos of different colours)? [Gap, Spec §FR-001] — closed by: FR-001 (lowest-contrast fill governs)
- [x] CHK002 - Are contrast requirements specified for both halo palettes, publication (default) and screen, rather than only one? [Gap, Spec §FR-001] — closed by: FR-001 (both palettes)
- [x] CHK003 - Are all atom-attached text kinds (symbol, H label, charge, isotope, map number) enumerated as subject to the contrast rule? [Completeness, Spec §FR-001] — closed by: FR-001
- [x] CHK004 - Are the remedy order and the fallback for low contrast both fully specified? [Completeness, Spec §FR-004] — closed by: FR-004
- [x] CHK005 - Is it specified which obstacles a map number must avoid (map numbers, labels, decorations, bonds, other atoms' halos, reaction-centre rings)? [Completeness, Spec §FR-008, Edge Cases] — closed by: FR-008 + Edge Cases (RC rings)
- [x] CHK006 - Are the exemptions from heavy-atom stripping fully enumerated (isotopic H, H-only components, H not bonded to exactly one heavy atom)? [Gap, Spec §FR-013] — closed by: FR-013 (three exemptions)

## Requirement Clarity

- [x] CHK007 - Is "the element's hue stays recognisable" stated in a measurable form? [Clarity, Spec §FR-004] — closed by: FR-004 (HSL hue and saturation kept, lightness only)
- [x] CHK008 - Are "standard offset" and the candidate set quantified, or explicitly delegated to the plan with a fixed baseline? [Clarity, Spec §FR-007, §FR-010] — closed by: research.md D5 (routed to plan, resolved there)
- [x] CHK009 - Is "overlap" defined precisely enough to be counted (text box against text box, and text box against a stroked bond segment, with any positive-area intersection counting)? [Clarity, Spec §SC-002, §SC-003] — closed by: SC-002 (overlap definition)
- [x] CHK010 - Is "tight" patch sizing defined against a named text-measurement basis? [Clarity, Spec §FR-005] — closed by: research.md D6 (routed to plan, resolved there)
- [x] CHK011 - Is the 3:1 threshold stated once and referenced consistently, including whether it is configurable? [Clarity, Spec §FR-003, Assumptions] — closed by: FR-003 + Assumptions (configurability delegated to plan)

## Requirement Consistency

- [x] CHK012 - Is the edge case about map numbers under the keep-existing-mapping mode consistent with the existing rule that displayed numbers are reassigned 1…n in mapping order? [Conflict, Spec Edge Cases vs. §FR-018] — closed by: Edge Cases (renumbering rule) + SC-007
- [x] CHK013 - Is FR-018's "structure unchanged" consistent with FR-006's bond clipping, which changes bond end-points at labelled atoms? [Consistency, Spec §FR-006, §FR-018] — closed by: FR-018 (FR-006 carve-out)
- [x] CHK014 - Do FR-010's font-reduction floor and SC-002's zero-overlap goal agree on what happens when even the floor collides? [Consistency, Spec §FR-010, §SC-002] — closed by: FR-010 (least-overlap fallback counts against SC-002)

## Acceptance Criteria Quality

- [x] CHK015 - Is the baseline for SC-003 (map-number/bond overlaps in 3.0.3) fixed to a reproducible measurement on named inputs? [Measurability, Spec §SC-003] — closed by: tests/data/reaction_map_pilot.json `baseline` (T004, 2026-10-08)
- [x] CHK016 - Is the measurement method for SC-008 (render time) defined, including what is timed and how many repetitions? [Measurability, Spec §SC-008] — closed by: SC-008 (median of 5)
- [x] CHK017 - Is SC-007's comparison against "manually pre-stripped" input tied to a defined stripping procedure rather than the user's unpublished script? [Measurability, Spec §SC-007] — closed by: SC-007 (FR-013 procedure)

## Scenario & Edge Case Coverage

- [x] CHK018 - Are requirements defined for the exception path where heavy-atom stripping meets malformed input (an H with two neighbours, or bridging hydrides)? [Coverage, Exception Flow, Gap] — closed by: FR-013 (non-1-neighbour H kept)
- [x] CHK019 - Is the coincident-atom exclusion (Feature B) bounded with a numeric threshold in both the edge cases and SC-002? [Edge Case, Spec §SC-002] — closed by: Edge Cases + SC-002 (0.3 × bond length)
- [x] CHK020 - Is behaviour specified when map numbers are disabled while labels still follow the contrast rule? [Coverage, Spec §FR-011] — closed by: FR-001 applies to all text independently of FR-011

## Non-Functional, Dependencies & Assumptions

- [x] CHK021 - Is determinism specified for both label placement and colour remedies, including tie-breaking? [Completeness, Spec §FR-009, §FR-016] — closed by: FR-009 + FR-004 ("smallest shift") + FR-016
- [x] CHK022 - Is the zero-dependency constraint stated as a requirement and not only as an assumption? [Traceability, Spec §FR-017] — closed by: FR-017
- [x] CHK023 - Is the assumption "transparent background is treated as white" justified, and is its consequence for dark-page use stated? [Assumption, Spec Assumptions] — closed by: Assumptions (dark-page consequence)
- [x] CHK024 - Are the new public interfaces (CLI flag, programmatic option) identified as public-interface additions requiring compatibility review? [Dependency, Spec §FR-012] — closed by: FR-012 (public-interface note)
