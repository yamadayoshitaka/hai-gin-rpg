/**
 * Head-Mesh Sculpt v9 — no visible cap or rim skirt, 112 head-derived groom volumes.
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

/**
 * v9 is NOT a wig shell.
 * The actual scalp mesh is a sampling/collision reference ONLY, and has
 * ZERO rendered triangles. Each visible vertex belongs to a sculpted strand.
 * No rim skirt, no skin-derived dome, no underlayer material, no visor band.
 */
function sculptureFromFollicles(THREE,base,h,style,color){
 const {pool,rim,faces}=base;
 const scalpGrid=new Map(),cell=.012;
 const bin=n=>Math.floor(n/cell),key=(a,b)=>bin(a)+':'+bin(b);
 for(const v of pool){
  const id=key(v.p[0],v.p[2]);
  if(!scalpGrid.has(id))scalpGrid.set(id,[]);
  scalpGrid.get(id).push(v);
 }
 const sampled=(x,z)=>{
  const a=bin(x),b=bin(z);
  let found=[],min=Infinity;
  for(let radius=1;radius<=12;radius++){
   for(let i=-radius;i<=radius;i++)for(let j=-radius;j<=radius;j++)
    for(const v of scalpGrid.get((a+i)+':'+(b+j))||[]){
     const dx=x-v.p[0],dz=z-v.p[2],dist=dx*dx+dz*dz;
     if(dist<min-.000002){min=dist;found=[v];}
     else if(dist<min+.000012)found.push(v);
    }
   if(found.length>=2||radius===12)break;
  }
  if(!found.length)throw Error('頭部表面の毛根位置を実測できません');
  // An x/z ray can hit both front and rear of the cranium. Use the
  // highest upper-scalp intersection, not a random depth-order vertex.
  return found.reduce((a,b)=>b.p[1]>a.p[1]?b:a);
 };
 const contour=rim.map(e=>pool[e.u]).filter(Boolean);
 if(contour.length<40)throw Error('頭部の生え際輪郭が不足しています');
 const radial=v=>Math.atan2(v.p[0]-h.cx,v.p[2]-h.cz);
 const angularDifference=(a,b)=>{
  const d=Math.abs(a-b);return Math.min(d,Math.PI*2-d);
 };
 const atRim=theta=>{
  let result=contour[0],best=Infinity;
  for(const v of contour){
   const d=angularDifference(radial(v),theta);
   if(d<best){best=d;result=v;}
  }
  return result;
 };
 const vertices=[],uv=[],rgb=[],weight=[],groups=SECTIONS.map(()=>[]),
  strips=112,rows=18,around=8;
 const place=(p,sec,w,seed,along)=>{
  const index=vertices.length/3;
  vertices.push(...p);
  uv.push((seed+along*.07)%8,along*2.2);
  const brightness=.88+.075*Math.sin(seed*.81)+.038*Math.sin(along*14+seed*2.3);
  rgb.push(brightness,brightness*.993,brightness*.974);
  weight.push(w);
  return index;
 };
 const tangent=(a,b)=>a.map((v,i)=>b[i]-v);
 const norm=a=>{const d=Math.hypot(...a)||1;return a.map(v=>v/d)};
 const cross=(a,b)=>[
  a[1]*b[2]-a[2]*b[1],
  a[2]*b[0]-a[0]*b[2],
  a[0]*b[1]-a[1]*b[0]
 ];
 for(let strip=0;strip<strips;strip++){
  const angle=-Math.PI+(strip+.5)*Math.PI*2/strips;
  const edge=atRim(angle);
  const front=Math.abs(angle)<.7;
  const xEnd=edge.p[0],zEnd=edge.p[2],endY=edge.p[1];
  const startX=h.cx+style.part*h.rx*.18+Math.sin(angle)*h.rx*.085;
  const startZ=h.cz-h.rz*.24+.009*Math.sin(strip*2.4);
  const length=sculptedForeheadLength(xEnd,zEnd,h,style);
  const sec=sectionOf(xEnd,zEnd,h);
  const samples=[];
  for(let i=0;i<rows;i++){
   const t=i/(rows-1),rootT=smooth(Math.min(1,t/.63));
   const x=lerp(startX,xEnd,rootT);
   const z=lerp(startZ,zEnd,rootT);
   const point=sampled(x,z);
   let normal=norm(point.n);
   const scalpRadial=norm([
    (x-h.cx)/h.rx,(point.p[1]-h.brow)/.11,(z-h.cz)/h.rz
   ]);
   if(normal.reduce((sum,v,j)=>sum+v*scalpRadial[j],0)<0)
    normal=normal.map(v=>-v);
   const beyond=smooth(Math.max(0,(t-.63)/.37));
   const y=point.p[1]-length*beyond+
    (style.flip?.004*beyond*beyond:0);
   const rootOffset=.0049+Math.min(.0035,style.volume*.16);
   const sideDrift=.0035*beyond+style.wave*.14*
    Math.sin(t*9+angle*6)*beyond;
   const center=[
    x+normal[0]*rootOffset+Math.sin(angle)*sideDrift,
    y+normal[1]*rootOffset*(1-beyond*.6),
    z+normal[2]*rootOffset+Math.cos(angle)*sideDrift
   ];
   samples.push({center,normal,t});
  }
  let prevRows=[],firstRow=[];
  for(let i=0;i<rows;i++){
   const {center,normal,t}=samples[i];
   const prev=samples[Math.max(i-1,0)].center;
   const next=samples[Math.min(i+1,rows-1)].center;
   let sideways=norm(cross(normal,tangent(prev,next)));
   const width=.0052+.0028*Math.sin(Math.PI*(.07+.82*t));
   const taper=1-.7*smooth((t-.85)/.15);
   const thick=.0015+.0007*Math.sin(Math.PI*t);
   const row=[];
   for(let k=0;k<around;k++){
    const rad=k*2*Math.PI/around;
    const side=Math.cos(rad)*width*taper;
    const depth=Math.sin(rad)*thick;
    const p=[
     center[0]+sideways[0]*side+normal[0]*depth,
     center[1]+sideways[1]*side+normal[1]*depth,
     center[2]+sideways[2]*side+normal[2]*depth
    ];
    row.push(place(p,sec,smooth((t-.55)/.45),strip,t));
   }
   if(i===0)firstRow=row;
   if(prevRows.length)for(let k=0;k<around;k++){
    const nextK=(k+1)%around;
    const a=prevRows[k],b=prevRows[nextK],c=row[k],d=row[nextK];
    groups[sec].push(a,b,c,b,d,c);
   }
   prevRows=row;
  }
  // Explicit end closures, preventing the old rim-hole artefacts.
  const first=place(samples[0].center,sec,0,strip,0);
  const last=place(samples[rows-1].center,sec,1,strip,1);
  for(let k=0;k<around;k++){
   const nextK=(k+1)%around;
   groups[sec].push(first,firstRow[nextK],firstRow[k]);
   groups[sec].push(last,prevRows[k],prevRows[nextK]);
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 const indices=[],counts={};
 for(let i=0;i<SECTIONS.length;i++){
  geometry.addGroup(indices.length,groups[i].length,i);
  indices.push(...groups[i]);
  counts[SECTIONS[i]]=groups[i].length/3;
 }
 geometry.setIndex(indices);
 geometry.computeVertexNormals();geometry.computeBoundingSphere();
 const fiber=makeCombTexture(THREE);
 const materials=SECTIONS.map(()=>new THREE.MeshStandardMaterial({
  color,roughness:.83,metalness:0,vertexColors:true,side:THREE.DoubleSide,
  ...(fiber?{map:fiber}:{})
 }));
 const mesh=new THREE.Mesh(geometry,materials);
 mesh.name='native-follicle-sculpt-no-visible-base-'+style.id;
 mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
 return {mesh,materials,fiber,weights:new Float32Array(weight),
  original:new Float32Array(vertices),counts,vertices:vertices.length/3,
  crownFaces:faces.length,boundaryEdges:rim.length,
  renderedScalpTriangles:0,renderedSkirtTriangles:0,
  exteriorLocks:strips,sourceSkinNeverRendered:true};
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
 const groom=sculptureFromFollicles(THREE,cap,shape,style,color);
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
    fitMethod:'actual-v121-follicles-no-visible-cap-v9',scalpGap:0};
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
    uniqueSculpt:true,oldHairGeometryUsed:false,oneSolid:true,antiHelmetSculpt:true,underlayerNotRendered:true,
    crownTriangles:groom.crownFaces,boundaryEdges:groom.boundaryEdges,
    totalTriangles:Object.values(groom.counts).reduce((a,b)=>a+b,0),
    totalVertices:groom.vertices,exteriorLocks:groom.exteriorLocks,renderedScalpTriangles:groom.renderedScalpTriangles,renderedSkirtTriangles:groom.renderedSkirtTriangles,browY:shape.brow,topY:shape.top,
    sway:'root-locked-damped-spring'})
 };
}
