import json,sys,statistics as st
D=[json.loads(l) for l in open(sys.argv[1])]
print('bin       n | before: %cross mCross mCrowd | after: %cross mCross mCrowd sev | worse | medRepairMs p95 max')
for lo,hi in [(2,15),(16,30),(31,50),(51,80),(81,999)]:
    b=[d for d in D if lo<=d['n']<=hi]
    if not b: continue
    B=[d['before'] for d in b]
    worse=sum(1 for d in b if d['cross']>d['before']['cross'] or d['crowd']>d['before']['crowd'] or d['severe']>d['before']['severe'])
    ms=sorted(d.get('ms',0) for d in b)
    print(f"{lo:>3}-{hi:<4}{len(b):>4} | {100*sum(x['cross']>0 for x in B)/len(b):6.1f} {st.mean(x['cross'] for x in B):6.2f} {st.mean(x['crowd'] for x in B):6.2f} | {100*sum(d['cross']>0 for d in b)/len(b):6.1f} {st.mean(d['cross'] for d in b):6.2f} {st.mean(d['crowd'] for d in b):6.2f} {sum(d['severe'] for d in b):3} | {worse:3} | {st.median(ms):6.0f} {ms[int(.95*(len(ms)-1))]:5.0f} {ms[-1]:5.0f}")
tb=sum(d['before']['cross'] for d in D);ta=sum(d['cross'] for d in D);print('total crossings',tb,'->',ta,'(%.0f%% reduction)'%(100*(tb-ta)/tb if tb else 0))
