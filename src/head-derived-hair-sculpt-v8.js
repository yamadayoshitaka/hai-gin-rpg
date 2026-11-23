/**
 * Head-Mesh Sculpt v7 — scalp-attached sculpt with reduced bulk and no rim visor.
 * Input geometry: real v121 face skin; no previous hair GLB or hair generator.
 * Pipeline: copy scalp triangles -> grow solid thickness + excess length ->
 * carve continuous silhouette -> surface/parting sculpt -> tip-only inertia.
 */
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const q5=x=>Math.round(x*100000);
const lerp=(a,b,t)=>a+(b-a)*t;
const SECTIONS=['crown','fringe','left','right','back'];
const EXAM=[0xc9aedf,0xa6e1c3,0xf4b7ba,0xf4b7ba,0xaac6ec];
const matSize=3;

/** All style parameters are authored afresh. Units are metres and radians. */
const W=[
 // 01-12 female: separate full shapes, not reskinned/recolored duplicates.
 {label:'ロング・センターパート',length:.238,front:.045,volume:.013,side:.9,part:0,wave:.014,layer:.12,bang:'curtain',taper:.16},
 {label:'ミディアム・内巻き',length:.147,front:.028,volume:.014,side:.8,part:-.13,wave:.021,layer:.27,bang:'soft',taper:.23},
 {label:'丸みボブ',length:.091,front:.036,volume:.019,side:.94,part:.04,wave:.010,layer:.06,bang:'full',taper:.13},
 {label:'ショートレイヤー',length:.058,front:.027,volume:.016,side:.84,part:-.22,wave:.006,layer:.64,bang:'side',taper:.60},
 {label:'姫カット風ロング',length:.235,front:.045,volume:.012,side:.86,part:0,wave:.006,layer:.02,bang:'full',taper:.04,hime:true},
 {label:'ロング・ゆるウェーブ',length:.265,front:.032,volume:.018,side:.98,part:.15,wave:.038,layer:.23,bang:'curtain',taper:.24},
 {label:'前下がりボブ',length:.101,front:.019,volume:.017,side:.99,part:-.10,wave:.014,layer:.12,bang:'side',taper:.25,angled:true},
 {label:'ミディアム・外ハネ',length:.166,front:.032,volume:.016,side:1,part:.10,wave:.029,layer:.4,bang:'soft',taper:.28,flip:true},
 {label:'マッシュショート',length:.052,front:.033,volume:.023,side:.88,part:0,wave:.006,layer:.15,bang:'full',taper:.32},
 {label:'セミロング・レイヤー',length:.185,front:.025,volume:.018,side:1,part:-.19,wave:.024,layer:.55,bang:'side',taper:.45},
 {label:'ストレートロング',length:.275,front:.027,volume:.010,side:.92,part:.06,wave:.004,layer:.02,bang:'curtain',taper:.08},
 {label:'ゆるカールミディアム',length:.145,front:.036,volume:.020,side:.98,part:-.12,wave:.046,layer:.43,bang:'soft',taper:.32}
];
const M=[
 {label:'ナチュラルショート',length:.034,front:.020,volume:.012,side:.82,part:.08,wave:.004,layer:.48,bang:'side',taper:.68},
 {label:'センターパート',length:.073,front:.036,volume:.015,side:.83,part:0,wave:.014,layer:.35,bang:'curtain',taper:.54},
 {label:'ツーブロック',length:.044,front:.024,volume:.017,side:.64,part:-.19,wave:.008,layer:.75,bang:'side',taper:.82},
 {label:'マッシュ',length:.051,front:.039,volume:.022,side:.82,part:0,wave:.007,layer:.17,bang:'full',taper:.37},
 {label:'ミディアム',length:.110,front:.032,volume:.016,side:.96,part:.12,wave:.020,layer:.33,bang:'side',taper:.40},
 {label:'七三分け',length:.047,front:.023,volume:.015,side:.74,part:-.26,wave:.004,layer:.37,bang:'side',taper:.70},
 {label:'アップバング',length:.036,front:.009,volume:.019,side:.77,part:.10,wave:.006,layer:.63,bang:'up',taper:.77},
 {label:'ウルフ',length:.133,front:.031,volume:.020,side:.90,part:-.08,wave:.028,layer:.74,bang:'side',taper:.63},
 {label:'ベリーショート',length:.018,front:.007,volume:.009,side:.55,part:0,wave:.002,layer:.78,bang:'up',taper:.90},
 {label:'ロング・センターパート',length:.220,front:.042,volume:.012,side:.95,part:0,wave:.018,layer:.24,bang:'curtain',taper:.25},
 {label:'ウェーブショート',length:.047,front:.028,volume:.021,side:.80,part:.15,wave:.027,layer:.58,bang:'side',taper:.68},
 {label:'アシンメトリー',length:.103,front:.038,volume:.018,side:.89,part:-.28,wave:.015,layer:.51,bang:'side',taper:.38,asymmetric:true},
 {label:'ソフトモヒカン',length:.025,front:.012,volume:.032,side:.56,part:0,wave:.003,layer:.70,bang:'up',taper:.86,mohawk:true},
 {label:'後ろ流しミディアム',length:.104,front:.012,volume:.021,side:.95,part:-.15,wave:.020,layer:.39,bang:'up',taper:.40}
];
const makeProfile=(kind,i,values)=>Object.freeze({
 id:kind+'-hair-'+String(i+1).padStart(2,'0'),
 sex:kind,number:String(i+1).padStart(2,'0'),
 label:values.label,...values
});
export const SCULPT_HAIR_STYLES=Object.freeze({
 female:Object.freeze(W.map((p,i)=>makeProfile('female',i,p))),
 male:Object.freeze(M.map((p,i)=>makeProfile('male',i,p)))
});
export const SCULPT_HAIR_ALL=Object.freeze([...SCULPT_HAIR_STYLES.female,...SCULPT_HAIR_STYLES.male]);
export function findSculptHairStyle(id){return SCULPT_HAIR_ALL.find(s=>s.id===id)||null}

