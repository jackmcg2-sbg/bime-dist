import sys,json,itertools,math
from rdkit import Chem
from rdkit.Chem import rdDepictor
def cross(a,b,c,d):
    o=lambda p,q,r:(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])
    d1,d2,d3,d4=o(c,d,a),o(c,d,b),o(a,b,c),o(a,b,d)
    return ((d1>0>d2) or (d1<0<d2)) and ((d3>0>d4) or (d3<0<d4))
def metrics(m):
    conf=m.GetConformer();P=[(conf.GetAtomPosition(i).x,conf.GetAtomPosition(i).y) for i in range(m.GetNumAtoms())]
    bl=sorted(math.dist(P[b.GetBeginAtomIdx()],P[b.GetEndAtomIdx()]) for b in m.GetBonds()); BL=bl[len(bl)//2] if bl else 1.5
    bonded={(b.GetBeginAtomIdx(),b.GetEndAtomIdx()) for b in m.GetBonds()}; bonded|={(j,i) for i,j in bonded}
    sev=cr=0
    for i,j in itertools.combinations(range(len(P)),2):
        if (i,j) in bonded: continue
        d=math.dist(P[i],P[j])/BL
        if d<0.35: sev+=1
        elif d<0.6: cr+=1
    bs=[(b.GetBeginAtomIdx(),b.GetEndAtomIdx()) for b in m.GetBonds()];x=0
    for (a,b),(c,d) in itertools.combinations(bs,2):
        if len({a,b,c,d})<4: continue
        if cross(P[a],P[b],P[c],P[d]): x+=1
    return dict(n=m.GetNumAtoms(),severe=sev,crowd=cr,cross=x)
for line in sys.stdin:
    rid,smi=line.rstrip('\n').split('\t')
    comps=[c for side in smi.split('>>') for c in side.split('.')]
    for engine in ('rdkit','coordgen'):
        rdDepictor.SetPreferCoordGen(engine=='coordgen')
        res=[]
        for c in comps:
            m=Chem.MolFromSmiles(c)
            if m is None: res.append(None);continue
            rdDepictor.Compute2DCoords(m); res.append(metrics(m))
        tot={k:sum(r[k] for r in res if r) for k in('severe','crowd','cross')}
        print(json.dumps(dict(id=rid,engine=engine,tot=tot,comps=[r for r in res if r and r['n']>1])))
