import * as THREE from 'three';

/**
 * Preview-only neck cut: retain the original indexed face vertices, UVs,
 * colours and ARTIST/SCULPT normals. v54/v55 rebuilt *every* triangle as
 * three unshared vertices, causing faceted-looking source-head previews
 * on some Android GPUs. Only intersected neck edges need new vertices.
 *
 * No source GLB geometry or battle actors are mutated.
 */
export function clipStudioFaceBustPreservingSurface(mesh,worldCutY){
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
 const worldY=new Float64Array(pos.count),tmp=new THREE.Vector3();
 for(let i=0;i<pos.count;i++)worldY[i]=
  tmp.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld).y;
 const inside=id=>worldY[id]>=worldCutY-1e-8;
 const edges=new Map();
 let newCutVertices=0,removedTriangles=0,keptTriangles=0,untouchedTriangles=0;
 const edge=(a,b)=>{
  const k=Math.min(a,b)+':'+Math.max(a,b);
  const old=edges.get(k);
  if(old!==undefined)return old;
  const t=THREE.MathUtils.clamp((worldCutY-worldY[a])/(worldY[b]-worldY[a]),0,1);
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
  onlyStudioPreview:true};
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
