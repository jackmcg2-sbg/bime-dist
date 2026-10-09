# Feature Specification: Reaction-Figure Layout Quality

**Feature Branch**: `002-reaction-layout-overlaps`

**Created**: 2026-10-08

**Status**: Draft

**Input**: User description: "Reaction-figure layout quality, in two parts. (A) Module parity: the CLI (tools/bime-cli.js) and the test shim load the same layout modules as the browser bundle (SMSDLayout.js, SDGLayout.js, editor/sdg/*), so CLI figures draw cis double bonds as cis and get the same layout as the browser. (C) A fold-back repair pass in BIME's 2D layout: after placement, remove bond crossings and atom clashes caused by chains or branches folded back over the molecule. It rotates or flips subtrees about acyclic single bonds (stretching where needed), scored by LayoutQuality, without distorting rings or changing stereo depiction. Measured against the exploration's corpus sample (367 heavy-atom molecules) and the three pilot reactions, with RDKit as the external reference. Out of scope: reading coordinates from RXN/MOL input (option E), rewriting chain placement (option D), and any runtime dependency."

**Exploration**: [exploration.md](exploration.md), present in this directory
before this spec was written (Gate E: go, scope "A + C", 2026-10-08).

## Background

Feature 001 made labels and map numbers legible wherever the layout left room.
Where it did not, figures are still messy: bonds cross and atoms sit on top of
each other. The exploration found:

- **The overlaps come from the 2D layout of each molecule,** not from the
  figure code. About 70% of crossings are *fold-backs*: a chain or branch drawn
  back over a distant part of the same molecule (exploration E3, E4).
- **They are common in large metabolites.** In a sample of the maintainer's
  corpus, molecules with at least one bond crossing make up 12% at 16–30
  atoms, 39% at 31–50 atoms and 85% at 51–80 atoms. A reference toolkit
  (RDKit) draws the same molecules with almost none (E10).
- **BIME's existing correction passes don't remove them** (E7, E8, E12).
- **The command line runs a smaller set of layout modules than the browser**
  (E6). As a result, every cis double bond is drawn trans in CLI figures and
  CLI-run tests (E11). That is a chemistry error, not just a visual one.
- **Wedges are drawn without regard to geometry** (found during planning, research
  R5). The wedge-or-hash choice at a stereocentre comes from a stereo label alone.
  During layout no label is set, so the choice reduces to a coin flip: 28 of 58
  corpus stereocentres read back from the drawing with the wrong configuration.
  The browser shows this today. Module parity would bring it into CLI figures,
  which currently have no wedges.

## Clarifications

### Session 2026-10-08

- Q: Where should the fold-back repair apply? → A: Every layout (the editor, every image export and the command line), on by default, with no opt-out flag (FR-013).
- Q: How ambitious should the crossing targets be? → A: As drafted (SC-003, SC-005).
- Q: What performance cost is acceptable? → A: As drafted: layout at most 3× today's command-line median per size bin; pilot figures end to end at most 1.5× (SC-009).
- Q (planning stop-and-report): BIME draws about half of stereocentres with an inverted wedge, and parity would bring this into CLI figures. What should Feature 002 do? → A: Fix it in this feature (FR-004a, SC-002a, User Story 1).
- Q (planning stop-and-report): The repair prototype reaches about 14% / 34% of molecules with crossings (31–50 / 51–80 atoms), against targets of 10% / 25%. What should SC-003 hold? → A: Revise to the evidence (SC-003 amended).
- Q (slice-3 stop-and-report): A specified double bond inside a macrocycle whose drawn ring shape contradicts its geometry (AM1CCSitr) cannot be drawn both uncramped and correct without macrocycle re-layout. How is it handled? → A: Known exception. The drawing keeps the correct cis/trans relation (one end may be cramped). FR-004/SC-002 exempt double bonds whose atoms and substituents are all members of one ring of 8 or more atoms; they are listed by the tests and recorded in docs/known-defects.md.
- Q (slice-3 stop-and-report): Per-molecule layout time for 51+ atoms sits at the 3× limit (2.9–3.5×), and the speed levers break SC-003. What holds? → A: Relax to 4× above 50 atoms; ≤50 atoms stays 3×; figures stay 1.5× (SC-009 amended).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Correct stereochemistry in every figure (Priority: P1)

A researcher renders mapped reactions of unsaturated lipids (oleate, eicosanoids)
with `bime aam … --format svg`. Today every cis double bond in those figures is
drawn trans, and wherever wedges are drawn (in the browser today, and in the CLI
once it loads the same modules), about half of the stereocentres show the wrong
configuration. After this story, every figure draws each double bond with the
geometry its structure specifies, and every wedge or hash so that the drawing
reads as the input's configuration.

**Why this priority**: It is a correctness defect in published figures. It is
small and independent of the layout repair, and can ship first.

