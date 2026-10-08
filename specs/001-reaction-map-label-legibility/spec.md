# Feature Specification: Reaction-Map SVG Label Legibility

**Feature Branch**: `001-reaction-map-label-legibility`

**Created**: 2026-10-08

**Status**: Draft

**Input**: User description: "Improve generated atom-mapped reaction images: (1) white background boxes on heteroatom labels (O, N, …) when not needed — detect limited contrast and handle it, e.g. N is always blue, so if it sits on a colour giving minimal contrast either give it a background or change its colour; (2) atom-map index numbers overlap each other, other atoms, and bonds; fold the user's existing explicit-hydrogen stripping into BIME. Overlapping bonds and atoms (problems 3–4) are a separate, later feature."

**Exploration**: none — direct request. The evidence was gathered in-session from
three pilot figures in `bime_pilot/` (`GDA1_HPRNStlr_heavy.svg`,
`GGH_10FTHF7GLUl_heavy.svg`, `CE2872DIOer_heavy.svg`), each stamped as produced by
BIME 3.0.3's mapped-reaction SVG export. The defects are directly observable and
traced to their code paths, and the user had already decided the scope (two
features, labels first), so no open problem-space question remained.

## Background

The mapped-reaction figure paints a soft coloured halo disc behind each mapped
atom (trace colouring), then draws bonds, then element labels, then map numbers.
In BIME 3.0.3 every non-carbon label is preceded by an opaque rectangle in the
canvas colour (white), whatever lies beneath it. Over a coloured halo this shows as
a white box. (Bonds are already trimmed back from labelled atoms by a label radius,
so the rectangle is not needed to hide the bond's own ends. *Corrected 2026-10-08
during planning: an earlier draft claimed otherwise.*) Map numbers are always placed at a
fixed offset directly below their atom, with no check against anything else in the
figure.

## Clarifications

### Session 2026-10-08

- Q: When a label has too little contrast against the halo beneath it, which remedy applies? → A: Recolour first, with a patch as fallback (FR-004).
- Q: Should the new legibility rules be the default or opt-in? → A: The default for every mapped-reaction SVG, with no legacy flag (FR-018, SC-006).
- Q: What render-time budget applies? → A: At most 2× the BIME 3.0.3 SVG render time on the pilot set (SC-008).
- Q (slice-2 stop-and-report): How should layout-crowded atoms be judged? → A: They are excluded from SC-002, SC-003 and FR-010's nearest-own rule when another atom is within 0.6 × bond length (Feature B).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Labels without unnecessary white boxes (Priority: P1)

A researcher renders an atom-mapped reaction to a figure. Heteroatom labels (O, N,
S, P, halogens, …) sit cleanly on their coloured halo or on the plain background,
with no visible white box, as long as the label is readable there. A box or colour
adjustment appears only where the label would otherwise be hard to read, such as a
blue N on a teal halo.

**Why this priority**: The white boxes are the most visible defect and appear on
almost every heteroatom in every mapped figure.

**Independent Test**: Render each of the three pilot reactions and inspect every
element label. Each label either has no background patch and meets the contrast
threshold against the fill beneath it, or has been remedied and meets it after the
remedy.

**Acceptance Scenarios**:

1. **Given** an O label on a pale halo whose composited fill already gives contrast
   at or above the threshold, **When** the figure is rendered, **Then** no
   background patch is drawn behind the O, and the bonds meeting that atom stop
   short of the label instead of running through it.
2. **Given** an N label whose blue colour against the composited halo fill falls
   below the threshold, **When** the figure is rendered, **Then** the label is
   remedied (see FR-004) and the remedied label meets the threshold.
3. **Given** a heteroatom with no halo on a white background, **When** the figure
   is rendered, **Then** no background patch is drawn and bonds are clipped at the
   label.
4. **Given** a figure rendered with a transparent background, **When** contrast is
   evaluated, **Then** the canvas is treated as white (see Assumptions) and the
   output is otherwise produced by the same rules.

---

### User Story 2 - Map numbers that don't collide (Priority: P1)

