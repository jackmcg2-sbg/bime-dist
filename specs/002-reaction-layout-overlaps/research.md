# Research: Reaction-Figure Layout Quality

Phase 0 for [plan.md](plan.md). Problem-space evidence is in
[exploration.md](exploration.md) (E#/V# ids). This file records the
solution-space decisions. Prototype scripts live in the session scratchpad, not
the repository. The ones the decisions rest on are copied to
`exploration/prototype/` for reproducibility; none is repository source.

All timings were measured on the maintainer's machine, sometimes under load from
concurrent runs. They are indicative only. The implementation re-measures
timings on a quiet machine against a baseline taken the same way (SC-009).

## R1 — What "module parity" loads, and where

**Decision.** Define the *engine module set* as `tools/editor-files.js` `FILES`
(the bundle order) minus a named set of UI-only modules:

- `Renderer.js`, `Tools.js`, `MolEditor.js`, `CanvasView.js`, `CanvasSurface.js`,
  `FocusLens.js` and `PageFormats.js` are excluded;
- `History.js` and `ToolbarPrefs.js` are already loaded by the shim and stay.

`tools/editor-files.js` exports the set as `ENGINE_FILES`, next to `FILES`, so a
module added to the bundle is picked up automatically unless it is UI.
`tests/shim.js` `loadAll()` loads `ENGINE_FILES` in order. The CLI's
`loadEditor()` already calls `shim.loadAll()` first, so it gets parity without
its own list. Its remaining explicit `require`s become no-ops (require cache).

**Rationale.**
- The CLI is missing `Templates.js` (ring-system templates, Layout Step 2b),
  `SMSDLayout.js` (Steps 10–11), and `SDGLayout.js` plus `editor/sdg/*` (Steps
  14, 15b and 16, including E/Z correction). Measured in this research and in
  exploration E6.
- All 49 bundle modules load under Node with the shim, with no errors.
- Loading cost: current CLI set 40 ms, engine set 65 ms, all 49 modules 60 ms.
- With the engine set emulated through a scratch preload (`node -r`), the full
  suite passes: **1678 passed, 0 failed, 244 s**. Parity alone needs no
  re-pinning. Feature 001's pinned hashes are single-ring molecules that the
  extra passes leave unchanged.

**Alternatives.**
- Hard-code the extra modules in the shim and the CLI. Rejected: two lists drift
  from the bundle again, which is how this defect arose.
- Load all 49 modules. Rejected: UI modules have no role in the CLI, and
  `MolEditor` and `Renderer` assume a DOM. They load today, but nothing
  guarantees they will.
- Load parity only in the CLI, not in tests. Rejected by FR-002: tests must
  exercise the layout users get.

## R2 — Where the repair runs in the pipeline, and pipeline order

**Decision.** Add a new step in `layoutComponent`, and make wedge assignment
the last geometry-dependent step:

```
… Step 15b (adaptive rescue)
Step 16a  E/Z correction            (existing)
Step 16R  fold-back repair          (NEW)
Step 16c  align to longest axis     (existing, rigid)
Step 16d  rotate standalone rings   (existing)
Step 16e  place explicit H          (existing)
Step 16f  macro-chain linearise     (existing, rigid)
Step 16b  wedge/hash assignment     (MOVED to last; FR-004a)
```

**Rationale.**
- Repair after 16a: the E/Z geometry is already correct, and the repair
  preserves it (R4). Repair before 16c, so the repaired molecule is still
  aligned horizontally. The prototype ran after 16c, which is why its
  molecules came out tall (visual check, `bime_pilot/compare/*_compareB.png`).
- Wedges last: once wedges follow geometry (R5), every step that moves atoms
  must come before wedge assignment. 16d flips rings and 16e places H, and both
  change local geometry. 16c and 16f are rigid rotations, so they would be safe
  either way.
- Repair runs once per connected component, as layout does. It runs only inside
  layout (FR-013), so editor atoms move only when the user asks for a layout.

**Alternatives.**
- Repair as a post-pass outside `Layout.layout` (the prototype). Rejected:
  alignment, ring flips and wedges would then all run on the unrepaired
  geometry.
- Repair before Step 15. Rejected: Step 15's polygon snap and chain relaxation
  would undo part of it.

## R3 — The repair algorithm and what it achieves

**Decision.** A deterministic, greedy, defect-driven search over rigid subtree
moves:

- **Pivots.** Single bonds that are not in a ring, where both ends have degree
  ≥ 2. For each pivot (u, v), the subtree is the side containing v. A side is
  used only if it is at most half the molecule, so the larger part stays put.
- **Moves.**
  - *Reflect* the subtree across the line u–v.
  - *Stretch* the pivot by +0.2 × bond length (to 1.2×, inside the 0.65–1.25×
    warning range, FR-010).
  - *Rotate* the subtree about u by ±30°, ±60°, ±90°, ±120° or 180°.
- **Score.** The existing quality terms for the atom pairs and bond pairs that
  a move can change: severe clash, close pair, crossing, bond length, acute
  angle. The reporting close-pair term (0.6 × bond length) is added so the
  search optimises the measured target. Every move is rigid, so only
  moved-vs-fixed pairs need re-scoring.
- **Greedy step.** Each iteration applies the single move with the largest
  score decrease. Ties go to the first candidate in bond order, then move
  order, which makes the search deterministic.
- **Escape.** When no single move improves, try the K = 8 best "sideways" moves,
  each followed by the best single move. Accept the pair only if it improves
  the score in total.
- **Final guard (FR-009).** Re-evaluate the whole molecule with the existing
  `LayoutQuality` measure. Keep the repaired layout only if it has no more hard
  failures and no higher penalty than before; otherwise restore the original.

**Evidence** (prototype on the corpus sample, parity module set; molecules with
crossings → after repair):

| Bin | Before | After | Mean crossings after | Severe clashes | Molecules made worse |
|---|---|---|---|---|---|
| 16–30 | 19.0% | 2.5% | 0.09 | 0 | 0 |
| 31–50 | 45.5% | 13.6% | 0.21 | 0 | 0 |
| 51–80 | 86.5% | 33.8% | 0.88 (from 11.92) | 0 | 0 |
| 81+ (n=6) | 100% | 83.3% | 4.33 | 0 | 0 |

- Total crossings: 1,120 → 116 (−90%). The final guard reverted 1 molecule.
- Escape step, tried on the 39 molecules still crossing: crossings 105 → 65,
  but only 1 more molecule fully cleared. It is kept because it reduces
  crossings; it does not change the per-molecule share.
- Pilots (crossings / close pairs): GDA1 48/76 → 1/1; GGH 7/27 → 1/0;
  CE2872 20/29 → 0/1.
- What remains (on 39 molecules): 68 chain-over-ring and 33 chain-over-chain
  crossings, 2 ring-vs-ring, 2 inside ring systems. These are still
  fold-backs, but they sit where no single or paired rigid move clears them.
- Reflect-only moves (ablation) reach only −65% in total, so stretch and rotate
  are needed.

The original SC-003 targets (≤10% / ≤25% of molecules) were not reached. At
the planning stop-and-report the maintainer chose "Revise to evidence": ≤15% /
≤35%, a mean of ≤1.0 crossings per molecule at 51–80 atoms, and −85% in total.

**Alternatives.**
- Reflect only. Too weak (−65%).
- Simulated annealing or random restarts. Rejected: they need a seeded random
  source to stay deterministic, and their gains are unproven here.
- Rewriting chain placement (option D). Out of scope by Gate E.
- Best of N atom orderings (exploration option B). It would need N full
  layouts, and the repair already covers the gain it showed.

## R4 — Stereo safety of the moves (FR-008)

**Decision.** Two guards keep the moves stereo-safe:

1. Ring bonds and double bonds are never pivots.
2. After each candidate move, check every double bond with specified geometry
   (`CIPStereo.doubleBondEZ` ≠ null). If a move changes which side of the
   double bond a substituent lies on, reject it.

Tetrahedral centres need no move guard. Wedges are assigned after the repair
from the final geometry (R2, R5), so any rigid move, a reflection included,
still gets a correct wedge.

**Rationale.** Reflecting a subtree whose root is a substituent of a double bond
cannot flip that bond's E/Z, because an isometry with a fixed point keeps sides.
*Rotating* a subtree about u, where u is a double-bond atom, can swing the
substituent across the double-bond axis. The check catches that case directly,
and it is cheap.

## R5 — Wedge correctness (FR-004a, CHK012)

**Finding.**
- `NonplanarBonds.assignTetrahedral` chooses wedge or hash from the centre's
  label alone (`label === 'R' ? WEDGE : DASH`). It ignores which bond carries
  the wedge and where the other neighbours lie.
- During layout no CIP label is set. On all 58 corpus stereocentres the label
  was `none`, so the code falls back to `'@' → S`. That is not a valid mapping
  either: `@`/`@@` describe neighbour order, not R/S.
- RDKit, reading the configuration back from a MOL file of BIME's coordinates
  plus wedges, gives **30 correct and 28 inverted** (48%), with none missing.
- Six simple molecules (L/D-alanine written two ways, (R)/(S)-2-butanol,
  L-lactate) all read back correctly, which validates the read-back method; the
  errors appear in sugars, steroids and lipids.

**Decision.**
- Keep `NonplanarBonds`' existing choice of *which* bond to wedge (its scoring
  prefers acyclic, terminal and least-crowded bonds).
