"""
specs/002-reaction-layout-overlaps/fixture-gen/layout_corpus_build.py

Copyright (c) 2026 BioInception PVT LTD, Cambridge, UK and Syed Asad Rahman.
Licensed under the Apache License, Version 2.0 - see LICENSE.txt

OFFLINE fixture generator for Feature 002 (research R7). Builds
tests/data/layout_corpus.json from the maintainer's atom-mapped RXN corpus.

Needs RDKit (e.g. the repo's .venv). It is NOT part of BIME, its tests or its
build (constitution I): the tests read the committed JSON only. Kept beside the
spec, not under tools/, so tools/ stays dependency-free JavaScript.

Usage:
    .venv/bin/python specs/002-reaction-layout-overlaps/fixture-gen/layout_corpus_build.py \
        /media/JACK/repos/ctf/rxns/moiety_rxns/atomMapped_std > tests/data/layout_corpus.json
    # Regenerate keeping the baseline recorded by tools/layout-bench.js:
    ... atomMapped_std --keep-baseline tests/data/layout_corpus.json > /tmp/x.json && mv /tmp/x.json tests/data/layout_corpus.json

Sampling (exploration E10): every 57th .rxn file in sorted order; each reactant
and product with atom-map numbers cleared and explicit H removed by a SMILES
round-trip; unique SMILES only; molecules RDKit cannot sanitise are dropped.
"""
import datetime
import itertools
import json
import math
import os
import sys

import rdkit
from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem, rdCIPLabeler, rdDepictor

RDLogger.DisableLog('rdApp.*')

BINS = [[2, 15], [16, 30], [31, 50], [51, 80], [81, None]]
RDKIT_BL = 1.5  # RDKit's depiction bond length (Angstrom-like units)

STEREO_SET = [
    ('L-alanine', 'C[C@H](N)C(=O)O'),
    ('D-alanine', 'C[C@@H](N)C(=O)O'),
    ('L-lactate', 'C[C@H](O)C(=O)O'),
    ('alpha-D-glucose', 'OC[C@H]1O[C@H](O)[C@H](O)[C@@H](O)[C@@H]1O'),
    ('testosterone', 'C[C@]12CC[C@H]3[C@@H](CCC4=CC(=O)CC[C@]34C)[C@@H]1CC[C@@H]2O'),
    ('cholesterol', 'CC(C)CCC[C@@H](C)[C@H]1CC[C@H]2[C@@H]3CC=C4C[C@@H](O)CC[C@]4(C)[C@H]3CC[C@]12C'),
]

EZ_SET = [
    ('cis-2-butene', 'C/C=C\\C', 'cis'),
    ('trans-2-butene', 'C/C=C/C', 'trans'),
    ('maleate', 'OC(=O)/C=C\\C(=O)O', 'cis'),
    ('fumarate', 'OC(=O)/C=C/C(=O)O', 'trans'),
    ('oleate', 'CCCCCCCC/C=C\\CCCCCCCC(=O)O', 'cis'),
    ('elaidate', 'CCCCCCCC/C=C/CCCCCCCC(=O)O', 'trans'),
]


def bin_of(n):
    for lo, hi in BINS:
        if n >= lo and (hi is None or n <= hi):
            return '%d-%d' % (lo, hi) if hi is not None else '%d+' % lo
    return None