function toSkinLocal(skin,host){
 skin.updateWorldMatrix(true,false);host.updateWorldMatrix(true,false);
 const geo=skin.geometry.clone();
 geo.applyMatrix4(host.matrixWorld.clone().invert().multiply(skin.matrixWorld));
 geo.computeBoundingBox();
 return geo;
}
function point(p,i){return [p.getX(i),p.getY(i),p.getZ(i)]}
function faceInfo(geo){
 const p=geo.getAttribute('position'),box=geo.boundingBox;
 if(!p||p.count<1000)throw Error('v121の実頭部メッシュがありません');
 const upper=[];
 for(let i=0;i<p.count;i++)if(p.getY(i)>box.max.y-.125)upper.push(point(p,i));
 if(upper.length<200)throw Error('頭頂形状を実測できません');
 const xs=upper.map(p=>p[0]).sort((a,b)=>a-b),
       zs=upper.map(p=>p[2]).sort((a,b)=>a-b);
 const quant=(arr,t)=>arr[Math.floor(t*(arr.length-1))];
 return {
  top:box.max.y,
  cx:(quant(xs,.04)+quant(xs,.96))*.5,
  cz:(quant(zs,.04)+quant(zs,.96))*.5,
  rx:Math.max(.05,(quant(xs,.97)-quant(xs,.03))*.5),
  rz:Math.max(.055,(quant(zs,.97)-quant(zs,.03))*.5)
 };
}
function measureBrow(skin,host,top){
 let brow=-Infinity;
 // Read ONLY source eyebrow mesh; never modify facial sliders/brow objects.
 if(skin.parent?.traverse)skin.parent.traverse(node=>{
  if(!node.isMesh||!/EYEBROW/i.test(node.name))return;
  const a=node.geometry?.getAttribute('position');if(!a)return;
  node.updateWorldMatrix(true,false);
  const m=host.matrixWorld.clone().invert().multiply(node.matrixWorld).elements;
  if(!m)return;
  for(let i=0;i<a.count;i++){
   const y=m[1]*a.getX(i)+m[5]*a.getY(i)+m[9]*a.getZ(i)+m[13];
   if(y>brow)brow=y;
  }
 });
 return Number.isFinite(brow)&&brow<top-.02?brow:top-.072;
}
/** The carved hairline follows the head, rather than a fake spherical helmet. */
export function sculptHairline(x,z,h,s){
 const a=Math.abs(Math.atan2(x-h.cx,z-h.cz));
 const front=1-smooth((a-.3)/.72),rear=smooth((a-1.52)/1.25);
 const asym=(x-h.cx)/h.rx;
 const shift=.006*s.part*asym;
 return h.brow+.018+.013*front-.027*(1-front)-.049*rear+shift;
}
/** Chiselled length silhouette: continuous contours, not noisy loose cards. */
export function carveHairLength(x,z,h,s){
 const a=Math.atan2(x-h.cx,z-h.cz),angle=Math.abs(a);
 const front=1-smooth((angle-.49)/.70);
 const back=smooth((angle-1.5)/1.1);
 const side=smooth((angle-.49)/1.0)*(1-back);
 let length=s.length*(side*.92+back*(.78+.22*s.side)) +
   s.front*front;
 if(s.bang==='curtain'){
  const center=1-smooth(Math.abs(x-h.cx)/(h.rx*.47));
  length*=1-center*.67;
 }else if(s.bang==='side'){
  length+=s.front*.48*front*clamp((x-h.cx)/h.rx*s.part+Math.abs(s.part),0,1);
 }else if(s.bang==='up'){length=s.length*(side*.93+back*.88)+s.front*.28*front;}
 if(s.hime&&side>.4&&back<.5)
  length=lerp(length,.115,1-smooth(Math.abs(angle-1.45)/.25));
 if(s.angled)length+=.033*side*(1-back);
 if(s.asymmetric)length*=1+clamp((x-h.cx)/h.rx,-1,1)*.35;
 length*=1-.13*s.layer*Math.cos(angle*13)**2;
 return Math.max(.008,length);
}
function skinClip(geo,h,style){
 const p=geo.getAttribute('position'),n=geo.getAttribute('normal'),idx=geo.getIndex();
 const pool=[],faces=[],lookup=new Map();
 const get=i=>{
  const v=point(p,i),nn=n?point(n,i):[v[0],v[1],v[2]];
  return {p:v,n:nn};
 };
 const boundaryValue=v=>v.p[1]-sculptHairline(v.p[0],v.p[2],h,style);
 const between=(a,b,t)=>({p:a.p.map((v,k)=>lerp(v,b.p[k],t)),
                          n:a.n.map((v,k)=>lerp(v,b.n[k],t))});
 const add=v=>{
  const key=v.p.map(q5).join(',');
  if(lookup.has(key))return lookup.get(key);
  const index=pool.length;pool.push(v);lookup.set(key,index);return index;
 };
 const triangleCount=Math.floor((idx?.count??p.count)/3);
 for(let i=0;i<triangleCount;i++){
  const vs=[0,1,2].map(j=>get(idx?idx.getX(i*3+j):i*3+j)),out=[];
  for(let j=0;j<3;j++){
   const a=vs[j],b=vs[(j+1)%3],va=boundaryValue(a),vb=boundaryValue(b);
   if(va>=0)out.push(a);
   if((va<0)!==(vb<0))out.push(between(a,b,va/(va-vb)));
  }
  if(out.length<3)continue;
  const a=add(out[0]);
  for(let j=1;j<out.length-1;j++){
   const b=add(out[j]),c=add(out[j+1]);
   if(a!==b&&a!==c&&b!==c)faces.push([a,b,c]);
  }
 }
 if(faces.length<550)throw Error('頭皮から十分な髪ベースを切り出せません');
 const edgeMap=new Map();
 for(const [a,b,c] of faces)for(const [u,v] of [[a,b],[b,c],[c,a]]){
  const key=Math.min(u,v)+':'+Math.max(u,v);
  if(edgeMap.has(key))edgeMap.get(key).count++;
  else edgeMap.set(key,{u,v,count:1});
 }
 const rim=[...edgeMap.values()].filter(v=>v.count===1);
 if(rim.length<40)throw Error('生え際の輪郭が生成できません');
 return {pool,faces,rim};
}
const sectionOf=(x,z,h)=>{
 const a=Math.atan2(x-h.cx,z-h.cz),abs=Math.abs(a);
 return abs<.76?1:abs>2.5?4:a<0?2:3;
};
function makeCombTexture(THREE){
 if(typeof document==='undefined'||!THREE.CanvasTexture)return null;
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;
 const ctx=canvas.getContext('2d');if(!ctx)return null;
 ctx.fillStyle='#f6f1e8';ctx.fillRect(0,0,256,512);
 for(let i=0;i<320;i++){
  const x=i*0.8,shade=(i%5? 'rgba(90,65,43,.045)':'rgba(255,249,230,.10)');
  ctx.strokeStyle=shade;ctx.lineWidth=i%8===0?.95:.42;ctx.beginPath();
  for(let y=0;y<=512;y+=32){
   const nx=x+1.15*Math.sin(y*.012+i*.39);
   if(!y)ctx.moveTo(nx,y);else ctx.lineTo(nx,y);
  }
  ctx.stroke();
 }
 const texture=new THREE.CanvasTexture(canvas);
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 texture.colorSpace=THREE.SRGBColorSpace;
 return texture;
}

