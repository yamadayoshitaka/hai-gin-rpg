/**
 * HAIR MODULAR SCULPT v11: a scratch-built, detachable five-part kit.
 * Reference: head scalp GLB only. Never reads or copies former hair meshes.
 *
 * ┌ Real v121 face/head (unchanged) ┐
 * ├ Rootcoat: 0.45 mm anatomical hairline backing, never the outer silhouette
 * ├ Crown: scalp conformal sculpted plates, fully overlapping
 * ├ Fringe: shaped and clipped thick curved plates above eyebrows
 * ├ Left / Right: separately sculpted face-framing plates
 * └ Back: dense overlapping long sculpted plates
 *
 * Every plate owns a spring and is checked against the head/neck/shoulder
 * ellipsoids independently on each animation tick; the root never moves.
 */
const bound=(x,a,b)=>Math.max(a,Math.min(b,x));
const ease=t=>{t=bound(t,0,1);return t*t*(3-2*t)};
const lerp=(a,b,t)=>a+(b-a)*t;
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const norm=a=>{const n=Math.hypot(...a)||1;return a.map(x=>x/n)};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const PARTS=Object.freeze(['crown','fringe','left','right','back']);
const INSPECT=[0xbcb0e9,0xb1e5b1,0xedb1b1,0xedb1b1,0xb6d5ee];
const W=[
 ['ストレートロング・ぱっつん',.35,.012,'full',0,.003,.2],
 ['ミディアム・内巻き',.16,.015,'soft',-.09,.014,.28],
 ['ボブ',.091,.02,'full',.03,.009,.12],
 ['ショートレイヤー',.053,.017,'side',-.18,.009,.55],
 ['姫カット・ロング',.34,.014,'full',0,.004,.04],
 ['ロングウェーブ',.34,.02,'curtain',.1,.034,.24],
 ['前下がりボブ',.119,.018,'side',-.08,.01,.29],
 ['ミディアム・外ハネ',.158,.022,'soft',.06,.023,.37],
 ['マッシュショート',.068,.023,'full',0,.006,.25],
 ['セミロングレイヤー',.228,.02,'side',-.16,.018,.48],
 ['ストレートロング',.36,.013,'curtain',0,.002,.04],
 ['ゆるカールミディアム',.184,.021,'soft',.08,.034,.30]
];
const M=[
 ['ナチュラルショート',.039,.016,'side',.06,.007,.56],
 ['センターパート',.081,.02,'curtain',0,.014,.33],
 ['ツーブロック',.044,.013,'side',-.19,.006,.76],
 ['マッシュ',.064,.021,'full',0,.006,.18],
 ['ミディアム',.114,.019,'side',.09,.017,.44],
 ['七三分け',.055,.016,'side',-.25,.005,.44],
 ['アップバング',.045,.019,'up',.05,.006,.59],
 ['ウルフ',.133,.022,'side',-.08,.023,.72],
 ['ベリーショート',.023,.009,'up',0,.004,.84],
 ['ロングセンターパート',.233,.016,'curtain',0,.013,.25],
 ['ウェーブショート',.056,.022,'side',.09,.021,.53],
 ['アシンメトリー',.115,.019,'side',-.24,.014,.58],
 ['ソフトモヒカン',.031,.029,'up',0,.006,.75],
 ['後ろ流しミディアム',.119,.02,'up',-.13,.014,.42]
];
const profile=(arr,gender)=>arr.map((p,i)=>Object.freeze({
 id:gender+'-hair-'+String(i+1).padStart(2,'0'),gender,
 label:p[0],length:p[1],volume:p[2],bang:p[3],
 part:p[4],wave:p[5],layer:p[6]
}));
export const HAIR_STYLES=Object.freeze({
 female:Object.freeze(profile(W,'female')),
 male:Object.freeze(profile(M,'male'))
});
export const HAIR_ALL=Object.freeze([...HAIR_STYLES.female,...HAIR_STYLES.male]);
export const findHairStyle=id=>HAIR_ALL.find(s=>s.id===id)||null;