def _cross(a, b, c, d):
    def o(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    d1, d2, d3, d4 = o(c, d, a), o(c, d, b), o(a, b, c), o(a, b, d)
    return ((d1 > 0 > d2) or (d1 < 0 < d2)) and ((d3 > 0 > d4) or (d3 < 0 < d4))


def rdkit_metrics(mol):
    """Reporting metric (data-model 'Layout defect') on an RDKit 2D depiction."""
    m = Chem.Mol(mol)
    rdDepictor.SetPreferCoordGen(False)
    rdDepictor.Compute2DCoords(m)
    conf = m.GetConformer()
    pts = [(conf.GetAtomPosition(i).x, conf.GetAtomPosition(i).y) for i in range(m.GetNumAtoms())]
    bonds = [(b.GetBeginAtomIdx(), b.GetEndAtomIdx()) for b in m.GetBonds()]
    bonded = set(bonds) | {(j, i) for i, j in bonds}
    severe = close = 0
    for i, j in itertools.combinations(range(len(pts)), 2):
        if (i, j) in bonded:
            continue
        d = math.dist(pts[i], pts[j]) / RDKIT_BL
        if d < 0.35:
            severe += 1
        elif d < 0.6:
            close += 1
    crossings = sum(1 for (a, b), (c, d) in itertools.combinations(bonds, 2)
                    if len({a, b, c, d}) == 4 and _cross(pts[a], pts[b], pts[c], pts[d]))
    return {'crossings': crossings, 'closePairs': close, 'severe': severe}


def cip_labels(mol):
    """[{atomIndex, cip}] for every specified tetrahedral centre (SMILES atom order)."""
    m = Chem.Mol(mol)
    rdCIPLabeler.AssignCIPLabels(m)
    out = []
    for a in m.GetAtoms():
        if a.GetChiralTag() != Chem.ChiralType.CHI_UNSPECIFIED and a.HasProp('_CIPCode'):
            out.append({'atomIndex': a.GetIdx(), 'cip': a.GetProp('_CIPCode')})
    return out


def ez_pairs(mol):
    """[{atoms: [a, b, c, d], expect}] for every specified stereo double bond b=c:
    a is a neighbour of b, d a neighbour of c (SMILES atom order), and expect is
    'cis' or 'trans' for a and d, read from RDKit's stereo-correct 2D depiction."""
    m = Chem.Mol(mol)
    rdDepictor.SetPreferCoordGen(False)
    rdDepictor.Compute2DCoords(m)
    conf = m.GetConformer()
    pos = lambda i: (conf.GetAtomPosition(i).x, conf.GetAtomPosition(i).y)
    out = []
    for bond in m.GetBonds():
        if bond.GetBondType() != Chem.BondType.DOUBLE or bond.GetStereo() == Chem.BondStereo.STEREONONE:
            continue
        b, c = bond.GetBeginAtomIdx(), bond.GetEndAtomIdx()
        na = sorted(n.GetIdx() for n in m.GetAtomWithIdx(b).GetNeighbors() if n.GetIdx() != c)
        nd = sorted(n.GetIdx() for n in m.GetAtomWithIdx(c).GetNeighbors() if n.GetIdx() != b)
        if not na or not nd:
            continue
        a, d = na[0], nd[0]
        def side(p):
            (bx, by), (cx, cy), (px, py) = pos(b), pos(c), pos(p)
            v = (cx - bx) * (py - by) - (cy - by) * (px - bx)
            return (v > 0) - (v < 0)
        sa, sd = side(a), side(d)
        if sa and sd:
            out.append({'atoms': [a, b, c, d], 'expect': 'cis' if sa == sd else 'trans'})
    return out


def corpus(directory):
    files = sorted(f for f in os.listdir(directory))[::57]
    seen, out, dropped = set(), [], 0
    for f in files:
        try:
            rxn = AllChem.ReactionFromRxnFile(os.path.join(directory, f), sanitize=False)
        except Exception:
            continue
        for m in list(rxn.GetReactants()) + list(rxn.GetProducts()):
            m = Chem.Mol(m)
            for a in m.GetAtoms():
                a.SetAtomMapNum(0)
            m = Chem.MolFromSmiles(Chem.MolToSmiles(m))
            if m is None:
                dropped += 1
                continue
            smi = Chem.MolToSmiles(m)
            if smi in seen or m.GetNumAtoms() < 2:
                continue
            seen.add(smi)
            # Re-parse from the stored SMILES so atom indices are SMILES order.
            m = Chem.MolFromSmiles(smi)
            out.append({'file': f, 'atoms': m.GetNumAtoms(), 'bin': bin_of(m.GetNumAtoms()),
                        'smiles': smi, 'rdkit': rdkit_metrics(m), 'stereo': cip_labels(m),
                        'ez': ez_pairs(m)})
    return out, dropped


def pilot_components(pilot_path):
    with open(pilot_path) as fh:
        pilots = json.load(fh)['reactions']
    out = []
    for p in pilots:
        comps = [c for side in p['smiles'].split('>>') for c in side.split('.')]
        for k, c in enumerate(comps):
            m = Chem.MolFromSmiles(c)
            if m is None:
                continue
            st = cip_labels(m)
            if st:
                out.append({'name': '%s#%d' % (p['id'], k), 'smiles': c, 'stereo': st})
    return out


def main():
    if len(sys.argv) not in (2, 4) or (len(sys.argv) == 4 and sys.argv[2] != '--keep-baseline'):
        sys.stderr.write(__doc__)
        sys.exit(2)
    directory = sys.argv[1]
    baseline = {}
    if len(sys.argv) == 4:  # regenerate without losing the recorded baseline
        with open(sys.argv[3]) as fh:
            baseline = json.load(fh).get('baseline', {})
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.abspath(os.path.join(here, '..', '..', '..'))
    molecules, dropped = corpus(directory)
    stereo_set = [{'name': n, 'smiles': s, 'stereo': cip_labels(Chem.MolFromSmiles(s))} for n, s in STEREO_SET]
    stereo_set += pilot_components(os.path.join(root, 'tests', 'data', 'reaction_map_pilot.json'))
    doc = {
        '_comment': 'Feature 002 layout-quality fixture. Generated offline by '
                    'specs/002-reaction-layout-overlaps/fixture-gen/layout_corpus_build.py; '
                    'baseline written by tools/layout-bench.js --write-baseline.',
        'provenance': {
            'toolkit': 'RDKit', 'version': rdkit.__version__,
            'depictor': 'rdDepictor.Compute2DCoords (CoordGen off), bond length %.1f' % RDKIT_BL,
            'cip': 'rdCIPLabeler.AssignCIPLabels',
            'sampling': 'every 57th .rxn of atomMapped_std (sorted); map numbers cleared; H removed by '
                        'SMILES round-trip; unique SMILES; atoms >= 2',
            'source': os.path.basename(os.path.normpath(directory)),
            'dropped': dropped,
            'date': datetime.date.today().isoformat(),
            'generator': 'specs/002-reaction-layout-overlaps/fixture-gen/layout_corpus_build.py',
        },
        'bins': BINS,
        'molecules': molecules,
        'stereoSet': stereo_set,
        'ezSet': [{'name': n, 'smiles': s, 'expect': e} for n, s, e in EZ_SET],
        'baseline': baseline,
    }
    json.dump(doc, sys.stdout, indent=1)
    sys.stdout.write('\n')


if __name__ == '__main__':
    main()
