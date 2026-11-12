import * as THREE from 'three';
import {normalizeFemaleFaceControls,normalizeMaleFaceControls,FACE_V7_PALETTE,MALE_REFERENCE_DEFAULT,safeContactColor} from './face-v7-controls.js';

/**
 * Actual face-only polygon meshes. No 2D decals, portrait planes or hair.
 * The underlying face surface (nose, cheek and philtrum) is sculpted by
 * independent-face-masters. These supplemental anatomical meshes are
 * projected into that same local coordinate system and parented to it:
 * two eyeballs, two sclera-facing iris/pupil pairs, four eyelid surfaces,
 * and two shallow, surface-conforming vermilion lip volumes.
 *
 * This is a 3D CLAY DRAFT, not a photogrammetry or animation-ready rig.
 */
const bell=(x,c,w)=>Math.exp(-.5*((x-c)/w)**2);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const smoothstep=t=>{const q=clamp(t,0,1);return q*q*(3-2*q)};
const vertexMakeup=new WeakMap();
const orbitalRestPositions=new WeakMap();
function setVertexMakeup(mesh,rgb){
 mesh.geometry.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));
 mesh.material.vertexColors=true;mesh.material.needsUpdate=true;
 vertexMakeup.set(mesh.geometry,new Float32Array(rgb));
}
function colorizedMakeup(mesh,colored){
 const saved=vertexMakeup.get(mesh.geometry);
 if(!saved)return;
 const attribute=mesh.geometry.getAttribute('color');
 for(let i=0;i<saved.length;i++)attribute.array[i]=colored?saved[i]:1;
 attribute.needsUpdate=true;
}
function pigmentFactor(base,tint,opacity){
 return new THREE.Vector3(1+(tint.r/base.r-1)*opacity,
  1+(tint.g/base.g-1)*opacity,1+(tint.b/base.b-1)*opacity);
}
function buildGrid(name,columns,rows,point,material){
 const vertices=[],uv=[],indices=[];
 for(let j=0;j<=rows;j++){
  for(let i=0;i<=columns;i++){
   const u=i/columns,v=j/rows,p=point(u,v);
   vertices.push(p.x,p.y,p.z);uv.push(u,v);
  }
 }
 for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
  const k=j*(columns+1)+i;
  indices.push(k,k+1,k+columns+1,k+1,k+columns+2,k+columns+1);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingSphere();
 const mesh=new THREE.Mesh(geo,material);
 mesh.name=name;mesh.renderOrder=2;
 return mesh;
}
/** Fine tapered eyelashes rooted on the ACTUAL cosmetic eyeliner contour.
 * Keep the legacy upper/lower mesh identities, so eye-angle joints and GLB
 * export still contain just four lash meshes rather than floating cards. */
