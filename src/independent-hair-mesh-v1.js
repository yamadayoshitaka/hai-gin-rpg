/**
 * v2: Intact CC-BY hairstyle on top of the EXISTING bald face.
 * Normal render never uses per-triangle zone splitting. No face/eyebrow edits.
 * The optional breakdown is a separate inspection-only visualization.
 */
import {cleanDetachedHairGeometry} from './hair-island-cleanup-v1.js';
import {
 independentHairFitFromRoot,bodyCollisionProxies,resolveHairBodyContact,
 classifyHairTriangle
} from './independent-hair-library-v1.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ZONES=['crown','fringe','left','right','back'];
const COLORS={crown:0xc3a4ee,fringe:0xa9e6bc,
 left:0xf1b5b5,right:0xf1b5b5,back:0x9ab8ec};
const EXPLODE={crown:[0,.09,0],fringe:[0,0,.11],
 left:[-.125,0,0],right:[.125,0,0],back:[0,-.02,-.14]};
const percentile=(data,q)=>{
 const sorted=data.sort((a,b)=>a-b);
 return sorted[Math.min(sorted.length-1,Math.max(0,Math.floor((sorted.length-1)*q)))];
};
function validBox(box){
 return !box.isEmpty()&&
  [box.min.x,box.min.y,box.min.z,box.max.x,box.max.y,box.max.z].every(Number.isFinite);
}
const asBox=box=>({min:{x:box.min.x,y:box.min.y,z:box.min.z},
 max:{x:box.max.x,y:box.max.y,z:box.max.z}});
function rootBandBounds(THREE,geometries){
 const xs=[],ys=[],zs=[],all=new THREE.Box3();
 for(const geometry of geometries)all.union(new THREE.Box3().setFromBufferAttribute(
  geometry.getAttribute('position')));
 if(!validBox(all))throw Error('髪の境界を計測できません');
 // Only the 8.5 cm crown attachment band defines the wig fit.
 // The former 16 cm band included bangs/side locks and dragged their
 // asymmetric outline into the scalp width, depth and horizontal centre.
 const floor=all.max.y-Math.min(.085,(all.max.y-all.min.y)*.70);
 for(const geometry of geometries){
  const pos=geometry.getAttribute('position');
  const stride=Math.max(1,Math.floor(pos.count/40000));
  for(let i=0;i<pos.count;i+=stride){
   if(pos.getY(i)<floor)continue;
   xs.push(pos.getX(i));ys.push(pos.getY(i));zs.push(pos.getZ(i));
  }
 }
 if(xs.length<30)throw Error('髪の頭頂／根元帯を計測できません');
 const box=new THREE.Box3(
  new THREE.Vector3(percentile(xs,.06),percentile(ys,.03),percentile(zs,.06)),
  new THREE.Vector3(percentile(xs,.94),all.max.y,percentile(zs,.94))
 );
 if(!validBox(box))throw Error('髪の根元帯が空です');
 return {rootBox:asBox(box),hairBox:asBox(all)};
}
function triangleArea(p,a,b,c){
 const ax=p.getX(a),ay=p.getY(a),az=p.getZ(a);
 const ux=p.getX(b)-ax,uy=p.getY(b)-ay,uz=p.getZ(b)-az;
 const vx=p.getX(c)-ax,vy=p.getY(c)-ay,vz=p.getZ(c)-az;
 return Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)*.5;
}
function cloneMaterials(THREE,source,color){
 const original=Array.isArray(source)?source:[source];
 const materials=original.map(m=>{
  const clone=m?.clone()||new THREE.MeshStandardMaterial();
  clone.side=THREE.DoubleSide;
  clone.metalness=Math.min(.15,clone.metalness??0);
  // Keep original alpha maps, normal maps, UVs and opacity unchanged.
  if(clone.color)clone.color.set(color);
  return clone;
 });
 return Array.isArray(source)?materials:materials[0];
}
function eachMaterial(mesh,fn){
 for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])fn(m);
}
/**
 * Measure only the actual bald face skin. The eyebrow, eyes, eyelashes and
 * mouth remain part of the imported face; none becomes a hair-fit surface.
 */