- Compute *wedge vs hash* from geometry. Take the centre's neighbours in the
  SMILES order that `@`/`@@` refers to, with any implicit H in its SMILES
  position. Give the chosen neighbour z = +1 (wedge) or −1 (hash) and the others
  z = 0, then take the sign of the signed volume.
- Pick the z sign whose handedness matches `@`/`@@`. With three explicit
  neighbours and an implicit H, the implicit H is placed opposite the
  neighbours' mean direction at z = 0. This follows the usual 2D-to-parity
  convention, the inverse of what MOL readers do.
- The mapping is written once in `NonplanarBonds`. The test oracle (below)
  does not share it.

**Read-back method for tests (independent of the fix):**
- (a) *Offline reference.* For each stereocentre in the corpus sample and in the
  named stereo set, RDKit reads the configuration back from the input SMILES;
  the resulting CIP labels (R/S) are stored in the fixture with provenance (R7).
- (b) *In-repo read-back.* The test derives `@`/`@@` from the drawing with its
  own helper: wedge z, 2D neighbour angles, and the neighbour order in the parsed
  molecule. It writes that onto a copy, runs `CIPStereo.assignRS`, and compares
  the R/S with the stored RDKit labels.

Two independent stacks (RDKit's labels, BIME's CIP on the read-back parity)
must agree, so a shared sign error can't pass silently.