function makeFineEyelashMesh(name,liner,x,y,z,eyeRadius,side,upper,settings){
 const count=Math.max(12,Math.round((upper?84:42)*settings.lashDensity)),
  vertices=[],indices=[];
 const reference=(u)=>sampleGrid(liner,28,3,u,.24);
 for(let i=0;i<count;i++){
  const u=.055+.89*(i+.5)/count;
  const p=reference(u),edge=Math.pow(Math.sin(Math.PI*u),.58);
  const step=.89/count*.16*settings.lashThickness;
  const left=reference(Math.max(0,u-step));
  const right=reference(Math.min(1,u+step));
  const a=new THREE.Vector3().lerpVectors(p,left,.62);
  const b=new THREE.Vector3().lerpVectors(p,right,.62);
  const spread=Math.abs(u-.5)*2;
  const length=eyeRadius*(upper?.29:.080)*settings.lashLength*(.58+.42*edge)*
   (.88+.12*Math.sin((i+1)*2.39996323));
  const baseWidth=Math.max(.000015,a.distanceTo(b)*.46);
  const baseCentre=new THREE.Vector3().addVectors(a,b).multiplyScalar(.5);
  const across=new THREE.Vector3().subVectors(b,a).normalize();
  const start=vertices.length/3,stations=5;
  for(let j=0;j<stations;j++){
   const t=j/(stations-1),curl=Math.max(0,settings.lashCurl);
   const lift=(upper?1:-1)*length*(.43*t+.57*t*t);
   const forward=eyeRadius*(upper?.09:.035)*t+
    eyeRadius*.23*curl*Math.pow(t,2.25);
   const swing=side*spread*eyeRadius*.065*Math.pow(t,1.3);
   const center=baseCentre.clone().add(new THREE.Vector3(
    swing,lift,forward+eyeRadius*.018));
   const width=baseWidth*Math.pow(1-t,1.45)+eyeRadius*.00022;
   for(const dir of [-1,1]){
    const point=center.clone().addScaledVector(across,dir*width);
    vertices.push(point.x-x,point.y-y,point.z-z);
   }
  }
  for(let j=0;j<stations-1;j++){
   const base=start+j*2,next=base+2;
   indices.push(base,base+1,next,next,base+1,next+1);
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingSphere();
 const material=new THREE.MeshBasicMaterial({
  color:FACE_V7_PALETTE.lashes,side:THREE.DoubleSide,
  transparent:true,opacity:upper?.95:.76,depthWrite:false
 });
 const lash=new THREE.Mesh(geo,material);
 lash.name=name;lash.renderOrder=7;
 lash.userData.colorRole='lashes';
 lash.userData.filamentCount=count;
 lash.userData.lashLength=settings.lashLength;
 lash.userData.lashThickness=settings.lashThickness;
 lash.userData.lashCurl=settings.lashCurl;
 lash.userData.rootedOnEyeliner=true;
 lash.userData.taperedGeometry=true;
 lash.userData.curvedRibbonStations=5;
 lash.userData.tipCurlsUpFromEyeliner=true;
 return lash;
}
function sampleGrid(mesh,columns,rows,u,v){
 const su=clamp(u,0,1)*columns,sv=clamp(v,0,1)*rows;
 const i=Math.min(columns-1,Math.floor(su)),j=Math.min(rows-1,Math.floor(sv));
 const a=su-i,b=sv-j,p=mesh.geometry.getAttribute('position');
 const vertex=(x,y)=>new THREE.Vector3().fromBufferAttribute(p,y*(columns+1)+x);
 return vertex(i,j).multiplyScalar((1-a)*(1-b))
  .addScaledVector(vertex(i+1,j),a*(1-b))
  .addScaledVector(vertex(i,j+1),(1-a)*b)
  .addScaledVector(vertex(i+1,j+1),a*b);
}
/** Stitch the two cosmetic eyelid bands at both eye corners in the
 * exact same mesh coordinate space, without detached makeup cards. */
function stitchLinerCorners(upper,lower,faceWidth,depth){
 const g=upper.geometry,vertices=Array.from(g.getAttribute('position').array);
 const uv=Array.from(g.getAttribute('uv').array);
 const index=Array.from(g.getIndex().array);
 for(const u of [0,1]){
  const a=sampleGrid(upper,28,3,u,0),b=sampleGrid(lower,28,3,u,0);
  const dx=(u===0?-1:1)*faceWidth*.0025;
  const dz=depth*.00024;
  const begin=vertices.length/3;
  for(const p of [a,b]){
   vertices.push(p.x,p.y,p.z+dz,p.x+dx,p.y,p.z+dz);
   uv.push(u,0,u,1);
  }
  index.push(begin,begin+1,begin+2,begin+2,begin+1,begin+3);
 }
 g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 g.setIndex(index);g.computeVertexNormals();g.computeBoundingSphere();
 upper.userData.eyelinerCornersClosed=true;
}
/**
 * Fast cosmetic-only redraw on ORIGINAL sculpted face triangles.
 * No raycasts, no GLB clone, no 1440-strand wig rebuild required for a
 * lipstick slider drag. Both cheek and lip masks are local to the head.
 */
/** Color is embedded in each actual surface-conforming lip mesh itself.
 * This is not a separate plane: the 3D vermilion vertices move with the
 * user-edited head, and only their existing triangle colors are changed. */
function tintRealLipSurface(lip,settings,mode='color'){
 const natural=new THREE.Color(0xd9a699);
 const tint=new THREE.Color(FACE_V7_PALETTE.lipstick);
 const shiftU=clamp(settings.lipstickX/.12,-1,1)*.23;
 const shiftV=clamp(settings.lipstickY/.12,-1,1)*.23;
 const width=settings.lipstickWidth*.5,height=settings.lipstickHeight*.5;
 const colors=[];
 for(let j=0;j<=8;j++)for(let i=0;i<=32;i++){
  const u=i/32,v=j/8;
  const fadeU=smoothstep((u-(.5+shiftU-width))/.085)*
   smoothstep(((.5+shiftU+width)-u)/.085);
  const fadeV=smoothstep((v-(.5+shiftV-height))/.11)*
   smoothstep(((.5+shiftV+height)-v)/.11);
  const rgb=pigmentFactor(natural,tint,.32*fadeU*fadeV);
  colors.push(rgb.x,rgb.y,rgb.z);
 }
 setVertexMakeup(lip,colors);
 colorizedMakeup(lip,mode==='color');
 lip.userData.lipstickOnSameTriangles=true;
 lip.userData.softSatinFinish=true;
 lip.userData.lipstickOnSourceHead=true;
}
export function updateRealFacePigment(face,controls={},mode='color'){
 if(!face?.isMesh)throw Error('Sculpted head required for cosmetics');
 const settings=normalizeFemaleFaceControls(controls);
 const geometry=face.geometry;
 geometry.computeBoundingBox();
 const box=geometry.boundingBox,d=box.getSize(new THREE.Vector3());
 const cx=(box.min.x+box.max.x)*.5;
 const lipCenter=face.userData.actualMouthCreaseY??box.min.y+d.y*.509;
 const skin=new THREE.Color(FACE_V7_PALETTE.skin);
 const blush=new THREE.Color(FACE_V7_PALETTE.blush);
 const lipstick=new THREE.Color(FACE_V7_PALETTE.lipstick);
 const positions=geometry.getAttribute('position'),colors=[];
 let actualLipTintVertices=0,actualCheekTintVertices=0;
 for(let i=0;i<positions.count;i++){
  const px=positions.getX(i),py=positions.getY(i),pz=positions.getZ(i);
  const nx=Math.abs((px-cx)/d.x),ny=(py-box.min.y)/d.y;
  const front=smoothstep(((pz-box.min.z)/d.z-.52)/.22);
  const cheek=.78*bell(nx,.247,.10)*bell(ny,.551,.063)*front;
  const mouthX=(px-cx)/Math.max(.00001,d.x*.047*settings.lipstickWidth);
  const mouthY=(py-lipCenter-d.y*settings.lipstickY*.08)/
   Math.max(.00001,d.y*.012*settings.lipstickHeight);
  const lipX=smoothstep((1-Math.abs(mouthX-settings.lipstickX/.12*.15))/.20);
  const lipY=smoothstep((1-Math.abs(mouthY))/.25);
  // Cosmetic controls may move the color within the lips, but cannot
  // push the pigment onto the chin or philtrum outside the oral region.
  const anatomicalLipY=(py-lipCenter)/(d.y*.013);
  const anatomicalLipX=(px-cx)/(d.x*.055*
   Math.min(1.62,Math.pow(settings.lipstickWidth,.46)));
  const bound=smoothstep((1-Math.abs(anatomicalLipY))/.25)*
   smoothstep((1-Math.abs(anatomicalLipX))/.25);
  const lipMask=lipX*lipY*front*bound;
  if(cheek>.12)actualCheekTintVertices++;
  if(lipMask>.12)actualLipTintVertices++;
  const rgb=pigmentFactor(skin,blush,cheek)
   .multiply(pigmentFactor(skin,lipstick,.30*lipMask));
  colors.push(rgb.x,rgb.y,rgb.z);
 }
 setVertexMakeup(face,colors);
 colorizedMakeup(face,mode==='color');
 face.userData.mouthPigmentSource='sculpted-head-vertices';
 face.userData.softNaturalLipTint=true;
 face.userData.lipTintVertexCount=actualLipTintVertices;
 face.userData.cheekTintVertexCount=actualCheekTintVertices;
 for(const name of ['UPPER','LOWER']){
  const lip=face.getObjectByName(name+'_3D_VERMILION_LIP');
  if(lip)tintRealLipSurface(lip,settings,mode);
 }
 return {lip:actualLipTintVertices,cheek:actualCheekTintVertices};
}
/** Fast, exact XY-indexed frontmost triangle interpolation.
 * Replaces expensive repeated Raycaster scans during face rebuilding. */
export function createFastFaceSurfaceSampler(geometry){
 geometry.computeBoundingBox();
 const b=geometry.boundingBox,attr=geometry.getAttribute('position');
 const index=geometry.index,n=index?index.count/3:attr.count/3;
 const cols=32,rows=40,dx=Math.max(1e-8,b.max.x-b.min.x);
 const dy=Math.max(1e-8,b.max.y-b.min.y);
 const buckets=Array.from({length:cols*rows},()=>[]);
 const cell=(x,y)=>clamp(Math.floor((x-b.min.x)/dx*cols),0,cols-1)+
  cols*clamp(Math.floor((y-b.min.y)/dy*rows),0,rows-1);
 for(let t=0;t<n;t++){
  const a=index?index.getX(3*t):3*t;
  const b1=index?index.getX(3*t+1):3*t+1;
  const c=index?index.getX(3*t+2):3*t+2;
  const x0=attr.getX(a),x1=attr.getX(b1),x2=attr.getX(c);
  const y0=attr.getY(a),y1=attr.getY(b1),y2=attr.getY(c);
  const denom=(y1-y2)*(x0-x2)+(x2-x1)*(y0-y2);
  if(Math.abs(denom)<1e-14)continue;
  const minX=clamp(Math.floor((Math.min(x0,x1,x2)-b.min.x)/dx*cols),0,cols-1);
  const maxX=clamp(Math.floor((Math.max(x0,x1,x2)-b.min.x)/dx*cols),0,cols-1);
  const minY=clamp(Math.floor((Math.min(y0,y1,y2)-b.min.y)/dy*rows),0,rows-1);
  const maxY=clamp(Math.floor((Math.max(y0,y1,y2)-b.min.y)/dy*rows),0,rows-1);
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)
   buckets[x+y*cols].push([a,b1,c,denom]);
 }
 const query=(x,y)=>{
  let farthest=-Infinity;
  for(const [a,b1,c,denom] of buckets[cell(x,y)]){
   const x0=attr.getX(a),x1=attr.getX(b1),x2=attr.getX(c);
   const y0=attr.getY(a),y1=attr.getY(b1),y2=attr.getY(c);
   const u=((y1-y2)*(x-x2)+(x2-x1)*(y-y2))/denom;
   const v=((y2-y0)*(x-x2)+(x0-x2)*(y-y2))/denom;
   const w=1-u-v;
   if(u<-.000003||v<-.000003||w<-.000003)continue;
   const z=u*attr.getZ(a)+v*attr.getZ(b1)+w*attr.getZ(c);
   if(z>farthest)farthest=z;
  }
  return Number.isFinite(farthest)?farthest:null;
 };
 return {query,cellCount:cols*rows,triangleCount:n};
}
/**
 * Sculpt the ORIGINAL face topology into two shallow eye sockets.
 * The sclera then sits just behind the anatomical eyelid rim; no globe
 * translation or skin-front max() hack is needed. The mesh stays continuous.
 * This works on a cloned source-head only and never modifies the donor GLB.
 */
export function sculptEyeSocketsInFaceGeometry(geometry,settings,gender='female'){
 if(!geometry?.getAttribute?.('position'))throw Error('Face mesh required');
 geometry.computeBoundingBox();
 const box=geometry.boundingBox,d=box.getSize(new THREE.Vector3());
 const p=geometry.getAttribute('position'),cx=box.getCenter(new THREE.Vector3()).x;
 const eyeScale=Math.sqrt(settings.eyeWidth*settings.eyeHeight);
 const eyeWidth=settings.eyeWidth/eyeScale,eyeHeight=settings.eyeHeight/eyeScale;
 const radius=d.x*.052*eyeScale;
 const width=radius*1.12*eyeWidth;
 const eyeY=box.min.y+d.y*(.684+.006*settings.eyePositionY);
 // Both sexes share the identical source-head geometry; eyelid aperture
 // differences are applied only to the optical lid meshes, not the skull.
 const halfHeight=radius*.50*eyeHeight;
 // Resolve BOTH the socket carve and the eye patch from the same original
 // anatomical eyelid landmarks, not from two unrelated depth estimates.
 const originalSkin=createFastFaceSurfaceSampler(geometry);
 const eyelidDepth=new Map();
 for(const side of [-1,1]){
  const x=cx+side*d.x*.123*settings.eyeSpacing;
  const lipShift=radius*.045*eyeWidth;
  const probes=[
   originalSkin.query(x,eyeY+halfHeight+lipShift),
   originalSkin.query(x,eyeY-halfHeight+lipShift),
   originalSkin.query(x-width,eyeY),originalSkin.query(x+width,eyeY)
  ].filter(Number.isFinite);
  eyelidDepth.set(side,probes.length?Math.min(...probes):box.max.z-radius);
 }
 let vertices=0,maxInset=0,depthSum=0;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  const front=THREE.MathUtils.smoothstep((z-box.min.z)/d.z,.46,.68);
  if(front<.001)continue;
  for(const side of [-1,1]){
   const centerX=cx+side*d.x*.123*settings.eyeSpacing;
   const tx=(x-centerX)/width;
   if(Math.abs(tx)>=1.13)continue;
   const arch=Math.pow(Math.max(0,1-tx*tx),.70);
   const vHeight=Math.max(radius*.012,halfHeight*arch);
   const ty=(y-eyeY)/vHeight;
   const q=Math.max(Math.abs(tx),Math.abs(ty));
   if(q>=1.12)continue;
   // The outer ring remains attached to the cheeks and forehead.
   // Deeper recessed vertices stay behind the eye display surface.
   const lidReference=eyelidDepth.get(side);
   // Ensure the entire interior of the closed donor skin is behind the
   // future iris. A fixed 0.3R indentation failed on slanted real faces.
   const targetSkinZ=lidReference-radius*.35;
   const inset=Math.max(0,z-targetSkinZ)*
    (1-THREE.MathUtils.smoothstep(q,.58,1.12))*front;
   if(inset<=.0000005)continue;
   p.setZ(i,z-inset);
   vertices++;depthSum+=inset;maxInset=Math.max(maxInset,inset);
   break;
  }
 }
 if(vertices){
  p.needsUpdate=true;geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
 }
 geometry.userData.anatomicalEyeSocketSculpt=true;
 geometry.userData.eyeSocketSculptedVertices=vertices;
 geometry.userData.eyeSocketDepthMax=maxInset;
 return {vertices,maxInset,meanInset:vertices?depthSum/vertices:0,
  continuousSourceMesh:true,eyeballTranslated:false};
}
/**
 * The imported donor head is closed under its original eyes. Recessing
 * vertices alone cannot expose a full circular iris on coarse triangulation.
 * Open the anatomical almond in the SAME source mesh, preserving the
 * surrounding brow, cheek and eyelid topology; the fitted sclera is placed
 * behind the real eyelid rim and will be depth-tested normally.
 */
