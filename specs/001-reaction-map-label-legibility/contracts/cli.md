# Contract: CLI addition

## `bime aam <reactionSmiles> --heavy-atoms`
- **New flag**, off by default. When present, `removeExplicitHydrogens()` runs on
  the parsed reaction before mapping (or before `--keep-mapping` builds its
  result). It applies to `--format text|json|svg`.
- **Help**: the `aam` per-command help gains one line:
  `--heavy-atoms   Strip explicit H atoms before mapping (heavy-atom figure).`
- **Exit codes and errors**: unchanged. A reaction that becomes empty cannot occur,
  because H-only components are exempt.

## `bime aam … --format svg` (behaviour change, no new flag)
- Labels and map numbers follow the legibility rules. The output differs from
  3.0.3 in: the removed or added knockout rects, label/map-number fill colours,
  map-number x/y positions, and occasionally map-number font sizes.
- Everything else (geometry, bonds, halos, arrow, captions, stamp) is identical.
