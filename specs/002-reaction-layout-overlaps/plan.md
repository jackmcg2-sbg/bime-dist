# Implementation Plan: Reaction-Figure Layout Quality

**Branch**: `002-reaction-layout-overlaps` | **Date**: 2026-10-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-reaction-layout-overlaps/spec.md`

## Summary

This feature has three parts:

1. **Module parity.** The Node runtime (tests and CLI) loads the same layout
   engine as the browser. The list comes from one place, `tools/editor-files.js`
   `ENGINE_FILES`, loaded by `tests/shim.js`, which the CLI already calls. This
   fixes cis double bonds drawn trans in the CLI.
2. **Wedge fix.** Wedge or hash is chosen from the drawn geometry, so that parity
   doesn't spread an existing defect (half of the stereocentres drawn inverted)
   into CLI figures.
3. **Fold-back repair.** A new, bounded, deterministic step inside
   `Layout.layoutComponent` moves whole subtrees rigidly about acyclic single
   bonds (reflect, stretch, rotate) to remove crossings and close pairs. A
   final `LayoutQuality` guard keeps the result only if it is no worse.

A maintainer benchmark, a committed corpus fixture and a guard test hold the
results. The prototype evidence is in [research.md](research.md) R3: corpus
crossings −90%, pilot crossings 48/7/20 → 1/1/0, no molecule worse.

## Technical Context

**Language/Version**: JavaScript (ES5-style IIFE modules in `editor/`); Node ≥ 18 for CLI and tests.

**Primary Dependencies**: none (constitution I). RDKit is used offline only, to build the fixture's reference numbers.

**Storage**: one committed JSON fixture, `tests/data/layout_corpus.json`.

**Testing**: `node tests/test_v3_2_0_layout_quality.js` (narrowest, new) → `node tests/test_v3_1_0_reaction_map_legibility.js` (FR-020) → `node tools/run-tests.js`.

**Target Platform**: browser bundle (`editor/*` scripts, `dist/` at release) and the Node CLI (`tools/bime-cli.js`, `bin/bime`).

**Project Type**: library + CLI (single project).

**Performance Goals**: SC-009. Layout per size bin ≤ 3× today's CLI median; pilot figures end to end ≤ 1.5×; full suite ≤ 1.3× its pre-feature quiet time; guard test ≤ 120 s (research R10).

**Constraints**: deterministic (no randomness, no clock in decisions); bounded effort (R6); no public signature or CLI flag changes (FR-018).

**Scale/Scope**: molecules up to ~110 heavy atoms in the corpus; the repair skips components over 300 heavy atoms.

## Constitution Check

- **Implementation gate (II)**: Approved tasks will change `editor/Layout.js`,
  `editor/sdg/NonplanarBonds.js`, `tools/editor-files.js`, `tests/shim.js`,
  `tools/bime-cli.js` and `tests/test-manifest.js`, and will add the guard
  test, the fixture and `tools/layout-bench.js`. No source has been edited. None
  will be before Gate 2 approval **and** an explicit `/speckit-implement`. ✅
  - *Disclosure*: planning research ran scratch prototypes **outside the
    repository** (session scratchpad). They monkey-patched or post-processed BIME
    in memory, and one emulated parity through a `node -r` preload during a full
    test run. No repository source was modified. Copies are kept under
    `exploration/prototype/` as Spec Kit material. Text edits to Spec Kit
    artifacts used inline `python3`/`sed`, as in Feature 001.
- **Zero dependencies (I)**: no runtime or build dependency is added, and there is
  no network fetch. RDKit appears only in the offline fixture generator, which
  lives beside the spec (`fixture-gen/`), not under `tools/`. Tests and the
  benchmark read the stored JSON. ✅
- **Tests (III)**: the narrowest suite is
  `node tests/test_v3_2_0_layout_quality.js`; then the Feature 001 suite
  (FR-020); then `node tools/run-tests.js`. `node tools/release-check.js` is
  **not** required, because `dist/` is unchanged. Note: browser users of the
  shipped `dist/` see the change only after a release rebuild. ✅
- **Release integrity (IV)**: there is no change to `dist/`, `versions.json`,
  SRI or the manifest. CHANGELOG `[Unreleased]` gets Fixed entries (cis/trans,
  wedges) and a Changed entry (layout repair). The version bump belongs to the
  release. The test is named for 3.2.0 because layout output changes. ✅
- **Public interfaces**: no signature, flag or file-format change. Layout output
  changes everywhere (approved at clarify: every layout, no opt-out). One
  internal option, `Layout.options.foldBackRepair`, exists for measurement only
  (FR-012a). The CLI gains a stderr diagnostic for static bundles that lack the
  layout modules. ✅
- **Architecture delta (V)**: [architecture-delta.yaml](architecture-delta.yaml)
  is written; see below. Gate 2A: APPROVE_WITH_ADR; ADR-0001 written.

## Architecture Impact

**Current architecture**: `tools/bime-cli.js` → `tests/shim.js` (`loadAll`) →
`editor/{Molecule, SmilesParser, …}`. The CLI then requires `RDT`, `Layout`,
`ImageExport` and a few others. `editor/Layout.js` looks up `SMSDLayout`,
`SDGLayout`, `SDG.*` and `Templates` as optional globals, which the browser
pages and bundle provide but Node never did. `tools/editor-files.js` is the
bundle's module list, used by the build, with no requires of its own.

**Proposed delta**:

- `tools/editor-files.js` gains `UI_FILES` and `ENGINE_FILES`.
- `tests/shim.js` → `tools/editor-files.js` is a **new edge**, so the shim loads
  `ENGINE_FILES`.
- `Layout.js` gains private repair functions and Step 16R. Step 16b (wedges)
  moves last. The internal option `foldBackRepair` is added.
- `NonplanarBonds.js` gets geometry-based wedge sense.
- The CLI's static-bundle guard is widened, with a warning.
- New: `tools/layout-bench.js` (→ `tests/shim.js`, a new edge mirroring the
  CLI's), the guard test and the fixture.
- No new `editor/` module, no page script-list change, no `dist/` change.

**Alternatives considered**:

- Repair in a new `editor/sdg/FoldBackRepair.js`. A cleaner unit, but it touches
  every HTML page's script list, the bundle list and the build, for one caller.
  Recorded as a follow-up if it grows.
- Hard-coded module lists in the shim and the CLI. Rejected: that recreates the
  drift that caused the defect.
- Parity only in the CLI. Rejected by FR-002.
- The **smallest conforming alternative** is this proposal.

**ADR**: recommended under V-A ("introduces a shared data representation"). The
engine/UI classification becomes the single definition of what every Node
consumer loads, and every future `editor/` module must be classified. The
proposal is a short `docs/decisions/0001-node-loads-engine-module-set.md`.

**Verdict**: APPROVE_WITH_ADR — Gate 2A, 2026-10-08 (user). Rationale: the delta conforms, adds no editor module and no cycle, and is the smallest conforming alternative. The engine/UI classification is a durable shared representation, recorded as [ADR-0001](../../docs/decisions/0001-node-loads-engine-module-set.md) before implementation.

## Project Structure

### Documentation (this feature)

```text
specs/002-reaction-layout-overlaps/
├── exploration.md, exploration/        # Bundle E evidence + planning prototypes (exploration/prototype/)
├── spec.md, checklists/                # requirements (Gate 1 passed)
├── plan.md                             # this file
├── architecture-delta.yaml             # Gate 2A
├── research.md, data-model.md, quickstart.md, contracts/{api,cli}.md
├── fixture-gen/layout_corpus_build.py  # offline RDKit generator (provenance)
└── tasks.md                            # next (/speckit-tasks), only after Gate 2A approves
```

### Source Code (repository root)

```text
editor/
├── Layout.js                 # Step 16R repair + step reorder + foldBackRepair option
└── sdg/NonplanarBonds.js     # geometry-based wedge sense
tools/
├── editor-files.js           # + UI_FILES, ENGINE_FILES
├── bime-cli.js               # widened static-bundle guard + warning
└── layout-bench.js           # NEW maintainer benchmark
tests/
├── shim.js                   # loadAll loads ENGINE_FILES
├── test-manifest.js          # registers the guard
├── test_v3_2_0_layout_quality.js   # NEW guard test
└── data/layout_corpus.json   # NEW fixture
```

**Structure Decision**: a single project. Code changes sit in the two layout
modules plus the loaders; measurement lives in `tools/` and `tests/`.

## Suggested slicing (for /speckit-tasks)

1. **Fixture + baseline + benchmark** (before any source change): build the
   fixture, then `layout-bench.js --write-baseline` on unmodified code.
2. **US1a — module parity** (shim, editor-files, CLI guard). Re-run the suite.
3. **US1b — wedges** (NonplanarBonds, step reorder), with the stereo read-back tests.
4. **US2 — fold-back repair** (Step 16R), with the corpus, pilot, ring and
   determinism guards and FR-020.
5. **Closeout**: CHANGELOG, timing (SC-009, R10), visual check, receipts.

Slice 2 alone already fixes cis/trans in the CLI. Slice 2 must not ship without
slice 3: with parity on and wedges unfixed, CLI figures would show wrong wedges.

## Complexity Tracking

None. There are no constitution violations to justify.