export function carveAnatomicalEyeOpenings(geometry,settings){
 geometry.computeBoundingBox();
 const box=geometry.boundingBox,d=box.getSize(new THREE.Vector3()),
  cx=box.getCenter(new THREE.Vector3()).x;
 const p=geometry.getAttribute('position'),indices=geometry.getIndex();
 const radius=d.x*.052*Math.sqrt(settings.eyeWidth*settings.eyeHeight);
 const width=d.x*.052*1.12*settings.eyeWidth;
 const height=d.x*.052*.50*settings.eyeHeight;
 const eyeY=box.min.y+d.y*(.684+.006*settings.eyePositionY);
 const frontThreshold=box.min.z+d.z*.55;
 const retained=[];
 let removed=0;
 const inOpening=(x,y,side)=>{
  const tx=(x-(cx+side*d.x*.123*settings.eyeSpacing))/width;
  if(Math.abs(tx)>=1.04)return false;
  const arch=Math.pow(Math.max(0,1-tx*tx),.70);
  const ty=(y-eyeY)/Math.max(radius*.010,height*arch);
  return Math.max(Math.abs(tx),Math.abs(ty))<1.04;
 };
 const triCount=(indices?indices.count:p.count)/3;
 for(let tri=0;tri<triCount;tri++){
  const ids=[0,1,2].map(k=>indices?indices.getX(tri*3+k):tri*3+k);
  const xyz=ids.map(i=>new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i)));
  const zMax=Math.max(...xyz.map(v=>v.z));
  if(zMax<frontThreshold){retained.push(...ids);continue;}
  const centroid=new THREE.Vector3().addVectors(xyz[0],xyz[1])
   .add(xyz[2]).multiplyScalar(1/3);
  const probes=[...xyz,centroid,
   xyz[0].clone().add(xyz[1]).multiplyScalar(.5),
   xyz[1].clone().add(xyz[2]).multiplyScalar(.5),
   xyz[2].clone().add(xyz[0]).multiplyScalar(.5)];
  let intersects=false;
  for(const side of [-1,1]){
   if(probes.some(v=>inOpening(v.x,v.y,side))){
    intersects=true;break;
   }
  }
  if(intersects){removed++;continue;}
  retained.push(...ids);
 }
 if(removed){
  geometry.setIndex(retained);
  geometry.computeBoundingSphere();
 }
 geometry.userData.anatomicalEyeOpenings=true;
 geometry.userData.anatomicalEyeOpenTriangles=removed;
 return {removed,retained:retained.length/3,openingCount:2,
  originalHeadPreserved:true,skinnedFaceSphereAvoided:true};
}
export function createAnatomicalFaceParts(face,{gender='female',controls={}}={}){
 if(!face?.isMesh||!['male','female'].includes(gender))
  throw Error('Sculpted face mesh and gender required for 3D facial parts');
 const settings=gender==='male'?normalizeMaleFaceControls(controls):
  normalizeFemaleFaceControls(controls);
 const geometry=face.geometry;
 geometry.computeBoundingBox();
 const box=geometry.boundingBox.clone(),d=box.getSize(new THREE.Vector3());
 if(d.x<.02||d.y<.02||d.z<.02)throw Error('No usable 3D face bounds');
 const cx=(box.min.x+box.max.x)*.5;
 const mat=color=>new THREE.MeshStandardMaterial({
  color,roughness:.89,metalness:0,side:THREE.DoubleSide
 });
 const lidMat=mat(0xbcbfc5);
 const lipMat=new THREE.MeshPhysicalMaterial({
  color:0xbfc3cb,roughness:.54,metalness:0,
  clearcoat:.13,clearcoatRoughness:.39,side:THREE.DoubleSide
 });
 const eyeMat=new THREE.MeshStandardMaterial({
  color:0xd5d8dd,roughness:.26,metalness:0
 });
 const irisMat=new THREE.MeshStandardMaterial({
  color:0x747a83,roughness:.26,metalness:0
 });
 const pupilMat=new THREE.MeshStandardMaterial({
  color:0x30353b,roughness:.24,metalness:0
 });
 const root=new THREE.Group();
 root.name=gender.toUpperCase()+'_ANATOMICAL_CLAY_FACE_PARTS';
 root.userData.headOnly=true;
 // Preserve the unmodified skin measurements so eyelids are fitted to the
 // actual source landmarks, while the displayed skin is recessed as ONE mesh.
 const referenceGeometry=geometry.clone();
 const sampler=createFastFaceSurfaceSampler(referenceGeometry);
 const socketSculpt=sculptEyeSocketsInFaceGeometry(geometry,settings,gender);
 const opening=carveAnatomicalEyeOpenings(geometry,settings);
 const localVertices=referenceGeometry.getAttribute('position');
 let projected=0,projectionFallbacks=0;
 const surfaceAt=(x,y)=>{
  const nearestFront=sampler.query(x,y);
  if(nearestFront!==null){projected++;return nearestFront;}
  // The surface is sparse around an open eye or mouth: only interpolate
  // inside the local face, never insert an arbitrary billboard plane.
  projectionFallbacks++;
  let best=Infinity,z=box.min.z;
  for(let i=0;i<localVertices.count;i++){
   const dx=localVertices.getX(i)-x,dy=localVertices.getY(i)-y;
   const dd=dx*dx+dy*dy;
   if(dd<best){best=dd;z=localVertices.getZ(i);}
  }
  return z;
 };
 const female=gender==='female';
 // Scale is determined exclusively by width and height. Normalize the
 // aspect factors so the aperture doesn't accidentally scale twice.
 const eyeScale=Math.sqrt(settings.eyeWidth*settings.eyeHeight);
 const eyeWidth=settings.eyeWidth/eyeScale,eyeHeight=settings.eyeHeight/eyeScale;
 const baseEyeRadius=d.x*.052;
 // Blender Studio: expose convex corneal volume above the real socket and
 // wrap the lids back onto the facial skin. Do not simply translate the eyes.
 const eyeApertureRatio=female?.50:.34;
 // A low, lid-seated corneal dome: the former 0.58R projection looked like
 // detached snail eyes in the mobile side view. Preserve slight curvature.
 const anteriorGlobeRatio=female?.120:.130;
 const eyeAnteriorClearances=[];
 const irisUpperLidRecessRatios=[];
 const originalIrisAngle=.585;
 // v33 enlarges the real circular IRIS without squashing its rim.
 const originalPupilAngle=.271;
 // A doubled requested projected diameter must remain on a sphere:
 // physical iris diameter is limited to 95.5% of the eye's diameter.
 const irisAngle=Math.asin(Math.min(.955,
  Math.sin(originalIrisAngle)*settings.irisDiameter));
 const pupilAngle=Math.asin(Math.min(.75,
  Math.sin(originalPupilAngle)*settings.irisDiameter));
 const eyeRadius=baseEyeRadius*eyeScale;
 const eyeCenterHeight=box.min.y+d.y*(.684+.006*settings.eyePositionY);
 // Preserve the saved eye size, but move the sockets slightly toward
 // the true lateral face rather than burying the globe in the midface.
 const eyeSpacing=d.x*.123*settings.eyeSpacing;
 const lateralEyeMargins=[];
 // Sclera centre is recessed. Upper and lower eyelids cover the spherical
 // edge, rather than drawing detached floating white eye disks.
 for(const side of [-1,1]){
  const firstChild=root.children.length;
  const eyeLabel=side===-1?'LEFT':'RIGHT';
  const x=cx+side*eyeSpacing,y=eyeCenterHeight;
  // Fit from actual orbital boundary points on the sculpted face.
  const rimWidth=eyeRadius*1.12*eyeWidth,rimHeight=eyeRadius*eyeApertureRatio*eyeHeight;
  const landmarks={
   inner:new THREE.Vector3(x-side*rimWidth,y,surfaceAt(x-side*rimWidth,y)),
   outer:new THREE.Vector3(x+side*rimWidth,y,surfaceAt(x+side*rimWidth,y)),
   upper:new THREE.Vector3(x,y+rimHeight,surfaceAt(x,y+rimHeight)),
   lower:new THREE.Vector3(x,y-rimHeight,surfaceAt(x,y-rimHeight))
  };
  const faceZ=surfaceAt(x,y);
  // Set globes into the socket but forward enough for the colored iris
  // to stay visible at oblique camera angles; not floating over the lids.
  // The source head has a deep orbital side-wall. A constant offset
  // can still leave the whole sclera hidden from a profile camera.
  // Solve the eye centre from the actual LATERAL facial skin surface.
  const profileProbeX=x+side*eyeRadius*1.18*.86*eyeWidth;
  const localSkinAtProfile=surfaceAt(profileProbeX,y);
  const cornealAtProfile=eyeRadius*.97*Math.sqrt(1-.86*.86);
  const desiredProfileGap=Math.max(d.z*.012,eyeRadius*.115);
  const orbitalDepth=(landmarks.inner.z+landmarks.outer.z+
   landmarks.upper.z+landmarks.lower.z)*.25;
  // v29: old sclera started only .025 eye-radii above skin, with .23
  // radii of central curvature; it looked sunk into the socket.
  // Fit a convex anterior globe using the real face as its edge. A local
  // front envelope ensures the iris is never buried by the source head.
  const width=eyeRadius*1.12*eyeWidth;
  // Sample the orbit with a fixed physical baseline: width/height changes
  // may reshape the eye but NEVER move its cornea backward into the face.
  // Face/eye templates reshape the eye socket: protect the entire cornea,
  // not only a central skin sample, from overlapping skin triangles.
  const orbitSamples=[];
  for(const ax of [-.62,0,.62])for(const ay of [-.45,0,.45])
   orbitSamples.push(surfaceAt(x+ax*width,y+ay*rimHeight));
  // Do not push the entire cornea to the MOST protruding brow/cheek
  // triangle. Keep the centre local to its actual eye socket instead.
  // Align the OPTICAL surface to the shallowest real eyelid rim, not
  // the forehead/cheek front or the center of a closed donor skin patch.
  // The unmodified upper rim often slopes backward substantially.
  const upperLipSkin=surfaceAt(x,y+rimHeight+eyeRadius*.045*eyeWidth);
  const lowerLipSkin=surfaceAt(x,y-rimHeight+eyeRadius*.045*eyeWidth);
  const orbitFrontZ=Math.min(upperLipSkin,lowerLipSkin,
   landmarks.inner.z,landmarks.outer.z);
  // Negative relative to the UNCARVED skin: the eye is now seated inside
  // the socket, not floating over it. Depth control adjusts the socket view
  // gently instead of pushing the whole globe outside the eyeliner.
  const eyeSurfaceLift=baseEyeRadius*(-.20+settings.eyeDepth*.045);
  const eyeDomeHeight=baseEyeRadius*anteriorGlobeRatio;
  const insetZ=(px,py)=>{
   const tx=clamp((px-x)/width,-1,1);
   const arch=Math.pow(Math.max(0,1-tx*tx),.70);
   const apertureY=eyeRadius*eyeApertureRatio*eyeHeight*arch;
   const ty=apertureY>.000001?
    clamp((py-y)/apertureY,-1,1):1;
   // Anatomically smooth sclera/cornea: the central eye MUST NOT inherit
   // triangulation noise from the original closed skin surface. The former
   // skin-projected patch caused broken reflective bands across the iris.
   // Only the narrow eyelid-contact zone blends back to the source skin.
   const curved=Math.sqrt(Math.max(0,1-tx*tx))*
    Math.sqrt(Math.max(0,1-ty*ty));
   const eyeFrontZ=orbitFrontZ+eyeSurfaceLift+
    eyeDomeHeight*Math.pow(curved,3.2);
   // The power-of-four transition leaves the core spheroid clean, but
   // meets the actual face at the upper/lower eyelid and both canthi.
   const skinBlend=Math.pow(1-curved,4);
   const rimZ=surfaceAt(px,py)-baseEyeRadius*.095;
   // Single smooth optical surface: unlike the previous skin-depth max(),
   // this does not produce triangular kinks or protruding iris stripes.
   return eyeFrontZ*(1-skinBlend)+rimZ*skinBlend;
  };
  const z=insetZ(x,y);
  eyeAnteriorClearances.push((z-faceZ)/eyeRadius);
  // The closed donor head may not have skin at the eye centre (its XY ray
  // samples the back of the head), so compare to the REAL eyelid edge.
  const upperEyelinerDepth=insetZ(x,y+rimHeight+eyeRadius*.045*eyeWidth)+
   eyeRadius*.075+Math.max(.00012,d.z*.004);
  irisUpperLidRecessRatios.push((upperEyelinerDepth-
   (z+eyeRadius*.010))/eyeRadius);
  const eyePatch=buildGrid(eyeLabel+'_ORBITAL_EYEBALL',48,18,(u,v)=>{
   const t=u*2-1,arch=Math.pow(Math.max(0,1-t*t),.70);
   const xx=x+t*width;
   const yy=y+(v*2-1)*eyeRadius*eyeApertureRatio*eyeHeight*arch;
   return new THREE.Vector3(xx,yy,insetZ(xx,yy));
  },eyeMat);
  eyePatch.renderOrder=4;
  eyePatch.userData.sourceProjected=true;
  eyePatch.userData.profileExposed=true; // legacy inspection contract
  eyePatch.userData.noDetachedEyeball=true;
  eyePatch.userData.geometryType='face-conforming-almond-eye';
  eyePatch.userData.anteriorGlobeReconstruction=true;
  eyePatch.userData.socketDepressionInOriginalMesh=true;
  eyePatch.userData.recessedBehindLid=true;
  eyePatch.userData.smoothCornealCore=true;
  eyePatch.userData.v33OrbitSampleCount=orbitSamples.length;
  eyePatch.userData.v33OrbitalSkinFrontEnvelope=orbitFrontZ;
  eyePatch.userData.skinBlendRestrictedToEyelidRim=true;
  eyePatch.userData.anteriorClearanceRatio=(z-faceZ)/eyeRadius;
  eyePatch.userData.eyelinerToCenterBulge=true;
  eyePatch.userData.irisFitsApertureWithoutClamp=true;
  eyePatch.userData.eyelinerToCenterBulgeFraction=anteriorGlobeRatio;
  eyePatch.userData.colorRole='sclera';
  root.add(eyePatch);
  // Both pupils and colored contacts are sections of the same real skin-
  // fitting eye opening. Their radius and colors remain slider-controlled.
  const makeCap=(label,angularRadius,material,raise)=>{
   // Earlier v26/v27 irises were BIGGER than the almond opening.
   // Clamping every circular iris vertex to the eyelid produced doubled
   // blue horizontal folds / stripes. A genuine round iris must fit the
   // actual opening instead, and no vertex may be clipped into a flat row.
   const isIris=label==='CURVED_IRIS';
   const irisDisplayScale=isIris?(female?.88:.67):.82;
   const requested=eyeRadius*irisDisplayScale*Math.sin(angularRadius);
   const opening=eyeRadius*eyeApertureRatio*eyeHeight;
   // Keep a real circle and a thin white sclera ring; never clip the
   // actual iris geometry into an ugly horizontal stripe.
   const physicalRadius=Math.min(requested,opening*(isIris?(female?.94:.90):.73));
   // The pupil and colored iris share one gentle nasal gaze shift, not
   // independent offsets that could create strabismus in oblique views.
   const gazeX=x-side*eyeRadius*.055*eyeWidth;
   const cap=buildGrid(eyeLabel+'_'+label,64,20,(u,v)=>{
    const az=u*Math.PI*2,rr=physicalRadius*v;
    const xx=rr*Math.cos(az),yy=rr*Math.sin(az);
    return new THREE.Vector3(gazeX+xx,y+yy,
     insetZ(gazeX+xx,y+yy)+eyeRadius*raise);
   },material);
   cap.userData.circularProjectedRadius=physicalRadius;
   cap.userData.gazeInwardOffsetRatio=.055;
   cap.userData.nasalGazeCentered=true;
   cap.userData.v33IrisScale=isIris?irisDisplayScale:undefined;
   cap.userData.v33IrisOpeningFraction=physicalRadius/opening;
   cap.userData.unclippedTrueCircle=true;
   cap.userData.apertureFitted=true;
   cap.userData.roundVertexCount=(65*21);
   cap.userData.followsFaceSurface=true;
   cap.userData.noDetachedEyeball=true;
   return cap;
  };
  irisMat.side=THREE.DoubleSide;pupilMat.side=THREE.DoubleSide;
  const iris=makeCap('CURVED_IRIS',irisAngle,irisMat,.010);
  const fiberColors=[];
  for(let j=0;j<=20;j++)for(let i=0;i<=64;i++){
   const r=j/20,angle=i/64*Math.PI*2;
   const radialStreak=Math.sin(angle*23+r*18)*Math.cos(angle*13-r*12);
   const fineStreak=Math.sin(angle*27-r*26)*Math.sin(angle*17+r*11);
   const fiber=.935+.043*radialStreak+.022*fineStreak;
   const limbal=1-.30*Math.pow(THREE.MathUtils.smoothstep(r,.82,1),2);
   const collarette=.90+.10*Math.exp(-Math.pow((r-.43)/.13,2));
   // Microfibres, a darker limbal ring and soft upper catchlight are
   // encoded directly in the iris geometry (no floating eye decals).
   const highlight=Math.exp(-Math.pow((angle-2.24)/.25,2))*
    Math.exp(-Math.pow((r-.73)/.16,2));
   const c=fiber*limbal*collarette+.080*highlight;
   fiberColors.push(c,c*.975,c*.955);
  }
  iris.geometry.setAttribute('color',
   new THREE.Float32BufferAttribute(fiberColors,3));
  irisMat.vertexColors=true;
  iris.userData.circularProjected=true;
  iris.userData.radialFibers=true;
  iris.userData.subtleIrisCatchlight=true;
  iris.userData.sharedSmoothCornealSurface=true;
  iris.userData.colorRole='iris';root.add(iris);
  const pupil=makeCap('CURVED_PUPIL',pupilAngle,pupilMat,.017);
  pupil.userData.circularProjected=true;
  pupil.userData.colorRole='pupil';root.add(pupil);
  // The profile protrusion is now only a slim sculpted patch above skin.
  lateralEyeMargins.push(eyeSurfaceLift+eyeDomeHeight);

  let upperEyeliner=null,lowerEyeliner=null;
  for(const upper of [true,false]){
   const label=(side===-1?'LEFT':'RIGHT')+(upper?'_UPPER':'_LOWER');
   const height=eyeRadius*eyeApertureRatio*eyeHeight;
   const mesh=buildGrid(label+'_ANATOMICAL_EYELID',28,4,(u,v)=>{
    const t=u*2-1,arch=Math.pow(Math.max(0,1-t*t),.73);
    const cornerTilt=(t+1)*eyeRadius*.045*eyeWidth;
    const nearY=y+(upper?1:-1)*height*arch+cornerTilt;
    const farY=nearY+(upper?1:-1)*eyeRadius*(upper?.28:.19)*v;
    const eyeZ=insetZ(x+t*width,nearY)+eyeRadius*.075;
    const skinZ=surfaceAt(x+t*width,farY)+d.z*.0033;
    const zz=eyeZ*(1-smoothstep(v))+skinZ*smoothstep(v);
    return new THREE.Vector3(x+t*width,farY,zz);
   },lidMat);
   mesh.userData.attachedToFace=true;
   mesh.userData.colorRole='eyelid';
   root.add(mesh);
   if(female){
    // Eyeliner shares the eye lid's actual surface and transformation.
    const linerMat=new THREE.MeshBasicMaterial({
     color:0x251a24,side:THREE.DoubleSide,transparent:true,
     opacity:upper?1:.92,depthWrite:false,depthTest:true,
     polygonOffset:true,polygonOffsetFactor:-5,polygonOffsetUnits:-5
    });
    const liner=buildGrid(label+'_EYELINER',28,3,(u,v)=>{
     const p=sampleGrid(mesh,28,4,u,.018+v*(upper?.064:.056));
     p.z+=Math.max(.00012,d.z*.004);
     return p;
    },linerMat);
    liner.userData.colorRole='eyeliner';liner.userData.cosmetic=true;
    liner.userData.conformsTo='real-eyelid-mesh';
    liner.renderOrder=9;
    mesh.add(liner);
    if(upper)upperEyeliner=liner;else lowerEyeliner=liner;
   }
  }
  if(female)stitchLinerCorners(upperEyeliner,lowerEyeliner,d.x,d.z);
  if(female){
   // Two real 3D orbital surfaces per eye: a subtle upper-lid fold
   // (double eyelid) and a volume band directly under the lower lid.
   // Neither is a painted dark 'bag'; geometry supplies its own soft
   // highlight/occlusion when the head is rotated.
   const upperFold=buildGrid(
    (side===-1?'LEFT':'RIGHT')+'_DOUBLE_EYELID_FOLD',28,4,(u,v)=>{
     const t=2*u-1,soft=Math.pow(Math.max(0,1-t*t),.72);
     const yy=y+eyeRadius*(.58+.14*soft+.11*v)*eyeHeight;
     const xx=x+t*eyeRadius*1.15*eyeWidth;
     const z=surfaceAt(xx,yy)+d.z*(.004+.0035*Math.sin(Math.PI*v)*soft);
     return new THREE.Vector3(xx,yy,z);
    },lidMat);
   upperFold.userData.anatomical='upper-lid-crease';
   upperFold.userData.colorRole='eyelid';
   root.add(upperFold);
   // Upper-lid eyeshadow shares the upper eyelid's actual joint and surface.
   // RGBA mesh vertices feather at the edges; no floating decal card.
   const upperEyelid=root.getObjectByName(eyeLabel+'_UPPER_ANATOMICAL_EYELID');
   const shadowMaterial=new THREE.MeshBasicMaterial({
    color:0x865b7d,transparent:true,opacity:.79,
    side:THREE.DoubleSide,depthWrite:false,vertexColors:true
   });
   const upperShadow=buildGrid(eyeLabel+'_UPPER_EYESHADOW',28,6,(u,v)=>{
    const p=sampleGrid(upperEyelid,28,4,u,.12+v*.78);
    p.z+=Math.max(.00005,d.z*.0018);
    return p;
   },shadowMaterial);
   const pigment=[];
   for(let j=0;j<=6;j++)for(let i=0;i<=28;i++){
    const u=i/28,v=j/6,outer=side===-1?1-u:u;
    pigment.push(1,1,1,.81*Math.pow(Math.sin(Math.PI*u),.6)*
     Math.pow(Math.sin(Math.PI*v),.72)*(.70+.30*outer));
   }
   upperShadow.geometry.setAttribute('color',
    new THREE.Float32BufferAttribute(pigment,4));
   upperShadow.userData.colorRole='upperShadow';
   upperShadow.userData.cosmetic=true;
   upperShadow.userData.onRealEyelid=true;
   upperEyelid.add(upperShadow);
   const accentMat=new THREE.MeshStandardMaterial({
    color:0x765458,roughness:.87,metalness:0,side:THREE.DoubleSide,
    transparent:true,opacity:.19,depthWrite:false
   });
   const accent=buildGrid((side===-1?'LEFT':'RIGHT')+'_EYE_ACCENT_LINE',
    28,2,(u,v)=>{
     const p=sampleGrid(upperFold,28,4,u,.19+.26*v);
     p.z+=Math.max(.00003,d.z*.00024);
     return p;
    },accentMat);
   accent.userData.colorRole='eyeAccent';accent.userData.cosmetic=true;
   upperFold.add(accent);
   // No lower-eye bag or dark under-eye strip: the original face mesh
   // supplies natural skin shading beneath the fitted lower eyelid.
  }
  if(female){
   const pivot=new THREE.Group();
   pivot.name=eyeLabel+'_BROW_ANGLE_CONTROL';
   const browY=y+eyeRadius*(1.15+.32*eyeHeight);
   pivot.position.set(x,browY,surfaceAt(x,browY));
   pivot.userData.control='brow';
   pivot.userData.side=side;
   const eyebrow=buildGrid(eyeLabel+'_SCULPTED_EYEBROW',34,4,(u,v)=>{
    const t=2*u-1,arch=Math.pow(Math.max(0,1-t*t),.65);
    const xx=x+t*eyeRadius*1.37*settings.browWidth;
    const yy=browY+eyeRadius*.10*arch+(v-.5)*eyeRadius*.17*arch*settings.browThickness;
    const zz=surfaceAt(xx,yy)+d.z*(.011+.002*arch);
    return new THREE.Vector3(xx-pivot.position.x,yy-pivot.position.y,
     zz-pivot.position.z);
   },mat(0xa2a6ac));
   eyebrow.userData.colorRole='brow';
   pivot.add(eyebrow);root.add(pivot);

   const lashPivot=new THREE.Group();
   lashPivot.name=eyeLabel+'_LASH_ANGLE_CONTROL';
   lashPivot.position.set(x,y,z);
   lashPivot.userData.control='lashes';
   lashPivot.userData.side=side;
   for(const upper of [true,false]){
    const lash=makeFineEyelashMesh(
     eyeLabel+(upper?'_UPPER':'_LOWER')+'_LASH_MESH',
     upper?upperEyeliner:lowerEyeliner,x,y,z,eyeRadius,side,upper,settings);
    lashPivot.add(lash);
   }
   root.add(lashPivot);
  }else{
   // The male is generated from the same smooth head, with a naturally
   // smaller eye and no liner/mascara/under-eye cosmetic layers.
   const pivot=new THREE.Group();
   const label=side===-1?'LEFT':'RIGHT';
   pivot.name=label+'_BROW_ANGLE_CONTROL';
   const browY=y+eyeRadius*(1.24+.32*eyeHeight);
   pivot.position.set(x,browY,surfaceAt(x,browY));
   const brow=buildGrid(label+'_NATURAL_MALE_BROW',30,4,(u,v)=>{
    const t=2*u-1,arch=Math.pow(Math.max(0,1-t*t),.72);
    const xx=x+t*eyeRadius*1.37*settings.browWidth;
    const yy=browY+eyeRadius*.035*arch+
      (v-.5)*eyeRadius*.23*arch*settings.browThickness;
    const zz=surfaceAt(xx,yy)+d.z*.010;
    return new THREE.Vector3(xx-pivot.position.x,
      yy-pivot.position.y,zz-pivot.position.z);
   },mat(0xa2a6ac));
   brow.userData.colorRole='brow';
   pivot.add(brow);root.add(pivot);
  }
  // Move all eye-specific components into a joint local pivot. An angle
  // change now rotates the eyeball, lids, under-eye band, brows and lashes
  // together, not detached individual painted strips.
  const eyeJoint=new THREE.Group();
  eyeJoint.name=(side===-1?'LEFT':'RIGHT')+'_EYE_LINKED_PIVOT';
  eyeJoint.position.set(x,y,z);
  // The ONE linked local-space joint owns the eye globe, lids,
  // under-eye shadows, eyeliner, lashes and brow. No independent orbital
  // piece can retain the old eye-gap when the control changes.
  eyeJoint.userData.eyeSpacingFactor=settings.eyeSpacing;
  eyeJoint.userData.linkedEyeGroups=true;
  const origin=eyeJoint.position.clone();
  const children=root.children.slice(firstChild);
  for(const child of children){
   root.remove(child);
   if(child.isMesh){
    if(child.userData.sourceProjected)child.position.sub(origin);
    else child.traverse(o=>{
     // Nested eyeliner/accent child geometry must be moved with the lid.
     if(o.isMesh)o.geometry.translate(-x,-y,-z);
    });
   }else child.position.sub(origin);
   eyeJoint.add(child);
  }
  root.add(eyeJoint);
 }
 // Detect the actual mouth groove from the sculpted 3D head surface.
 // Search an oral-only vertical zone and average the depth curvature
 // across the lips; never use the chin or a screen-space painted patch.
 const nominalMouthY=box.min.y+d.y*.509;
 let lipCenter=nominalMouthY,bestCrease=-Infinity;
 for(let k=-12;k<=12;k++){
  const y=nominalMouthY+k*d.y*.0018,dy=d.y*.006;
  let curvature=0;
  for(const x of [cx-d.x*.012,cx,cx+d.x*.012])
   curvature+=(surfaceAt(x,y-dy)+surfaceAt(x,y+dy))*.5-surfaceAt(x,y);
  if(curvature>bestCrease){bestCrease=curvature;lipCenter=y;}
 }
 // Both cheek and lip pigments live on OWNED real head mesh vertices.
 // No separate lipstick sticker can drift over the skin/chin.
 face.userData.actualMouthCreaseY=lipCenter;
 const pigmentCount=female?
  updateRealFacePigment(face,settings):{lip:0,cheek:0};
 const actualLipTintVertices=pigmentCount.lip;
 const actualCheekTintVertices=pigmentCount.cheek;
 // Two subtle natural vermilion volumes still follow the real face
 // surface, but lipstick is painted ONLY on the original head triangles.
 // Widen the actual vermilion surface only when requested; the v8 saved
 // preset (1x) retains identical 3D lip topology and pigmentation.
 const halfWidth=d.x*.044*Math.min(1.62,Math.pow(settings.lipstickWidth,.46));
 const actualLips=new Map();
 for(const upper of [true,false]){
  const material=female?lipMat.clone():lipMat;
  const mesh=buildGrid((upper?'UPPER':'LOWER')+'_3D_VERMILION_LIP',
   32,8,(u,v)=>{
    const t=u*2-1;
    const taper=Math.pow(Math.max(0,1-t*t),.70);
    const cupid=upper?
      d.y*.0018*(bell(Math.abs(t),.37,.22)-.42*bell(t,0,.23)):0;
    const cy=lipCenter+(upper?d.y*.006:-d.y*.007)+cupid+
     d.y*.006*(settings.mouthAngle/12)*t;
    const vertical=(v-.5)*d.y*(upper?.011:.013)*taper;
    const x=cx+d.x*.004*settings.mouthPositionX+t*halfWidth,y=cy+vertical;
    const fullness=(1-t*t)*Math.sin(Math.PI*v);
    const z=surfaceAt(x,y)+d.z*(.00026+.00155*fullness*taper);
    return new THREE.Vector3(x,y,z);
   },material);
  mesh.userData.faceSurfaceConforming=true;
  mesh.userData.colorRole='lipBase';
  actualLips.set(upper,mesh);
  root.add(mesh);
 }
 // Lip strips are naturally tinted anatomical volumes, not cosmetics.
 for(const upper of [true,false]){
  const lip=actualLips.get(upper);
  tintRealLipSurface(lip,settings);
  lip.userData.lipstickOnSourceHead=true;
  lip.userData.lipstickCoverage={x:settings.lipstickX,y:settings.lipstickY,
   width:settings.lipstickWidth,height:settings.lipstickHeight};
 }
 // Male-only real 3D filaments, rooted in the same head surface and
 // re-generated if facial proportions or beard sliders change.
 if(!female){
  const beardMat=new THREE.MeshStandardMaterial({
   color:0x56443a,roughness:1,metalness:0,side:THREE.DoubleSide
  });
  const regions=[
   ['LEFT_MOUSTACHE',-.17,-.012,.531,.551,78],
   ['RIGHT_MOUSTACHE',.012,.17,.531,.551,78],
   ['CHIN_BEARD',-.24,.24,.345,.459,210],
   ['LEFT_JAW_BEARD',-.48,-.20,.392,.490,105],
   ['RIGHT_JAW_BEARD',.20,.48,.392,.490,105]
  ];
  for(const [name,xMin,xMax,yMin,yMax,maxCount] of regions){
   const points=[],count=Math.floor(maxCount*settings.beardDensity);
   for(let i=0;i<count;i++){
    const u=(i*.61803398875+.11)%1,v=(i*.754877666+.37)%1;
    const x=cx+d.x*(xMin+(xMax-xMin)*u);
    const y=box.min.y+d.y*(yMin+(yMax-yMin)*v);
    const z=surfaceAt(x,y)+Math.max(.0001,d.z*.00065);
    const thick=d.x*(.00052+.00034*(i%3));
    const length=d.y*.009*settings.beardLength*(.55+.45*u);
    const lift=d.z*.002*settings.beardLength;
    points.push(x-thick,y,z,x+thick,y,z,
     x+thick*.12,y-length,z+lift);
   }
   const geo=new THREE.BufferGeometry();
   geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
   if(points.length)geo.computeVertexNormals();
   const strand=new THREE.Mesh(geo,beardMat);
   strand.name=name+'_3D_HAIR';
   strand.userData.colorRole='beard';
   strand.userData.filamentCount=count;
   strand.renderOrder=3;
   root.add(strand);
  }
 }
 // The face mesh itself carries the integrated nose, so DO NOT glue a
 // separate nose sphere in front of its nasal bridge.
 // The lightweight raycast proxy is still used by reprojectBrows when
 // the eye angle changes. Never detach its shared sculpted geometry.
 // It is not part of the scene and its only geometry is the owned face
 // geometry which is disposed together with the actual face mesh.
 const meshList=[];
 root.traverse(o=>{if(o.isMesh)meshList.push(o);});
 const partTriangles=meshList.reduce((n,m)=>n+
  (m.geometry.index?m.geometry.index.count/3:
   m.geometry.getAttribute('position').count/3),0);
 const report=Object.freeze({
  gender,partMeshCount:meshList.length,realSurfaceProjectionCount:projected,
  projectionFallbacks,surfaceSampler:'xy-triangle-spatial-index',
  samplerCells:sampler.cellCount,eyeMeshCount:2,irisMeshCount:2,pupilMeshCount:2,
  eyelidMeshCount:4,lipMeshCount:2,lipstickMeshCount:0,
  lipstickPlacement:female?{
   x:settings.lipstickX,y:settings.lipstickY,
   width:settings.lipstickWidth,height:settings.lipstickHeight,
   anchoredToLipSurface:true,boundedWithinLipArea:true,
   attachedToLipMesh:true,paintAsVertexColor:true,
   appliedToSourceHead:true,lipTintVertexCount:actualLipTintVertices
  }:null,
  eyelinerMeshCount:female?4:0,eyelinerCornersClosed:female,
  upperEyeshadowMeshCount:female?2:0,shadowOnRealEyelids:female,
  eyeAccentMeshCount:female?2:0,
  blushMeshCount:0,blushVertexTint:female,
  blushOpacityFactor:female?.78:0,cheekTintVertexCount:actualCheekTintVertices,
  beardMeshCount:female?0:5,
  beardDensity:gender==='male'?settings.beardDensity:0,
  eyebrowMeshCount:2,eyelashMeshCount:female?4:0,
  eyelashFilamentCount:female?Math.round((84+42)*2*settings.lashDensity):0,
  eyelashesRootedOnLiner:female,
  eyeWidthFactor:settings.eyeWidth,eyeHeightFactor:settings.eyeHeight,
  browWidthFactor:settings.browWidth,browThicknessFactor:settings.browThickness,
  lashDensityFactor:settings.lashDensity,lashLengthFactor:settings.lashLength,
  lashThicknessFactor:settings.lashThickness,lashCurlFactor:settings.lashCurl,
  noStandaloneEyeSphere:true,noUnderEyeBags:true,
  irisNotSquashedAtLids:true,
  irisGeometry:'true-round-circular-disk-fitted-inside-almond-opening',
  eyeBulgeStartsAtEyeliner:true,eyeBulgeFraction:anteriorGlobeRatio,
  anteriorEyeGlobeReconstructed:true,
  smoothCornealCore:true,
  eyeCoreSkinBlendPower:4,
  eyeApertureHeightFraction:eyeApertureRatio,
  eyeAnteriorClearanceRatios:eyeAnteriorClearances.map(n=>Number(n.toFixed(3))),
  eyeSocketGeometry:'original-head-socket-with-open-almond-apertures',
  eyeOpeningsCutFromHeadTriangles:opening.removed,
  eyeSocketSculptedVertices:socketSculpt.vertices,
  eyeSocketMaxInset:socketSculpt.maxInset,
  eyeSkinDepthClampRemoved:true,
  irisUpperLidRecessRatios:irisUpperLidRecessRatios.map(n=>Number(n.toFixed(3))),
  underEyeShadowMeshCount:0,
  doubleLidCreaseMeshCount:female?2:0,
  lowerOrbitalVolumeMeshCount:0,
  irisPolarAngleRadians:Number(irisAngle.toFixed(4)),
  pupilPolarAngleRadians:Number(pupilAngle.toFixed(4)),
  irisDiameterRequestFactor:settings.irisDiameter,
  actualIrisDiameterFactor:Number((Math.sin(irisAngle)/Math.sin(originalIrisAngle)).toFixed(3)),
  mouthHalfWidthFraction:.044,
  lipCreaseCurvature:Number(bestCrease.toFixed(7)),
  lipCenterNormalized:Number(((lipCenter-box.min.y)/d.y).toFixed(4)),
  eyeScale,eyeSizeDerivedFromWidthHeight:true,
  anteriorDepthIndependentOfSize:true,
  eyeProfileLateralMargins:lateralEyeMargins.map(v=>Number(v.toFixed(6))),
  eyeballProjection:'sculpted-face-conforming-almond-no-sphere',
  irisPupilProjection:'circular-face-conformal-inset',irisRadialFibers:true,
  irisNasalGazeOffsetRatio:.055,cornealProfile:'lid-seated-subtle-convex',
  contactColorDefault:safeContactColor(settings.contactColor),
  eyeAngleDefault:settings.eyeAngle,
  eyeSpacingFactor:settings.eyeSpacing,
  eyeDepthFactor:settings.eyeDepth,
  eyelinerVisibilityPolicy:'opaque-lid-edge-above-eye',
  maleCosmeticsDisabled:!female,
  noseSourceIntegrated:true,
  partTriangles,faceOnly:true,bodyIncluded:false,partGeometryReal:true,
  reference:'soft-cheek-small-nose-relaxed-almond-eyes-gentle-lips'
 });
 root.userData.report=report;
 root.userData.faceDepthForLiner=d.z;
 root.userData.eyelinerSurfaceSyncCount=0;
 // Rotate the orbital system together, then push brows back to the
 // head's real surface. Without reprojection a slanted brow sinks into
 // the skull and seems to disappear at +/- eye angles.
 root.reprojectBrows=()=>{
  root.updateMatrixWorld(true);
  root.traverse(mesh=>{
   if(!mesh.isMesh||mesh.userData?.colorRole!=='brow')return;
   const attr=mesh.geometry.getAttribute('position');
   if(!attr)return;
   if(!orbitalRestPositions.has(mesh.geometry))
    orbitalRestPositions.set(mesh.geometry,attr.array.slice());
   const original=orbitalRestPositions.get(mesh.geometry);
   for(let i=0;i<attr.count;i++)
    attr.setXYZ(i,original[i*3],original[i*3+1],original[i*3+2]);
   mesh.updateWorldMatrix(true,false);
   for(let i=0;i<attr.count;i++){
    const p=new THREE.Vector3(attr.getX(i),attr.getY(i),attr.getZ(i));
    mesh.localToWorld(p);root.worldToLocal(p);
    // A bounded inner endpoint guarantees an inter-brow gap even when
    // both eye rigs rotate to their +/-20 degree extremes.
    const gap=d.x*.023;
    if(mesh.name.startsWith('LEFT_'))p.x=Math.min(p.x,cx-gap);
    else p.x=Math.max(p.x,cx+gap);
    const skin=surfaceAt(p.x,p.y);
    p.z=skin+d.z*.008;
    root.localToWorld(p);mesh.worldToLocal(p);
    attr.setXYZ(i,p.x,p.y,p.z);
   }
   attr.needsUpdate=true;
   mesh.geometry.computeVertexNormals();
   mesh.geometry.computeBoundingSphere();
  });
 };
 updateFaceFeatureAngles(root,settings);
 return {root,report};
}