**Data gap.** The corpus sample's SMILES carry stereo for only 14 molecules,
because the RXN-to-SMILES extraction kept little stereo. The named stereo set in
SC-002a (L/D-alanine, L-lactate, α-D-glucose, testosterone, cholesterol and the
pilots' stereocentres) covers ring and steroid cases that the corpus misses.

## R6 — Effort bound (FR-012, CHK010)

**Decision.** The bound is a count, not a clock, so it stays deterministic:

- at most **60 greedy iterations** per component;
- the escape step runs at most **8 times** per component, with K = 8;
- at most **50,000 move evaluations** per component in total;
- components with more than **300 heavy atoms** skip the repair; it would be too
  costly, and no such molecule is in scope.

The search stops at whichever limit comes first and keeps the best layout found.

**Rationale.**
- No molecule in the sample hit the 40-iteration cap of prototype v1.
  Prototype v2 converged within 60.
- Move evaluations are ≈ (pivots × 2 sides) × 13 moves per iteration. For an
  80-atom molecule that is ≈ 2,000 per iteration, so 50,000 allows about
  25 iterations at that size. That is where convergence happened.
- Prototype v2 time at 51–80 atoms: median 140 ms of repair on a 138 ms
  layout; p95 440 ms. The 81+ bin: median 270 ms. Against SC-009, layout plus
  repair has to stay within 3× today's CLI layout median per bin. This is
  re-measured on a quiet machine during implementation. If it fails, the
  levers in order are: fewer rotation angles (drop ±90° and ±120°), then a
  smaller K, then the evaluation cap.

## R7 — Fixture, reference metrics and provenance (FR-015, CHK007)

**Decision.**
- **`tests/data/layout_corpus.json`** holds:
  - for each molecule: source `.rxn` file name, heavy-atom count, SMILES and size
    bin, plus RDKit reference metrics (crossings, close pairs, severe clashes);
  - for each stereocentre: its RDKit CIP label;
  - a `provenance` block: toolkit `RDKit 2026.03.6`, depictor
    `rdDepictor.Compute2DCoords` (CoordGen off), the sampling rule ("every 57th
    file of `atomMapped_std`, sorted; map numbers cleared; H removed by a SMILES
    round-trip; unique SMILES; molecules RDKit cannot sanitise dropped: 271"),
    date, and the generator script path.
- **The generator script**, `specs/002-reaction-layout-overlaps/fixture-gen/layout_corpus_build.py`, is committed for
  provenance. It is kept beside the spec, not under `tools/`, so `tools/` stays
  dependency-free JavaScript. It is run offline only and needs RDKit and the corpus directory.
  It is not part of the test run or the build (constitution I).
- **The named stereo set** (SC-002a) is stored in the same file with RDKit labels.
- **The baseline block**: BIME metrics with the CLI module set before the
  feature (exploration E10), recorded by the benchmark on unmodified code
  before any source change, in the way Feature 001 recorded its T004 baseline.

## R8 — Benchmark and guard (FR-016, FR-017)

**Decision.**
- **`tools/layout-bench.js`** is a maintainer script, not a `bime` subcommand
  (FR-016 as amended at Gate 1).
  - It lays out every fixture molecule in one process, in fixture order, and
    reports per bin: share of molecules with crossings, mean crossings, mean
    close pairs, severe clashes and median time, next to the RDKit and baseline
    columns.
  - `--json` gives machine output. `--no-repair` uses the internal switch
    (FR-012a) for SC-004.
  - `--write-baseline` records the baseline block, and is run only on
    unmodified code.
- **`tests/test_v3_2_0_layout_quality.js`** is the guard. It is named for the
  next MINOR, because layout output changes.
  - It runs the corpus with and without repair through the internal switch
    (SC-003, SC-004), checks stereo read-back (SC-002a, R5), runs the
    cis/trans set (SC-002), checks ring rigidity (SC-006) and pilot crossings
    (SC-005), and runs FR-020 (Feature 001's outcomes) through Feature 001's
    harness.
  - It names the worst molecules on failure.

## R9 — Pre-built binaries (FR-005, CHK021)

**Finding.**
- No binary build exists in the repository. `bin/bime` is a Node shim.
- `loadEditor()` short-circuits when `RDT`, `SmilesParser` and `Layout` are
  already global, which is the case for a statically bundled binary built
  elsewhere.

**Decision.**
- Widen the short-circuit test so it also requires the engine-only globals
  (`SDG`, `SDGLayout`, `SMSDLayout`, `Templates`).
- If a static bundle lacks them, `loadEditor` writes a one-line warning to stderr
  ("layout modules missing from this build; figures may differ from the
  browser") and continues. It cannot load files dynamically there.
- Verify with a unit test that pre-populates the globals: the full set gives no
  reload and no warning; a partial set gives the warning.
- Building a binary is out of scope. FR-005 is met for any static bundle built
  from `ENGINE_FILES`, and the build documentation says so.

## R10 — Test-suite run time (CHK028)

**Decision.** Record the suite's quiet-machine time before the change and after
each slice, in the receipts. The budget is: full suite at most **1.3×** its
pre-feature quiet time, and the new guard test at most **120 s**.

**Rationale.**
- Parity alone ran the suite in 244 s, but the pre-feature figure (646 s) was
  taken under load, so the two are not comparable. A same-machine, same-load
  pair is needed.
- The guard lays out 367 molecules twice, with and without repair. At the
  prototype's speed that is about 60–90 s. Feature 001's suite already takes
  about 136 s, so the guard should not double that.

## R11 — Determinism (FR-014, SC-007)

**Decision.**
- The repair iterates bonds in `mol.bonds` order and moves in a fixed order;
  ties keep the first candidate.
- It uses no `Math.random`, no wall clock and no object-key ordering.
- Within one process, layout still depends on history (known-defects.md), so
  SC-007 is tested in two fresh child processes.
