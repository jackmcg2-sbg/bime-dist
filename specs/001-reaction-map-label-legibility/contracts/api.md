# Contract: Programmatic API additions

## `Molecule.prototype.removeExplicitHydrogens()` (new, public)
- **Effect**: removes every explicit H atom that has exactly one neighbour, where
  that neighbour is a heavy atom, the H is not isotopic (`isotope === 0`), carries
  no charge, and does not belong to an H-only component. Bonds and curly arrows
  referencing the H are removed with it (via `removeAtom`).
- **Neighbour update**: when `hydrogens >= 0` it is incremented, and `-1` (auto)
  is left as is. Chirality: a token at a tetrahedral neighbour is flipped when
  moving the H from neighbour index *k* (of *n*) to the implicit-last slot is an
  odd permutation, `(n−1−k) % 2 === 1`.
- **Returns**: the number of atoms removed. A molecule with nothing to strip is
  untouched and returns 0.
- **Ids**: surviving atom and bond ids are unchanged.
- **Intended use**: call on a parsed reaction **before** `RDT.mapReaction`.

## `ImageExport.toReactionMapSVG(mol, result, options)` (existing, behaviour change)
- The legibility rules are always on (FR-018). There is no option to restore 3.0.3
  labels.
- New optional `options.minContrast` (number, default 3).
- Unchanged: the signature, the other options, the auto-sizing, and the stamp
  handling by the caller.

## `ImageExport._legibility` (new, internal; underscore = not public API)
Pure helpers exposed for unit tests only: `parseColor`, `luminance`, `contrast`,
`composite`, `remedyColour`, `placeMapNumbers`. They are not documented for users.

## Unchanged (pinned)
`ImageExport.toSVG`, `toPublicationSVG` and `toPrintSVG` produce byte-identical
output to 3.0.3 for the same input.