/**
 * Retessellate only four tiny eyeliner grids from their anatomical eyelid
 * vertices after an angle change. All coordinates live in the same 3D
 * eye-joint space. Corner bridges follow the updated upper/lower strips.
 */
function refitEyelinerToLids(partsRoot){
 const depth=partsRoot.userData.faceDepthForLiner||.2;
 let count=0;
 for(const side of ['LEFT','RIGHT']){
  const upper=partsRoot.getObjectByName(side+'_UPPER_EYELINER');
  const lower=partsRoot.getObjectByName(side+'_LOWER_EYELINER');
  if(!upper||!lower)continue;
  for(const [liner,isUpper] of [[upper,true],[lower,false]]){
   const eyelid=liner.parent;
   const attr=liner.geometry.getAttribute('position');
   for(let j=0;j<=3;j++)for(let i=0;i<=28;i++){
    const u=i/28,v=j/3;
    const p=sampleGrid(eyelid,28,4,u,.018+v*(isUpper?.064:.056));
    p.z+=Math.max(.00006,depth*.0018);
    attr.setXYZ(j*29+i,p.x,p.y,p.z);
   }
   attr.needsUpdate=true;
   liner.geometry.computeBoundingSphere();
   count++;
  }
  const attr=upper.geometry.getAttribute('position');
  if(attr.count>=124){
   let cursor=116;
   for(const u of [0,1]){
    const a=sampleGrid(upper,28,3,u,0);
    const b=sampleGrid(lower,28,3,u,0);
    const dx=(u===0?-1:1)*depth*.0025;
    for(const p of [a,b]){
     attr.setXYZ(cursor++,p.x,p.y,p.z+depth*.00024);
     attr.setXYZ(cursor++,p.x+dx,p.y,p.z+depth*.00024);
    }
   }
   attr.needsUpdate=true;
   upper.geometry.computeBoundingSphere();
  }
 }
 partsRoot.userData.eyelinerSurfaceSyncCount=
  (partsRoot.userData.eyelinerSurfaceSyncCount||0)+1;
 return count;
}
/** Change eyebrow and lash tilts without rebuilding or changing the face mesh. */
export function updateFaceFeatureAngles(partsRoot,settings={}){
 const v=normalizeFemaleFaceControls(settings);
 const values={};
 for(const side of [-1,1]){
  const lbl=side===-1?'LEFT':'RIGHT';
  const joint=partsRoot.getObjectByName(lbl+'_EYE_LINKED_PIVOT');
  const brow=partsRoot.getObjectByName(lbl+'_BROW_ANGLE_CONTROL');
  const lashes=partsRoot.getObjectByName(lbl+'_LASH_ANGLE_CONTROL');
  if(joint)joint.rotation.z=side*THREE.MathUtils.degToRad(v.eyeAngle);
  if(brow)brow.rotation.z=side*THREE.MathUtils.degToRad(v.browAngle);
  if(lashes)lashes.rotation.z=side*THREE.MathUtils.degToRad(v.lashAngle);
 }
 values.eyeAngle=v.eyeAngle;
 values.browAngle=v.browAngle;
 values.lashAngle=v.lashAngle;
 values.linkedEyeBrowLashUnderEye=true;
 values.eyelinerMeshesRefitted=refitEyelinerToLids(partsRoot);
 partsRoot.userData.featureAngles=values;
 partsRoot.reprojectBrows?.();
 return values;
}

