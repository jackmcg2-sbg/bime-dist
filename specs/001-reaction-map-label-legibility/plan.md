# Implementation Plan: Reaction-Map SVG Label Legibility

**Branch**: `001-reaction-map-label-legibility` | **Date**: 2026-10-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-reaction-map-label-legibility/spec.md`

## Summary

Make the atom-mapped reaction figure (`bime aam --format svg` →
`ImageExport.toReactionMapSVG`) legible in three ways:

1. Replace the unconditional white knockout rect behind heteroatom labels with a
   per-text WCAG contrast check against the composited halo fill beneath it.
   Failures are remedied by a same-hue lightness shift, with a tight patch only as
   a fallback.
2. Place each map number at the lowest-overlap position among a fixed,
   deterministic candidate set around its atom, instead of a fixed offset below it.
3. Add `Molecule.prototype.removeExplicitHydrogens()` and an `aam --heavy-atoms`
   flag that strips explicit H before mapping.

The new rules are confined to the reaction-map path by an internal option, so
single-molecule SVG export is byte-identical. Design detail is in
[research.md](research.md), D1–D8.

## Technical Context

**Language/Version**: plain JavaScript (ES5-style IIFE modules), run in browsers and Node

**Primary Dependencies**: none (Principle I)

**Storage**: N/A

**Testing**: `node tests/<file>.js` suites through `tests/shim.js`; `node tools/run-tests.js`
(source only; the bundle suites run inside `tools/build.js` at release)

**Target Platform**: Node CLI (`bin/bime`, `tools/bime-cli.js`) and the browser bundle

**Project Type**: library + CLI

**Performance Goals**: SVG render step ≤ 2× BIME 3.0.3 on the pilot set, median of 5 (SC-008)

**Constraints**: deterministic output; no dependency; `toSVG` output byte-identical

**Scale/Scope**: reactions up to about 120 heavy atoms (the largest pilot, GDA1_HPRNStlr)

## Constitution Check

- **Implementation gate (II)**: The tasks in `tasks.md`, after Gate 2A and Gate 2,
  will change `editor/ImageExport.js`, `editor/Molecule.js`, `tools/bime-cli.js`,
  `tests/test-manifest.js`, a new test file and a new fixture in `tests/data/`. No
  source has been edited, and none will be before Gate 2 approval **and** an
  explicit `/speckit-implement`. ✅
  - *Disclosure*: during specify, clarify and checklist, the agent used inline
    `python3` heredocs to make text replacements in Spec Kit artifacts under
    `specs/001-…/`, and once in `.gitignore` at the user's direction. These are
    not source changes, but Principle II's wording ("temporary or inline scripts")
    is broad, so they are recorded here for the reviewer.
- **Zero dependencies (I)**: none added. No network access. Uses only `Math`,
  string handling, and the existing `measureText`. ✅
- **Tests (III)**: the narrowest suite is
  `node tests/test_v3_1_0_reaction_map_legibility.js` (new, registered in
  `tests/test-manifest.js`). Then `node tools/run-tests.js` must pass.
  `node tools/release-check.js` is **not** required: `dist/` is not touched,
  because the CLI loads `editor/` directly (research F11). ✅
- **Release integrity (IV)**: no change to `dist/`, `versions.json`, SRI, the
  manifest or the version. The version bump and CHANGELOG entry are deferred to the
  next release, which is outside this feature. The test file is named for the
  intended next MINOR (3.1.0), because a public API is added. ✅
- **Public interfaces**: there are three.
  - (a) The CLI flag `--heavy-atoms` is a compatible addition.
  - (b) `Molecule.prototype.removeExplicitHydrogens` is a compatible addition.
  - (c) The `aam --format svg` / `toReactionMapSVG` output changes visually. This
    was approved as default-on at clarify (2026-10-08), and its SVG structure stays
    valid.
  - `toSVG`, `toPublicationSVG` and `toPrintSVG` are unchanged and pinned. ✅
- **Architecture delta (V)**: [architecture-delta.yaml](architecture-delta.yaml)
  is written; see below. Awaiting the Gate 2A verdict.

## Architecture Impact

**Current architecture**: `tools/bime-cli.js` → (`SmilesParser`, `RDT`,
`ImageExport`, `ExportStamp`). `ImageExport` → (`Molecule`, `Layout`, `RDT`
optional, `SmilesWriter`/`MetaboliteLibrary` optional). `_buildSVGImpl` is shared
by every SVG export.

**Proposed delta**:
- Modified: `ImageExport.js`. A reaction-map-only branch inside `_buildSVGImpl`,
  gated by the internal `opts.legibleLabels` set by `toReactionMapSVG`. New
  private helpers, exposed as `ImageExport._legibility` for tests.
- Modified: `Molecule.js`. A new public method, `removeExplicitHydrogens`.
- Modified: `bime-cli.js`. `cmdAam` calls `rxn.removeExplicitHydrogens()` under
  `--heavy-atoms`, and the help text gains a line.
- Modified: `tests/test-manifest.js`. Registers the new suite.
- New dependency edges: **none**. The CLI→Molecule edge already exists, since the
  CLI uses `SmilesParser` output, which is a Molecule. No new module and no change
  to `tools/editor-files.js` or the pages.

**Alternatives considered**:
- A new `editor/LabelLegibility.js` module. It would be reusable by `Renderer.js`,
  but it costs edits to `editor-files.js`, every HTML page's script list, the CLI
  loader and the test shim, all for one caller. Rejected for now and recorded as a
  follow-up if the on-screen canvas adopts the rules.
- Changing `_buildSVGImpl` for all callers. Out of scope, and breaks pinned
  single-molecule tests.
- Stripping H inside `toReactionMapSVG`. It cannot run before mapping (FR-013);
  the spec's FR-012 was revised accordingly.
- The **smallest conforming alternative** is this proposal: no new module, no new
  edge, everything behind one internal option.

**Verdict**: APPROVE — Gate 2A, 2026-10-08 (user). Rationale: the delta conforms, adds no module or edge, and is the smallest conforming alternative.

## Project Structure

### Documentation (this feature)

```text
specs/001-reaction-map-label-legibility/
├── spec.md · human-loop.md · plan.md · research.md · data-model.md · quickstart.md
├── architecture-delta.yaml
├── contracts/ (api.md, cli.md)
├── checklists/ (requirements.md, rendering.md)
└── tasks.md            # after the Gate 2A approval only
```

### Source Code (repository root)

```text
editor/
├── ImageExport.js      # modified: legibility branch + _legibility helpers
└── Molecule.js         # modified: removeExplicitHydrogens()
tools/
└── bime-cli.js         # modified: aam --heavy-atoms + help line
tests/
├── test_v3_1_0_reaction_map_legibility.js   # new
├── test-manifest.js    # modified: register the new suite
└── data/
    └── reaction_map_pilot.json              # new: 3 pilot reaction SMILES + 3.0.3 baseline counts
```

**Structure Decision**: the existing single-project layout (`editor/`, `tools/`,
`tests/`). No new directories.

## Complexity Tracking

No constitution violations to justify.