const position=(a,i)=>[a.getX(i),a.getY(i),a.getZ(i)];
function sourceGeometry(skin,root){
 if(!skin?.isMesh||!skin.geometry?.getAttribute('position'))
  throw Error('顔v121の実際の頭部GLBが必要です');
 skin.updateWorldMatrix(true,false);root.updateWorldMatrix(true,false);
 const g=skin.geometry.clone();
 g.applyMatrix4(root.matrixWorld.clone().invert().multiply(skin.matrixWorld));
 g.computeBoundingBox();
 return g;
}
function anatomy(g,skin,root){
 const a=g.getAttribute('position'),top=g.boundingBox.max.y;
 const crown=[];
 for(let i=0;i<a.count;i++)if(a.getY(i)>top-.13)crown.push(position(a,i));
 if(crown.length<240)throw Error('頭部メッシュから頭頂形状を取得できません');
 const xs=crown.map(v=>v[0]).sort((a,b)=>a-b),zs=crown.map(v=>v[2]).sort((a,b)=>a-b);
 const q=(v,t)=>v[Math.round((v.length-1)*t)];
 let brow=-Infinity;
 if(skin.parent?.traverse)skin.parent.traverse(m=>{
  if(!m.isMesh||!/EYEBROW/i.test(m.name))return;
  const v=m.geometry?.getAttribute('position');if(!v)return;
  m.updateWorldMatrix(true,false);
  const tr=root.matrixWorld.clone().invert().multiply(m.matrixWorld).elements;
  if(!tr)return;
  for(let i=0;i<v.count;i++)brow=Math.max(brow,
   v.getX(i)*tr[1]+v.getY(i)*tr[5]+v.getZ(i)*tr[9]+tr[13]);
 });
 if(!Number.isFinite(brow)||brow>top-.022)brow=top-.075;
 return {
  top,cx:(q(xs,.03)+q(xs,.97))*.5,cz:(q(zs,.03)+q(zs,.97))*.5,
  rx:Math.max(.061,(q(xs,.98)-q(xs,.02))*.5),
  rz:Math.max(.066,(q(zs,.98)-q(zs,.02))*.5),brow
 };
}
function hairline(p,h){
 const angle=Math.abs(Math.atan2(p[0]-h.cx,p[2]-h.cz));
 const front=1-ease((angle-.36)/.71);
 const rear=ease((angle-1.4)/1.25);
 return h.brow+.017+.014*front-.025*(1-front)-.045*rear;
}
/**
 * Head-surface ray sampler: interpolate ACTUAL HEAD TRIANGLES (not nearest
 * floating vertices). For X/Z crown queries choose highest valid y; for
 * X/Y face queries choose foremost valid z. Grid acceleration keeps mobile
 * input responsive while building 26 independent hairstyle profiles.
 */
