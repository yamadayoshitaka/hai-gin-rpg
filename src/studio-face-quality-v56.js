import * as THREE from 'three';

/**
 * Preview-only neck cut: retain the original indexed face vertices, UVs,
 * colours and ARTIST/SCULPT normals. v54/v55 rebuilt *every* triangle as
 * three unshared vertices, causing faceted-looking source-head previews
 * on some Android GPUs. Only intersected neck edges need new vertices.
 *
 * No source GLB geometry or battle actors are mutated.
 */
/**
 * An upward-curved neckline at each side, and a shallower nape at the back.
 * The center under the jaw stays low; unlike a planar cut, this doesn't
 * leave a straight horizontal edge across the base of a sculpted face.
 * Units are world meters and the variation stays below ~1 cm.
 */
export function studioAnatomicalSeamY(worldCutY,worldX,worldZ,{
 centerX=0,centerZ=0,halfWidth=.1,halfDepth=.08,
 sideRise=.028,backRise=.006
}={}){
 const across=THREE.MathUtils.clamp(
  Math.abs(worldX-centerX)/Math.max(.001,halfWidth),0,1);
 const behind=THREE.MathUtils.clamp(
  (centerZ-worldZ)/Math.max(.001,halfDepth),0,1);
 return worldCutY+sideRise*across*across+backRise*behind*behind;
}

export function clipStudioFaceBustPreservingSurface(mesh,worldCutY,{anatomicalCurve=false}={}){
 if(!mesh?.isMesh||!mesh.geometry?.getAttribute('position')||
  !Number.isFinite(worldCutY))throw Error('Valid face mesh and cut height required');
 mesh.updateWorldMatrix(true,false);
 const original=mesh.geometry,pos=original.getAttribute('position');
 const idx=original.getIndex(),count=idx?idx.count:pos.count;
 if(count%3)throw Error('Non-triangular original face indices');
 const names=Object.keys(original.attributes),attributes={};
 const output={},itemSizes={};
 for(const name of names){
  const a=original.getAttribute(name);
  if(a.isInterleavedBufferAttribute)throw Error('Interleaved face attribute not supported');
  itemSizes[name]=a.itemSize;
  output[name]=Array.from(a.array);
  attributes[name]=a;
 }
 const originalVertexCount=pos.count;
 if(!original.boundingBox)original.computeBoundingBox();
 const worldBounds=original.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
 const worldCenter=worldBounds.getCenter(new THREE.Vector3());
 const worldSize=worldBounds.getSize(new THREE.Vector3());
 const seamProfile={
  centerX:worldCenter.x,centerZ:worldCenter.z,
  halfWidth:worldSize.x*.48,halfDepth:worldSize.z*.5,
  sideRise:.028,backRise:.006
 };
 const signedY=new Float64Array(pos.count),worldY=new Float64Array(pos.count);
 const tmp=new THREE.Vector3();
 for(let i=0;i<pos.count;i++){
  tmp.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);
  worldY[i]=tmp.y;
  signedY[i]=tmp.y-(anatomicalCurve?
   studioAnatomicalSeamY(worldCutY,tmp.x,tmp.z,seamProfile):worldCutY);
 }
 const inside=id=>signedY[id]>=-1e-8;
 const edges=new Map();
 let newCutVertices=0,removedTriangles=0,keptTriangles=0,untouchedTriangles=0;
 const edge=(a,b)=>{
  const k=Math.min(a,b)+':'+Math.max(a,b);
  const old=edges.get(k);
  if(old!==undefined)return old;
  const t=THREE.MathUtils.clamp(
   -signedY[a]/(signedY[b]-signedY[a]),0,1);
  const id=originalVertexCount+newCutVertices++;
  for(const name of names){
   const attr=attributes[name],size=itemSizes[name],values=[];
   for(let j=0;j<size;j++)
    values.push(attr.getComponent(a,j)*(1-t)+attr.getComponent(b,j)*t);
   if(name==='normal'&&size===3){
    const n=new THREE.Vector3(...values).normalize();
    values.splice(0,3,n.x,n.y,n.z);
   }
   output[name].push(...values);
  }
  edges.set(k,id);
  return id;
 };
 const allIndices=[],outGroups=[];
 const groups=original.groups?.length?original.groups:
  [{start:0,count,materialIndex:0}];
 for(const group of groups){
  const start=allIndices.length;
  for(let p=group.start;p<Math.min(count,group.start+group.count);p+=3){
   const triangle=[0,1,2].map(o=>idx?idx.getX(p+o):p+o);
   const flags=triangle.map(inside);
   if(flags.every(Boolean)){
    allIndices.push(...triangle);untouchedTriangles++;keptTriangles++;
    continue;
   }
   if(flags.every(flag=>!flag)){removedTriangles++;continue;}
   const polygon=[];
   for(let k=0;k<3;k++){
    const a=triangle[k],b=triangle[(k+1)%3],
      inA=flags[k],inB=flags[(k+1)%3];
    if(inA&&inB)polygon.push(b);
    else if(inA&&!inB)polygon.push(edge(a,b));
    else if(!inA&&inB)polygon.push(edge(a,b),b);
   }
   for(let k=1;k+1<polygon.length;k++){
    allIndices.push(polygon[0],polygon[k],polygon[k+1]);keptTriangles++;
   }
   removedTriangles++;
  }
  if(allIndices.length>start)outGroups.push({
   start,count:allIndices.length-start,materialIndex:group.materialIndex||0
  });
 }
 const geometry=new THREE.BufferGeometry();
 for(const name of names)
  geometry.setAttribute(name,new THREE.Float32BufferAttribute(output[name],itemSizes[name]));
 geometry.setIndex(allIndices);
 for(const group of outGroups)
  geometry.addGroup(group.start,group.count,group.materialIndex);
 // Do NOT recompute normals. Original sculpt normals and vertex makeup are
 // preserved byte-for-byte on untouched vertices, and smoothly interpolated
 // solely at the cut. Recomputing here would destroy facial shading.
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.userData.studioPreservedIndexedFace=true;
 return {geometry,removedTriangles,keptTriangles,
  untouchedTriangles,newCutVertices,originalVertexCount,
  sourceVertexPositionsPreserved:true,sourceNormalsPreserved:!!attributes.normal,
  anatomicalCurve,anatomicalSeamProfile:anatomicalCurve?seamProfile:null,
  cutPlaneType:anatomicalCurve?'jaw-and-nape-curve':'horizontal',
  onlyStudioPreview:true};
}

