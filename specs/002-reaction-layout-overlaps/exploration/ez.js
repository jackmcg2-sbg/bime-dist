const path=require('path');const root=process.argv[2];require(path.join(root,'tests/shim.js')).loadAll();
for(const m of ['RDT','AtomTrace','MetaboliteLibrary','Layout','ImageExport'])require(path.join(root,'editor',m+'.js'));
if(process.argv[3]==='1'){require(path.join(root,'editor/SMSDLayout.js'));for(const f of require(path.join(root,'tools/editor-files.js')).FILES)if(/^(SDGLayout|sdg\/)/.test(f))require(path.join(root,'editor',f));}
for(const [name,smi] of [['cis-2-butene','C/C=C\\C'],['maleate','OC(=O)/C=C\\C(=O)O'],['oleate','CCCCCCCC/C=C\\CCCCCCCC(=O)O']]){
 const m=SmilesParser.parse(smi);Layout.layout(m);
 const db=m.bonds.find(b=>b.type===2&&m.getAtom(b.atom1).symbol==='C'&&m.getAtom(b.atom2).symbol==='C');
 const a=db.atom1,b=db.atom2;const na=m.getNeighbors(a).find(x=>x!==b),nb=m.getNeighbors(b).find(x=>x!==a);
 const A=m.getAtom(a),B=m.getAtom(b),NA=m.getAtom(na),NB=m.getAtom(nb);
 const side=(p)=>Math.sign((B.x-A.x)*(p.y-A.y)-(B.y-A.y)*(p.x-A.x));
 console.log(name.padEnd(13),'drawn',side(NA)===side(NB)?'cis  ':'trans');}