function triangleSampler(geo,h){
 const a=geo.getAttribute('position'),normals=geo.getAttribute('normal');
 const index=geo.getIndex(),n=Math.floor((index?.count??a.count)/3);
 const triangles=[],XZ=new Map(),XY=new Map(),cell=.013;
 const bin=x=>Math.floor(x/cell);
 const addBin=(map,x,y,id)=>{
  const key=bin(x)+','+bin(y);
  if(!map.has(key))map.set(key,[]);
  map.get(key).push(id);
 };
 const bboxGrid=(map,p0,p1,p2,c0,c1,id)=>{
  const minX=Math.min(p0[c0],p1[c0],p2[c0]),maxX=Math.max(p0[c0],p1[c0],p2[c0]);
  const minY=Math.min(p0[c1],p1[c1],p2[c1]),maxY=Math.max(p0[c1],p1[c1],p2[c1]);
  const startX=bin(minX),stopX=bin(maxX),startY=bin(minY),stopY=bin(maxY);
  if((stopX-startX+1)*(stopY-startY+1)>150)return;
  for(let x=startX;x<=stopX;x++)for(let y=startY;y<=stopY;y++){
   const key=x+','+y;
   if(!map.has(key))map.set(key,[]);
   map.get(key).push(id);
  }
 };
 const topVertices=[];
 for(let i=0;i<a.count;i++)
  if(a.getY(i)>h.brow-.065)topVertices.push({
   p:position(a,i),n:normals?position(normals,i):[0,1,0]
  });
 for(let t=0;t<n;t++){
  const ids=[0,1,2].map(j=>index?index.getX(t*3+j):t*3+j);
  const p=ids.map(i=>position(a,i));
  const normalsT=ids.map(i=>normals?position(normals,i):[0,1,0]);
  const id=triangles.length;
  triangles.push({p,n:normalsT});
  if(p.some(v=>v[1]>h.brow-.065))bboxGrid(XZ,...p,0,2,id);
  if(p.some(v=>v[1]>h.brow-.15))bboxGrid(XY,...p,0,1,id);
 }
 function bary(p0,p1,p2,c0,c1,x,y){
  const ax=p0[c0],ay=p0[c1],bx=p1[c0],by=p1[c1],cx=p2[c0],cy=p2[c1];
  const d=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
  if(Math.abs(d)<1e-12)return null;
  const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/d;
  const v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/d;
  const w=1-u-v;
  return Math.min(u,v,w)<-.00002?null:[u,v,w];
 }
 function ray(map,c0,c1,x,y,axis,prefer){
  const ids=new Set();
  const bx=bin(x),by=bin(y);
  for(let radius=0;radius<=2;radius++){
   for(let i=-radius;i<=radius;i++)for(let j=-radius;j<=radius;j++)
    for(const t of map.get((bx+i)+','+(by+j))||[])ids.add(t);
   if(ids.size>6)break;
  }
  let best=null,choice=prefer==='highest'||prefer==='front'?-Infinity:Infinity;
  for(const id of ids){
   const t=triangles[id],b=bary(...t.p,c0,c1,x,y);
   if(!b)continue;
   const p=[0,1,2].map(k=>t.p.reduce((s,v,j)=>s+b[j]*v[k],0));
   const score=p[axis],better=prefer==='highest'||prefer==='front'?score>choice:score<choice;
   if(better){
    choice=score;
    const n=norm(t.n[0].map((_,k)=>t.n.reduce((s,v,j)=>s+b[j]*v[k],0)));
    best={p,n};
   }
  }
  return best;
 }
 function fallback(x,z){
  let near=topVertices[0],dmin=Infinity;
  for(const v of topVertices){
   const d=(v.p[0]-x)**2+(v.p[2]-z)**2;
   if(d<dmin){dmin=d;near=v}
  }
  return near||{p:[x,h.top-.03,z],n:[0,1,0]};
 }
 const crown=(x,z)=>ray(XZ,0,2,x,z,1,'highest')||fallback(x,z);
 const front=(x,y)=>ray(XY,0,1,x,y,2,'front')?.p[2]??(h.cz+h.rz*.88);
 const rear=(x,y)=>ray(XY,0,1,x,y,2,'back')?.p[2]??(h.cz-h.rz*.91);
 return {crown,front,rear,triangles:n};
}
/** Fine directional albedo/height/roughness - generated on device for free. */
function fiberMaps(THREE){
 if(typeof document==='undefined'||!THREE.CanvasTexture)return null;
 const cv=document.createElement('canvas');cv.width=512;cv.height=1024;
 const ctx=cv.getContext('2d');
 if(!ctx)return null;
 ctx.fillStyle='#f0ede5';ctx.fillRect(0,0,512,1024);
 for(let i=0;i<1800;i++){
  const x=(i*.61803398875%1)*512;
  const shift=Math.sin(i*7.1)*.7;
  const alpha=(i%7===0?.16:.065);
  ctx.strokeStyle=i%3===0?'rgba(67,49,30,'+alpha+')':'rgba(255,255,240,'+(alpha*1.1)+')';
  ctx.lineWidth=i%13===0?.8:.32;
  ctx.beginPath();ctx.moveTo(x,0);
  for(let y=32;y<=1024;y+=32)ctx.lineTo(x+shift+Math.sin(y*.013+i*.3)*1.2,y);
  ctx.stroke();
 }
 const a=new THREE.CanvasTexture(cv);
 a.wrapS=a.wrapT=THREE.RepeatWrapping;a.colorSpace=THREE.SRGBColorSpace;a.anisotropy=8;
 const bumpCanvas=document.createElement('canvas');bumpCanvas.width=512;bumpCanvas.height=1024;
 const b=bumpCanvas.getContext('2d');b.fillStyle='#808080';b.fillRect(0,0,512,1024);
 for(let i=0;i<512;i+=1.4){
  b.fillStyle=Math.round(i)%7===0?'#b0b0b0':'#939393';
  b.fillRect(i,0,.55,1024);
 }
 const texture=new THREE.CanvasTexture(bumpCanvas);
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 return {albedo:a,bump:texture};
}
/** Clip source triangles into a 0.45mm scalp-adherent, hairline-cut rootcoat. */
function rootBacking(THREE,source,h,color,fiber){
 const p=source.getAttribute('position'),N=source.getAttribute('normal'),idx=source.getIndex();
 const pts=[],tex=[],rgb=[],faceCount=Math.floor((idx?.count??p.count)/3);
 const vertex=i=>{
  const p0=position(p,i);
  const n0=N?position(N,i):norm([p0[0]-h.cx,p0[1]-h.brow,p0[2]-h.cz]);
  return {p:p0,n:n0,d:p0[1]-hairline(p0,h)}
 };
 const between=(a,b,t)=>({
  p:a.p.map((x,i)=>lerp(x,b.p[i],t)),
  n:a.n.map((x,i)=>lerp(x,b.n[i],t)),d:0
 });
 const emit=v=>{
  const n=norm(v.n),off=.00045;
  pts.push(...v.p.map((p,i)=>p+n[i]*off));
  tex.push((v.p[0]-h.cx)*31,(v.p[2]-h.cz)*29);
  rgb.push(.85,.83,.80);
 };
 for(let i=0;i<faceCount;i++){
  const tri=[0,1,2].map(j=>vertex(idx?idx.getX(i*3+j):i*3+j)),clip=[];
  for(let j=0;j<3;j++){
   const a=tri[j],b=tri[(j+1)%3],insideA=a.d>=0,insideB=b.d>=0;
   if(insideA)clip.push(a);
   if(insideA!==insideB)clip.push(between(a,b,a.d/(a.d-b.d)));
  }
  for(let j=1;j<clip.length-1;j++){emit(clip[0]);emit(clip[j]);emit(clip[j+1])}
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));
 g.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));
 g.computeVertexNormals();g.computeBoundingSphere();
 const m=new THREE.MeshStandardMaterial({
  color,vertexColors:true,roughness:.93,side:THREE.DoubleSide,
  polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1,
  ...(fiber?{map:fiber.albedo}:{})
 });
 const mesh=new THREE.Mesh(g,m);
 mesh.name='skin-fit-inside-follicle-rootcoat';
 mesh.castShadow=false;
 return {mesh,g,m,triangles:pts.length/9,offset:.00045};
}
/**
 * Sculpt a thick plate by sweeping an ellipsoid-profiled cross section along
 * a head-derived spline; every plate is independently addressable for motion.
 * Unlike v9 cylinders, width is 3-8x thickness and plates overlap laterally.
 */
