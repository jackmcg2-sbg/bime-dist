// usage: node measure.js <repoRoot> <withSDG 0|1> <id> <smiles> [svgOut]
const path=require('path'),fs=require('fs');
const [root,withSDG,id,smi,svgOut]=process.argv.slice(2);
const shim=require(path.join(root,'tests/shim.js'));shim.loadAll();
for(const m of ['RDT','AtomTrace','MetaboliteLibrary','Layout','ImageExport','MolfileWriter','ExportStamp'])require(path.join(root,'editor',m+'.js'));
if(withSDG==='2'){require(path.join(root,'editor/SMSDLayout.js'));}
if(withSDG==='1'||withSDG==='2'){const files=require(path.join(root,'tools/editor-files.js'));const list=files.FILES;
  for(const f of list){if(/^(SDGLayout|sdg\/)/.test(f))require(path.join(root,'editor',f));}}
const t0=Date.now();
const rxn=SmilesParser.parse(smi);const res=RDT.mapReaction(rxn,{});
const svg=ImageExport.toReactionMapSVG(rxn,res,{});
const ms=Date.now()-t0;
if(svgOut)fs.writeFileSync(svgOut,svg);
const BL=(typeof BOND_LENGTH!=='undefined'?BOND_LENGTH:30);
function cross(a,b,c,d){const o=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
 const d1=o(c,d,a),d2=o(c,d,b),d3=o(a,b,c),d4=o(a,b,d);return ((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0));}
const out=[];
for(const ids of rxn.getComponents()){const S=new Set(ids);const at=ids.map(i=>rxn.getAtom(i));
 const bonded=new Set();const bs=rxn.bonds.filter(b=>S.has(b.atom1)&&S.has(b.atom2));bs.forEach(b=>{bonded.add(b.atom1+','+b.atom2);bonded.add(b.atom2+','+b.atom1);});
 let severe=0,crowd=0,cr=0,longB=0,shortB=0;
 for(let i=0;i<at.length;i++)for(let j=i+1;j<at.length;j++){if(bonded.has(at[i].id+','+at[j].id))continue;const d=Math.hypot(at[i].x-at[j].x,at[i].y-at[j].y);if(d<0.35*BL)severe++;else if(d<0.6*BL)crowd++;}
 const P=b=>[rxn.getAtom(b.atom1),rxn.getAtom(b.atom2)];
 for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){const a=bs[i],b=bs[j];if(a.atom1===b.atom1||a.atom1===b.atom2||a.atom2===b.atom1||a.atom2===b.atom2)continue;const [p,q]=P(a),[r,s]=P(b);if(cross(p,q,r,s))cr++;}
 bs.forEach(b=>{const[p,q]=P(b);const l=Math.hypot(p.x-q.x,p.y-q.y)/BL;if(l>1.45)longB++;if(l<0.55)shortB++;});
 const rings=(rxn.findRings?rxn.findRings(20).filter(r=>r.atoms.every(a=>S.has(a))).length:0);
 out.push({n:ids.length,rings,severe,crowd,cross:cr,longB,shortB});}
const tot=out.reduce((t,c)=>{for(const k of['severe','crowd','cross','longB','shortB'])t[k]=(t[k]||0)+c[k];return t;},{});
console.log(JSON.stringify({id,mode:withSDG,ms,BL,tot,comps:out.filter(c=>c.n>1)}));
