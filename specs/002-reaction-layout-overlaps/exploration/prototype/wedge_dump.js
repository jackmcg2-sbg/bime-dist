// Lay out each SMILES with the parity module set; emit a V2000 MOL using depictStereo wedges (scratch).
const path=require('path'),fs=require('fs');const root=process.argv[2];const shim=require(path.join(root,'tests/shim.js'));shim.loadAll();
const UI=new Set(["Renderer.js","Tools.js","MolEditor.js","CanvasView.js","CanvasSurface.js","FocusLens.js","PageFormats.js","History.js","ToolbarPrefs.js"]);
for(const f of require(path.join(root,'tools/editor-files.js')).FILES){if(!UI.has(f))require(path.join(root,'editor',f));}
const out=[];
for(const line of fs.readFileSync(process.argv[3],'utf8').trim().split('\n')){const [f,n,smi]=line.split('\t');if(!/@/.test(smi))continue;
 const m=SmilesParser.parse(smi);Layout.layout(m);const idx={};m.atoms.forEach((a,i)=>idx[a.id]=i+1);
 const pad=(s,w)=>String(s).padStart(w);let mb=`\n  scratch\n\n${pad(m.atoms.length,3)}${pad(m.bonds.length,3)}  0  0  0  0  0  0  0  0999 V2000\n`;
 for(const a of m.atoms){const chg=a.charge||0;const cc={0:0,1:3,2:2,3:1,'-1':5,'-2':6,'-3':7}[chg]||0;mb+=`${(a.x/30).toFixed(4).padStart(10)}${(-a.y/30).toFixed(4).padStart(10)}${'0.0000'.padStart(10)} ${(a.symbol||'C').padEnd(3)} 0${pad(cc,3)}  0  0  0  0  0  0  0  0  0  0\n`;}
 for(const b of m.bonds){let a1=b.atom1,a2=b.atom2,st=0;if(b.depictStereo){st=b.depictStereo===1?1:6;if(b.depictStereoFromAtom===a2){a1=b.atom2;a2=b.atom1;}}
  const t=b.type===4||b.aromatic?4:b.type;mb+=`${pad(idx[a1],3)}${pad(idx[a2],3)}${pad(t,3)}${pad(st,3)}\n`;}
 mb+='M  END\n';out.push({f,smi,mb,wedges:m.bonds.filter(b=>b.depictStereo).length,stereoBefore:m.bonds.filter(b=>b.depictStereo).map(b=>b.depictStereo)});}
fs.writeFileSync(process.argv[4],JSON.stringify(out));console.log(out.length,'chiral molecules');