function buildPiece(THREE,label,specs,color,fiber){
 const vertices=[],uv=[],rgb=[],idx=[],locks=[],rings=8;
 const emit=(p,u,v,seed)=>{
  const id=vertices.length/3;
  vertices.push(...p);uv.push(u,v);
  const tone=.94+.025*Math.sin(seed*5.2)+.015*Math.cos(seed*.7+v*12);
  rgb.push(tone,tone*.994,tone*.985);
  return id;
 };
 for(let k=0;k<specs.length;k++){
  const spec=specs[k],points=[],n=spec.rows??16,rows=[],seed=k+1;
  for(let j=0;j<n;j++)points.push(spec.sample(j/(n-1),k));
  for(let j=0;j<n;j++){
   const t=j/(n-1),v=points[j],
    a=points[Math.max(0,j-1)].center,b=points[Math.min(n-1,j+1)].center;
   const tangent=norm(sub(b,a)),normal=norm(v.normal);
   let width=norm(cross(tangent,normal));
   if(Math.hypot(...width)<.3)width=[1,0,0];
   const half=spec.width(t,k);
   const depth=spec.thickness??.0011;
   const ring=[];
   for(let m=0;m<rings;m++){
    const theta=m*2*Math.PI/rings;
    const side=Math.cos(theta)*half,up=Math.sin(theta)*depth;
    const p=add(v.center,add(width.map(x=>x*side),normal.map(x=>x*up)));
    ring.push(emit(p,m/rings,t*spec.uvRepeat,seed));
   }
   rows.push(ring);
  }
  for(let i=0;i<n-1;i++)for(let j=0;j<rings;j++){
   const r=(j+1)%rings,a=rows[i][j],b=rows[i][r],c=rows[i+1][j],d=rows[i+1][r];
   idx.push(a,b,c,b,d,c);
  }
  const first=emit(points[0].center,.5,0,seed),last=emit(points[n-1].center,.5,spec.uvRepeat,seed);
  for(let m=0;m<rings;m++){
   const r=(m+1)%rings;idx.push(first,rows[0][r],rows[0][m]);
   idx.push(last,rows[n-1][m],rows[n-1][r]);
  }
  locks.push({label,rows,points,freeFrom:spec.freeFrom??.48,
   seed,spring:{x:0,z:0,vx:0,vz:0},collisions:0});
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));
 geo.setIndex(idx);
 geo.computeVertexNormals();geo.computeBoundingSphere();
 const material=new THREE.MeshStandardMaterial({
  color,vertexColors:true,metalness:0,roughness:.73,side:THREE.DoubleSide,
  ...(fiber?{map:fiber.albedo,bumpMap:fiber.bump,bumpScale:.00015}:{})
 });
 const mesh=new THREE.Mesh(geo,material);
 mesh.name='kit-sculpt-'+label;mesh.castShadow=true;mesh.receiveShadow=true;
 mesh.frustumCulled=false;
 return {geo,material,mesh,locks,baseline:new Float32Array(vertices),triangles:idx.length/3};
}
/**
 * Prototyped from actual crown head: 5 independently detachable units,
 * dense overlapping sculpted plates. The crown is BEFORE fringe/side/back;
 * the rootcoat remains completely below the sculpted outside surfaces.
 */
