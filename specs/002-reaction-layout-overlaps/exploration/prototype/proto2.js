// Scratch prototype v2: incremental scoring, more moves. node proto2.js root tsv mode [moveset] [maxIter]
const path=require('path'),fs=require('fs');const root=process.argv[2];require(path.join(root,'tests/shim.js')).loadAll();
require(path.join(root,'editor/Templates.js'));require(path.join(root,'editor/SMSDLayout.js'));require(path.join(root,'editor/Layout.js'));
for(const f of require(path.join(root,'tools/editor-files.js')).FILES)if(/^(SDGLayout|sdg\/)/.test(f))require(path.join(root,'editor',f));
const LQ=globalThis.SDG.LayoutQuality;const BL=30;
const mode=process.argv[4]||'base',MS=(process.argv[5]||'R,S,T,W').split(','),MAXIT=+(process.argv[6]||60);
function cr(a,b,c,d){const o=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);const d1=o(c,d,a),d2=o(c,d,b),d3=o(a,b,c),d4=o(a,b,d);return ((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0));}
function report(m){const B=new Set();m.bonds.forEach(b=>{B.add(b.atom1+','+b.atom2);B.add(b.atom2+','+b.atom1);});let x=0,c=0,s=0;const bs=m.bonds;
 for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){const a=bs[i],b=bs[j];if(a.atom1===b.atom1||a.atom1===b.atom2||a.atom2===b.atom1||a.atom2===b.atom2)continue;if(cr(m.getAtom(a.atom1),m.getAtom(a.atom2),m.getAtom(b.atom1),m.getAtom(b.atom2)))x++;}
 for(let i=0;i<m.atoms.length;i++)for(let j=i+1;j<m.atoms.length;j++){const p=m.atoms[i],q=m.atoms[j];if(B.has(p.id+','+q.id))continue;const d=Math.hypot(p.x-q.x,p.y-q.y)/BL;if(d<0.35)s++;else if(d<0.6)c++;}
 return {cross:x,crowd:c,severe:s};}
