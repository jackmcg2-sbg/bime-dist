// node classify.js root smiles  -> layout each component standalone (Layout.layout), classify crossings
const path=require('path');const root=process.argv[2];const shim=require(path.join(root,'tests/shim.js'));shim.loadAll();
require(path.join(root,'editor/Layout.js'));
const smi=process.argv[3];const comps=smi.split('>>').flatMap(s=>s.split('.'));
function cross(a,b,c,d){const o=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);const d1=o(c,d,a),d2=o(c,d,b),d3=o(a,b,c),d4=o(a,b,d);return ((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0));}
for(const c of comps){const m=SmilesParser.parse(c);Layout.layout(m);if(m.atoms.length<12)continue;
 const ringAtoms=new Set();const rings=m.findRings(20);rings.forEach(r=>r.atoms.forEach(a=>ringAtoms.add(a)));
 // ring systems
 const sys={};let ns=0;const rs=rings.map(r=>new Set(r.atoms));const par=rs.map((_,i)=>i);const f=i=>par[i]===i?i:(par[i]=f(par[i]));
 for(let i=0;i<rs.length;i++)for(let j=i+1;j<rs.length;j++)if([...rs[i]].some(a=>rs[j].has(a)))par[f(i)]=f(j);
 rs.forEach((r,i)=>r.forEach(a=>sys[a]=f(i)));
 // BFS dist
 const adj={};m.bonds.forEach(b=>{(adj[b.atom1]=adj[b.atom1]||[]).push(b.atom2);(adj[b.atom2]=adj[b.atom2]||[]).push(b.atom1);});
 const D=(s)=>{const d={[s]:0},q=[s];while(q.length){const u=q.shift();for(const v of adj[u]||[])if(d[v]===undefined){d[v]=d[u]+1;q.push(v);}}return d;};
 const cls={};const bs=m.bonds;let n=0;
 for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){const a=bs[i],b=bs[j];if(new Set([a.atom1,a.atom2,b.atom1,b.atom2]).size<4)continue;
  if(!cross(m.getAtom(a.atom1),m.getAtom(a.atom2),m.getAtom(b.atom1),m.getAtom(b.atom2)))continue;n++;
  const inR=x=>ringAtoms.has(x.atom1)&&ringAtoms.has(x.atom2)&&sys[x.atom1]===sys[x.atom2];
  const td=Math.min(...[a.atom1,a.atom2].map(x=>{const d=D(x);return Math.min(d[b.atom1],d[b.atom2]);}));
  let k;if(inR(a)&&inR(b)&&sys[a.atom1]===sys[b.atom1])k='same-ring-system';else if(inR(a)&&inR(b))k='two-ring-systems';else if(inR(a)||inR(b))k='chain-over-ring';else k='chain-over-chain';
  k+=td<=2?' (local,td<=2)':td<=5?' (td3-5)':' (fold-back,td>5)';cls[k]=(cls[k]||0)+1;}
 const q=Layout.quality(m);
 console.log(c.length>60?c.slice(0,57)+'...':c, '| atoms',m.atoms.length,'rings',rings.length,'systems',new Set(Object.values(sys)).size,'| crossings',n,JSON.stringify(cls));}