function sculptProfiles(h,sampler,style){
 const parts={crown:[],fringe:[],left:[],right:[],back:[]};
 const long=style.length>.18;
 const CROWN=168,FRINGE=40,SIDES=16,BACK=82;
 const quality=style.gender==='male'?.94:1;
 // Crown follows the REAL head triangle surface (top-down sampled barycentrically).
 for(let k=0;k<CROWN;k++){
  const angle=-Math.PI+(k+.5)*2*Math.PI/CROWN;
  const x0=h.cx+style.part*h.rx*.15+.003*Math.sin(angle);
  const z0=h.cz-h.rz*.10;
  const tipX=h.cx+Math.sin(angle)*h.rx*.89;
  const tipZ=h.cz+Math.cos(angle)*h.rz*.85;
  parts.crown.push({
   rows:17,uvRepeat:2.1,thickness:.0011,freeFrom:.96,
   width:t=>(.0048+.0007*Math.sin(k*.17))*(1-.13*ease((t-.94)/.06)),
   sample:t=>{
    const f=ease(t),x=lerp(x0,tipX,f),z=lerp(z0,tipZ,f);
    const surface=sampler.crown(x,z),normal=norm(surface.n);
    const outward=dot(normal,norm([x-h.cx,(surface.p[1]-h.brow)*.7,z-h.cz]))<0?
     normal.map(v=>-v):normal;
    const offset=.0048+style.volume*.14+.00028*Math.sin(k*.8+t*8);
    const center=add(surface.p,outward.map(v=>v*offset));
    return {center,normal:outward};
   }
  });
 }
 // Front: straight fringe cut just above eyebrows. Center-part is a profile,
 // not a cutout in the scalp: the scalp remains covered by crown plates.
 for(let k=0;k<FRINGE;k++){
  const u=(k+.5)/FRINGE*2-1,x=h.cx+u*h.rx*.86;
  if(style.bang==='curtain'&&Math.abs(u)<.11)continue;
  const root=sampler.crown(x,h.cz+h.rz*.45);
  const startY=root.p[1]+.005;
  const endY=h.brow+(style.bang==='up'?.037:style.bang==='side'?.012:.004);
  const finalZ=sampler.front(x,endY)+.0055;
  parts.fringe.push({
   rows:15,uvRepeat:2.3,thickness:.001,freeFrom:.82,
   width:t=>(.0037+.00055*Math.sin(k*.58))*(1-.08*ease((t-.93)/.07)),
   sample:t=>{
    const f=ease(t);
    const y=lerp(startY,endY,f);
    const z=Math.max(lerp(root.p[2]+.005,finalZ,f)+.0018*Math.sin(Math.PI*t),
      sampler.front(x,y)+.0048);
    return {center:[x+.0010*Math.sin(k*.35)*f,y,z],normal:[0,0,1]};
   }
  });
 }
 // L/R: separate long, thick curved face-framing pieces, inner side attached
 // near ears and tips deflected away from nose, neck and shoulders.
 for(const sign of [-1,1]){
  const label=sign<0?'left':'right';
  for(let k=0;k<SIDES;k++){
   const u=(k+.5)/SIDES,x0=h.cx+sign*h.rx*(.74+.19*u);
   const z0=h.cz+h.rz*(.38-.31*u);
   const source=sampler.crown(x0,z0);
   const startY=Math.min(source.p[1]+.005,h.top-.058);
   const span=style.length*(long?1.03:.85)+.022;
   parts[label].push({
    rows:19,uvRepeat:4,thickness:.0011,freeFrom:.25,
    width:t=>(.0034+.00075*u)*(1-.33*ease((t-.85)/.15)),
    sample:t=>{
     const f=ease(t),y=startY-span*t;
     const x=x0+sign*(.008+.002*u)*f;
     const z=Math.max(source.p[2]+.007,
      sampler.front(x,y)+.0065)+.002*Math.sin(k*.61+t*7)*f;
     return {center:[x,y,z],normal:[0,0,1]};
    }
   });
  }
 }
 // Back: multiple strata (near/far, different roots) prevent the bald rear
 // "vertical fence" and give an actual rounded long haircut silhouette.
 for(let k=0;k<BACK;k++){
  const u=(k+.5)/BACK*2-1,x0=h.cx+u*h.rx*.92;
  const z0=h.cz-h.rz*.48;
  const src=sampler.crown(x0,z0);
  const length=style.length*(long?1.10:1)+.020;
  parts.back.push({
   rows:20,uvRepeat:4.7,thickness:.001,freeFrom:.28,
   width:t=>(h.rx*.95/BACK*1.85)*(1-.40*ease((t-.85)/.15)),
   sample:t=>{
    const f=ease(t),y=src.p[1]+.005-length*t+
     .015*Math.pow(Math.abs(u),1.9)*f;
    const x=lerp(x0,h.cx+u*h.rx*.85,f)+
      style.wave*.10*Math.sin(t*8+k*.34)*f;
    const z=Math.min(h.cz-h.rz*(.84+.10*f),sampler.rear(x,y)-.005)-
      style.wave*.12*Math.sin(k*.41+t*10)*f;
    return {center:[x,y,z],normal:[0,0,-1]};
   }
  });
 }
 return parts;
}
const COLLIDER_PARTS=Object.freeze(['head','neck','left-shoulder','right-shoulder','chest','upper-back']);
/** Head + body ellipsoids in the same pivot-space units as v121. */
export function makeHairColliders(h){
 return [
  {id:'head',center:[h.cx,h.brow+.008,h.cz],radius:[h.rx*.91,Math.max(.092,h.top-h.brow+.015),h.rz*.91]},
  {id:'neck',center:[h.cx,h.brow-.114,h.cz-.007],radius:[.064,.096,.068]},
  {id:'left-shoulder',center:[h.cx-.136,h.brow-.215,h.cz-.014],radius:[.105,.074,.102]},
  {id:'right-shoulder',center:[h.cx+.136,h.brow-.215,h.cz-.014],radius:[.105,.074,.102]},
  {id:'chest',center:[h.cx,h.brow-.230,h.cz+.061],radius:[.159,.110,.108]},
  {id:'upper-back',center:[h.cx,h.brow-.232,h.cz-.084],radius:[.159,.133,.099]}
 ];
}
/** Separate local-space contact correction for each sculpted plate centerline. */
export function pushHairPlateOutside(p,colliders,part){
 let result=[...p],hits=0;
 for(const c of colliders){
  if(c.id==='head'&&part==='crown')continue;
  const u=result.map((x,i)=>(x-c.center[i])/(c.radius[i]+.003));
  const d=Math.hypot(...u);
  if(d>=1)continue;
  const normal=d>.0001?u.map(x=>x/d):[part==='left'?-1:1,.2,part==='back'?-1:1];
  const projected=normal.map((x,i)=>c.center[i]+x*(c.radius[i]+.003));
  result=projected;hits++;
 }
 return {point:result,hits};
}
export function sculptHairFromHead(THREE,skin,{referenceRoot,headSize,color='#c3a16e',styleId}={}){
 const style=findHairStyle(styleId);
 if(!style||!referenceRoot||!skin?.isMesh||!headSize)
  throw Error('顔v121頭部の実メッシュと有効な髪型IDが必要です');
 const g=sourceGeometry(skin,referenceRoot);
 const h=anatomy(g,skin,referenceRoot);
 const sample=triangleSampler(g,h);
 const fibers=fiberMaps(THREE);
 const backing=rootBacking(THREE,g,h,color,fibers);
 const pieces=sculptProfiles(h,sample,style);
 g.dispose();
 const root=new THREE.Group();root.name='assembled-modular-hair-'+style.id;
 const base=new THREE.Group();base.name='anatomical-root-only';
 base.add(backing.mesh);root.add(base);
 const parts=new Map(),colliders=makeHairColliders(h);
 for(const part of PARTS){
  const unit=buildPiece(THREE,part,pieces[part],color,fibers);
  const group=new THREE.Group();group.name='detachable-'+part;
  group.add(unit.mesh);root.add(group);
  parts.set(part,{...unit,group});
 }
 const baseline={...headSize};
 let tint=color,inspect=false,exploded=false,clock=0,contacts=0;
 const fitToHead=size=>{
  size=size||baseline;
  root.scale.set(size.width/baseline.width,size.height/baseline.height,size.depth/baseline.depth);
  root.position.set(0,0,0);
  root.userData.fit={scale:root.scale.toArray(),position:[0,0,0],headSize:size,
   fitMethod:'scalp-derived-detachable-five-part-kit-v11'};
  return root.userData.fit;
 };
 const recolor=()=>{
  backing.m.color.set(tint);
  for(const [i,part] of PARTS.entries())
   parts.get(part).material.color.set(inspect?INSPECT[i]:tint);
 };
 const rebuild=(dt=.03,motion='idle',wind=0)=>{
  contacts=0;
  const speed=motion==='run'?11:motion==='walk'?7:motion==='turn'?4:1.5;
  const power=motion==='run'?1.55:motion==='walk'?1:motion==='turn'?.75:.24;
  const step=bound(dt,1/240,.06);
  for(const part of PARTS){
   const unit=parts.get(part),pos=unit.geo.getAttribute('position');
   const out=pos.array,baselineVertices=unit.baseline;
   // A lock is a separate spring-and-collider unit even when vertices
   // are batched in one GPU mesh for mobile performance.
   for(const lock of unit.locks){
    const state=lock.spring,phase=lock.seed*.187;
    const targetX=(.0065*Math.sin(clock*speed+phase)*power+
      .0034*wind*Math.sin(clock*1.8+phase));
    const targetZ=(.006*Math.cos(clock*speed*.82+phase)*power+
      .0035*wind*Math.cos(clock*1.42+phase));
    state.vx+=(36*(targetX-state.x)-11*state.vx)*step;
    state.vz+=(36*(targetZ-state.z)-11*state.vz)*step;
    state.x=bound(state.x+state.vx*step,-.026,.026);
    state.z=bound(state.z+state.vz*step,-.027,.027);
    lock.collisions=0;
    for(let i=0;i<lock.rows.length;i++){
     const t=i/(lock.rows.length-1);
     const w=ease((t-lock.freeFrom)/(1-lock.freeFrom));
     const original=lock.points[i].center;
     const moved=[original[0]+state.x*w,original[1],original[2]+state.z*w];
     const hit=(w>0&&part!=='crown')?pushHairPlateOutside(moved,colliders,part):{point:moved,hits:0};
     lock.collisions+=hit.hits;contacts+=hit.hits;
     const correction=sub(hit.point,original);
     for(const id of lock.rows[i]){
      const k=id*3;
      out[k]=baselineVertices[k]+correction[0];
      out[k+1]=baselineVertices[k+1]+correction[1];
      out[k+2]=baselineVertices[k+2]+correction[2];
     }
    }
   }
   pos.needsUpdate=true;
   if(motion!=='idle'||wind!==0)unit.geo.computeVertexNormals();
  }
 };
 const updateMotion=(dt,{motion='idle',wind=0,time}={})=>{
  clock=Number.isFinite(time)?time:clock+dt;
  rebuild(dt,motion,wind);
  return {collisions:contacts};
 };
 const deformTips=(x=0,z=0)=>{
  for(const part of PARTS)for(const lock of parts.get(part).locks){
   lock.spring.x=bound(x,-.02,.02);lock.spring.z=bound(z,-.02,.02);
   lock.spring.vx=0;lock.spring.vz=0;
  }
  rebuild(1/30,'idle',0);
 };
 const setExploded=value=>{
  exploded=!!value;
  const shifts={crown:[0,.045,0],fringe:[0,.014,.055],
   left:[-.055,0,.01],right:[.055,0,.01],back:[0,0,-.06]};
  for(const part of PARTS)parts.get(part).group.position.set(
   ...(exploded?shifts[part]:[0,0,0]));
  base.visible=!exploded;
 };
 const dispose=()=>{
  root.removeFromParent();
  backing.g.dispose();backing.m.dispose();
  for(const part of PARTS){
   const unit=parts.get(part);unit.geo.dispose();unit.material.dispose();
  }
  fibers?.albedo.dispose();fibers?.bump.dispose();
 };
 const sectionCounts=Object.fromEntries(PARTS.map(p=>[p,parts.get(p).triangles]));
 fitToHead(baseline);
 return {
  root,cap:null,fitToHead,updateMotion,deformTips,dispose,sectionCounts,
  cleanupStats:{removedTriangles:0,removedComponents:0},
  setColor:v=>{tint=v;recolor();},
  setSectionColors:v=>{inspect=!!v;recolor();},
  setSectionVisible:(part,v)=>{if(parts.has(part))parts.get(part).group.visible=!!v;},
  setExploded,
  diagnostics:()=>({
   styleId:style.id,styleName:style.label,
   hairParts:5,partNames:[...PARTS],
   strandCounts:Object.fromEntries(PARTS.map(part=>[part,parts.get(part).locks.length])),
   separateCollisionStrands:PARTS.reduce((s,p)=>s+parts.get(p).locks.length,0),
   collisionContacts:contacts,independentSprings:true,
   rootBackingTriangles:backing.triangles,rootBackingOffset:backing.offset,
   sourceHeadUsedOnlyAsTemplate:true,oldHairMeshUsed:false,
   assembledLikeDetachableKit:true,texture:'fiber-albedo-micro-bump',
   triangleCount:Object.values(sectionCounts).reduce((a,b)=>a+b,0),
   browY:h.brow,topY:h.top
  })
 };
}
