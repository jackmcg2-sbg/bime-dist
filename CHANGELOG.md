# Changelog

Notable changes per release. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Heavy-atom reaction figures.** `bime aam --heavy-atoms` strips explicit
  hydrogen atoms before mapping, for any output format, so figures and reports
  cover heavy atoms only. Isotopic and charged H, H₂/H⁺ and stereocentres are
  preserved. For library use, call `Molecule.prototype.removeExplicitHydrogens()`
  before `RDT.mapReaction`.

### Changed

- **Legible mapped-reaction figures.** In `bime aam --format svg` /
  `ImageExport.toReactionMapSVG`, atom labels no longer sit in white boxes. Each
  label and map number is contrast-checked (WCAG 3:1) against the coloured halo
  beneath it and darkened within its own hue only when needed. Map numbers are
  placed at the least-cluttered position around their atom instead of a fixed
  spot below it, so they no longer overlap each other, labels or bonds, except
  where the 2D layout itself crowds atoms together. Bonds now stop clear of
  labels. Single-molecule SVG export is unchanged.

## [3.0.3] — 2026-07-12

A major release: teaching-grade chemical correctness across the built-in
library, a single unified molecule + reaction editor, and a leaner, more
reliable workbench.

### Added

- **Provenance-stamped browser SVG export.** Publication-quality SVG exports
  from the workbench now carry a BIME provenance stamp (version + fingerprint),
  matching the command-line tool.

### Changed

- **One unified editor.** Draw a molecule — or a reaction with `>>` — on the
  same canvas. No separate modes.

### Fixed

- **Teaching-grade chemistry.** Dozens of built-in structures and the SMILES
  writer were corrected so each molecule renders and exports its chemically
  correct constitution and stereochemistry — including cis/trans (E/Z) and R/S.
  A new valence-sanity check guards the whole library against regressions.
- **Always boots.** The workbench no longer starts blank in a background tab.

### Migration

No action required — a drop-in update.

## [2.4.16] — 2026-06-11

Geometric (cis/trans) isomers are now captioned correctly on mapped-reaction
figures.

### Fixed

- Compound captions on `bime aam <reaction> --format svg` figures no longer
  confuse a cis isomer with its trans partner — for example, maleate could be
  captioned "Fumarate".

## [2.4.15] — 2026-06-01

Render a figure from a mapping you already have.

### Added

- **`bime aam --keep-mapping`.** If your reaction SMILES already carries `:n`
  atom-map numbers, this uses them verbatim — building the figure (or the
  JSON/text report) from your mapping **without re-running the mapper**.

## [2.4.14] — 2026-06-01

Publication-ready mapped-reaction figures from the command line.

### Added

- **Mapped-reaction SVG figures.** `bime aam <reaction> --format svg` renders a
  publication-quality figure of an atom-atom-mapped reaction.
- **Per-component compound labels.** Each component can be captioned with its
  compound name, so a scheme reads like a journal figure.

---

Earlier history is omitted from the public changelog.
