/**
 * Head-fitted five-part hair groom v10.
 * Reference female 01: fine center crown, straight brow-length fringe,
 * two long face-framing locks, swept side hair, rounded long back curtain.
 *
 * THE HEAD GLB IS THE ONLY GEOMETRIC REFERENCE. No old hair meshes used.
 * A 0.7mm anatomical root coat sits UNDER dense sculpted hair strands.
 * Crown / fringe / left / right / back are independent renderable parts.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const mix=(a,b,t)=>a+(b-a)*t;
const normalize=v=>{const n=Math.hypot(...v)||1;return v.map(a=>a/n)};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const PARTS=['crown','fringe','left','right','back'];
const EXAM=[0xcbb4e6,0xb1edbd,0xf3aabc,0xf3aabc,0xaacafa];
const F=[
 ['ストレートロング・ぱっつん前髪',.35,.015,'full',0,.004],
 ['ミディアム・内巻き',.17,.020,'soft',-.12,.012],
 ['丸みボブ',.10,.024,'full',0,.008],
 ['ショートレイヤー',.066,.014,'side',-.18,.009],
 ['姫カット・ロング',.32,.013,'full',0,.004],
 ['ロング・ゆるウェーブ',.34,.025,'curtain',.12,.035],
 ['前下がりボブ',.13,.020,'side',-.1,.01],
 ['ミディアム・外ハネ',.17,.025,'soft',.08,.024],
 ['マッシュショート',.07,.025,'full',0,.008],
 ['セミロング・レイヤー',.23,.022,'side',-.13,.018],
 ['ストレートロング',.36,.012,'curtain',0,.003],
 ['カールミディアム',.19,.026,'soft',.1,.036]
];
const M=[
 ['ナチュラルショート',.047,.015,'side',.06,.008],
 ['センターパート',.085,.018,'curtain',0,.012],
 ['ツーブロック',.047,.012,'side',-.16,.006],
 ['マッシュ',.073,.023,'full',0,.006],
 ['ミディアム',.132,.018,'side',.08,.019],
 ['七三分け',.061,.016,'side',-.22,.005],
 ['アップバング',.046,.018,'up',.06,.007],
 ['ウルフ',.153,.023,'side',-.09,.024],
 ['ベリーショート',.03,.012,'up',0,.003],
 ['ロング・センターパート',.245,.017,'curtain',0,.013],
 ['ウェーブショート',.063,.026,'side',.11,.023],
 ['アシンメトリー',.128,.022,'side',-.24,.015],
 ['ソフトモヒカン',.039,.029,'up',0,.003],
 ['後ろ流しミディアム',.127,.021,'up',-.12,.014]
];
const styles=(list,sex)=>list.map((p,i)=>Object.freeze({
 id:sex+'-hair-'+String(i+1).padStart(2,'0'),sex,label:p[0],
 length:p[1],volume:p[2],bang:p[3],part:p[4],wave:p[5]
}));
export const SCULPT_HAIR_ALL=Object.freeze([...styles(F,'female'),...styles(M,'male')]);
export const SCULPT_HAIR_STYLES=Object.freeze({
 female:Object.freeze(SCULPT_HAIR_ALL.filter(s=>s.sex==='female')),
 male:Object.freeze(SCULPT_HAIR_ALL.filter(s=>s.sex==='male'))
});
export const findSculptHairStyle=id=>SCULPT_HAIR_ALL.find(s=>s.id===id)||null;

function sourceInPivot(skin,pivot){
 skin.updateWorldMatrix(true,false);pivot.updateWorldMatrix(true,false);
 const g=skin.geometry.clone();
 g.applyMatrix4(pivot.matrixWorld.clone().invert().multiply(skin.matrixWorld));
 g.computeBoundingBox();
 return g;
}
const at=(p,i)=>[p.getX(i),p.getY(i),p.getZ(i)];
function getAnatomy(g,skin,pivot){
 const p=g.getAttribute('position'),box=g.boundingBox;
 if(!p||p.count<1000)throw Error('v121の頭メッシュが必要です');
 const top=box.max.y,above=[];
 for(let i=0;i<p.count;i++)if(p.getY(i)>top-.135)above.push(at(p,i));
 if(above.length<250)throw Error('頭頂部の実測点が不足しています');
 const xs=above.map(v=>v[0]).sort((a,b)=>a-b);
 const zs=above.map(v=>v[2]).sort((a,b)=>a-b);
 const q=(a,t)=>a[Math.round((a.length-1)*t)];
 const cx=(q(xs,.04)+q(xs,.96))*.5,cz=(q(zs,.04)+q(zs,.96))*.5;
 const rx=Math.max(.06,(q(xs,.98)-q(xs,.02))*.50);
 const rz=Math.max(.064,(q(zs,.98)-q(zs,.02))*.50);
 let brow=-Infinity;
 if(skin.parent?.traverse)skin.parent.traverse(node=>{
  if(!node.isMesh||!/EYEBROW/i.test(node.name))return;
  const a=node.geometry?.getAttribute('position');
  if(!a)return;
  node.updateWorldMatrix(true,false);
  const tr=pivot.matrixWorld.clone().invert().multiply(node.matrixWorld).elements;
  if(!tr)return;
  for(let i=0;i<a.count;i++){
   const x=a.getX(i),y=a.getY(i),z=a.getZ(i);
   brow=Math.max(brow,tr[1]*x+tr[5]*y+tr[9]*z+tr[13]);
  }
 });
 if(!Number.isFinite(brow)||brow>=top-.02)brow=top-.075;
 return {top,cx,cz,rx,rz,brow};
}
/** Skin vertices are used ONLY for sampling and a concealed root backing. */
function skinSampler(g,h){
 const p=g.getAttribute('position'),normal=g.getAttribute('normal');
 const cell=.009,grid=new Map(),xy=new Map();
 const k=(a,b)=>Math.floor(a/cell)+','+Math.floor(b/cell);
 const put=(map,k,v)=>{if(!map.has(k))map.set(k,[]);map.get(k).push(v)};
 for(let i=0;i<p.count;i++){
  const pos=at(p,i);
  const n=normal?at(normal,i):normalize([pos[0]-h.cx,pos[1]-h.brow,pos[2]-h.cz]);
  const v={p:pos,n};
  if(pos[1]>h.brow-.065)put(grid,k(pos[0],pos[2]),v);
  put(xy,k(pos[0],pos[1]),v);
 }
 function nearest(map,a,b,prefer){
  const ka=Math.floor(a/cell),kb=Math.floor(b/cell);
  let found=[],best=Infinity;
  for(let radius=0;radius<=8;radius++){
   for(let i=-radius;i<=radius;i++)for(let j=-radius;j<=radius;j++){
    for(const v of map.get((ka+i)+','+(kb+j))||[]){
     const p0=prefer==='scalp'?[v.p[0],v.p[2]]:[v.p[0],v.p[1]];
     const d=(p0[0]-a)**2+(p0[1]-b)**2;
     if(d<best-.000008){best=d;found=[v]}
     else if(d<best+.00008)found.push(v);
    }
   }
   if(found.length>=3)break;
  }
  if(!found.length)return null;
  if(prefer==='front')return found.reduce((a,b)=>a.p[2]>b.p[2]?a:b);
  if(prefer==='back')return found.reduce((a,b)=>a.p[2]<b.p[2]?a:b);
  // On crown choose the highest candidate among close vertices: no fall
  // through to the back of the face when an x,z column has two surfaces.
  return found.reduce((a,b)=>a.p[1]>b.p[1]?a:b);
 }
 const scalp=(x,z)=>nearest(grid,x,z,'scalp')||{p:[x,h.top-.04,z],n:[0,1,0]};
 const faceFront=(x,y)=>nearest(xy,x,y,'front')?.p[2]??(h.cz+h.rz*.94);
 const faceBack=(x,y)=>nearest(xy,x,y,'back')?.p[2]??(h.cz-h.rz*.96);
 return {scalp,faceFront,faceBack};
}
function makeFiberTextures(THREE){
 if(typeof document==='undefined'||!THREE.CanvasTexture)return null;
 const canvas=document.createElement('canvas');
 canvas.width=512;canvas.height=1024;
 const g=canvas.getContext('2d');
 if(!g)return null;
 g.fillStyle='#eee9df';g.fillRect(0,0,512,1024);
 // Brushed longitudinal highlights, varying at sub-pixel widths.
 // Density is high enough not to resemble painted-on coarse ropes.
 for(let i=0;i<1100;i++){
  const x=(i*.61803398875%1)*512;
  const faint=(.045+.10*((i*13)%23)/23);
  g.strokeStyle=i%5===0?'rgba(92,63,32,'+faint+')':
    'rgba(255,255,245,'+(faint*.80)+')';
  g.lineWidth=i%11===0?.9:.37;
  g.beginPath();g.moveTo(x,0);
  for(let y=32;y<=1024;y+=32)
   g.lineTo(x+1.5*Math.sin(i*.41+y*.009)+.6*Math.sin(i*.19+y*.036),y);
  g.stroke();
 }
 // Low contrast highlights running in the direction of the fiber.
 for(let x=1;x<512;x+=19){
  const grad=g.createLinearGradient(x-4,0,x+5,0);
  grad.addColorStop(0,'rgba(80,58,41,0)');
  grad.addColorStop(.5,'rgba(255,252,243,.09)');
  grad.addColorStop(1,'rgba(80,58,41,0)');
  g.fillStyle=grad;g.fillRect(x-4,0,9,1024);
 }
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.RepeatWrapping;
 texture.anisotropy=8;
 const relief=document.createElement('canvas');
 relief.width=512;relief.height=1024;
 const r=relief.getContext('2d');
 r.fillStyle='#808080';r.fillRect(0,0,512,1024);
 for(let x=0;x<512;x+=2){
  r.fillStyle=x%8===0?'#b3b3b3':'#929292';
  r.fillRect(x,0,.6,1024);
 }
 const bump=new THREE.CanvasTexture(relief);
 bump.wrapS=THREE.RepeatWrapping;bump.wrapT=THREE.RepeatWrapping;
 return {texture,bump};
}
function makeStrandPart(THREE,name,paths,color,fibers){
 const verts=[],uv=[],rgb=[],weights=[],idx=[];
 const rings=8;
 const push=(p,u,v,seed,weight)=>{
  const out=verts.length/3;
  verts.push(...p);uv.push(u,v);
  const highlight=.95+.026*Math.sin(seed*1.7)+.014*Math.cos(seed*11.2+v*19);
  rgb.push(highlight,highlight*.994,highlight*.983);weights.push(weight);
  return out;
 };
 for(let k=0;k<paths.length;k++){
  const spec=paths[k],n=spec.rows||15,sections=[];
  const positions=[];
  for(let i=0;i<n;i++)positions.push(spec.position(i/(n-1),k));
  for(let i=0;i<n;i++){
   const t=i/(n-1),v=positions[i];
   const prev=positions[Math.max(0,i-1)],next=positions[Math.min(i+1,n-1)];
   const tang=normalize(next.p.map((x,j)=>x-prev.p[j]));
   const normal=normalize(v.n);
   let lateral=normalize(cross(tang,normal));
   // A wide, very shallow elliptical sculpted lock: no cylindrical rods.
   const ribbonWidth=spec.width(t,k);
   const thick=spec.thickness??.0011;
   const row=[];
   for(let j=0;j<rings;j++){
    const a=2*Math.PI*j/rings;
    const radial=Math.cos(a)*ribbonWidth,depth=Math.sin(a)*thick;
    row.push(push([
      v.p[0]+lateral[0]*radial+normal[0]*depth,
      v.p[1]+lateral[1]*radial+normal[1]*depth,
      v.p[2]+lateral[2]*radial+normal[2]*depth
     ],j/rings,t*(spec.uvRepeat||3.5),k,spec.sway?spec.sway(t):0));
   }
   sections.push(row);
  }
  for(let i=0;i<n-1;i++)for(let j=0;j<rings;j++){
   const r=(j+1)%rings,a=sections[i][j],b=sections[i][r],
         c=sections[i+1][j],d=sections[i+1][r];
   idx.push(a,b,c,b,d,c);
  }
  const first=push(positions[0].p,.5,0,k,0);
  const last=push(positions[n-1].p,.5,spec.uvRepeat||3.5,k,spec.sway?spec.sway(1):0);
  for(let j=0;j<rings;j++){
   const r=(j+1)%rings;
   idx.push(first,sections[0][r],sections[0][j]);
   idx.push(last,sections[n-1][j],sections[n-1][r]);
  }
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 g.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));
 g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();
 const material=new THREE.MeshStandardMaterial({
  color,vertexColors:true,roughness:.72,metalness:0,
  side:THREE.DoubleSide,
  ...(fibers?{map:fibers.texture,bumpMap:fibers.bump,bumpScale:.00020}:{})
 });
 const mesh=new THREE.Mesh(g,material);
 mesh.name='v121-sculpt-'+name;
 mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
 return {mesh,geometry:g,material,baseline:new Float32Array(verts),
  sway:new Float32Array(weights),triangles:idx.length/3,strands:paths.length};
}
/**
 * Anatomical rootcoat is a small hair-colored, textured fallback deep under
 * all sculpted crown strands. Never a silhouette-defining outer helmet.
 */
