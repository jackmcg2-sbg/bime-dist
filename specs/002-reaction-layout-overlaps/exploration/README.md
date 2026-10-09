# Exploration supporting material

Scripts are read-only measurements; run from the repo root.

| Script | Purpose | Entry |
|---|---|---|
| `measure.js` | Map + render a reaction; count per-component crossings and close pairs. Mode 0 = CLI module set, 1 = + SDG, 2 = + SMSDLayout + SDG. | E2, E7, E8 |
| `classify.js` | Lay out each component alone; classify crossings by ring context and graph distance. | E3, E4 |
| `var.js` | Same molecule from several atom orderings (input from RDKit random SMILES). | E5 |
| `ez.js` | Is a cis double bond drawn cis? Mode 0/1 as above. | E11 |
| `corpus.js` | Lay out each molecule in `data/corpus_mols.tsv`; optional `sdg` arg. | E10, E12 |
| `rdk.py` | RDKit/CoordGen reference metrics (needs `.venv` with RDKit). | E9 |
| `summ.py` | Size-binned summary: `summ.py <bime.jsonl> <rdkit.jsonl>`. | E10, E12 |

`data/corpus_mols.tsv`: every 57th file of `atomMapped_std` (sorted), each
reactant/product with map numbers cleared and H removed by a SMILES round-trip
through RDKit; unique SMILES only; 271 molecules RDKit could not sanitise were
dropped. `data/corpus_rxncoords.jsonl`: the same files' stored coordinates,
heavy atoms only, all instances (not deduplicated).

Close pair = non-bonded atoms < 0.6 × bond length; severe < 0.35; crossing =
proper intersection of two bonds sharing no atom.