function repair(m){
 const N=m.atoms.length;if(N<4)return {iters:0,moves:0,ms:0};
 const idx={};m.atoms.forEach((a,i)=>idx[a.id]=i);const X=m.atoms.map(a=>a.x),Y=m.atoms.map(a=>a.y);
 const adj=m.atoms.map(()=>[]);const E=m.bonds.map(b=>[idx[b.atom1],idx[b.atom2],b]);E.forEach(([u,v])=>{adj[u].push(v);adj[v].push(u);});
 const bonded=new Set();E.forEach(([u,v])=>{bonded.add(u*N+v);bonded.add(v*N+u);});
 const ringE=new Set();m.findRings(20).forEach(r=>{const A=r.atoms.map(a=>idx[a]);for(let i=0;i<A.length;i++){const u=A[i],v=A[(i+1)%A.length];ringE.add(u*N+v);ringE.add(v*N+u);}});
 // pair term (reporting + LQ-like): severe 200, close(<.6) 3+, crossing 6 ; bond len warn
 const pairCost=(i,j)=>{if(bonded.has(i*N+j))return 0;const d=Math.hypot(X[i]-X[j],Y[i]-Y[j])/BL;if(d<0.35)return 200+(0.35-d)*50;if(d<0.6)return 3+(0.6-d)*20;return 0;};
 const P=(i)=>({x:X[i],y:Y[i]});
 const crossCost=(e,f)=>{const [a,b]=E[e],[c,d]=E[f];if(a===c||a===d||b===c||b===d)return 0;return cr(P(a),P(b),P(c),P(d))?6:0;};
 const bondCost=(e)=>{const [a,b]=E[e];const l=Math.hypot(X[a]-X[b],Y[a]-Y[b])/BL;return l<0.65?(0.65-l)*10+50:l>1.25?(l-1.25)*10+50:0;};
 const angCost=(c)=>{let s=0;const nb=adj[c];for(let i=0;i<nb.length;i++)for(let j=i+1;j<nb.length;j++){const a1=Math.atan2(Y[nb[i]]-Y[c],X[nb[i]]-X[c]),a2=Math.atan2(Y[nb[j]]-Y[c],X[nb[j]]-X[c]);let d=Math.abs(a1-a2);if(d>Math.PI)d=2*Math.PI-d;if(d<Math.PI/4)s+=4+(Math.PI/4-d)*20;}return s;};
 // cost of interaction between moved set S (mask) and rest
 function crossTerm(mask,Slist,Sedges){let c=0;for(const i of Slist)for(let j=0;j<N;j++)if(!mask[j])c+=pairCost(i,j);
  for(const e of Sedges)for(let f=0;f<E.length;f++){if(Sedges.has(f))continue;c+=crossCost(e,f)*(f<e||!Sedges.has(f)?1:0);}return c;}
 function total(){let c=0;for(let i=0;i<N;i++)for(let j=i+1;j<N;j++)c+=pairCost(i,j);for(let e=0;e<E.length;e++)for(let f=e+1;f<E.length;f++)c+=crossCost(e,f);for(let e=0;e<E.length;e++)c+=bondCost(e);for(let i=0;i<N;i++)c+=angCost(i);return c;}
 const side=(u,v)=>{const seen=new Uint8Array(N);seen[v]=1;const q=[v];const L=[v];while(q.length){const x=q.pop();for(const y of adj[x])if(y!==u&&!seen[y]){seen[y]=1;q.push(y);L.push(y);}}return {mask:seen,list:L};};
 const cands=[];
 E.forEach(([a,b,bd],e)=>{if(bd.type!==1||ringE.has(a*N+b))return;for(const [u,v] of [[a,b],[b,a]]){const s=side(u,v);if(s.mask[u])continue;if(s.list.length*2<=N+1){const Sed=new Set();E.forEach(([p,q],f)=>{if(s.mask[p]||s.mask[q])Sed.add(f);});cands.push({u,v,e,...s,Sed});}}});
 const moveFns=(c)=>{const U={x:X[c.u],y:X[c.u]},ux0=X[c.v]-X[c.u],uy0=Y[c.v]-Y[c.u],L=Math.hypot(ux0,uy0),ux=ux0/L,uy=uy0/L,ox=X[c.u],oy=Y[c.u];const out=[];
  if(MS.includes('R'))out.push((i)=>{const px=X[i]-ox,py=Y[i]-oy;const d=px*ux+py*uy;X[i]=ox+2*d*ux-px;Y[i]=oy+2*d*uy-py;});
  if(MS.includes('S'))out.push((i)=>{X[i]+=0.2*BL*ux;Y[i]+=0.2*BL*uy;});
  if(MS.includes('T'))for(const th of (MS.includes('W')?[30,-30,60,-60,90,-90,120,-120,180]:[30,-30,60,-60]).map(t=>t*Math.PI/180)){const C=Math.cos(th),S=Math.sin(th);out.push((i)=>{const px=X[i]-ox,py=Y[i]-oy;X[i]=ox+C*px-S*py;Y[i]=oy+S*px+C*py;});}
  return out;};
 const t0=Date.now();let it=0,acc=0;let cur=total();
 for(it=0;it<MAXIT;it++){
  if(cur<1e-9)break;let best=null;
  for(const c of cands){const local=()=>crossTerm(c.mask,c.list,c.Sed)+bondCost(c.e)+angCost(c.u);
   const before=local();if(before<1e-9)continue;const sx=c.list.map(i=>X[i]),sy=c.list.map(i=>Y[i]);
   const fns=moveFns(c);
   for(let k=0;k<fns.length;k++){for(const i of c.list)fns[k](i);const after=local();const gain=before-after;
    if(gain>1e-6&&(!best||gain>best.gain))best={gain,c,X2:c.list.map(i=>X[i]),Y2:c.list.map(i=>Y[i])};
    c.list.forEach((i,j)=>{X[i]=sx[j];Y[i]=sy[j];});}
  }
  if(!best)break;best.c.list.forEach((i,j)=>{X[i]=best.X2[j];Y[i]=best.Y2[j];});cur-=best.gain;acc++;
 }
 // final guard with LayoutQuality: keep only if not worse
 const ids=m.atoms.map(a=>a.id);const q0=LQ.evaluate(m,ids,{bondLength:BL});const sx=m.atoms.map(a=>[a.x,a.y]);
 m.atoms.forEach((a,i)=>{a.x=X[i];a.y=Y[i];});const q1=LQ.evaluate(m,ids,{bondLength:BL});
 let kept=true;if(q1.hardFailures>q0.hardFailures||q1.penalty>q0.penalty+1e-6){m.atoms.forEach((a,i)=>{a.x=sx[i][0];a.y=sx[i][1];});kept=false;}
 return {iters:it,moves:acc,ms:Date.now()-t0,kept};
}
for(const line of fs.readFileSync(process.argv[3],'utf8').trim().split('\n')){const [f,n,smi]=line.split('\t');
 const m=SmilesParser.parse(smi);const t0=Date.now();Layout.layout(m);const layMs=Date.now()-t0;const before=report(m);let info={};
 if(mode==='repair')info=repair(m);const r=report(m);
 console.log(JSON.stringify({f,n:+n,cross:r.cross,crowd:r.crowd,severe:r.severe,before,layMs,...info}));}