A researcher reads atom-map numbers to follow atoms from reactants to products.
Every map number is readable, sits visibly next to its own atom, and does not
overlap another map number, another atom's label, or (wherever a free position
exists) a bond.

**Why this priority**: Overlapping indices make the mapping, the point of the
figure, unreadable. It is co-equal with Story 1.

**Independent Test**: Render the three pilot reactions and compute the bounding
boxes of all map numbers, element labels and bond segments. Count the pairwise
overlaps.

**Acceptance Scenarios**:

1. **Given** two adjacent mapped atoms whose default below-atom positions would
   overlap, **When** the figure is rendered, **Then** the two map numbers are
   placed so that neither overlaps the other.
2. **Given** a mapped atom with a bond running straight down from it, **When** the
   figure is rendered, **Then** its map number is placed in a free direction rather
   than on top of the bond.
3. **Given** the same input rendered twice, **When** the outputs are compared,
   **Then** every map-number position is identical (deterministic).
4. **Given** a crowded atom where every candidate position collides with something,
   **When** the figure is rendered, **Then** the least-colliding candidate is
   chosen, and the number stays unambiguously closest to its own atom.

---

### User Story 3 - Heavy-atom-only figures built in (Priority: P2)

A researcher whose reaction input carries explicit hydrogen atoms asks BIME directly
for a heavy-atom-only mapped figure, instead of pre-processing the input with an
external script. Explicit hydrogens are removed before mapping and rendering, and
the hydrogen count is still shown on heteroatom labels (for example OH, NH₂).

**Why this priority**: This removes a manual step the user already does and
standardises it, but it isn't a visual-quality defect itself.

**Independent Test**: Take a reaction with explicit H atoms. Render it with the
heavy-atom option and compare it with rendering the same reaction after the H atoms
were removed beforehand. Both figures show the same heavy atoms, the same
mapping-derived numbering, and the same H counts on labels.

**Acceptance Scenarios**:

1. **Given** a reaction with explicit H atoms, **When** the heavy-atom option is
   requested on the command line, or the heavy-atom operation is called on the parsed reaction before mapping, **Then** no H atom
   or H–X bond is drawn, and heteroatoms show their full H count in their labels.
2. **Given** an explicit H attached to a stereocentre, **When** it is removed,
   **Then** the stereocentre's configuration is preserved in the figure.
3. **Given** a component made up only of hydrogen (H₂, H⁺), **When** the option is
   requested, **Then** that component is kept and drawn, not deleted, so that no
   reaction side ends up empty.
4. **Given** the option is not requested, **When** the figure is rendered, **Then**
   explicit H atoms are handled exactly as before.

---

### Edge Cases

- **Crowded atoms** (an existing layout defect, Feature B): when atoms are drawn
  closer than 0.6 × the standard bond length to one another, the map-number and
  label rules still produce output, but the collision criteria are not judged for
  those atoms (see SC-002).
- **Charged, isotopic and implicit-H decorations** (charge marks, isotope numbers,
  "H"/"H₂" labels) obey the same contrast rule as the element symbol and count as
  obstacles for map-number placement.
- **Unmapped atoms** have no map number. Their labels still follow the contrast
  rule.
- **Reaction-centre rings** (dashed amber outline) count as obstacles for
  map-number placement, but not as a fill for contrast purposes, since they are a
  stroke only.
- **Isotopic hydrogen** (D, T, or [2H]) is not removed by the heavy-atom option,
  because it carries chemical meaning.
- **Explicit H carrying a map number**, under the keep-existing-mapping mode: the H
  and its mapping pair are dropped. Displayed numbers follow the existing rule that
  they are reassigned 1…n in mapping order. The result MUST therefore match the same
  reaction with those H atoms removed beforehand (SC-007), not the original input
  numbers.
- **The map-number colour against a halo it lands on** must also meet the contrast
  threshold.

## Requirements *(mandatory)*

### Functional Requirements

**Contrast-aware labels (Story 1)**