export function measureBaldHeadSurface(THREE,model){
 model.updateMatrixWorld(true);
 let face=null;
 model.traverse(node=>{
  if(!node.isMesh||!node.geometry?.getAttribute('position'))return;
  if(/eyebrow|brow|lash|eye|iris|pupil|mouth|teeth|tongue/i.test(node.name))return;
  if(!face||node.geometry.getAttribute('position').count>
     face.geometry.getAttribute('position').count)face=node;
 });
 if(!face)throw Error('実際のスキンヘッド表面がありません');
 const points=[],tmp=new THREE.Vector3(),attr=face.geometry.getAttribute('position');
 for(let i=0;i<attr.count;i++){
  tmp.fromBufferAttribute(attr,i).applyMatrix4(face.matrixWorld);
  if(Number.isFinite(tmp.x+tmp.y+tmp.z))points.push([tmp.x,tmp.y,tmp.z]);
 }
 if(points.length<100)throw Error('スキンヘッドの頂点が不足');
 const y=points.map(v=>v[1]),top=percentile(y,.996),bottom=percentile(y,.025);
 // Crown and upper temples, excluding face and nose protrusions.
 const upper=points.filter(v=>v[1]>top-Math.min(.15,(top-bottom)*.48));
 if(upper.length<40)throw Error('スキンヘッドの頭頂領域が不足');
 const xs=upper.map(v=>v[0]),zs=upper.map(v=>v[2]);
 const left=percentile(xs,.025),right=percentile(xs,.975);
 const back=percentile(zs,.025),front=percentile(zs,.975);
 // The v121 mesh includes shoulders/neck. Never use the entire bust
 // height for the hair fitting volume: its anatomical cranium is ~24 cm.
 const w=right-left,d=front-back,h=Math.min(.245,(top-bottom)*.66);
 if(!(w>.05&&d>.05&&h>.13))throw Error('スキンヘッドの寸法が異常');
 const centerX=(left+right)/2,centerY=top-h*.5,centerZ=(back+front)/2;
 // Actual head vertices: normalized to cranium dimensions so the same
 // scalp survives face-scale slider changes. Brows, eyes and lashes excluded.
 const scalpRoofPoints=upper.filter((p,i)=>i%4===0&&p[1]>top-.125)
  .map(p=>[(p[0]-centerX)/w,(p[1]-centerY)/h,(p[2]-centerZ)/d]);
 return Object.freeze({
  skinMesh:face,vertexCount:points.length,
  width:w,depth:d,height:h,top,front,scalpRoofPoints,
  centerX,centerY,centerZ,
  skinBounds:{min:[left,top-h,back],max:[right,top,front]}
 });
}
/**
 * Pull crown vertices out of the *actual* v121 skin roof, not a sphere.
 * The correction only lifts intersecting root/upper-shell vertices: bangs
 * and freely hanging locks retain their authored shape.
 * Reads sampled anatomical vertices but never changes the head mesh.
 */
