# Contract: Command line and maintainer tools

## `bime` (all subcommands)
- **No new flags and no removed flags** (FR-018).
- `loadEditor()` loads the engine module set (via `shim.loadAll()`), so every
  subcommand that lays out a molecule (`clean`, `export`, `aam --format svg`)
  gets the browser's layout, including E/Z correction, the repair, and wedges.
- **Static-bundle path** (pre-built binaries): the short-circuit now also checks
  for `SDG`, `SDGLayout`, `SMSDLayout` and `Templates`. If any is missing, one
  line goes to stderr:
  `bime: layout modules missing from this build; figures may differ from the browser`.
  Exit status is unchanged.
- **Output changes** (intended):
  - `clean` and `export` coordinates and SVG change for molecules that had
    crossings or close pairs, or a specified cis double bond.
  - Molfile/SDF export changes only in its coordinates. `MolfileWriter` writes
    the stereo column from `bond.stereo` and never reads `depictStereo`, so the
    depiction wedges don't reach MOL files. That is unchanged and out of scope.

## `tools/layout-bench.js` (new, maintainer script)
```
node tools/layout-bench.js [--json] [--no-repair] [--bin 51-80] [--write-baseline]
```
- Reads `tests/data/layout_corpus.json` and lays out every molecule in one
  process, in fixture order.
- Prints a per-bin table: BIME (now) | baseline | RDKit. `--json` gives the
  report object (data-model).
- `--no-repair` sets `Layout.options.foldBackRepair = false` for the run.
- `--write-baseline` writes the `baseline` block. Run it only on code without
  this feature's source changes (task order enforces this).
- Exit status 0. This tool reports and does not judge; the guard test judges.

## `specs/002-reaction-layout-overlaps/fixture-gen/layout_corpus_build.py` (new, offline, provenance only; kept out of `tools/`)
```
.venv/bin/python specs/002-reaction-layout-overlaps/fixture-gen/layout_corpus_build.py <atomMapped_std dir> > tests/data/layout_corpus.json
```
- Needs RDKit. It is never run by the tests or the build, and is not a
  dependency of BIME (constitution I).
