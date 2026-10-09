import json,sys,statistics as st
def load(p): return {(d['f'],d['n'],i):d for i,d in enumerate(json.loads(l) for l in open(p))}
B=[json.loads(l) for l in open(sys.argv[1])];R=[json.loads(l) for l in open(sys.argv[2])]
R={(r['f'],r['n']):r for r in R}
bins=[(2,15),(16,30),(31,50),(51,80),(81,1000)]
print('size     mols | BIME: %clean  %cross  meanCross  meanCrowd  medMs | RDKit: %clean %cross meanCross')
for lo,hi in bins:
    b=[d for d in B if lo<=d['n']<=hi and 'cross' in d]; r=[R[(d['f'],d['n'])] for d in b if (d['f'],d['n']) in R]
    if not b: continue
    cl=lambda x:x['cross']==0 and x['crowd']==0 and x['severe']==0
    print(f"{lo:>3}-{hi:<4} {len(b):>4} | {100*sum(map(cl,b))/len(b):6.1f} {100*sum(d['cross']>0 for d in b)/len(b):6.1f} {st.mean(d['cross'] for d in b):9.2f} {st.mean(d['crowd'] for d in b):9.2f} {st.median(d['ms'] for d in b):6.0f} | {100*sum(map(cl,r))/len(r):6.1f} {100*sum(d['cross']>0 for d in r)/len(r):6.1f} {st.mean(d['cross'] for d in r):6.2f}")
b=[d for d in B if 'cross' in d];print('all',len(b),'BIME clean %.1f%%'%(100*sum(d['cross']==0 and d['crowd']==0 and d['severe']==0 for d in b)/len(b)),'errors',sum('err' in d for d in B))