function rootcoat(THREE,g,h,color,fibers){
 const p=g.getAttribute('position'),normal=g.getAttribute('normal'),index=g.getIndex();
 const vertices=[],uv=[],rgb=[],tri=[];
 const hairline=(x,z)=>{
  const phi=Math.abs(Math.atan2(x-h.cx,z-h.cz));
  return h.brow+.027*(1-smooth((phi-.45)/.75))-.070*smooth((phi-1.35)/1.7);
 };
 const count=Math.floor((index?.count??p.count)/3);
 const read=i=>{
  const v=at(p,i),n=normal?at(normal,i):normalize([v[0]-h.cx,v[1]-h.brow,v[2]-h.cz]);
  return {v,n,d:v[1]-hairline(v[0],v[2])};
 };
 const between=(a,b,t)=>({v:a.v.map((x,k)=>mix(x,b.v[k],t)),
  n:a.n.map((x,k)=>mix(x,b.n[k],t)),d:0});
 const emit=v=>{
  const normal=normalize(v.n),off=.00045;
  vertices.push(v.v[0]+normal[0]*off,v.v[1]+normal[1]*off,v.v[2]+normal[2]*off);
  uv.push((v.v[0]-h.cx)*32,(v.v[2]-h.cz)*32);
  rgb.push(.82,.818,.805);
 };
 for(let k=0;k<count;k++){
  const a=[0,1,2].map(j=>read(index?index.getX(k*3+j):k*3+j));
  const clipped=[];
  for(let j=0;j<3;j++){
   const u=a[j],v=a[(j+1)%3],inU=u.d>=0,inV=v.d>=0;
   if(inU)clipped.push(u);
   if(inU!==inV)clipped.push(between(u,v,u.d/(u.d-v.d)));
  }
  for(let j=1;j<clipped.length-1;j++){
   emit(clipped[0]);emit(clipped[j]);emit(clipped[j+1]);
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));
 geo.computeVertexNormals();geo.computeBoundingSphere();
 const material=new THREE.MeshStandardMaterial({
  color,vertexColors:true,roughness:.91,side:THREE.DoubleSide,
  polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1,
  ...(fibers?{map:fibers.texture}:{})
 });
 const mesh=new THREE.Mesh(geo,material);mesh.name='concealed-follicle-rootcoat';
 mesh.castShadow=false;mesh.receiveShadow=true;
 return {mesh,geometry:geo,material,triangles:vertices.length/9,offset:.00045};
}
function referencePaths(h,skin,style){
 const paths={crown:[],fringe:[],left:[],right:[],back:[]};
 const femaleLong=style.id==='female-hair-01';
 const long=style.length>=.20;
 const wave=style.wave;
 const crownCount=124,fringeCount=(style.bang==='up'?16:34),backCount=(long?62:44);
 // Part 1: covered crown. Every root is tied to upper real scalp
 // coordinates; overlap > 2x removes the bald central/top area.
 for(let k=0;k<crownCount;k++){
  const angle=-Math.PI+(k+.5)*Math.PI*2/crownCount;
  const outerX=h.cx+Math.sin(angle)*h.rx*.93;
  const outerZ=h.cz+Math.cos(angle)*h.rz*.91;
  const rootX=h.cx+style.part*h.rx*.20+.003*Math.sin(angle);
  const rootZ=h.cz-h.rz*.11;
  paths.crown.push({
   rows:17,thickness:.0011,uvRepeat:2.5,
   width:t=>(.0042+.0035*smooth(t))*(1-.2*smooth((t-.94)/.06)),
   position:t=>{
    const f=smooth(t),x=mix(rootX,outerX,f),z=mix(rootZ,outerZ,f);
    const s=skin.scalp(x,z);
    const n=normalize(s.n);
    const off=.0058+.0005*Math.sin(k*.78);
    return {p:[x+n[0]*off,s.p[1]+Math.abs(n[1])*off,
      z+n[2]*off],n};
   },sway:()=>0
  });
 }
 // Part 2: even, straight, dense fringe, rooted in the forehead crown.
 for(let k=0;k<fringeCount;k++){
  const u=(k+.5)/fringeCount*2-1,x=h.cx+u*h.rx*.87;
  const root=skin.scalp(x*.94,h.cz+h.rz*.42);
  const rootY=root.p[1]+.006,rootZ=h.cz+h.rz*.45;
  const eyeClear=style.bang==='up'?.028:style.bang==='side'?.010:-.010;
  const endY=h.brow+eyeClear+(femaleLong?.0018*Math.sin(k*.77):.002*Math.sin(k*1.12));
  const endZ=Math.max(h.cz+h.rz*.83,skin.faceFront(x,endY)+.006);
  if(style.bang==='curtain'&&Math.abs(u)<.18)continue;
  paths.fringe.push({
   rows:16,thickness:.001,uvRepeat:2.2,
   width:t=>(.0038+.0004*Math.sin(k*.73))*(1-.08*t),
   position:t=>{
    const f=smooth(t),y=mix(rootY,endY,f);
    const z=Math.max(mix(rootZ,endZ,f)+.003*Math.sin(Math.PI*t),
      skin.faceFront(x,y)+.0035);
    return {p:[x+.0012*Math.sin(k*.42)*f,y,z],n:[0,0,1]};
   },sway:t=>.15*smooth((t-.67)/.33)
  });
 }
 // Parts 3 + 4: independently shaped, long, narrow face-framing locks.
 for(const sign of [-1,1]){
  const which=sign<0?'left':'right',count=long?12:9;
  for(let k=0;k<count;k++){
   const u=(k+.5)/count;
   const x0=h.cx+sign*h.rx*(.76+.19*u),z0=h.cz+h.rz*(.48-.34*u);
   const root=skin.scalp(x0,z0);
   const startY=Math.min(root.p[1]+.002,h.brow+.056);
   const span=femaleLong?.365:style.length*(.75+.23*u)+.03;
   const length=(long?span:Math.min(span,.17));
   paths[which].push({
    rows:20,uvRepeat:4.2,thickness:.00115,
    width:t=>(.0040+.0015*u)*(1-.27*smooth((t-.85)/.15)),
    position:t=>{
     const f=smooth(t),y=startY-length*t;
     const x=x0+sign*(.009*f+.003*Math.sin(k*.91)*f);
     const onFace=skin.faceFront(x,y)+.007;
     const z=Math.max(h.cz+h.rz*(.76-.14*u),onFace*(1-f)+
        (h.cz+h.rz*.72)*f)+.0015*Math.sin(t*7+k);
     return {p:[x,y,z],n:[0,0,1]};
    },sway:t=>smooth((t-.25)/.75)
   });
  }
 }
 // Part 5: long, densely layered rear curtain, rounded near the hem.
 for(let k=0;k<backCount;k++){
  const u=(k+.5)/backCount*2-1;
  const x0=h.cx+u*h.rx*.98;
  const z0=h.cz-h.rz*.52;
  const root=skin.scalp(x0,z0);
  const rootY=root.p[1]+.003;
  const span=style.length*(long?1.13:.95)+.042;
  paths.back.push({
   rows:22,thickness:.001,uvRepeat:5.5,
   width:t=>(h.rx*.97/backCount*1.65)*(1-.42*smooth((t-.90)/.10)),
   position:t=>{
    const f=smooth(t),y=rootY-span*t+.022*Math.pow(Math.abs(u),1.7)*f;
    const x=mix(x0,h.cx+u*h.rx*.91,f)+.0015*Math.sin(k*1.9+t*6)*f;
    const targetZ=h.cz-h.rz*(.83+.24*f);
    const z=Math.min(targetZ,skin.faceBack(x,y)-.005)-
      wave*.18*Math.sin(k*.42+t*9)*f;
    return {p:[x,y,z],n:[0,0,-1]};
   },sway:t=>smooth((t-.28)/.72)
  });
 }
 return paths;
}
export function sculptHairFromHead(THREE,skin,{referenceRoot,headSize,color='#c3a16e',styleId}={}){
 const style=findSculptHairStyle(styleId);
 if(!style||!referenceRoot||!skin?.isMesh||!headSize)
  throw Error('実v121頭部と有効な髪型IDが必要です');
 const geo=sourceInPivot(skin,referenceRoot);
 const h=getAnatomy(geo,skin,referenceRoot);
 const sampler=skinSampler(geo,h),fiber=makeFiberTextures(THREE);
 const under=rootcoat(THREE,geo,h,color,fiber);
 const spec=referencePaths(h,sampler,style);
 const root=new THREE.Group();
 root.name='v121-five-piece-reference-hair-'+style.id;
 const parts=new Map(),owned=[];
 const group=new THREE.Group();
 group.name='inner-roots-only';group.add(under.mesh);
 root.add(group);
 for(const part of PARTS){
  const data=makeStrandPart(THREE,part,spec[part],color,fiber);
  const section=new THREE.Group();section.name='hair-part-'+part;
  section.add(data.mesh);root.add(section);parts.set(part,{...data,section});
 }
 geo.dispose();
 const baseSize={...headSize};let tint=color,inspection=false,exploded=false,clock=0,
  dx=0,dz=0,vx=0,vz=0;
 const recolor=()=>{
  under.material.color.set(tint);
  for(const [i,p] of PARTS.entries()){
   parts.get(p).material.color.set(inspection?EXAM[i]:tint);
  }
 };
 const fitToHead=size=>{
  const value=size||baseSize;
  root.scale.set(value.width/baseSize.width,
    value.height/baseSize.height,value.depth/baseSize.depth);
  root.position.set(0,0,0);
  root.userData.fit={scale:root.scale.toArray(),position:[0,0,0],
   headSize:value,fitMethod:'real-v121-five-part-reference-groom-v10'};
  return root.userData.fit;
 };
 const restore=()=>{
  for(const part of PARTS){
   const data=parts.get(part),a=data.geometry.getAttribute('position');
   const b=data.baseline;
   for(let i=0;i<data.sway.length;i++){
    const k=i*3,w=data.sway[i];
    a.array[k]=b[k]+dx*w;
    a.array[k+1]=b[k+1]+(exploded?.013*w:0);
    a.array[k+2]=b[k+2]+dz*w;
   }
   a.needsUpdate=true;
   if(data.sway.some(v=>v>0))data.geometry.computeVertexNormals();
  }
 };
 const updateMotion=(dt,{motion='idle',wind=0,time}={})=>{
  const step=clamp(dt||1/30,1/240,.05);
  clock=Number.isFinite(time)?time:clock+step;
  const speed=motion==='run'?12:motion==='walk'?7:motion==='turn'?4:1.5;
  const power=motion==='run'?1.4:motion==='walk'?1:.5;
  const tx=.008*power*Math.sin(clock*speed)+.0035*wind*Math.sin(clock*1.8);
  const tz=.006*power*Math.cos(clock*speed*.8)+.004*wind*Math.cos(clock*1.37);
  vx+=(31*(tx-dx)-9*vx)*step;
  vz+=(31*(tz-dz)-9*vz)*step;
  dx=clamp(dx+vx*step,-.03,.03);dz=clamp(dz+vz*step,-.03,.03);
  restore();return {dx,dz};
 };
 const deformTips=(x=0,z=0)=>{
  dx=clamp(x,-.035,.035);dz=clamp(z,-.035,.035);restore();
 };
 const sectionCounts=Object.fromEntries(PARTS.map(p=>[p,parts.get(p).triangles]));
 const dispose=()=>{
  root.removeFromParent();
  under.geometry.dispose();under.material.dispose();
  for(const part of PARTS){
   const v=parts.get(part);v.geometry.dispose();v.material.dispose();
  }
  fiber?.texture.dispose();fiber?.bump.dispose();
 };
 fitToHead(baseSize);
 return {
  root,cap:null,fitToHead,updateMotion,deformTips,dispose,sectionCounts,
  cleanupStats:{removedTriangles:0,removedComponents:0},
  setColor:value=>{tint=value;recolor();},
  setSectionColors:value=>{inspection=!!value;recolor();},
  setSectionVisible:(name,visible)=>{
   if(parts.has(name))parts.get(name).section.visible=!!visible;
  },
  setExploded:value=>{
   exploded=!!value;
   const offsets={crown:[0,.032,0],fringe:[0,.012,.042],
    left:[-.045,0,0],right:[.045,0,0],back:[0,0,-.05]};
   for(const p of PARTS)parts.get(p).section.position.set(
    ...(exploded?offsets[p]:[0,0,0]));
   group.visible=!exploded;restore();
  },
  diagnostics:()=>({
   styleId:style.id,styleName:style.label,
   hairParts:PARTS.length,partNames:[...PARTS],
   frontalStrands:spec.fringe.length,crownStrands:spec.crown.length,
   sideStrands:spec.left.length+spec.right.length,
   backStrands:spec.back.length,
   scalpBackingTriangles:under.triangles,
   scalpBackingOffset:under.offset,
   scalpUsedAsGeometryReference:true,
   reusedFormerHairGeometry:false,
   texture:'directional-fiber-albedo-and-micro-bump',
   totalTriangles:Object.values(sectionCounts).reduce((a,b)=>a+b,0),
   rootFixedSway:true,
   browY:h.brow,topY:h.top
  })
 };
}
