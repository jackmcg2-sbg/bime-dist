# Data Model: Reaction-Figure Layout Quality

No persistent user data. The entities are in-memory structures during layout,
plus one committed test fixture.

## Engine module set

The list of `editor/` files loaded by the test shim and the CLI.

| Field | Value |
|---|---|
| Source | `tools/editor-files.js` → `ENGINE_FILES` = `FILES` minus `UI_FILES` |
| `UI_FILES` | `Renderer.js`, `Tools.js`, `MolEditor.js`, `CanvasView.js`, `CanvasSurface.js`, `FocusLens.js`, `PageFormats.js` |
| Order | bundle order (same as `FILES`) |
| Invariant | every file in `FILES` is in exactly one of `ENGINE_FILES` and `UI_FILES` |

## Pivot candidate (repair, transient)

| Field | Meaning |
|---|---|
| `u`, `v` | the pivot bond's atoms. `u` stays fixed; `v` roots the moving subtree |
| `bond` | the pivot bond: single, not in a ring, both ends of degree ≥ 2 |
| `subtree` | atoms reachable from `v` without crossing the pivot; size ≤ half the component |
| `subtreeBonds` | bonds with at least one end in `subtree` |

Rule: if the subtree contains `u`, the pivot is a ring bond and is never a
candidate.

## Move (repair, transient)

| Kind | Effect | Constraint |
|---|---|---|
| reflect | mirror the subtree across the line u–v | — |
| stretch | translate the subtree along u→v by 0.2 × BL | the pivot bond stays ≤ 1.25 × BL (FR-010) |
| rotate(θ) | rotate the subtree about u, θ ∈ {±30°, ±60°, ±90°, ±120°, 180°} | rejected if it flips a specified E/Z (R4) |

The order is fixed: reflect, stretch, then the rotations in the listed order.
Ties keep the first candidate.

## Repair budget (R6)

| Field | Default |
|---|---|
| `maxIterations` | 60 |
| `escapeK` | 8 |
| `maxEscapes` | 8 |
| `maxEvaluations` | 50,000 |
| `maxAtoms` | 300 (larger components are not repaired) |

These are internal constants, not user options (FR-012a covers only the
on/off switch used in tests).

## Layout defect (reporting metric, spec Key Entities)

| Field | Definition |
|---|---|
| `crossings` | pairs of bonds that share no atom and properly intersect |
| `closePairs` | non-bonded atom pairs with 0.35 × BL ≤ d < 0.6 × BL |
| `severe` | non-bonded atom pairs with d < 0.35 × BL |
| `abnormalBonds` | bonds outside 0.65–1.25 × BL |

## Layout corpus fixture — `tests/data/layout_corpus.json`

```text
{
  provenance: { toolkit, version, depictor, sampling, dropped, date, generator },
  bins:       [[2,15],[16,30],[31,50],[51,80],[81,null]],
  molecules:  [ { file, atoms, bin, smiles,
                  rdkit: { crossings, closePairs, severe },
                  stereo: [ { atomIndex, cip } ] } ],         // RDKit CIP per stereocentre
  stereoSet:  [ { name, smiles, stereo: [ { atomIndex, cip } ] } ],  // SC-002a named set
  ezSet:      [ { name, smiles, expect: 'cis'|'trans' } ],     // SC-002 named set
  baseline:   { moduleSet: 'cli-3.1-pre', perBin: { …same fields as a report bin… },
                pilots: { GDA1_HPRNStlr: {…}, GGH_10FTHF7GLUl: {…}, CE2872DIOer: {…} },
                timing: { medianMsPerBin: {…}, pilotEndToEndMs: {…}, machine: '…' } }
}
```

Validation:
- `molecules` has 367 entries, and each SMILES parses in BIME.
- `atoms` is RDKit's atom count of the stored SMILES: heavy atoms plus any
  explicit `[H]` RDKit keeps for double-bond stereo (`[H]/N=C…`, 23 molecules).
  This is the counting used by the exploration (E10) and the baseline bins.
  *(Clarified during T004; the earlier wording said "heavy-atom count".)*
- `atomIndex` is the 0-based index in SMILES atom order, which BIME's parse
  order and RDKit's `MolFromSmiles` share.
- `baseline` is written only by `tools/layout-bench.js --write-baseline` on code
  without this feature's source changes.

## Benchmark report (`tools/layout-bench.js --json`)

```text
{ moduleSet, repair: true|false, perBin: { "<lo>-<hi>": { n, withCrossingsPct, meanCrossings,
  meanClosePairs, severe, medianMs } }, totals: { crossings, closePairs, severe },
  worst: [ { file, crossings, closePairs } ] }
```
