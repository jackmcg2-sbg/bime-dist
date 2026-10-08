# Phase 0 Research: Reaction-Map SVG Label Legibility

All findings come from reading the source at BIME 3.0.3 (`84a44be`), with
`editor/ImageExport.js` unless another file is named. No code was executed beyond
the existing CLI output already present in `bime_pilot/`.

## Findings from the code path (Principle VII)

| # | Finding | Where |
|---|---|---|
| F1 | `toReactionMapSVG` lays out the scheme, numbers map pairs 1…n in `result.mapping` key order, derives the trace halos, forces `publication: true`, auto-sizes at 34 px per bond with 30 px padding, and then calls the **shared** `_buildSVG`. | 277–358 |
| F2 | `_buildSVGImpl` is shared with `toSVG`, `toPublicationSVG` and `toPrintSVG`. Tests pin the single-molecule output: `test_v2_4_7` D1 says the default is unchanged, and E3 regex-pins `haloFill` and the two knockout-rect sites. | 674; tests |
| F3 | Halos: `r = max(fontSize×0.9, 9)` (14.4 px under publication's fontSize 16), `opacity="0.85"`, drawn before bonds. The palette is `COMPONENT_PAIR_PALETTE` (10 pale tints) or the neutral `#cccccc`. | 904–930, 74 |
| F4 | Label knockout: a rect filled with `haloFill` (the canvas colour, or `none` when transparent) is drawn **unconditionally** before every shown label. It is drawn again behind left/right H labels. | 1060–1066, 1108–1114 |
| F5 | Bonds are **already trimmed** at labelled atoms by `labelRadius = textWidth/2 + labelPad`. | 841–845, 942–946 |
| F6 | Map numbers: `y = ay + fontSize + 6` (baseline at `+12×0.3`), fill `#0d9488`, 12 px bold, centred, with no collision handling. | 1144–1149 |
| F7 | `measureText`: in a browser this is the real `getComputedTextLength()`. **Corrected during implementation (2026-10-08):** under Node, `tests/shim.js` (also loaded by `bime-cli`) defines a stub `document` whose `getComputedTextLength()` returns **0**, so the `0.6×` heuristic is never reached. In the CLI every label width is 0: bonds are trimmed by `labelPad` only (4 px), and the knockout rects are 8 px wide, which matches the pilot SVGs. | 142–162; tests/shim.js:18–39 |
| F8 | Publication uses `PRINT_COLORS` (N `#0000cc`, O `#cc0000`, …). Screen uses `ELEMENTS` colours (N `#2563eb`, O `#dc2626`). | 44, Molecule.js 19–21 |
| F9 | The chirality frame is `getNeighbors()` order, with the implicit H last. The parser converts SMILES-token order into this frame by permutation parity. | SmilesParser.js 773–830 |
| F10 | Adding an editor module means editing `tools/editor-files.js` **and** every page's script list, because `test_release_integrity` asserts page scripts equal `FILES`. The CLI and test shim also keep their own load lists. | release-integrity test:170; bime-cli.js 52–71 |
| F11 | The CLI loads `editor/` sources directly. `dist/` is not on the CLI path. | bime-cli.js 52–71 |

## Contrast figures (hand-computed, WCAG 2.x)

The fill is the halo composited at 0.85 over white. For the teal halo `#a5d8d2`
that gives ≈ `rgb(178,222,217)`, with relative luminance L ≈ 0.667.

| Text | Colour | L | Contrast vs teal halo | ≥ 3:1? |
|---|---|---|---|---|
| N (publication) | `#0000cc` | 0.044 | ≈ 7.7 | yes |
| N (screen) | `#2563eb` | 0.153 | ≈ 3.5 | yes, narrowly |
| O (publication) | `#cc0000` | 0.128 | ≈ 4.0 | yes |
| H label | `#666666` | 0.133 | ≈ 3.9 | yes |
| Map number | `#0d9488` | 0.230 | ≈ 2.6 | **no** |

**Consequence:** on the pilot figures (publication mode), most element labels pass
outright. Their white boxes simply disappear, which is the visible win. The
teal map number fails wherever it lands on a teal halo and will be darkened
within its own hue. These hand figures are to be confirmed by the T-test fixture;
they are estimates, not measurements.

## Decisions

### D1 — Gating: the new rules apply on the reaction-map path only
- **Decision**: `toReactionMapSVG` sets an internal option (`legibleLabels: true`)
  on the opts it passes to `_buildSVG`. `_buildSVGImpl` branches on it. With the
  option absent (`toSVG` and the other single-molecule exports), the existing code
  runs unchanged.
- **Rationale**: the spec scopes the change to the mapped-reaction export (F2), and
  the single-molecule output stays byte-identical (test_v2_4_7 D1/E3).
- **Alternatives**: changing `_buildSVGImpl` for every caller was rejected because
  it is out of scope and breaks pinned tests. A second copy of `_buildSVGImpl` was
  rejected because it means about 600 duplicated lines.

### D2 — Where the helpers live: inside ImageExport.js (no new module)
- **Decision**: pure helper functions (colour parsing, luminance, contrast,
  compositing, HSL lightness search, rect/segment overlap, candidate placement) go
  inside the `ImageExport.js` IIFE. They are exposed read-only as
  `ImageExport._legibility` for unit tests, following the leading-underscore
  convention already used for internals such as `RDT._splitReactionSides`.
- **Rationale**: a new module costs edits to `editor-files.js`, every HTML page, the
  CLI loader and the test shim (F10), for code with one caller.
- **Alternatives**: a new `editor/LabelLegibility.js`, which would be reusable by
  `Renderer.js` later, was rejected for now. It is the right move if the on-screen
  canvas adopts the rules, and it is recorded as a follow-up.

### D3 — Effective fill and contrast (FR-001…FR-003)
- **Decision**: for each text item, build its bounding box from the text metrics
  (D6). Collect the halo discs that intersect it. Candidate fills are the canvas,
  if the box is not fully inside one disc; each intersecting disc composited
  singly over the canvas; and all intersecting discs composited in draw order. The
  lowest contrast governs. Transparent counts as `#ffffff`. Threshold
  `CONTRAST_MIN = 3`, an internal constant overridable through an
  `options.minContrast` on the reaction-map export.
- **Rationale**: it meets FR-001's lowest-contrast-governs rule without pixel
  sampling, and it is deterministic.

### D4 — Remedy (FR-004, FR-005)
- **Decision**: convert the text colour to HSL. Step lightness in 1-percentage-point
  increments away from the fill's luminance (darker on light fills), keeping hue and
  saturation, and stop at the first shade that reaches the threshold. If lightness
  hits 0 or 100 without passing, keep the original colour and emit a patch: a
  `<rect rx="2">` sized to the measured text width + 2×1.5 px, by fontSize + 2 px,
  filled with the canvas colour (`#ffffff` when transparent, per the spec's
  Assumptions).
- **Rationale**: this is the smallest deterministic change that keeps hue exactly
  (CHK007).

### D5 — Map-number placement (FR-007…FR-010; resolves CHK008)
- **Standard offset** `d0`: the 3.0.3 distance from the atom centre to the
  number's box centre is `fontSize + 6 − (12×0.7 − (12+4)/2)`, about `fontSize + 6`
  px. `d0 = fontSize + 6` (22 px in publication mode).
- **Candidate set**: 8 compass directions at `d0`. The order starts at the direction
  closest to the negated sum of the bond unit vectors (the "free side"), then goes
  by increasing angular distance, ties broken clockwise. If no candidate is
  hard-clear: 8 directions at `1.4·d0`, then `1.8·d0`; then the same rings at 90% and
  then 75% font size (the FR-010 floor). Any candidate whose centre is nearer to
  another atom than to its own is discarded.
- **Score**: hard overlaps (another map number, any atom label or decoration) weigh
  1000 per px² of intersection area. Bond overlap weighs 10 per px of segment
  length inside the box, after inflating the box by half the stroke width. Another
  atom's halo weighs 1 per px² of overlap, approximated by the box-to-disc
  overlap. Ties go to the earlier candidate.
- **Order**: atoms are placed greedily, most crowded first (descending number of
  obstacles within `2·d0`), ties by ascending atom id, so that crowded atoms get
  first pick. Deterministic (FR-009).
- **Rationale**: the standard approach for discrete-candidate label placement; it is
  cheap at about 100 atoms × 48 candidates × local obstacles.

- **Amended during implementation (slice 2, 2026-10-08)**, after measurement on
  the pilots:
  - The candidate set is **16 directions** (22.5° steps), not 8.
  - The ring order is d0, **0.75·d0**, 1.4·d0, 1.8·d0, repeated at 90% and then
    75% font. The closer ring lets numbers stay nearest their own atom in tight
    regions.
  - Candidates nearer another atom are never chosen normally. If every candidate is,
    the **forced fallback** takes the one with the least hard overlap, then the
    widest own-vs-other margin.

  With 8 directions and no near ring, GDA1 had 16 map/map overlaps and 15
  nearer-another-atom violations. With these changes, all residuals are confined to
  layout-crowded atoms (another atom < 0.6·BL; spec SC-002 as amended).

### D6 — Text measurement basis (resolves CHK010)
- **Decision** *(amended during implementation; see the F7 correction)*: on the legibility path, widths come from `measureText`, falling back to `text.length × size × 0.6` when it returns 0 for non-empty text. The same width drives bond trimming at labelled atoms on that path, which keeps FR-006 true once the knockout rect is gone. Shared code and `toSVG` keep the raw `measureText`. Box height is
  `fontSize`, centred vertically on the glyph's visual centre, which is consistent
  with how the knockout rect is placed today. In Node the heuristic is used,
  which is deterministic, so the CLI output and the SC tests are reproducible.
  Browser output may differ slightly, but it is still deterministic per
  environment.

### D7 — Heavy-atom stripping (FR-012…FR-015)
- **Decision**: add `Molecule.prototype.removeExplicitHydrogens()`, which returns
  the number removed. For each H atom with exactly one neighbour that is a heavy
  atom, not isotopic, not in an H-only component, and with no charge:
  1. If the neighbour has `hydrogens >= 0` (an explicit count), increment it. If it
     is `-1` (auto), leave it, because auto-H re-derives the count.
  2. If the neighbour has a chirality token and the H sits at index *k* of its *n*
     neighbours, flip `@`↔`@@` when `(n−1−k)` is odd. This moves H to the frame's
     implicit-H-last slot (F9). If the neighbour then holds more than one implicit
     H it is no longer a stereocentre, and the token is left alone (CIP ignores
     it).
  3. `removeAtom(h)`, which already cascades bonds and curly arrows.
- The CLI flag `--heavy-atoms` on `aam` calls it on the parsed reaction **before**
  mapping (or before `resultFromExistingMapping` under `--keep-mapping`). Explicit
  H map pairs vanish with the atoms, and the numbering rule (F1) then re-numbers.
- **Rationale**: it lives where the chirality frame is defined. It is reusable by
  API callers before `RDT.mapReaction`, and the CLI change is a single call.
- **Alternatives**: rewriting the SMILES text with a regex was rejected as fragile
  (ring closures, brackets). Write-then-reparse was rejected because it is
  indirect and round-trips through SmilesWriter's choices.

### D8 — Tests and the baseline (routes CHK015)
- The narrowest new suite is `tests/test_v3_1_0_reaction_map_legibility.js`. It
  uses the 3 pilot reactions as fixtures in `tests/data/`, written as reaction
  SMILES, which the user supplies or the tasks extract. Before behaviour changes,
  it records the **3.0.3 baseline** overlap counts (SC-003) into the fixture.
  - **Open input**: the pilot SVGs do not embed their input SMILES. The tasks
    must obtain the three reaction SMILES from the user's pipeline. This is a
    blocking prerequisite, raised at Gate 2.
- Re-run the existing suites `test_v2_4_13_reaction_map_svg.js`,
  `test_v2_4_14_compound_labels.js`, `test_v2_4_7_publication_export.js` and
  `test_v2_4_17_publication_kekule.js`, then `node tools/run-tests.js`.

### D8a — Fixture source candidates (found read-only, 2026-10-08)
RXN copies of the pilot reactions exist in sibling repositories, for example
`../combexp/aam/data/rxnFiles/sanitized/GDA1_HPRNStlr.rxn` and
`../reconXmoieties/results/rxnfiles/merged_atomMapped/GDA1_HPRNStlr.rxn`. No
driver script producing `bime_pilot/` was found, and the BIME CLI does not read
RXN. The user must say which source and conversion the pilot used. Raised at Gate 2.