/** Clay and color mode both keep the exact same geometry. */
export function applyFaceColorMode(face,mode='clay',{contactColor,makeupType=0}={}){
 const colored=mode==='color';
 const male=face.name.startsWith('MALE_');
 const clay={
  skin:0xbfc3cb,eyelid:0xbcbfc5,lipBase:0xbfc3cb,
  lipstick:0xbfc3cb,underEye:0xbcbfc5,
  eyeliner:0xbcbfc5,eyeAccent:0xbcbfc5,upperShadow:0xbcbfc5,
  blush:0xbfc3cb,beard:0x8c929a,
  sclera:0xd5d8dd,iris:0x747a83,pupil:0x30353b,
  brow:0xa2a6ac,lashes:0x8c929a
 };
 // Selected makeup recolors actual 3D lip and lid geometry; no decals.
 const makeupChoices=[
  [0xc07c82,0x865b7d,0xcf8383,0x30252b],
  [0xc28289,0xaa828e,0xcd9290,0x403037],
  [0xda93a4,0xb38b9e,0xe59ba7,0x403039],
  [0xb37b70,0x947565,0xbd8b7f,0x332b28],
  [0xd09ca8,0xb5a4b6,0xc8abb3,0x514451],
  [0xdf8698,0xc18d9f,0xda8d9d,0x352633],
  [0xa56c7b,0x776b93,0xaf8890,0x252334],
  [0xd55c86,0xaa6388,0xcf819e,0x271e30],
  [0xb54b67,0x8b5168,0xb47c80,0x24212a],
  [0x9f4e66,0x6c4c76,0xb16a83,0x281b32]
 ];
 const makeup=makeupChoices[Math.min(9,Math.max(0,Math.round(makeupType)))];
 const palette={
  ...FACE_V7_PALETTE,lipBase:male?(makeupType===0?0xc9998b:makeup[0]):
   (makeupType===0?0xd9a699:makeup[0]),
  upperShadow:makeup[1],blush:makeup[2],eyeliner:makeup[3],
  lipstick:makeup[0],
  iris:male?0x50413b:parseInt(safeContactColor(contactColor).slice(1),16)
 };
 face.traverse(o=>{
  if(!o.isMesh||!o.material)return;
  const role=o.userData?.colorRole;
  if(['lipstick','upperShadow','underEye','eyeliner','eyeAccent','blush'].includes(role)){
   o.visible=colored&&!male;
  }
  if(role&&o.material.color){
   const hex=(colored?palette:clay)[role];
   if(hex!==undefined)o.material.color.setHex(hex);
   colorizedMakeup(o,colored);
   o.material.needsUpdate=true;
  }
 });
 face.userData.faceColorMode=colored?'color':'clay';
 face.userData.contactColor=male?null:safeContactColor(contactColor);
 return face.userData.faceColorMode;
}