/**
 * The imported portrait has a broad shoulder/bust pedestal beneath the jaw.
 * Even a curved clipping plane still leaves that wide, squared-off shelf
 * hanging over the actual character's narrow neck. After clipping, taper
 * ONLY the already-discardable lower portion of the owned studio geometry
 * inwards. Upper cheeks, mouth, nose, ears, eyes and original GLB are untouched.
 */
export function taperStudioLowerBustBelowChin(mesh,{
 sourceWorldBounds,upperRatio=.27,lowerRatio=.10,
 edgeReduction=.72
}={}){
 const geometry=mesh?.geometry,pos=geometry?.getAttribute?.('position');
 if(!mesh?.isMesh||!pos||!sourceWorldBounds)
  return {applied:false,reason:'missing-face-or-original-bounds'};
 mesh.updateWorldMatrix(true,false);
 const worldBox=sourceWorldBounds;
 const size=worldBox.getSize(new THREE.Vector3());
 const mid=worldBox.getCenter(new THREE.Vector3());
 if(size.y<.04)return {applied:false,reason:'face-height-invalid'};
 const inv=mesh.matrixWorld.clone().invert(),world=new THREE.Vector3();
 const guardX=Math.max(.010,size.x*.115);
 const guardZ=Math.max(.010,size.z*.14);
 let affectedVertices=0,upperFaceVerticesMoved=0;
 let lowerWidthBefore=0,lowerWidthAfter=0;
 for(let i=0;i<pos.count;i++){
  world.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);
  const ratio=(world.y-worldBox.min.y)/size.y;
  if(ratio>=upperRatio)continue;
  const blend=1-THREE.MathUtils.smoothstep(
   ratio,lowerRatio,upperRatio);
  if(blend<=1e-8)continue;
  const reduction=THREE.MathUtils.clamp(edgeReduction*blend,0,.86);
  const dx=world.x-mid.x,dz=world.z-mid.z;
  const narrow=(value,guard)=>{
   const sign=Math.sign(value);
   return sign*(Math.min(Math.abs(value),guard)+
    Math.max(0,Math.abs(value)-guard)*(1-reduction));
  };
  const nextX=mid.x+narrow(dx,guardX);
  const nextZ=mid.z+narrow(dz,guardZ)*.98+dz*.02;
  if(Math.abs(nextX-world.x)+Math.abs(nextZ-world.z)<1e-8)continue;
  if(ratio>=upperRatio)upperFaceVerticesMoved++;
  lowerWidthBefore=Math.max(lowerWidthBefore,Math.abs(dx));
  lowerWidthAfter=Math.max(lowerWidthAfter,Math.abs(nextX-mid.x));
  world.x=nextX;world.z=nextZ;
  const local=world.applyMatrix4(inv);
  pos.setXYZ(i,local.x,local.y,local.z);
  affectedVertices++;
 }
 if(affectedVertices){
  pos.needsUpdate=true;
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
 }
 geometry.userData.studioLowerBustTapered=true;
 return {applied:true,affectedVertices,upperFaceVerticesMoved,
  lowerWidthBefore,lowerWidthAfter,edgeReduction,
  previewOnly:true,sourceGeometryUntouched:true,
  noseMouthEyesUnaffected:true};
}

