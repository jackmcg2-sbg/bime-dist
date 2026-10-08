# Known defects

Observed facts about the code or toolchain that are not yet fixed. Each entry
names the evidence it rests on and the feature that found it.

## Layout and mapping depend on process history

**Found:** Feature 001 (reaction-map label legibility), 2026-10-08, on BIME 3.0.3.

The same reaction SMILES can be laid out (2D coordinates) and atom-mapped
differently depending on how many molecules the same Node process has parsed
before it. Atom and bond ids come from a module-global counter in
`editor/Molecule.js` (`_nextAtomId`, `_nextBondId`) with no reset, and the result
depends on those id values.

Evidence: parsing, mapping and rendering `GDA1_HPRNStlr` in a fresh process,
versus after rendering an esterification three times first, gave different
coordinates and map numbers. That is a different SHA-256 of the
`(x, y, mapNumber)` list: `03b7…` versus `b0d5…`. The result reproduced with the
original 3.0.3 `editor/ImageExport.js`, so it is not caused by the export code.
The script was a session scratch script; the steps above reproduce it.

Consequences:

- A CLI call (one process per reaction) is reproducible. A batch inside one
  process is not, unless the order is fixed.
- Test counts measured on large reactions can drift when a suite runs inside
  `node tools/run-tests.js` (one shared process) rather than standalone.
  `tests/test_v3_1_0_reaction_map_legibility.js` renders its pilot reactions
  first, in fixture order, to match its recorded baseline.
- Same-process timing loops that re-parse each iteration measure different
  layouts. Compare timings in fresh processes.

## Text measures 0 px wide under Node

**Found:** Feature 001, 2026-10-08.

`tests/shim.js` (which the CLI, `tools/bime-cli.js`, also loads) defines a stub
`document` whose `getComputedTextLength()` returns `0`. Under Node, the CLI and the
tests, `ImageExport`'s `measureText` therefore returns 0 for every string, and its
`length × size × 0.6` fallback is never reached, because that fallback is taken
only when `document` is undefined.

Consequences outside the reaction-map legibility path:

- Bonds are trimmed at labelled atoms by `labelPad` only (4 px), so their ends run
  under the glyphs.
- Knockout rects are `2 × labelPad` wide (8 px), narrower than the glyph.
- Implicit-H labels are positioned as if the element symbol had zero width (for
  example, the `H` of `OH` overlaps the `O`).

The reaction-map figure (`ImageExport.toReactionMapSVG` / `bime aam --format svg`)
works around this since Feature 001 (`legibleWidth` in `_buildSVGImpl`). The
single-molecule exports (`toSVG`, `toPublicationSVG`, `toPrintSVG`) still have the
defect. Their output is pinned byte-identical by
`tests/test_v3_1_0_reaction_map_legibility.js` (P1), so fixing it there needs its
own feature and new pins.
