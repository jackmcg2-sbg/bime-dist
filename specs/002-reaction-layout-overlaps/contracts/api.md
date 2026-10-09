# Contract: Programmatic interfaces

## `Layout.layout(mol)` / `Layout.layoutFragment(mol, atoms)` (existing, behaviour change)
- Signature and return value are unchanged.
- **New behaviour**: after placement, every connected component goes through the
  fold-back repair (research R3). It is always on (FR-013) and bounded by
  research R6.
- **Changed step order**: wedge/hash assignment now runs last (research R2), and
  wedge or hash follows the drawn geometry (FR-004a). `bond.depictStereo` and
  `bond.depictStereoFromAtom` keep their meaning; only their values become
  correct.
- **Guarantees**:
  - A component with no crossing and no close pair before the repair keeps its
    coordinates (FR-011).
  - Ring internal geometry is unchanged by the repair (FR-007).
  - Specified E/Z geometry is preserved (FR-008).
  - Output is deterministic in a fresh process (FR-014).

## `Layout.options.foldBackRepair` (new, internal; FR-012a)
- Boolean, default `true`. Read only by `layoutComponent`.
- It exists for measurement (the guard test and `tools/layout-bench.js
  --no-repair`). It is not documented in the user guide, and no CLI flag sets it.

## `tools/editor-files.js` (existing module, new exports)
- `ENGINE_FILES`: array of `editor/`-relative paths, in bundle order, = `FILES`
  minus `UI_FILES`.
- `UI_FILES`: the named UI-only files (data-model "Engine module set").
- `FILES` and `scriptTags` are unchanged.

## `tests/shim.js` `loadAll()` (existing, behaviour change)
- Loads `ENGINE_FILES` in order, in addition to what it loaded before. It is
  idempotent and keeps the static-bundle short-circuit.

## `NonplanarBonds.assignTetrahedral` (existing, behaviour change)
- Still chooses the same bond to wedge.
- Wedge vs hash now comes from the 2D geometry and the centre's `@`/`@@` token
  (research R5), no longer from a stereo label.

## Unchanged
- Every public function signature.
- SMILES, SMARTS, MOL and SDF writers. They don't read coordinates for stereo:
  SMILES stereo still comes from `bond.stereo` and the atoms' chirality tokens,
  not from `depictStereo`.
- `ImageExport` code. Its output changes only through the coordinates and
  wedges it receives.
