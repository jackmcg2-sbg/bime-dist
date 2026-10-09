const path=require('path');const root=process.argv[2];require(path.join(root,'tests/shim.js')).loadAll();require(path.join(root,'editor/Layout.js'));
function cross(a,b,c,d){const o=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);const d1=o(c,d,a),d2=o(c,d,b),d3=o(a,b,c),d4=o(a,b,d);return ((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0));}
const fs=require('fs');for(const line of fs.readFileSync(process.argv[3],'utf8').trim().split('\n')){const [name,...vs]=line.split('\t');const r=[];
for(const v of vs){const m=SmilesParser.parse(v);Layout.layout(m);let n=0,cr=0;const bs=m.bonds;for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){const a=bs[i],b=bs[j];if(new Set([a.atom1,a.atom2,b.atom1,b.atom2]).size<4)continue;if(cross(m.getAtom(a.atom1),m.getAtom(a.atom2),m.getAtom(b.atom1),m.getAtom(b.atom2)))n++;}
for(let i=0;i<m.atoms.length;i++)for(let j=i+1;j<m.atoms.length;j++){const p=m.atoms[i],q=m.atoms[j];if(m.bonds.some(b=>(b.atom1===p.id&&b.atom2===q.id)||(b.atom2===p.id&&b.atom1===q.id)))continue;if(Math.hypot(p.x-q.x,p.y-q.y)<18)cr++;}
r.push(n+'/'+cr);}console.log(name,'canonical:',r[0],' random orders:',r.slice(1).join(' '));}