**Independent Test**: Render molecules with specified cis and trans double bonds,
and molecules with stereocentres, through the command line. Check from the
output coordinates which side of each double bond its substituents lie on.
Independently read the configuration of each stereocentre back from its
coordinates and wedges.

**Acceptance Scenarios**:

1. **Given** cis-2-butene, maleate or oleate, **When** it is laid out through
   the command line, **Then** the substituents of the specified double bond lie on
   the same side.
2. **Given** a molecule with a specified trans double bond, **When** it is laid
   out through the command line, **Then** the substituents lie on opposite sides.
3. **Given** any input, **When** it is laid out through the command line and
   through the browser module set in fresh processes, **Then** the coordinates are
   identical.
4. **Given** a molecule with specified stereocentres (an amino acid, a sugar, a
   steroid), **When** it is drawn, **Then** reading each stereocentre's
   configuration back from the drawn wedges and coordinates gives the input's
   configuration.

---

### User Story 2 - Large molecules drawn without folded-back chains (Priority: P1)

A researcher renders a mapped reaction involving cofactors, glycolipids or
polyglutamates (50–110 heavy atoms). Today long chains and branches are drawn
back across the molecule, so bonds cross and atoms pile up, and labels and map
numbers can't be placed cleanly. After this story, those fold-backs are
repaired. The molecule's rings stay regular, its stereochemistry is unchanged,
and the figure reads as a normal structure diagram.

**Why this priority**: This is the visual problem the maintainer reported
(problems 3 and 4). It dominates the remaining mess in the pilot figures.

**Independent Test**: Lay out the corpus sample and the pilot reactions, then
count bond crossings and close atom pairs per molecule before and after the
repair.

**Acceptance Scenarios**:

1. **Given** a molecule whose layout has a chain folded back across another part
   of the molecule, **When** it is laid out, **Then** that crossing is gone and
   no new crossing or clash has appeared in its place.
2. **Given** a molecule that already lays out with no crossings or clashes,
   **When** it is laid out, **Then** its coordinates are unchanged by the repair.
3. **Given** a molecule with stereocentres or specified double bonds, **When**
   the repair moves part of it, **Then** the stereochemistry read back from the
   drawing is identical to the input's.
4. **Given** the three pilot reactions, **When** they are rendered as mapped
   figures, **Then** the folded cores that remained messy after Feature 001
   (the GDA1 sugar cluster, the GGH bicyclic block, the CE2872 phosphate/ring
   pile-up) no longer have crossed bonds through them, beyond any the
   reference toolkit also draws.

---

### User Story 3 - A repeatable layout-quality benchmark (Priority: P2)

A maintainer changing the layout code wants to know whether the change helped
or hurt. After this story, one command lays out a fixed corpus sample. It reports
crossings, close pairs and timing per size bin, alongside stored reference
numbers. A test guards the thresholds this feature reaches, so a future
regression fails the test suite.

**Why this priority**: It turns the exploration's one-off measurements into a
guard, but the figures improve without it.

**Independent Test**: Run the benchmark on the unchanged code and confirm it
reproduces the exploration's baseline numbers (E10). Then run it on the
changed code and confirm the thresholds hold.

**Acceptance Scenarios**:

1. **Given** the stored corpus sample, **When** the benchmark runs, **Then** it
   reports, per size bin, the share of molecules with crossings, the mean
   crossings, the mean close pairs and the median layout time, next to the stored
   reference values.
2. **Given** a change that raises crossings above the guarded thresholds, **When**
   the test suite runs, **Then** the guard test fails and names the worst molecules.

---

### Edge Cases

- **Crossings that are geometrically unavoidable.** Some structures can't be
  drawn in 2D without a crossing: cages, bridged polycycles, some macrocycles.
  The repair must not distort rings trying to remove these; they are left as
  placed. The existing quality measure already distinguishes saturated-cage
  crossings.
- **Ring-to-ring crossings inside one fused ring system.** These are left to the
  ring placement and are not repaired by moving ring atoms.
- **Rotatable bonds.** A subtree hanging off a ring or a chain can only be moved
  as a rigid unit, pivoting on an acyclic single bond. Double, triple and ring
  bonds are never pivots.
- **Repair makes things worse.** If no move improves the layout, the original
  coordinates are kept. A move is accepted only if it lowers the total defect
  score without adding any new severe clash or abnormal bond length.
- **Single atoms, two-atom molecules, molecules with no rotatable bond:** no repair
  is attempted.
- **Disconnected input and reaction components:** each connected component is
  repaired on its own, as layout already treats them.
- **Very large molecules (more than 150 heavy atoms):** the repair runs within a
  bounded effort and stops when the budget is spent, keeping the best layout found.
- **Input with explicit hydrogens:** hydrogens move with the heavy atom they
  are attached to.
