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
- **Testing rule** (Feature 002): a test that compares two layouts (repair on
  vs off, CLI vs engine, before vs after a change) must lay them out in fresh
  processes with identical history: the same molecules in the same order before
  the one compared. Comparing two runs in one process measures the history,
  not the change. `tests/test_v3_2_0_layout_quality.js` (`jobs()`) is a worked
  example.

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

## SMILES parser drops a bare `*` wildcard atom

**Found:** Feature 002 (reaction-layout-overlaps), 2026-10-08.

`SmilesParser.parse` reports `Unexpected character "*"` for an unbracketed
wildcard atom (valid SMILES), and builds no atom for it. The rest of the
molecule is parsed, so every later atom index shifts by one per bare `*`.
`[*]` in brackets is unaffected.

Evidence: 4 molecules of the Feature 002 corpus sample
(`tests/data/layout_corpus.json`: FUCGALFUCGALACGLCGALGLUSIDEt, HMR_7168 ×2,
HMR_9492). Each has its RDKit atom count minus one per bare `*`. The
layout-quality guard tolerates exactly this error and skips these molecules in
index-based checks.

## CIP labels disagree with RDKit on three corpus stereocentres

**Found:** Feature 002, 2026-10-09. **Unverified:** it is not known which
labeller is right.

On the input SMILES (no drawing involved), `CIPStereo.assignRS` labels three
centres R where RDKit's `rdCIPLabeler` says S:
- CRBS_PTCSA_TEOStlr atoms 27 and 39 (a sterol ester);
- G3PI45DP_12OCTAtrr atom 35 (a phosphoinositide).

The drawn wedges read back as the input's `@`/`@@` in every case, so this is a
CIP-ranking question, not a depiction one.
`tests/test_v3_2_0_layout_quality.js` (US1-e) prints them as info.

## A double bond inside a macrocycle can keep a cramped end

**Found:** Feature 002, 2026-10-09. Accepted as an exception to FR-004 (spec
clarification, slice-3 stop-and-report).

When both atoms of a specified double bond belong to one ring of 8 or more atoms,
and each end's other substituent is also a ring member, the drawn ring
conformation may contradict the specified geometry. Reflecting the one movable
exocyclic substituent then gives the right cis/trans relation but leaves that
end with both groups on one side of the double bond. Drawing it both uncramped
and correct needs macrocycle layout that honours E/Z (ring placement), which is
not implemented.

Evidence: AM1CCSitr (cyclosporin-like, 33-membered ring), atom 49. The guard
lists it (`listed: … macrocycle, FR-004 exception`) and still checks the relation.

## Layout history-dependence also reaches cis/trans correctness

**Found:** Feature 002, 2026-10-09; extends "Layout and mapping depend on process
history" above.

The same molecule can get a different cis/trans drawing depending on what the
process laid out before it. AM1CCSitr's in-ring double bond is drawn with
a cramped end when the corpus is laid out in full fixture order, but correctly in a
process that lays out only the molecules with specified double bonds.
Comparisons in Feature 002's guard therefore run in fresh child processes with the
same history on both sides.