/**
 * Restore smooth shading on the OWNED PREVIEW face after neck clipping.
 * Some donor head meshes carry unshared, flat-lit triangles even before
 * clipping. Weld NORMALS for position-coincident sculpt vertices, never
 * positions, colour, UV, morph targets or eye/lip meshes.
 */
export function smoothStudioFaceNormals(geometry,{weldTolerance=.00007}={}){
 const pos=geometry?.getAttribute?.('position'),src=geometry?.getAttribute?.('normal');
 if(!pos||!src||pos.count!==src.count)
  return {applied:false,reason:'missing-position-or-normals'};
 const idx=geometry.getIndex(),triCount=(idx?idx.count:pos.count)/3;
 const key=i=>Math.round(pos.getX(i)/weldTolerance)+':'+
  Math.round(pos.getY(i)/weldTolerance)+':'+
  Math.round(pos.getZ(i)/weldTolerance);
 const groups=new Map();
 const kByIndex=Array.from({length:pos.count},(_,i)=>key(i));
 const vec=i=>new THREE.Vector3(pos.getX(i),pos.getY(i),pos.getZ(i));
 for(let i=0;i<triCount;i++){
  const ids=[0,1,2].map(j=>idx?idx.getX(i*3+j):i*3+j);
  const a=vec(ids[0]),b=vec(ids[1]),d=vec(ids[2]);
  const faceNormal=new THREE.Vector3().subVectors(b,a)
   .cross(new THREE.Vector3().subVectors(d,a));
  if(faceNormal.lengthSq()<1e-19)continue;
  const originalDirection=new THREE.Vector3();
  for(const id of ids)
   originalDirection.add(new THREE.Vector3(src.getX(id),src.getY(id),src.getZ(id)));
  if(faceNormal.dot(originalDirection)<0)faceNormal.negate();
  for(const id of ids){
   const k=kByIndex[id];
   let g=groups.get(k);
   if(!g){g={x:0,y:0,z:0,faces:0};groups.set(k,g)}
   g.x+=faceNormal.x;g.y+=faceNormal.y;g.z+=faceNormal.z;g.faces++;
  }
 }
 const normals=new Float32Array(src.array.length),out=new THREE.Vector3();
 let smoothed=0,changed=0,maxAngleDegrees=0,weldedGroups=0;
 for(const g of groups.values())if(g.faces>1)weldedGroups++;
 for(let i=0;i<pos.count;i++){
  const g=groups.get(kByIndex[i]);
  const original=new THREE.Vector3(src.getX(i),src.getY(i),src.getZ(i));
  if(original.lengthSq()<1e-15)original.set(0,0,1);
  original.normalize();out.copy(original);
  if(g?.faces>1){
   const average=new THREE.Vector3(g.x,g.y,g.z);
   if(average.lengthSq()>1e-18){
    average.normalize();
    const angle=original.angleTo(average)*180/Math.PI;
    maxAngleDegrees=Math.max(maxAngleDegrees,angle);
    if(angle<65){
     out.copy(original).multiplyScalar(.13).addScaledVector(average,.87).normalize();
     smoothed++;
     if(angle>.5)changed++;
    }
   }
  }
  normals[i*3]=out.x;normals[i*3+1]=out.y;normals[i*3+2]=out.z;
 }
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
 geometry.userData.studioSmoothedSkinNormals=true;
 return {applied:true,vertexCount:pos.count,weldedGroups,smoothed,
  alteredNormalVertices:changed,maxAngleDegrees,
  topologyUnmodified:true,pigmentUnmodified:true,originalMeshUnmodified:true};
}