export function conformCrownAboveHeadSurface(deformers,fit,roofSamples,rootTop){
 if(!Array.isArray(roofSamples)||!roofSamples.length)return 0;
 const grid=new Map(),cell=.013;
 for(const p of roofSamples){
  const x=p[0]*fit.headSize.width,
   y=p[1]*fit.headSize.height,z=p[2]*fit.headSize.depth;
  const key=Math.floor(x/cell)+','+Math.floor(z/cell);
  if(!grid.has(key))grid.set(key,[]);
  grid.get(key).push([x,y,z]);
 }
 const crown=fit.crownY;
 let adjusted=0;
 for(const d of deformers){
  const a=d.original,raw=d.raw;
  a.set(raw);
  for(let j=0;j<raw.length;j+=3){
   // Do not project front bangs or long lengths onto the cranium.
   const yRaw=raw[j+1],yWorld=yRaw*fit.scale[1]+fit.position[1];
   if(yRaw<rootTop-.077||yWorld<crown-.095)continue;
   const x=raw[j]*fit.scale[0]+fit.position[0],
    z=raw[j+2]*fit.scale[2]+fit.position[2];
   if(z>fit.foreheadZ-.014)continue;
   const bx=Math.floor(x/cell),bz=Math.floor(z/cell);
   let sum=0,weight=0;
   for(let ix=-1;ix<=1;ix++)for(let iz=-1;iz<=1;iz++){
    const near=grid.get((bx+ix)+','+(bz+iz));
    if(!near)continue;
    for(const p of near){
     const distance=(p[0]-x)**2+(p[2]-z)**2;
     if(distance>.00036)continue;
     const w=1/(distance+.00003);
     sum+=p[1]*w;weight+=w;
    }
   }
   if(!weight)continue;
   const roof=sum/weight;
   const depth=Math.max(0,roof+.005-yWorld);
   const fade=Math.min(1,Math.max(0,(yRaw-rootTop+.077)/.065));
   const correction=Math.min(.014,depth)*fade;
   if(correction>.00015){
    a[j+1]+=correction/fit.scale[1];
    adjusted++;
   }
  }
 }
 return adjusted;
}
export function buildIndependentHairMesh(THREE,scene,{headSize={},headScalp=null,
 color='#c5a36f'}={}){
 scene.updateMatrixWorld(true);
 const root=new THREE.Group();root.name='detachable-hair-overlay-v2';
 const normalRoot=new THREE.Group();normalRoot.name='intact-original-glb';
 const breakdownRoot=new THREE.Group();breakdownRoot.name='inspection-only-breakdown';
 breakdownRoot.visible=false;
 root.add(normalRoot,breakdownRoot);
 const zones=new Map(),owned=[],deformers=[],intactGeometries=[];
 for(const id of ZONES){
  const group=new THREE.Group();group.name='inspection-'+id;
  breakdownRoot.add(group);zones.set(id,group);
 }
 let removedTriangles=0,removedComponents=0;
 const originals=[];
 scene.traverse(source=>{
  if(!source.isMesh||!source.geometry?.getAttribute('position'))return;
  // Keep every original triangle and material group in normal rendering.
  const geometry=source.geometry.clone();
  geometry.applyMatrix4(source.matrixWorld);
  const cleaned=cleanDetachedHairGeometry(geometry);
  removedTriangles+=cleaned.removedTriangles;
  removedComponents+=cleaned.removedComponents;
  if(!cleaned.keptTriangles){geometry.dispose();return;}
  const material=cloneMaterials(THREE,source.material,color);
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='intact-hair-'+(source.name||'mesh');
  mesh.castShadow=mesh.receiveShadow=true;
  mesh.frustumCulled=false;
  normalRoot.add(mesh);owned.push(mesh);intactGeometries.push(geometry);
  const pos=geometry.getAttribute('position');
  const original=new Float32Array(pos.array);
  const top=new THREE.Box3().setFromBufferAttribute(pos).max.y;
  const weights=new Float32Array(pos.count);
  const flexStart=top-.095;
  const flexLength=Math.max(.13,top-new THREE.Box3().setFromBufferAttribute(pos).min.y-.095);
  for(let i=0;i<weights.length;i++){
   weights[i]=Math.pow(clamp((flexStart-original[i*3+1])/flexLength,0,1),1.45);
  }
  deformers.push({attr:pos,raw:new Float32Array(original),original,weights});
  originals.push({source,geometry});
 });
 if(!intactGeometries.length)throw Error('元GLBに髪メッシュがありません');
 const {rootBox,hairBox}=rootBandBounds(THREE,intactGeometries);
 const headHeight=Math.max(.17,Number(headScalp?.height)||Number(headSize?.height)||.235);
 const counts=Object.fromEntries(ZONES.map(x=>[x,0]));
 // Optional diagnostic meshes. Never deform or show them in normal mode.
 for(const {source,geometry} of originals){
  const position=geometry.getAttribute('position'),index=geometry.getIndex();
  const triangles=Math.floor((index?.count??position.count)/3);
  const buckets=Object.fromEntries(ZONES.map(id=>[id,[]]));
  for(let i=0;i<triangles;i++){
   const a=index?index.getX(i*3):i*3,b=index?index.getX(i*3+1):i*3+1,
    c=index?index.getX(i*3+2):i*3+2;
   if(triangleArea(position,a,b,c)<1e-10)continue;
   const x=(position.getX(a)+position.getX(b)+position.getX(c))/3;
   const y=(position.getY(a)+position.getY(b)+position.getY(c))/3;
   const z=(position.getZ(a)+position.getZ(b)+position.getZ(c))/3;
   const id=classifyHairTriangle(x,y,z,hairBox,headHeight);
   buckets[id].push(a,b,c);
  }
  for(const id of ZONES){
   if(buckets[id].length<36)continue;
   const part=geometry.clone();part.setIndex(buckets[id]);part.clearGroups();
   part.computeBoundingSphere();
   const material=cloneMaterials(THREE,
    Array.isArray(source.material)?source.material[0]:source.material,COLORS[id]);
   const mesh=new THREE.Mesh(part,material);
   mesh.name='inspection-'+id;mesh.frustumCulled=false;
   zones.get(id).add(mesh);owned.push(mesh);
   counts[id]+=buckets[id].length/3;
  }
 }
 let size=headSize,scalp=headScalp,colorValue=color,breakdown=false,exploded=false;
 let colliders=bodyCollisionProxies(size),lastX=NaN,lastZ=NaN,lastContacts=0,lastCollision=null;
 const fitToHead=(nextSize=size,nextScalp=scalp)=>{
  size=nextSize;scalp=nextScalp;
  const f=independentHairFitFromRoot(rootBox,hairBox,size,scalp);
  root.scale.set(...f.scale);root.position.set(...f.position);
  root.userData.fit=f;
  colliders=bodyCollisionProxies(size);
  root.userData.crownVerticesAdjusted=conformCrownAboveHeadSurface(
   deformers,f,scalp?.scalpRoofPoints,rootBox.max.y);
  lastX=NaN;lastZ=NaN;lastCollision=null;
  return f;
 };
 const setSectionColors=value=>{
  breakdown=Boolean(value);
  normalRoot.visible=!breakdown;breakdownRoot.visible=breakdown;
 };
 const setExploded=value=>{
  exploded=Boolean(value);
  // Breakdown is never used as a substitute for the intact normal mesh.
  for(const [id,g] of zones)g.position.set(...(exploded?EXPLODE[id]:[0,0,0]));
  if(exploded)setSectionColors(true);
 };
 const setColor=value=>{
  colorValue=value;
  normalRoot.traverse(n=>{
   if(n.isMesh)eachMaterial(n,m=>m.color?.set(value));
  });
 };
 const setSectionVisible=(id,visible)=>{
  if(zones.has(id))zones.get(id).visible=Boolean(visible);
 };
 const deformTips=(x=0,z=0,{collision=true}={})=>{
  if(Math.abs(x-lastX)+Math.abs(z-lastZ)<.00005&&lastCollision===collision)
   return lastContacts;
  lastX=x;lastZ=z;lastCollision=collision;lastContacts=0;
  const f=root.userData.fit;
  for(const d of deformers){
   const {attr,original,weights}=d,values=attr.array;
   for(let i=0;i<weights.length;i++){
    const j=i*3,w=weights[i];
    let vx=original[j]+x*w,vy=original[j+1],vz=original[j+2]+z*w;
    if(collision&&w>.025&&f){
     const real=[
      vx*f.scale[0]+f.position[0],
      vy*f.scale[1]+f.position[1],
      vz*f.scale[2]+f.position[2]
     ];
     const result=resolveHairBodyContact(real,colliders,.004);
     if(result.hits){
      // Collisions affect only free lengths: never shift scalp roots.
      // Hard independent vertex projections shredded lower hair strips.
      // A bounded soft correction preserves neighbouring triangle continuity.
      const dx=result.position[0]-real[0],
       dy=result.position[1]-real[1],dz=result.position[2]-real[2];
      const length=Math.hypot(dx,dy,dz)||1;
      const limit=.004+.005*w; // <=9 mm per vertex (moving preview only)
      const factor=Math.min(1,limit/length)*w*w;
      vx+=dx*factor/f.scale[0];
      vy+=dy*factor/f.scale[1];
      vz+=dz*factor/f.scale[2];
      lastContacts+=result.hits;
     }
    }
    values[j]=vx;values[j+1]=vy;values[j+2]=vz;
   }
   attr.needsUpdate=true;
  }
  root.userData.contactVertices=lastContacts;
 root.userData.detachedFragmentsRemoved=removedTriangles;
  return lastContacts;
 };
 const dispose=()=>{
  root.parent?.remove(root);
  for(const mesh of owned){
   mesh.geometry.dispose();
   for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])
    material.dispose();
  }
 };
 fitToHead(size,scalp);
 return {
  root,assetBox:hairBox,rootBandBox:rootBox,sectionCounts:counts,
  cleanupStats:{removedTriangles,removedComponents},
  fitToHead,setColor,setSectionColors,setExploded,setSectionVisible,
  deformTips,dispose,
  diagnostics:()=>({normalIntact:normalRoot.visible,contacts:lastContacts,
   rootBand:rootBox,headFit:root.userData.fit,color:colorValue,
   removedTriangles,removedComponents,
   crownVerticesAdjusted:root.userData.crownVerticesAdjusted||0})
 };
}