/**
 * Physically bounded volume relative to the *real* scalp. The previous
 * crown had 13–32 mm of uniform extrusion; it looked like a motorcycle helmet.
 * 2.5–9 mm covers normal styles, with a deliberate narrow mohawk exception.
 */
export function scalpGroomThickness(x,y,z,h,style){
 const height=smooth((y-h.brow)/Math.max(.035,h.top-h.brow));
 const along=(x-h.cx)/h.rx;
 const partCenter=style.part*.8;
 const partLine=Math.exp(-Math.pow((along-partCenter)*9,2));
 const ridge=(.0009*Math.sin(x*145+z*56)+.00042*Math.sin(x*233-z*95))*height;
 const base=.0028+Math.min(.0055,style.volume*.25)*height*(1-.3*partLine);
 const mohawk=style.mohawk?.011*height*(1-smooth(Math.abs(along)/.38)):0;
 return clamp(base+ridge+mohawk,.0024,style.mohawk?.018:.011);
}
/**
 * Trim the forehead lock to clear the source eyebrow/eyes and curb the
 * radial overhang to a few mm. This is a contour operation, not a cap visor.
 */
export function sculptedForeheadLength(x,z,h,style){
 const angle=Math.abs(Math.atan2(x-h.cx,z-h.cz));
 const original=carveHairLength(x,z,h,style);
 const mask=1-smooth((angle-.32)/.53);
 const root=sculptHairline(x,z,h,style);
 const safe=Math.max(.006,root-h.brow-.008);
 return lerp(original,Math.min(original,safe),mask);
}
/** Flow stays tangent to the scalp at the fringe; side/back volume stays thin. */
export function sculptedOutwardFlow(angle,t,style){
 const abs=Math.abs(angle),fringe=1-smooth((abs-.36)/.55);
 const k=smooth(t);
 return (.0012*fringe+(.0032+style.volume*.12)*(1-fringe))*k;
}