- **Molecules the browser lays out with the full module set today:** after module
  parity they lay out the same way from the command line. The repair pass then
  applies equally in both.

## Requirements *(mandatory)*

### Functional Requirements

#### Module parity (US1)

- **FR-001**: The command-line tool MUST load the same layout and refinement
  modules as the browser bundle, so that layout through the command line
  includes every step the browser runs.
- **FR-002**: The test harness MUST load the same layout modules, so that tests
  exercise the layout users actually get.
- **FR-003**: For the same input, layout through the command line and through the
  browser module set MUST produce identical coordinates in a fresh process.
- **FR-004**: Every double bond with specified cis/trans geometry MUST be drawn
  with that geometry in command-line output.
  *Exception (slice-3 stop-and-report): a double bond inside a macrocycle (ring of ≥8 atoms) whose substituents are ring members on both ends must keep the correct cis/trans relation, but may have a cramped end; it is listed, not failed.*
- **FR-004a**: Wherever a wedge or hash is drawn at a stereocentre, its choice
  (and the bond it is placed on) MUST follow from the drawn 2D geometry and the
  centre's specified configuration, so that the drawing reads back as that
  configuration. This applies to every layout caller, as FR-013 does.
- **FR-005**: Standalone pre-built command-line binaries MUST behave the same as
  the Node command line with respect to FR-001 and FR-004.

#### Fold-back repair (US2)

- **FR-006**: After a molecule is placed, layout MUST run a repair step. It
  detects bond crossings and close atom pairs and tries to remove them by moving
  whole subtrees: rotating or reflecting them about acyclic single bonds, or
  lengthening the pivot bond where rotation alone can't clear the defect.
- **FR-007**: A repair move MUST NOT change the internal geometry of any ring or
  fused ring system. Ring systems may only be moved rigidly as part of a subtree.
- **FR-008**: A repair move MUST NOT change the stereochemistry a reader would
  take from the drawing. Specified double-bond geometry and stereocentre
  configuration read back from the drawing MUST match the input, and any
  wedge/hash marks MUST stay consistent with the moved atoms.
- **FR-009**: Moves MUST be judged with the project's existing layout-quality
  measure, using its own thresholds (severe clashes, close pairs, crossings,
  bond-length warnings, acute angles). A move is accepted only if it lowers the total score without adding a
  severe clash or an abnormal bond length. If the final layout scores no
  better than the original, the original MUST be kept.
- **FR-010**: Any lengthened pivot bond MUST stay within the measure's warning
  range (0.65–1.25 × the standard bond length), so it is never flagged as abnormal.
- **FR-011**: The repair MUST leave unchanged the coordinates of any molecule that
  has no crossing and no close pair before repair.
- **FR-012**: The repair MUST be bounded in effort per molecule and MUST stop when
  the budget is spent, keeping the best layout found so far.
- **FR-012a**: For measurement only (SC-004 and the guard test), the repair MAY be
  disabled through an internal switch. The switch MUST NOT be documented as a user
  option or exposed as a command-line flag.
- **FR-013**: The repair MUST apply to every caller of the 2D layout (the
  editor, all image exports and the command line), not only to reaction figures.
  Mapped-reaction figures get it through the layout they already run. It is
  on by default, with no option to turn it off. The repair runs only as part of
  layout: it never moves atoms on its own, so atoms placed by hand in the editor
  move only when the user asks for a layout (for example, Clean).
- **FR-014**: Layout output MUST be deterministic: the same input in a fresh
  process produces byte-identical coordinates and figures.

#### Benchmark and guard (US3)

- **FR-015**: The repository MUST contain a fixed corpus sample of heavy-atom
  molecules, taken from the exploration, plus stored reference metrics from an
  external toolkit. Neither may be a runtime dependency.
- **FR-016**: A maintainer benchmark script (a repository tool, not a new `bime`
  subcommand; the `bime` command-line surface is unchanged) MUST report, per molecule-size bin, the share
  of molecules with crossings, the mean crossings, the mean close pairs and the
  median layout time, next to the stored references.
- **FR-017**: A test MUST guard the thresholds in SC-003 and SC-004, so a regression
  fails the suite and names the worst molecules.

#### General

- **FR-020**: Feature 001's outcomes MUST still hold on the three pilot reactions
  after the layout changes: every atom text item meets the contrast threshold
  (its SC-001); zero map-number/map-number and map-number/label overlaps for
  uncrowded atoms (its SC-002); and no background patch behind text that already
  meets the threshold (its SC-004). Re-pinning its tests (FR-019) does not waive
  these.

- **FR-018**: The feature MUST NOT add a runtime dependency or network access,
  and MUST NOT change any public API signature or command-line flag.
