import * as THREE from 'three';

/**
 * Connect a cropped portrait to the body using the portrait's *real cut
 * edges*. v54-v57 guessed a circular radius and coloured its cylinder
 * blue-grey; that could never meet the irregular jaw contour, and it
 * exposed the original neck through a detached blue shelf.
 *
 * This is a preview-only mesh. The GLB head, eyes, lips, and body skeleton
 * stay untouched. Every upper-ring sample lies ON an actual cropped-face
 * boundary segment. The lower ring overlaps the torso under the tunic.
 */
const V=()=>new THREE.Vector3();
const cross=(a,b)=>a.x*b.z-a.z*b.x;
export function extractStudioJawCutSegments(faceMesh,originalVertexCount){
 const geometry=faceMesh?.geometry,pos=geometry?.getAttribute('position'),
  index=geometry?.getIndex();
 if(!pos||!index||!Number.isInteger(originalVertexCount))
  return [];
 const segments=[],dedup=new Set();
 for(let t=0;t+2<index.count;t+=3){
  const ids=[index.getX(t),index.getX(t+1),index.getX(t+2)];
  const created=ids.filter(i=>i>=originalVertexCount);
  if(created.length!==2)continue;
  const a=Math.min(...created),b=Math.max(...created),key=a+':'+b;
  if(dedup.has(key))continue;
  dedup.add(key);
  segments.push([a,b]);
 }
 return segments;
}

function sampleCutContour(faceMesh,segments,steps){
 const pos=faceMesh.geometry.getAttribute('position'),
  normal=faceMesh.geometry.getAttribute('normal'),
  pigment=faceMesh.geometry.getAttribute('color');
 faceMesh.updateWorldMatrix(true,false);
 const world=new Map();
 function p(i){
  if(!world.has(i))world.set(i,V().fromBufferAttribute(pos,i)
   .applyMatrix4(faceMesh.matrixWorld));
  return world.get(i);
 }
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(const [a,b] of segments)for(const id of [a,b]){
  const v=p(id);minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);
  minZ=Math.min(minZ,v.z);maxZ=Math.max(maxZ,v.z);
 }
 const center={x:(minX+maxX)*.5,z:(minZ+maxZ)*.5};
 const samples=[];
 let fallbackCount=0;
 for(let i=0;i<steps;i++){
  const theta=2*Math.PI*i/steps;
  const ray=new THREE.Vector3(Math.cos(theta),0,Math.sin(theta));
  let best=null;
  for(const [a,b] of segments){
   const aWorld=p(a),bWorld=p(b),edge=bWorld.clone().sub(aWorld);
   const denom=cross(ray,edge);
   if(Math.abs(denom)<1e-10)continue;
   const delta=aWorld.clone().sub(new THREE.Vector3(center.x,0,center.z));
   const t=cross(delta,edge)/denom;
   const u=cross(delta,ray)/denom;
   if(t>=0&&u>=-1e-5&&u<=1+1e-5&&(!best||t>best.t))
    best={a,b,u:THREE.MathUtils.clamp(u,0,1),t};
  }
  if(!best){
   // Rare imported open/non-manifold seam: nearest existing cut point.
   let d=Infinity;
   for(const [a,b] of segments)for(const id of [a,b]){
    const v=p(id),dir=Math.atan2(v.z-center.z,v.x-center.x);
    const diff=Math.abs(Math.atan2(Math.sin(dir-theta),Math.cos(dir-theta)));
    if(diff<d){d=diff;best={a:id,b:id,u:0,t:0}}
   }
   fallbackCount++;
  }
  const upper=V().fromBufferAttribute(pos,best.a)
   .lerp(V().fromBufferAttribute(pos,best.b),best.u);
  const upperWorld=upper.clone().applyMatrix4(faceMesh.matrixWorld);
  const upperNormal=normal?
   V().fromBufferAttribute(normal,best.a).lerp(
    V().fromBufferAttribute(normal,best.b),best.u).normalize():
   null;
  const upperPigment=pigment&&pigment.itemSize>=3?
   V().fromBufferAttribute(pigment,best.a).lerp(
    V().fromBufferAttribute(pigment,best.b),best.u):
   new THREE.Vector3(1,1,1);
  samples.push({upper,upperWorld,upperNormal,upperPigment});
 }
 return {samples,center,fallbackCount};
}