/**
 * The original scalp is UNDER the visible hair. Create closed, rounded,
 * low-poly carved locks growing from real v121 scalp samples. No old GLBs.
 * Their roots are attached to the crown, not to a fake outer cap rim.
 */
function buildOutsideLocks(h,style,pool,place,byPart){
 const grid=new Map(),cell=.013;
 const ix=v=>Math.floor(v/cell);
 for(const v of pool){
  const key=ix(v.p[0])+','+ix(v.p[2]);
  if(!grid.has(key))grid.set(key,[]);
  grid.get(key).push(v);
 }
 function sample(x,z){
  const a=ix(x),b=ix(z);let best=null,dmin=Infinity;
  for(let r=1;r<=8&&!best;r++)for(let i=-r;i<=r;i++)for(let j=-r;j<=r;j++)
   for(const v of grid.get((a+i)+','+(b+j))||[]){
    const dx=v.p[0]-x,dz=v.p[2]-z,d=dx*dx+dz*dz;
    if(d<dmin){best=v;dmin=d;}
   }
  return best;
 }
 let made=0;
 for(let id=0;id<56;id++){
  const angle=-Math.PI+(id+.5)*Math.PI*2/56;
  const xEnd=h.cx+Math.sin(angle)*h.rx*.86;
  const zEnd=h.cz+Math.cos(angle)*h.rz*.88;
  const front=Math.abs(angle)<.75;
  const xBegin=h.cx+style.part*h.rx*.20+Math.sin(angle)*h.rx*.16;
  const zBegin=h.cz-h.rz*.36;
  const len=sculptedForeheadLength(xEnd,zEnd,h,style);
  const ringCount=12,sides=8,rings=[],centers=[];
  const section=sectionOf(xEnd,zEnd,h);
  for(let k=0;k<ringCount;k++){
   const t=k/(ringCount-1),f=smooth(t),x=lerp(xBegin,xEnd,f),z=lerp(zBegin,zEnd,f);
   const v=sample(x,z);
   if(!v)throw Error('v121頭皮表面の採取に失敗しました');
   const normal=v.n,mag=Math.hypot(...normal)||1;
   const n=normal.map(q=>q/mag);
   const offset=.0097+Math.min(.0025,style.volume*.13);
   const tail=smooth((t-.66)/.34);
   const y=v.p[1]-(front?Math.min(len,.027):len*.6)*tail;
   const center=[x+n[0]*offset,y+n[1]*offset,z+n[2]*offset];
   centers.push({center,normal:n,t});
  }
  for(let k=0;k<ringCount;k++){
   const {center,normal,t}=centers[k];
   const prev=centers[Math.max(0,k-1)].center,next=centers[Math.min(ringCount-1,k+1)].center;
   const tangent=next.map((v,i)=>v-prev[i]);
   let across=[
    normal[1]*tangent[2]-normal[2]*tangent[1],
    normal[2]*tangent[0]-normal[0]*tangent[2],
    normal[0]*tangent[1]-normal[1]*tangent[0]
   ];
   const length=Math.hypot(...across)||1;
   across=across.map(v=>v/length);
   const w=(.010+Math.min(.0025,style.volume*.14))*(.57+.43*Math.sin(Math.PI*(.05+.89*t)));
   const thick=.0022;
   const row=[];
   for(let j=0;j<sides;j++){
    const rad=j*Math.PI*2/sides;
    const a=Math.cos(rad)*w,b=Math.sin(rad)*thick;
    row.push(place(
     center[0]+across[0]*a+normal[0]*b,
     center[1]+across[1]*a+normal[1]*b,
     center[2]+across[2]*a+normal[2]*b,
     section,smooth(t)*.7
    ));
   }
   rings.push(row);
  }
  for(let k=0;k<ringCount-1;k++)for(let j=0;j<sides;j++){
   const j1=(j+1)%sides,a=rings[k][j],b=rings[k][j1],
    c=rings[k+1][j],d=rings[k+1][j1];
   byPart[section].push(a,b,c,b,d,c);
  }
  const first=centers[0].center,last=centers[ringCount-1].center;
  const capA=place(...first,section,0),capB=place(...last,section,1);
  for(let j=0;j<sides;j++){
   const j1=(j+1)%sides;
   byPart[section].push(capA,rings[0][j1],rings[0][j]);
   byPart[section].push(capB,rings[ringCount-1][j],rings[ringCount-1][j1]);
  }
  made++;
 }
 return made;
}