- **FR-001**: For every rendered text item belonging to an atom (element symbol,
  implicit-H label, charge, isotope, map number), the figure MUST determine the
  effective fill beneath it: the halo colour composited at its drawn opacity over
  the canvas colour where a halo lies beneath, otherwise the canvas colour. Where a text
  item's box covers more than one fill (part halo and part canvas, or overlapping
  halos), the fill giving the lowest contrast governs. The rule MUST hold for both
  halo palettes, publication (the default) and screen.
- **FR-002**: The figure MUST compute the contrast ratio between each text colour
  and its effective fill using the WCAG 2.x relative-luminance definition.
- **FR-003**: When the contrast ratio is at or above the threshold (default 3:1,
  see Assumptions), the figure MUST NOT draw any background patch behind that text.
- **FR-004**: When the contrast ratio is below the threshold, the figure MUST apply
  a remedy in this order: first, shift the label colour's lightness (darker or
  lighter) while keeping its hue, choosing the smallest shift that meets the
  threshold; only if no same-hue shade meets it, keep the original colour and draw
  a tight, rounded patch in the canvas colour behind the text. The result MUST meet
  the threshold, and the element's hue (e.g. N reads as blue) MUST stay
  recognisable: a recoloured label keeps its original HSL hue angle and saturation,
  and only lightness changes. *(Clarified 2026-10-08: the user chose "recolour, patch
  fallback".)*
- **FR-005**: Any background patch that is drawn MUST be sized tightly to the text
  it serves, not to a fixed character cell.
- **FR-006**: Bonds meeting a labelled atom MUST continue to end at the edge of
  that atom's label, as BIME 3.0.3 already does, so that no bond line passes visibly
  through its own atom's label whether or not a patch is drawn.

**Collision-aware map numbers (Story 2)**

- **FR-007**: Each map number MUST be placed at one of a fixed, ordered set of
  candidate positions around its atom (at minimum the 8 compass directions at a
  standard offset). The initial preference goes to directions away from the atom's
  bonds.
- **FR-008**: Each candidate MUST be scored by its overlap with other map numbers
  already placed, all atom labels and their decorations, all bond segments, and
  the halos of other atoms. The lowest-scoring candidate is chosen.
- **FR-009**: Map numbers MUST be placed in a deterministic order, and ties MUST be
  broken deterministically, so that identical input yields byte-identical output.
- **FR-010**: If no candidate at the standard offset is free of overlaps with other
  map numbers and atom labels, the system MUST try a larger offset next. It may
  reduce the map-number font only as a last resort, down to a floor of 75% of the
  standard size. If even that leaves no overlap-free candidate, the
  least-overlapping candidate is used. Such a placement counts against SC-002; it is
  not hidden. A map number MUST be closer to its own atom than to any other atom
  whenever such a candidate exists. For layout-crowded atoms (SC-002) where none
  exists, the forced placement takes the candidate with the least overlap, and then
  the widest own-vs-other margin.
- **FR-011**: Disabling map numbers (the existing option) MUST still suppress them
  entirely.

**Heavy-atom option (Story 3)**

- **FR-012**: An opt-in heavy-atom-only option MUST be offered both as a
  command-line flag on the atom-mapping command (honoured for every output format,
  because stripping happens before mapping) and as a programmatic operation on a
  parsed reaction that callers run before mapping. *(Revised 2026-10-08 during
  planning: an option on the figure export itself cannot strip before mapping, as
  FR-013 requires, because it receives an already-mapped result.)* Both are public-interface
  additions (constitution: code review MUST confirm compatibility). The option is
  off by default.
- **FR-013**: With the option set, every explicit hydrogen atom MUST be removed
  before mapping and layout, and added back to its neighbour's implicit H count.
  Four kinds of hydrogen are exempt and kept as drawn: isotopic hydrogens (D, T,
  [2H], [3H]); charged hydrogens; hydrogens in hydrogen-only components (H₂, H⁺);
  and any hydrogen not bonded to exactly one heavy atom (e.g. bridging hydrides or
  H–H), so that
  malformed or unusual input is never altered silently.
- **FR-014**: Removing an H attached to a stereocentre MUST preserve that
  stereocentre's configuration.
- **FR-015**: With the option unset, explicit-H handling MUST be unchanged from
  BIME 3.0.3.

**Compatibility and constraints**

- **FR-016**: Output for the same input and options MUST be deterministic.
- **FR-017**: The feature MUST NOT add a runtime dependency, network access, or
  build step (constitution Principle I).
- **FR-018**: The legibility rules (FR-001…FR-011) MUST apply by default to every
  mapped-reaction SVG, and no option restores the BIME 3.0.3 label look. Apart from
  those rules (including FR-006's shortened bond ends at labelled atoms), the
  figure's structure (atom positions, bond styles and colours,
  halo colours, arrow, captions, provenance stamp) MUST be unchanged for inputs
  that don't use the heavy-atom option.

### Key Entities

- **Text item**: a rendered string tied to an atom (symbol, H label, charge,
  isotope or map number), with a colour, a bounding box, and an effective
  underlying fill.
- **Obstacle**: anything a map number must avoid: text items, bond segments, and
  the halos and reaction-centre rings of other atoms.
- **Placement candidate**: a position and size for a map number, scored by its
  overlap with obstacles.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Across the three pilot reactions, rendered as heavy-atom figures, 100%
  of atom text items meet the contrast threshold against their effective fill.
- **SC-002**: Overlap here means any positive-area intersection between two text
  bounding boxes, or between a text bounding box and a bond segment widened by its
  stroke width. Across the same three figures, there are zero overlaps between map
  numbers, and zero overlaps between a map number and an atom label. **Layout-crowded
  atoms are excluded:** an atom is crowded when any other atom is drawn closer than
  0.6 × the standard bond length to it, a layout defect deferred to Feature B. An
  overlap is excluded when either of its owning atoms is crowded. Excluded counts
  are reported, not hidden. *(Amended 2026-10-08 at the slice-2 stop-and-report: the
  user chose "Exclude crowded atoms". The threshold was previously 0.3 × bond length
  for the pair only.)*
- **SC-003**: Across the same three figures, the number of map-number/bond overlaps
  for uncrowded atoms (SC-002) falls by at least 75% compared with the BIME 3.0.3
  output measured on the same uncrowded atoms.
- **SC-004**: Across the same three figures, no background patch is drawn behind
  text whose unremedied contrast already meets the threshold. In BIME 3.0.3 every
  heteroatom has one.
- **SC-005**: Rendering the same input twice produces byte-identical figures, with
  the provenance stamp excluded.
- **SC-006**: The project's full existing test suite still passes, and every
  difference in existing figure-output tests is limited to the legibility changes.
- **SC-007**: For a reaction with explicit H atoms, the heavy-atom option produces
  the same figure as removing the same H atoms from the input beforehand, under the
  same exemptions as FR-013 (the procedure the user's external script performed).
- **SC-008**: Rendering each pilot reaction to a figure (excluding the mapping step)
  takes no more than 2× as long as BIME 3.0.3 takes on the same machine, comparing
  the median of 5 runs each.

## Assumptions

- The default contrast threshold is 3:1. This is the WCAG 2.x minimum for large or
  bold text and for graphical objects, and suits the bold element labels and map
  numbers used in these figures. The plan may expose the threshold as an option.
- For contrast purposes, a transparent background is treated as white, since the
  figures are normally placed on white pages. As a consequence, contrast is not
  guaranteed when a transparent figure is placed on a dark page. Dark backgrounds
  are out of scope.
- The default CPK element colours stay as they are. Only the remedy in FR-004 ever
  changes a rendered label colour.
- The heavy-atom option strips hydrogens before the mapping step, as the user's
  external pipeline does, so mapping runs on the heavy-atom reaction. Mapping
  explicit H atoms carries no information wanted in these figures.
- The scope is the mapped-reaction SVG export, which is what produced the pilot
  figures. The plain single-molecule SVG export and the interactive editor
  canvas use separate drawing paths and are not changed here. A later feature may
  carry the same rules over to them.
- The user's RXN inputs reach BIME as reaction SMILES through their own pipeline.
  Reading RXN files is out of scope.
- Overlapping bonds and atoms caused by 2D coordinate generation (as in
  CE2872DIOer's NAD fold and the GDA1 sugar cluster) belong to Feature B and are
  out of scope here.
