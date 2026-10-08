# Implementation Receipt — Feature 001, slice T001–T012

## Prompt
`/speckit-implement` (no arguments). The approved scope at Gate 2 (2026-10-08) was
"First slice: T001–T012" (Phases 1–2 + US1).

## Final response
Slice T001–T012 is implemented and verified. The white knockout boxes are gone from
mapped-reaction SVGs. Each label and map number is now contrast-checked against the
halo beneath it and, if too faint, darkened within its own hue. Bonds stop clear of
the labels.

- Tests: new suite 19/19; affected suites 4_13 (10/10), 4_14 (9/9), 4_7 (11/11),
  4_17 (4/4) and 3_0_3 stamp (6/6); full `node tools/run-tests.js` 1662 passed, 0 failed.
- Pilots (3.0.3 → now): knockout rects 114/89/75 → 0/0/0; patches 0; symbols
  recoloured 0/0/6; map numbers darkened 141/222, 89/178 and 94/140. Render time is
  about 1.0× 3.0.3 (budget 2×).
- Single-molecule `toSVG`/`toPublicationSVG`/`toPrintSVG` are byte-identical
  (9 hashes pinned).
- Deviation: under Node, text measures 0 px wide (the shim stubs
  `getComputedTextLength`), so the legibility path uses a 0.6×size width fallback
  and trims bonds by it. Without that, removing the boxes would expose 166
  own-bond stubs inside labels.
- Not done (deferred at Gate 2): US2 map-number placement (map/label overlaps are
  still at baseline, 71/30/44), US3 `--heavy-atoms`, and closeout T022–T026.

Next: Gate 3.

## Diff summary
- `editor/ImageExport.js` (+230/−16):
  - Pure helpers: `_parseColor`, `_luminance`, `_contrast`, `_composite`,
    `_toHex`, `_rgbToHsl`, `_hslToRgb`, `_remedyColour`, `_remedyColourAll`.
    Exposed frozen as `ImageExport._legibility`.
  - `toReactionMapSVG` forces `opts.legibleLabels = true` and accepts
    `options.minContrast`.
  - In `_buildSVGImpl`: `legible` / `minContrast`; `legibleWidth` with the
    zero-width fallback; `labelRadius` uses it when legible; halo discs are
    recorded; `legibleFills` / `legibleColour` implement D3/D4. Symbol, charge,
    H-label, isotope and map-number colours go through `legibleColour` when
    legible, and the knockout and H-background rects are skipped. The legacy path
    is unchanged (pinned).
- `tests/test_v3_1_0_reaction_map_legibility.js` (new): measurement harness
  (H1–H4), single-molecule pin (P1), helper units (L1–L6), US1 (US1-a…h), and a
  `--write-baseline` mode.
- `tests/data/reaction_map_pilot.json` (new): 3 heavy-atom pilot SMILES, an
  explicit-H fixture for US3, the 3.0.3 baseline, and 9 pinned hashes.
- `tests/test-manifest.js`: registers the suite.
- Not source: Spec Kit artifacts under `specs/001-…/`, `.specify/feature.json`,
  `.specify/.implement-in-flight`, and the user-directed `.gitignore` edit from
  Gate 1.

## Tests
| Run | Result |
|---|---|
| `node tests/test_v3_1_0_reaction_map_legibility.js` | 19 passed, 0 failed |
| Same suite against the 3.0.3 `ImageExport.js` (temporary swap, restore verified with `cmp`) | 5 passed, 14 failed. US1-h catches 91 own-bond intrusions; the L/US1 tests fail as intended |
| `node tests/test_v2_4_13_reaction_map_svg.js` | 10/0 |
| `node tests/test_v2_4_14_compound_labels.js` | 9/0 |
| `node tests/test_v2_4_7_publication_export.js` | 11/0 |
| `node tests/test_v2_4_17_publication_kekule.js` | 4/0 |
| `node tests/test_v3_0_3_browser_export_stamp.js` | 6/0 |
| `node tools/run-tests.js` | 1662 passed, 0 failed (149.8 s) |
| `node tools/release-check.js` | not run; not required (`dist/` unchanged) |

T012: no existing assertion needed updating.

SC-008 timing (median of 5, mapping excluded, same machine and session), 3.0.3 →
now, in ms: GDA1 1932 → 2014 (1.04×), GGH 673 → 636 (0.95×), CE2872 795 → 783
(0.98×).

## Unresolved issues
- **Deviation (recorded in human-loop.md):** Node measures text as 0 px wide
  (`tests/shim.js` stub), which corrected research F7/D6. On the legibility path,
  bond trimming at labelled atoms uses the 0.6×size fallback. This stays inside
  `ImageExport.js`, behind `legibleLabels`.
- **Test refinement during T010:** US1-h was narrowed from "any bond" to "the
  label's own bonds, with coincident atoms excluded". The broad version counted
  other atoms' bonds crossing labels in folded layouts, which is Feature B. The
  narrowed guard was re-verified to fail on 3.0.3 (91 intrusions).
- **Harness bug found and fixed before the baseline was accepted:** the
  attribute regex dropped `x1`/`y1`, giving mapBond = 0. The baseline was
  re-recorded on untouched code, and H2 now covers the parser.
- **Fixture conversion (one-off, outside the repo):** the RXN files were
  converted with BIME's own `MolEditor.prototype._parseMolV2000` per `$MOL` block,
  plus an explicit-H strip and `SmilesWriter`. The script stayed in the session
  scratchpad, not the repository.
- Map-number overlaps remain (US2, deferred). Folded layouts in CE2872DIOer and
  GDA1 remain (Feature B).
- Browser rendering uses real text metrics, so its output will differ slightly
  from Node's; this is unverified in a browser.

## Other information
Before/after PNGs (session scratchpad, not committed): `scratchpad/after/*.png`
and `scratchpad/CE_base.svg` (3.0.3, same input).