function generateSculpt(THREE,base,h,style,color){
 const {pool,faces,rim}=base;
 const innerOffset=pool.length;
 const verts=[],rgb=[],texcoord=[],weights=[],sectionTris=SECTIONS.map(()=>[]);
 const place=(x,y,z,side,weight)=>{
  const i=verts.length/3;
  verts.push(x,y,z);
  weights.push(weight);
  const brightness=clamp(.89+.045*Math.cos(x*174+z*66)+.02*Math.sin((y-h.top)*110+z*47),.78,1.03);
  rgb.push(brightness,brightness*.996,brightness*.984);
  texcoord.push((x-h.cx)*22+(z-h.cz)*3,(h.top-y)*22);
  return i;
 };
 // 1. Mould the outside of the original head skin into an excess-volume solid.
 for(const v of pool){
  const [x,y,z]=v.p;
  const n=v.n,normal=Math.hypot(...n)||1;
  const nx=n[0]/normal,ny=n[1]/normal,nz=n[2]/normal;
  const high=smooth((y-h.brow)/Math.max(.035,h.top-h.brow));
  const along=(x-h.cx)/h.rx;
  const bulk=.00075+scalpGroomThickness(x,y,z,h,style)*.23;
  // Gently comb the crown from the authored parting. The hair is attached
  // to the source skin, rather than a hard equidistant spherical shell.
  const partDistance=along-style.part*.8;
  const swept=.0015*high*Math.tanh(partDistance*6);
  const sideVolume=style.mohawk?(.65+.35*(1-smooth(Math.abs(along)/.75))):1;
  place(x+nx*bulk*sideVolume+swept,y+ny*bulk,z+nz*bulk*sideVolume,0,0);
 }
 // 2. A closed inner skin shell. The face remains exactly as uploaded.
 for(const v of pool){
  const [x,y,z]=v.p,n=v.n,mag=Math.hypot(...n)||1;
  place(x+n[0]/mag*.00045,y+n[1]/mag*.00045,z+n[2]/mag*.00045,0,0);
 }
 for(const [a,b,c] of faces){
  sectionTris[0].push(a,b,c,c+innerOffset,b+innerOffset,a+innerOffset);
 }
 // 3. Grow the same boundary outward and downward as an OVERSIZED mass.
 // 4. Carve it by the style-specific length/parting/contour field, in place.
 const rows=18,outer=new Map(),inner=new Map();
 const emitRim=(index,row,inside)=>{
  if(row===0)return index+(inside?innerOffset:0);
  const cache=inside?inner:outer,key=index+':'+row;
  if(cache.has(key))return cache.get(key);
  const v=pool[index],x=v.p[0],y=v.p[1],z=v.p[2];
  const angle=Math.atan2(x-h.cx,z-h.cz),abs=Math.abs(angle);
  const t=row/rows,k=smooth(t);
  const rootIndex=index+(inside?innerOffset:0);
  const rootX=verts[rootIndex*3],rootY=verts[rootIndex*3+1],
   rootZ=verts[rootIndex*3+2];
  // The root is exactly on the sculpted scalp shell. Every following row
  // starts from this vertex: no dark cracking seam or floating outer belt.
  const length=sculptedForeheadLength(x,z,h,style);
  const dx=x-h.cx,dz=z-h.cz,dir=Math.hypot(dx,dz)||1;
  const ux=dx/dir,uz=dz/dir;
  const outwardDistance=sculptedOutwardFlow(angle,t,style);
  const isFringe=1-smooth((abs-.4)/.55);
  const group=Math.sin(angle*17+style.part*2.7);
  const groove=Math.pow((group+1)*.5,11);
  // Individually taper many smooth carved locks near their tips. A single
  // unbroken drape from the whole rim reads as a hat or cape.
  const layerCut=(.012*style.layer+.0045*style.taper)*groove*k*k;
  const wave=style.wave*.22*Math.sin(angle*9+t*10+style.part*2)*k*k;
  const carve=clamp(length-layerCut,.006,.31);
  const tipWave=(.0026+style.wave*.15)*Math.sin(angle*18+style.part*3)*k*k;
  const x1=rootX+ux*(outwardDistance+wave)+tipWave*ux+
    style.part*.0018*isFringe*k+(style.flip?.0065*k*k:0)*ux;
  const y1=rootY-carve*t+.0018*Math.sin(Math.PI*t);
  const z1=rootZ+uz*(outwardDistance+wave)+tipWave*uz+
    (style.angled?.004*k:0)*isFringe;
  const idx=place(x1,y1,z1,sectionOf(x,z,h),k*k);
  cache.set(key,idx);return idx;
 };
 for(const e of rim){
  const {u,v}=e;
  const a=pool[u].p,b=pool[v].p,sec=sectionOf((a[0]+b[0])*.5,(a[2]+b[2])*.5,h);
  for(let row=0;row<rows;row++){
   const a0=emitRim(u,row,false),b0=emitRim(v,row,false);
   const a1=emitRim(u,row+1,false),b1=emitRim(v,row+1,false);
   sectionTris[sec].push(a0,b0,a1,b0,b1,a1);
   const ia0=emitRim(u,row,true),ib0=emitRim(v,row,true);
   const ia1=emitRim(u,row+1,true),ib1=emitRim(v,row+1,true);
   sectionTris[sec].push(ia0,ia1,ib0,ib0,ia1,ib1);
  }
  const ao=emitRim(u,rows,false),bo=emitRim(v,rows,false);
  const ai=emitRim(u,rows,true),bi=emitRim(v,rows,true);
  sectionTris[sec].push(ao,bo,ai,bo,bi,ai);
 }
 const externalLocks=buildOutsideLocks(h,style,pool,place,sectionTris);
 if(externalLocks!==56)throw Error('外側の髪束の生成数が不足: '+externalLocks);
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(texcoord,2));
 let all=[],counts={};
 for(let i=0;i<5;i++){
  geometry.addGroup(all.length,sectionTris[i].length,i);
  all.push(...sectionTris[i]);
  counts[SECTIONS[i]]=sectionTris[i].length/3;
 }
 geometry.setIndex(all);
 geometry.computeVertexNormals();geometry.computeBoundingSphere();
 const fiber=makeCombTexture(THREE);
 const materials=SECTIONS.map(()=>new THREE.MeshStandardMaterial({
  color,vertexColors:true,roughness:.84,metalness:0,side:THREE.DoubleSide,
  ...(fiber?{map:fiber}:{})
 }));
 const mesh=new THREE.Mesh(geometry,materials);
 mesh.name='v121-outer-lock-groom-'+style.id;
 mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
 const maxY=h.top;
 return {mesh,materials,fiber,weights:new Float32Array(weights),
   original:new Float32Array(verts),counts,
   crownFaces:faces.length,boundaryEdges:rim.length,topY:maxY,
   vertices:verts.length/3,externalLocks
 };
}
export function sculptHairFromHead(THREE,skin,{referenceRoot,headSize,color='#b68c59',styleId}={}){
 const style=findSculptHairStyle(styleId);
 if(!style)throw Error('未定義の髪型ID: '+String(styleId));
 if(!skin?.isMesh||!referenceRoot)throw Error('顔v121の実頭部メッシュが必要です');
 const head=toSkinLocal(skin,referenceRoot);
 const shape=faceInfo(head);
 shape.brow=measureBrow(skin,referenceRoot,shape.top);
 const cap=skinClip(head,shape,style);
 head.dispose();
 const groom=generateSculpt(THREE,cap,shape,style,color);
 const root=new THREE.Group();root.name='head-derived-sculpt-'+style.id;root.add(groom.mesh);
 const baseline={...headSize};let tint=color,inspect=false,split=false,clock=0,dx=0,dz=0,vx=0,vz=0;
 const vertices=groom.mesh.geometry.getAttribute('position');
 const reset=()=>{
  const a=vertices.array,b=groom.original;
  for(let i=0;i<groom.weights.length;i++){
   const k=i*3,w=groom.weights[i];
   const x=b[k],z=b[k+2],angle=Math.atan2(x-shape.cx,z-shape.cz);
   const phase=Math.sin(clock*4+angle*2.4)*.15;
   a[k]=x+dx*w*(1+phase)+(split?.012*w*Math.sin(angle):0);
   a[k+1]=b[k+1]+(split?.004*w:0);
   a[k+2]=z+dz*w*(1+phase)+(split?.012*w*Math.cos(angle):0);
  }
  vertices.needsUpdate=true;
  groom.mesh.geometry.computeVertexNormals();
 };
 const fitToHead=(next=baseline)=>{
  root.scale.set(next.width/baseline.width,next.height/baseline.height,
    next.depth/baseline.depth);
  root.position.set(0,0,0);
  root.userData.fit={scale:root.scale.toArray(),position:[0,0,0],headSize:next,
    fitMethod:'real-head-skin-groomed-contours-v7',scalpGap:.0015};
  return root.userData.fit;
 };
 const recolor=()=>groom.materials.forEach((m,i)=>m.color.set(inspect?EXAM[i]:tint));
 const updateMotion=(dt,{motion='idle',wind=0,time}={})=>{
  const t=clamp(dt||1/60,1/240,.06);
  clock=Number.isFinite(time)?time:clock+t;
  const speed=motion==='run'?12:motion==='walk'?7.2:motion==='turn'?4:1.4;
  const strength=motion==='run'?1.5:motion==='walk'?1:motion==='turn'?.82:.15;
  const targetX=(Math.sin(clock*speed)*.009*strength+Math.sin(clock*1.9)*wind*.004)*Math.min(1,style.length/.1);
  const targetZ=(Math.cos(clock*speed*.83)*.008*strength+Math.cos(clock*1.23)*wind*.004)*Math.min(1,style.length/.1);
  const spring=32,damping=11;
  vx+=(spring*(targetX-dx)-damping*vx)*t;
  vz+=(spring*(targetZ-dz)-damping*vz)*t;
  dx=clamp(dx+vx*t,-.04,.04);dz=clamp(dz+vz*t,-.04,.04);
  reset();return {dx,dz};
 };
 const deformTips=(x=0,z=0)=>{dx=clamp(x,-.035,.035);dz=clamp(z,-.035,.035);reset();};
 const dispose=()=>{
  root.removeFromParent();groom.mesh.geometry.dispose();
  groom.materials.forEach(m=>m.dispose());groom.fiber?.dispose?.();
 };
 fitToHead();
 return {root,cap:null,cleanupStats:{removedTriangles:0,removedComponents:0},
  sectionCounts:groom.counts,fitToHead,updateMotion,deformTips,dispose,
  setSectionColors:flag=>{inspect=Boolean(flag);recolor();},
  setExploded:flag=>{split=Boolean(flag);reset();},
  setSectionVisible:(name,enabled)=>{
   const i=SECTIONS.indexOf(name);if(i!==-1)groom.materials[i].visible=!!enabled;
  },
  setColor:value=>{tint=value;recolor();},
  diagnostics:()=>({source:'v121-head-only',hairStyle:style.label,styleId:style.id,
    uniqueSculpt:true,oldHairGeometryUsed:false,oneSolid:true,antiHelmetSculpt:true,baseUnderOuterLocks:true,
    crownTriangles:groom.crownFaces,boundaryEdges:groom.boundaryEdges,
    totalTriangles:Object.values(groom.counts).reduce((a,b)=>a+b,0),
    totalVertices:groom.vertices,externalLocks:groom.externalLocks,browY:shape.brow,topY:shape.top,
    sway:'root-locked-damped-spring'})
 };
}
