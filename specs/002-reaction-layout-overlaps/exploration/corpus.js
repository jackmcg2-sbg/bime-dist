const path=require('path'),fs=require('fs');const root=process.argv[2];require(path.join(root,'tests/shim.js')).loadAll();require(path.join(root,'editor/Layout.js'));
if(process.argv[4]==='sdg'){for(const f of require(path.join(root,'tools/editor-files.js')).FILES)if(/^(SDGLayout|sdg\/)/.test(f))require(path.join(root,'editor',f));}
function cross(a,b,c,d){const o=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);const d1=o(c,d,a),d2=o(c,d,b),d3=o(a,b,c),d4=o(a,b,d);return ((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0));}
for(const line of fs.readFileSync(process.argv[3],'utf8').trim().split('\n')){const [f,n,smi]=line.split('\t');
 const t0=Date.now();let m;try{m=SmilesParser.parse(smi);Layout.layout(m);}catch(e){console.log(JSON.stringify({f,n:+n,err:String(e).slice(0,60)}));continue;}const ms=Date.now()-t0;
 const B=new Set();m.bonds.forEach(b=>{B.add(b.atom1+','+b.atom2);B.add(b.atom2+','+b.atom1);});let x=0,c=0,s=0;const bs=m.bonds;
 for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){const a=bs[i],b=bs[j];if(new Set([a.atom1,a.atom2,b.atom1,b.atom2]).size<4)continue;if(cross(m.getAtom(a.atom1),m.getAtom(a.atom2),m.getAtom(b.atom1),m.getAtom(b.atom2)))x++;}
 for(let i=0;i<m.atoms.length;i++)for(let j=i+1;j<m.atoms.length;j++){const p=m.atoms[i],q=m.atoms[j];if(B.has(p.id+','+q.id))continue;const d=Math.hypot(p.x-q.x,p.y-q.y)/30;if(d<0.35)s++;else if(d<0.6)c++;}
 console.log(JSON.stringify({f,n:+n,rings:m.findRings(20).length,cross:x,crowd:c,severe:s,ms}));}