- **FR-019**: Pinned outputs in existing tests that change because of a layout
  change (for example, Feature 001's single-molecule hashes and pilot baselines)
  MUST be re-pinned deliberately. Each change must be listed with its cause, not
  silently overwritten.

### Key Entities

- **Layout defect** (reporting metric, used by SC-003, SC-004, SC-005 and the
  benchmark, as in the exploration): a bond crossing (two bonds that share no atom
  and properly intersect); a close pair (two non-bonded atoms closer than 0.6 ×
  bond length); a severe clash (closer than 0.35 × bond length); an abnormal
  bond length (outside 0.65–1.25 × bond length). The acceptance rule (FR-009)
  uses the quality measure's own thresholds instead, so the reported
  close-pair count is the stricter of the two.
- **Pivot bond**: an acyclic single bond. Rotating or reflecting the smaller side
  about it moves a subtree rigidly.
- **Subtree**: everything on one side of a pivot bond, including any ring systems
  it contains, moved as one rigid unit.
- **Corpus sample**: the exploration's 367 unique heavy-atom molecules, each
  with its source reaction file name and heavy-atom count, plus RDKit reference
  metrics for each.
- **Size bin**: heavy-atom count ranges 2–15, 16–30, 31–50, 51–80 and 81+.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the pilot reactions and the corpus sample, command-line and
  browser module sets produce identical coordinates (100% of molecules), each
  measured in a fresh process.
- **SC-002**: In command-line output, 100% of the double bonds with specified
  geometry in the corpus sample, plus cis-2-butene, maleate and oleate, are drawn
  with that geometry.
- **SC-002a**: Every specified stereocentre in the corpus sample and in a named
  stereo set (at least: L- and D-alanine, L-lactate, α-D-glucose, testosterone,
  cholesterol, and the stereocentres in the three pilot reactions) reads back
  from the drawing (coordinates plus wedges) with its input configuration: 100%.
  Baseline today: 30 of 58 corpus stereocentres.
- **SC-003**: On the corpus sample, the share of molecules with at least one
  crossing falls from 39% to at most 15% in the 31–50-atom bin, and from 85% to
  at most 35% in the 51–80-atom bin. The mean number of crossings per molecule
  in the 51–80-atom bin falls from 12.9 to at most 1.0. Total crossings across
  the sample fall by at least 85%. Baseline: exploration E10, CLI module set.
  *(Amended 2026-10-08 at the planning stop-and-report, from 10% / 25% / 75%,
  on prototype evidence: research R3.)*
- **SC-004**: On the corpus sample, no molecule ends with more crossings, close
  pairs or severe clashes than the same code produces with the repair disabled.
- **SC-005**: On the three pilot reactions rendered as mapped figures, total
  crossings fall by at least 75% (baseline 48 / 7 / 25), and no severe clash
  remains.
- **SC-006**: On the corpus sample, the stereochemistry read back from every
  repaired drawing matches its input (100%), and no ring changes shape: every
  ring bond length and internal angle is unchanged within 1%.
- **SC-007**: Laying out the same input twice, in separate fresh processes,
  gives byte-identical coordinates and figures.
- **SC-008**: The full existing test suite passes. Every re-pinned expected
  value is listed with its cause.
- **SC-009**: Median layout time per size bin on the corpus sample is at most 3×
  today's command-line median for molecules up to 50 atoms, and at most 4× for
  larger molecules. Rendering each pilot reaction end to end (mapping plus
  figure) takes at most 1.5× today's time. *(Amended 2026-10-09 at the slice-3
  stop-and-report, from 3× for every bin. Loading the browser's engine alone
  costs 2.1× at 51–80 atoms; whole figures measure 0.8–1.1×.)*

## Assumptions

- The corpus sample, which is derived from the maintainer's public-metabolite
  reaction files, is committed to the repository as a test fixture (SMILES, atom
  counts and source file names only). Confirmed by the maintainer at Gate 1.
- RDKit is used only to produce stored reference numbers, offline. It is not
  needed to run BIME, its tests or the benchmark.
- "Same as the browser" means the module set in `tools/editor-files.js`, which
  is the bundle order. The bundle in `dist/` is not rebuilt by this feature
  (constitution IV); rebuilding is a release task.
- The SC-005 threshold was confirmed by the maintainer at clarify. SC-003 was
  revised to the prototype's evidence at the planning stop-and-report.
  They are set from the exploration's evidence:
  RDKit reaches about 0%, and best-of-10 atom orderings alone already took
  CE2872 from 15 crossings to 1. They are targets for this feature, not proof
  that they can be reached; planning may revise them with evidence.
- Layout is history-dependent within one process (known-defects.md). All
  measurements in this feature use fresh processes or a fixed order. Fixing that
  dependence is out of scope.
- Out of scope: reading coordinates from RXN/MOL input (exploration option E);
  rewriting chain placement (option D); labels and map numbers (Feature 001);
  the reaction-scheme arrangement of components.