/**
 * Face is an independently cloned, already-owned preview mesh. Keep its
 * skin colours and eyes, make the light response slightly more matte and
 * reduce micro-bump highlights that exaggerate triangle boundaries.
 */
export function restoreStudioFaceSurfaceQuality(face){
 if(!face?.isMesh||!face.material)return {applied:false};
 const material=Array.isArray(face.material)?face.material[0]:face.material;
 if(face.userData.studioFaceQualityV56)
  return {applied:true,reused:true,sourceFaceUntouched:true};
 const previousRoughness=material.roughness;
 material.roughness=Math.max(material.roughness??.7,.81);
 if('clearcoat' in material)material.clearcoat=Math.min(material.clearcoat??0,.028);
 if('bumpScale' in material)material.bumpScale=Math.min(material.bumpScale??0,.000055);
 material.flatShading=false;material.needsUpdate=true;
 face.userData.studioFaceQualityV56=true;
 return {applied:true,previousRoughness,roughness:material.roughness,
  originalSculptUntouched:true,originalFaceColoursUntouched:true};
}

/** Match the neck material to the PREVIEW face, not a hardcoded white plate.
 * The face colour attribute is a pigment multiplier (usually near 1).
 */
export function sampleStudioFacePigment(face){
 if(!face?.isMesh)return {base:new THREE.Color(0xe4bdb0),
  multiplier:new THREE.Color(1,1,1),samples:0};
 const base=(Array.isArray(face.material)?face.material[0]:face.material)
  ?.color?.clone()||new THREE.Color(0xe4bdb0);
 const geometry=face.geometry,pos=geometry?.getAttribute('position'),
  pigment=geometry?.getAttribute('color');
 if(!pos||!pigment||pigment.itemSize<3)return {
  base,multiplier:new THREE.Color(1,1,1),samples:0};
 geometry.computeBoundingBox();
 const b=geometry.boundingBox,d=b.getSize(new THREE.Vector3()),
  center=b.getCenter(new THREE.Vector3());
 let r=0,g=0,bl=0,samples=0;
 for(let i=0;i<pos.count;i++){
  const x=(pos.getX(i)-center.x)/Math.max(.001,d.x),
    y=(pos.getY(i)-b.min.y)/Math.max(.001,d.y),
    z=(pos.getZ(i)-b.min.z)/Math.max(.001,d.z);
  // Lower side-cheek skin; avoid eye-shadow, lipstick and nose pigment.
  if(Math.abs(x)<.38&&y>.28&&y<.52&&z>.60){
   r+=pigment.getX(i);g+=pigment.getY(i);bl+=pigment.getZ(i);
   samples++;
  }
 }
 return {base,multiplier:samples?
  new THREE.Color(r/samples,g/samples,bl/samples):
  new THREE.Color(1,1,1),samples};
}
