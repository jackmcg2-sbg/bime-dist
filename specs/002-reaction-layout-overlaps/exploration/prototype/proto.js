// Scratch prototype of the fold-back repair (NOT repo code). node proto.js root tsv mode(base|repair) [moves=R,S,T] [maxIter]
const path=require('path'),fs=require('fs');const root=process.argv[2];require(path.join(root,'tests/shim.js')).loadAll();
require(path.join(root,'editor/Templates.js'));require(path.join(root,'editor/SMSDLayout.js'));require(path.join(root,'editor/Layout.js'));
for(const f of require(path.join(root,'tools/editor-files.js')).FILES)if(/^(SDGLayout|sdg\/)/.test(f))require(path.join(root,'editor',f));
const LQ=globalThis.SDG.LayoutQuality;const BL=30;
const mode=process.argv[4]||'base',MOVES=(process.argv[5]||'R,S,T').split(','),MAXIT=+(process.argv[6]||40);
function cross(a,b,c,d){const o=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);const d1=o(c,d,a),d2=o(c,d,b),d3=o(a,b,c),d4=o(a,b,d);return ((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0));}
function report(m){const B=new Set();m.bonds.forEach(b=>{B.add(b.atom1+','+b.atom2);B.add(b.atom2+','+b.atom1);});let x=0,c=0,s=0;const bs=m.bonds;
 for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){const a=bs[i],b=bs[j];if(a.atom1===b.atom1||a.atom1===b.atom2||a.atom2===b.atom1||a.atom2===b.atom2)continue;if(cross(m.getAtom(a.atom1),m.getAtom(a.atom2),m.getAtom(b.atom1),m.getAtom(b.atom2)))x++;}
 for(let i=0;i<m.atoms.length;i++)for(let j=i+1;j<m.atoms.length;j++){const p=m.atoms[i],q=m.atoms[j];if(B.has(p.id+','+q.id))continue;const d=Math.hypot(p.x-q.x,p.y-q.y)/BL;if(d<0.35)s++;else if(d<0.6)c++;}
 return {cross:x,crowd:c,severe:s};}
// score: LayoutQuality penalty + reporting-metric close pairs (0.6) so the target metric is optimised too
function score(m,ids){const q=LQ.evaluate(m,ids,{bondLength:BL});const r=report(m);return {v:q.penalty+q.hardFailures*1000+r.crowd*3+r.cross*6,q,r};}
function repair(m){
 const ids=m.atoms.map(a=>a.id);if(ids.length<4)return {iters:0,moves:0};
 const adj={};ids.forEach(i=>adj[i]=[]);m.bonds.forEach(b=>{adj[b.atom1].push(b.atom2);adj[b.atom2].push(b.atom1);});
 const ringBond=new Set();m.findRings(20).forEach(r=>{const A=r.atoms;for(let i=0;i<A.length;i++){const u=A[i],v=A[(i+1)%A.length];ringBond.add(u+','+v);ringBond.add(v+','+u);}});
 const pivots=m.bonds.filter(b=>b.type===1&&!ringBond.has(b.atom1+','+b.atom2)&&adj[b.atom1].length>1&&adj[b.atom2].length>1);
 const side=(u,v)=>{const seen=new Set([v]);const q=[v];while(q.length){const x=q.pop();for(const y of adj[x])if(y!==u&&!seen.has(y)){seen.add(y);q.push(y);}}return seen;};
 const sides=[];for(const p of pivots){for(const [u,v] of [[p.atom1,p.atom2],[p.atom2,p.atom1]]){const s=side(u,v);if(s.size<=ids.length/2+0.5)sides.push({u,v,s:[...s]});}}
 let best=score(m,ids);let it=0,acc=0;const snap=()=>m.atoms.map(a=>[a.x,a.y]),rest=(S)=>m.atoms.forEach((a,i)=>{a.x=S[i][0];a.y=S[i][1];});
 const t0=Date.now();
 for(it=0;it<MAXIT;it++){
  if(best.r.cross===0&&best.r.crowd===0&&best.r.severe===0)break;
  let cand=null;const base=snap();
  for(const sd of sides){const U=m.getAtom(sd.u),V=m.getAtom(sd.v);const dx=V.x-U.x,dy=V.y-U.y,L=Math.hypot(dx,dy);const ux=dx/L,uy=dy/L;
   const moves=[];
   if(MOVES.includes('R'))moves.push(['R',(a)=>{const px=a.x-U.x,py=a.y-U.y;const d=px*ux+py*uy;a.x=U.x+2*d*ux-px;a.y=U.y+2*d*uy-py;}]);
   if(MOVES.includes('S'))moves.push(['S',(a)=>{a.x+=0.2*BL*ux;a.y+=0.2*BL*uy;}]);
   if(MOVES.includes('T'))for(const th of [Math.PI/6,-Math.PI/6,Math.PI/3,-Math.PI/3]){const c=Math.cos(th),s=Math.sin(th);moves.push(['T',(a)=>{const px=a.x-U.x,py=a.y-U.y;a.x=U.x+c*px-s*py;a.y=U.y+s*px+c*py;}]);}
   for(const [name,f] of moves){for(const id of sd.s)f(m.getAtom(id));const sc=score(m,ids);
    if(sc.q.hardFailures<=best.q.hardFailures&&sc.v<best.v-1e-6&&(!cand||sc.v<cand.sc.v))cand={sc,S:snap(),name};rest(base);}
  }
  if(!cand)break;rest(cand.S);best=cand.sc;acc++;
 }
 return {iters:it,moves:acc,ms:Date.now()-t0};
}
for(const line of fs.readFileSync(process.argv[3],'utf8').trim().split('\n')){const [f,n,smi]=line.split('\t');
 const m=SmilesParser.parse(smi);const t0=Date.now();Layout.layout(m);const before=report(m);let info={};
 if(mode==='repair')info=repair(m);const ms=Date.now()-t0;const r=report(m);
 console.log(JSON.stringify({f,n:+n,cross:r.cross,crowd:r.crowd,severe:r.severe,before,ms,...info}));}