export function buildStudioContourNeck({
 faceRoot,faceMesh,cut,torsoTopY,torsoCenterX=0,
 torsoCenterZ=0,facePigment,steps=48,rings=7
}={}){
 const geometry=faceMesh?.geometry;
 if(!faceRoot?.isObject3D||!faceMesh?.isMesh||
  !geometry||!Number.isFinite(torsoTopY)||!cut?.originalVertexCount)
  return {applied:false,reason:'invalid-head-or-cut'};
 const segments=extractStudioJawCutSegments(faceMesh,cut.originalVertexCount);
 if(segments.length<12)return {
  applied:false,reason:'real-cut-edge-unavailable',segments:segments.length};
 const sampled=sampleCutContour(faceMesh,segments,steps);
 if(sampled.fallbackCount>steps*.25)return {
  applied:false,reason:'discontinuous-cut-boundary',
  fallbackCount:sampled.fallbackCount,segments:segments.length};
 faceRoot.updateWorldMatrix(true,true);
 const inv=faceMesh.matrixWorld.clone().invert();
 const upperYs=sampled.samples.map(s=>s.upperWorld.y);
 const seamMinY=Math.min(...upperYs),seamMaxY=Math.max(...upperYs);
 const bottomWorldY=torsoTopY-.018;
 if(seamMinY<bottomWorldY+.003||seamMaxY>bottomWorldY+.105)
  return {applied:false,reason:'unsafe-neck-length',
   seamMinY,seamMaxY,bottomWorldY};
 const vert=[],colors=[],uv=[],indices=[],sourceNormals=[];
 const base=(facePigment?.base||new THREE.Color(0xe7bdb2)).clone();
 const pigment=(facePigment?.multiplier||new THREE.Color(1,1,1));
 for(let row=0;row<rings;row++){
  const t=row/(rings-1);  // row 0 = face's exact actual cut edge
  const progress=THREE.MathUtils.smoothstep(t,0,1);
  for(let i=0;i<steps;i++){
   const s=sampled.samples[i];
   const skinWorld=s.upperWorld;
   // The collar hides this LOWER ring inside the real skinned torso.
   // Never push the head upward to solve a clothing/skin gap.
   const neckLower=new THREE.Vector3(
    torsoCenterX+(skinWorld.x-sampled.center.x)*.87,
    bottomWorldY,
    torsoCenterZ+(skinWorld.z-sampled.center.z)*.87);
   const world=skinWorld.clone().lerp(neckLower,progress);
   const local=world.applyMatrix4(inv);
   vert.push(local.x,local.y,local.z);
   const pigmentAtVertex=s.upperPigment.clone().lerp(
    new THREE.Vector3(pigment.r,pigment.g,pigment.b),progress*.6);
   // No grey/blue cloth in the skin gap; the existing REAL garment covers
   // the final few millimetres. This uses the same skin base as the face.
   colors.push(pigmentAtVertex.x,pigmentAtVertex.y,pigmentAtVertex.z);
   uv.push(i/steps,t);
   sourceNormals.push(s.upperNormal?.clone()||new THREE.Vector3(0,0,1));
  }
 }
 for(let row=0;row<rings-1;row++)for(let i=0;i<steps;i++){
  const a=row*steps+i,b=row*steps+(i+1)%steps,c=a+steps,d=b+steps;
  indices.push(a,b,c,b,d,c);
 }
 const skinGeometry=new THREE.BufferGeometry();
 skinGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vert,3));
 skinGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 skinGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 skinGeometry.setIndex(indices);
 skinGeometry.computeVertexNormals();
 // Match the existing sculpt shading exactly along the attachment border.
 const normals=skinGeometry.getAttribute('normal');
 for(let i=0;i<steps;i++){
  const n=sourceNormals[i];
  if(n.lengthSq()>.1)normals.setXYZ(i,n.x,n.y,n.z);
 }
 normals.needsUpdate=true;
 skinGeometry.computeBoundingBox();skinGeometry.computeBoundingSphere();
 const material=new THREE.MeshStandardMaterial({
  color:base,vertexColors:true,roughness:.84,metalness:0,
  side:THREE.DoubleSide,transparent:false,flatShading:false
 });
 const mesh=new THREE.Mesh(skinGeometry,material);
 mesh.name='STUDIO_CONTOUR_SKIN_NECK_V58';
 mesh.userData={studioPreviewOnly:true,realBoundaryStitch:true,
  noClothColoredSkin:true,sourceFaceUntouched:true,
  inheritedFaceMaterial:true,cutEdgeSegments:segments.length};
 mesh.frustumCulled=false;
 // Same parent transform as the actual face and the exact upper seam.
 faceMesh.add(mesh);
 return {applied:true,mesh,segments:segments.length,steps,rings,
  fallbackCount:sampled.fallbackCount,seamMinY,seamMaxY,bottomWorldY,
  headSurfaceMatched:true,skinColored:true,
  separatelyGuessedCircularCut:false,
  facePositionUnchanged:true,sourceGLBUnchanged:true,
  neckHeight:seamMaxY-bottomWorldY};
}
