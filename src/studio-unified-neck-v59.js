import * as THREE from 'three';

/**
 * One face/neck surface, one material, one draw call.
 *
 * v58 put a second skin cylinder UNDER an imported bust. The cylinder
 * stopped at the top of the Ranger body rather than the actual shirt
 * neckline, leaving the donor's orange neck visible through a 4–6 cm gap.
 * Here every cut-edge segment is triangulated directly into the FACE'S
 * existing indexed geometry. Top indices are reused (not resampled) and
 * the lower edge finishes inside the observed garment collar.
 *
 * This is applied only to a disposable studio preview copy. All original
 * portrait/rigged/battle assets remain immutable.
 */
export function measureStudioGarmentCollar(wardrobeRoot,{torsoTopY=0}={}){
 let candidate=null;
 wardrobeRoot?.updateWorldMatrix?.(true,true);
 wardrobeRoot?.traverse?.(m=>{
  if(!m.isMesh||!m.visible||!m.geometry?.getAttribute?.('position'))return;
  const n=String(m.name||'');
  if(!/^(?:sewn-neckline|.*?(?:tunic-neckline|shirt-collar))$/i.test(n))return;
  const attr=m.geometry.getAttribute('position'),v=new THREE.Vector3(),b=new THREE.Box3();
  const jump=Math.max(1,Math.floor(attr.count/1500));
  for(let i=0;i<attr.count;i+=jump){
   if(m.isSkinnedMesh&&m.skeleton&&m.getVertexPosition)m.getVertexPosition(i,v);
   else v.fromBufferAttribute(attr,i);
   b.expandByPoint(v.applyMatrix4(m.matrixWorld));
  }
  if(b.isEmpty())return;
  if(!candidate||b.max.y>candidate.y)
   candidate={y:b.max.y,x:(b.min.x+b.max.x)/2,z:(b.min.z+b.max.z)/2,
    mesh:m.name};
 });
 return candidate||{y:torsoTopY-.052,x:0,z:0,mesh:'torso-based-fallback'};
}

// v61 preview-only anatomical neck silhouette: widen the visible mid-neck
// without moving the jaw cut, expanding shoulder geometry, or changing the
// original face GLB. Both horizontal axes taper smoothly into the garment.
export const STUDIO_NECK_V61_SHAPE=Object.freeze({
 lowerWidthFactor:.90,lowerDepthFactor:.89,
 midWidthGain:.10,midDepthGain:.08,
 collarWidthFactor:1.06,collarDepthFactor:.98,
 visibleSkinFactor:.76
});

export function studioNeckV61Profile(t){
 const u=THREE.MathUtils.clamp(t,0,1);
 const smooth=THREE.MathUtils.smoothstep(u,0,1);
 const bell=Math.sin(Math.PI*u);
 return {
  lowerWidthFactor:STUDIO_NECK_V61_SHAPE.lowerWidthFactor,
  lowerDepthFactor:STUDIO_NECK_V61_SHAPE.lowerDepthFactor,
  widthGain:1+STUDIO_NECK_V61_SHAPE.midWidthGain*bell,
  depthGain:1+STUDIO_NECK_V61_SHAPE.midDepthGain*bell,
  centerBlend:smooth
 };
}

/**
 * Phase 1 (BARE BODY): measure the actual *posed* skinned neck of the torso,
 * not a sewn garment collar. The head donor's lower bust is cut elsewhere;
 * the body donor head is hidden elsewhere. This measurement NEVER cuts the
 * real body or modifies original rig/bind vertices.
 */
export function measureStudioBareTorsoNeck(bodyRoot,{bandMeters=.035}={}){
 const candidates=[];
 bodyRoot?.updateWorldMatrix?.(true,true);
 bodyRoot?.traverse?.(mesh=>{
  if(!mesh?.isMesh||!mesh.geometry?.getAttribute?.('position')||
   !/^(?:(?:female|male)_(?:ranger|peasant)_body|superhero_(?:female|male))$/i.test(mesh.name||''))return;
  const attr=mesh.geometry.getAttribute('position'),v=new THREE.Vector3();
  const samples=[];
  // Explicitly skin every donor vertex before measuring the neckline:
  // static geometry.boundingBox would refer to the T-pose, not the pose.
  // Important: the donor head was removed by editing triangle indices,
  // NOT by deleting vertex buffers. Reading ALL vertices would accidentally
  // reintroduce discarded head vertices into the neck measurement.
  const ids=mesh.geometry.getIndex()?
   new Set(Array.from(mesh.geometry.getIndex().array)):
   new Set(Array.from({length:attr.count},(_,i)=>i));
  for(const i of ids){
   if(mesh.isSkinnedMesh&&mesh.skeleton&&mesh.getVertexPosition)
    mesh.getVertexPosition(i,v);
   else v.fromBufferAttribute(attr,i);
   const w=v.clone().applyMatrix4(mesh.matrixWorld);
   if(Number.isFinite(w.x)&&Number.isFinite(w.y)&&Number.isFinite(w.z))samples.push(w);
  }
  if(samples.length>=24)candidates.push({mesh,samples});
 });
 if(!candidates.length)return {applied:false,reason:'real-skin-torso-missing'};
 const selected=candidates.reduce((a,b)=>a.samples.length>=b.samples.length?a:b);
 const all=selected.samples,topY=Math.max(...all.map(p=>p.y));
 const band=Math.max(.018,Math.min(.065,bandMeters));
 const ring=all.filter(p=>p.y>=topY-band&&p.y<=topY+.0005);
 if(ring.length<12)return {applied:false,reason:'bare-torso-neck-ring-missing',samples:ring.length};
 const percent=(items,p)=>{
  const sorted=items.slice().sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))];
 };
 const xs=ring.map(v=>v.x),zs=ring.map(v=>v.z);
 const xlo=percent(xs,.10),xhi=percent(xs,.90),zlo=percent(zs,.10),zhi=percent(zs,.90);
 const halfWidth=THREE.MathUtils.clamp((xhi-xlo)*.5,.025,.080);
 const halfDepth=THREE.MathUtils.clamp((zhi-zlo)*.5,.024,.075);
 return {applied:true,phase:'skin-before-clothing',mesh:selected.mesh.name,
  centerX:(xlo+xhi)*.5,centerZ:(zlo+zhi)*.5,
  topY,innerOverlapY:topY-.014,halfWidth,halfDepth,
  skinVertices:all.length,ringSamples:ring.length,
  source:'posed-real-skinned-torso',sourceGarmentIndependent:true};
}

function orientedStudioCutEdges(geometry,originalVertexCount){
 const indices=geometry?.getIndex();
 if(!indices)return [];
 const seen=new Set(),edges=[];
 for(let i=0;i<indices.count;i+=3){
  const tri=[indices.getX(i),indices.getX(i+1),indices.getX(i+2)];
  for(let k=0;k<3;k++){
   const a=tri[k],b=tri[(k+1)%3];
   if(a<originalVertexCount||b<originalVertexCount)continue;
   const key=Math.min(a,b)+':'+Math.max(a,b);
   if(seen.has(key))continue;
   // Clipping algorithm makes two NEW vertices per cut triangle. A pair of
   // adjacent NEW ids is the true outside boundary edge, and this ordering
   // follows the authored triangle winding.
   if(tri.filter(v=>v>=originalVertexCount).length!==2)continue;
   seen.add(key);edges.push([a,b]);
  }
 }
 return edges;
}

export function weldStudioNeckIntoFace({
 faceMesh,cut,wardrobeRoot,torsoTopY,torsoCenterX=0,torsoCenterZ=0,
 facePigment=null,rings=11,collarInset=.009,bareTorsoProfile=null
}={}){
 const source=faceMesh?.geometry,position=source?.getAttribute?.('position');
 if(!faceMesh?.isMesh||!source?.getIndex()||!position||
    !Number.isFinite(torsoTopY)||!Number.isInteger(cut?.originalVertexCount))
  return {applied:false,reason:'missing-indexed-face-or-torso'};
 if(Object.keys(source.morphAttributes||{}).some(k=>source.morphAttributes[k]?.length))
  return {applied:false,reason:'morph-attributes-not-supported'};
 const edges=orientedStudioCutEdges(source,cut.originalVertexCount);
 if(edges.length<12)return {applied:false,reason:'no-real-cut-boundary',edges:edges.length};
 const collar=measureStudioGarmentCollar(wardrobeRoot,{torsoTopY});
 // The REAL shirt top is far below the skinned body's apparent top. Cover
 // the gap to the collar, otherwise a coloured neck stump remains exposed.
 // v62 skin-first: the bottom ring is placed INSIDE the real torso skin,
 // independent of any garment. A separate clothing pass occurs afterwards.
 const skinFirst=bareTorsoProfile?.applied===true;
 const bottomWorldY=skinFirst?
  Math.min(torsoTopY-.010,bareTorsoProfile.innerOverlapY):
  Math.min(torsoTopY-.015,collar.y-collarInset);
 faceMesh.updateWorldMatrix(true,false);
 const toWorld=faceMesh.matrixWorld;
 const fromWorld=toWorld.clone().invert();
 const boundaryIds=[...new Set(edges.flat())];
 const local=new Map(),world=new Map(),v=new THREE.Vector3();
 const cutPos=source.getAttribute('position');
 let minY=Infinity,maxY=-Infinity,minX=Infinity,maxX=-Infinity,
   minZ=Infinity,maxZ=-Infinity;
 for(const id of boundaryIds){
  const p=v.fromBufferAttribute(cutPos,id).clone();
  local.set(id,p);
  const w=p.clone().applyMatrix4(toWorld);
  world.set(id,w);
  minY=Math.min(minY,w.y);maxY=Math.max(maxY,w.y);
  minX=Math.min(minX,w.x);maxX=Math.max(maxX,w.x);
  minZ=Math.min(minZ,w.z);maxZ=Math.max(maxZ,w.z);
 }
 const neckHeight=maxY-bottomWorldY;
 if(neckHeight<.016||neckHeight>.135)
  return {applied:false,reason:'out-of-range-collar-to-jaw',
   neckHeight,collarY:collar.y,topY:maxY,bottomWorldY};
 const centerX=(minX+maxX)/2,centerZ=(minZ+maxZ)/2;
 const attrNames=Object.keys(source.attributes),attributes=Object.create(null);
 for(const name of attrNames){
  const a=source.getAttribute(name);
  if(!a?.array||a.isInterleavedBufferAttribute)
   return {applied:false,reason:'unsupported-face-attribute',name};
  attributes[name]=Array.from(a.array);
 }
 const vertexCount=position.count,cols=boundaryIds.length;
 const vertexMap=new Map();
 let midHalfWidthX=0,midHalfDepthZ=0;
 const garmentX=skinFirst?bareTorsoProfile.centerX:
  (collar.mesh==='torso-based-fallback'?torsoCenterX:collar.x);
 const garmentZ=skinFirst?bareTorsoProfile.centerZ:
  (collar.mesh==='torso-based-fallback'?torsoCenterZ:collar.z);
 for(let row=1;row<rings;row++){
  const t=row/(rings-1),profile=studioNeckV61Profile(t);
  const smooth=profile.centerBlend;
  const midCenterX=THREE.MathUtils.lerp(centerX,garmentX,smooth);
  const midCenterZ=THREE.MathUtils.lerp(centerZ,garmentZ,smooth);
  for(let k=0;k<cols;k++){
   const id=boundaryIds[k],upperWorld=world.get(id);
   // Match the LOWER ring to the real body-neck contour, not to armour.
   // Its last 14mm live within the torso volume to hide all open edges.
   const bodyX=skinFirst?
    (upperWorld.x-centerX)/Math.max(.001,(maxX-minX)*.5)*bareTorsoProfile.halfWidth*.96:
    (upperWorld.x-centerX)*profile.lowerWidthFactor;
   const bodyZ=skinFirst?
    (upperWorld.z-centerZ)/Math.max(.001,(maxZ-minZ)*.5)*bareTorsoProfile.halfDepth*.96:
    (upperWorld.z-centerZ)*profile.lowerDepthFactor;
   const skinBottom=new THREE.Vector3(garmentX+bodyX,bottomWorldY,garmentZ+bodyZ);
   const interpolated=upperWorld.clone().lerp(skinBottom,smooth);
   // Anatomical cervical fullness: the donor face remains untouched at the
   // jaw boundary, while the middle 40–60% gains width/depth. The bottom
   // stays inside the actual raised garment collar instead of a thin tube.
   interpolated.x=midCenterX+(interpolated.x-midCenterX)*profile.widthGain;
   interpolated.z=midCenterZ+(interpolated.z-midCenterZ)*profile.depthGain;
   if(row===Math.floor((rings-1)/2)){
    midHalfWidthX=Math.max(midHalfWidthX,Math.abs(interpolated.x-midCenterX));
    midHalfDepthZ=Math.max(midHalfDepthZ,Math.abs(interpolated.z-midCenterZ));
   }
   // Sculpt throat and nape in profile; both actual boundary rings remain
   // intact, so the imported face and garment connection never drift.
   const relativeDepth=(upperWorld.z-centerZ)/Math.max(.001,(maxZ-minZ)*.5);
   const frontWeight=THREE.MathUtils.smoothstep(relativeDepth,-.85,.85);
   const anatomicalSweep=THREE.MathUtils.lerp(.0013,-.0022,frontWeight);
   interpolated.z+=Math.sin(Math.PI*t)*anatomicalSweep;
   const result=interpolated.applyMatrix4(fromWorld);
   vertexMap.set(row+':'+id,vertexCount+(row-1)*cols+k);
   for(const name of attrNames){
    const attr=source.getAttribute(name),i=id*attr.itemSize;
    const values=Array.from(attr.array.slice(i,i+attr.itemSize));
    if(name==='position'){
     values[0]=result.x;values[1]=result.y;values[2]=result.z;
    }else if(name==='normal'&&values.length>=3){
     const normal=new THREE.Vector3(values[0],values[1],values[2]);
     const outward=new THREE.Vector3(upperWorld.x-centerX,0,upperWorld.z-centerZ);
     if(outward.lengthSq()<1e-9)outward.set(0,0,1);
     outward.normalize();
     // Preserve the source normal exactly at the attachment boundary;
     // gradually roll toward neck side normals only near the collar.
     normal.lerp(outward,Math.min(1,smooth*3.25)).normalize();
     values[0]=normal.x;values[1]=normal.y;values[2]=normal.z;
    }else if(name==='color'&&values.length>=3&&facePigment?.multiplier){
     // The donor face lower edge contains isolated dark/light pigments.
     // Extending those colors down the entire neck creates vertical stripes.
     const blend=THREE.MathUtils.smoothstep(t,.04,.32);
     const m=facePigment.multiplier;
     for(let k=0;k<3;k++)
      values[k]=THREE.MathUtils.lerp(values[k],[m.r,m.g,m.b][k],blend);
    }else if(name==='uv'&&values.length>=2){
     values[1]=values[1]+t*.015;
    }
    attributes[name].push(...values);
   }
  }
 }
 const outIndices=Array.from(source.getIndex().array);
 const sourceIndexCount=outIndices.length;
 for(let row=0;row<rings-1;row++){
  for(const [start,end] of edges){
   const a=row===0?start:vertexMap.get(row+':'+start),
    b=row===0?end:vertexMap.get(row+':'+end),
    c=vertexMap.get((row+1)+':'+start),
    d=vertexMap.get((row+1)+':'+end);
   if([a,b,c,d].some(x=>x===undefined))
    return {applied:false,reason:'broken-cut-edge-index'};
   // Oppose the original face edge winding, making a contiguous manifold
   // surface (instead of a separate tube visibly overlaid beneath the chin).
   outIndices.push(b,a,c,b,c,d);
  }
 }
 const geometry=new THREE.BufferGeometry();
 for(const name of attrNames){
  const old=source.getAttribute(name),ctor=old.array.constructor;
  geometry.setAttribute(name,new THREE.BufferAttribute(
   new ctor(attributes[name]),old.itemSize,old.normalized));
 }
 geometry.setIndex(outIndices);
 for(const group of source.groups)
  geometry.addGroup(group.start,group.count,group.materialIndex);
 if(source.groups.length)
  geometry.addGroup(sourceIndexCount,outIndices.length-sourceIndexCount,
   source.groups[0].materialIndex);
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.userData={...source.userData,studioUnifiedNeck:true,
  studioOriginalFaceVertexCount:vertexCount,
  studioNeckBoundaryEdges:edges.length};
 return {applied:true,geometry,originalVertexCount:vertexCount,
  originalTriangleCount:sourceIndexCount/3,
  addedTriangles:(outIndices.length-sourceIndexCount)/3,
  boundaryEdges:edges.length,collarSource:collar.mesh,collarY:collar.y,
  seamMinY:minY,seamMaxY:maxY,neckBottomY:bottomWorldY,neckHeight,
  sourceVertexPositionsUnchanged:true,sourceFaceNormalsUnchanged:true,
  separateNeckMeshesNeeded:false,faceSkinMaterialReused:true,
  neckColorSmoothed:true,neckNormalsSmoothed:true,
  centerX,centerZ,jawHalfX:(maxX-minX)*.5,jawHalfZ:(maxZ-minZ)*.5,
  v61WidenedNeck:true,v61NeckRingCount:rings,
  v62SkinFirst:skinFirst,v62BareTorsoProfile:skinFirst?bareTorsoProfile:null,
  v62SkinToTorsoOverlap:skinFirst?bareTorsoProfile.topY-bottomWorldY:null,
  v61WidthGainAtMid:studioNeckV61Profile(.5).widthGain,
  v61DepthGainAtMid:studioNeckV61Profile(.5).depthGain,
  neckMidHalfWidthX:midHalfWidthX,neckMidHalfDepthZ:midHalfDepthZ,
  previewOnly:true};
}

/**
 * Short raised cloth collar, part of the GARMENT and hidden with it.
 * It conceals the lower half of an elongated exposed neck without placing
 * another blue disc under the chin. Only a narrow tapered tube fits the
 * existing sewn-neckline. Top sits ~29mm below the real lower jaw.
 */
export function addStudioRaisedInnerCollar({wardrobeRoot,joined}={}){
 if(!wardrobeRoot?.isObject3D||!joined?.applied)
  return {applied:false,reason:'outfit-or-neck-unavailable'};
 // v61: shorten visible neck 24% from v59, while thickening the cervical
 // surface. The face skin still uses its original material and vertices.
 const topY=joined.seamMinY-.029*STUDIO_NECK_V61_SHAPE.visibleSkinFactor;
 // Skinned outfits can raise the sewn neckline independently of the bare
 // collarbone during animation. Never skip the only fabric underlap when
 // a slim male/female pose makes the measured garment just 8–11mm below the
 // jaw. The new lower bound extends fabric INSIDE the existing garment,
 // rather than moving or cutting any skin vertices.
 const nominalBaseY=joined.collarY-.016;
 const baseY=Math.min(nominalBaseY,topY-.014);
 if(topY-baseY<.012||topY>=joined.seamMinY-.012)
  return {applied:false,reason:'collar-height-invalid',topY,baseY};
 const count=48,rings=10,verts=[],uv=[],indices=[];
 // Follow the widened neck, without adding detached skin rings or changing
 // metal armour. The fabric upper edge covers the skin-to-cloth transition.
 const upperRadiusX=THREE.MathUtils.clamp(
  joined.jawHalfX*STUDIO_NECK_V61_SHAPE.collarWidthFactor,.030,.053);
 const upperRadiusZ=THREE.MathUtils.clamp(
  joined.jawHalfZ*STUDIO_NECK_V61_SHAPE.collarDepthFactor,.029,.051);
 const lowerRadiusX=Math.max(upperRadiusX*1.22,.049);
 const lowerRadiusZ=Math.max(upperRadiusZ*1.22,.045);
 const collar=measureStudioGarmentCollar(wardrobeRoot,{
  torsoTopY:joined.collarY+.05});
 wardrobeRoot.updateWorldMatrix(true,false);
 const inverse=wardrobeRoot.matrixWorld.clone().invert();
 for(let r=0;r<rings;r++){
  const t=r/(rings-1),shoulder=1-THREE.MathUtils.smoothstep(t,.15,.92);
  const cx=THREE.MathUtils.lerp(collar.x,joined.centerX,t*.85);
  const cz=THREE.MathUtils.lerp(collar.z,joined.centerZ,t*.85);
  for(let i=0;i<count;i++){
   const angle=2*Math.PI*i/count;
   // Lower the throat slightly and raise the rear/side neckline so the
   // collar follows the jaw-to-nape contour, not a cut horizontal pipe.
   // Both garment seam and original facial vertices remain in place.
   const front=Math.max(0,Math.sin(angle));
   const rear=Math.max(0,-Math.sin(angle));
   const sides=Math.abs(Math.cos(angle));
   const wave=.0018*t*Math.sin(angle*2)+t*t*(.002*sides+.003*rear-.0015*front);
   const radiusX=THREE.MathUtils.lerp(upperRadiusX,lowerRadiusX,shoulder);
   const radiusZ=THREE.MathUtils.lerp(upperRadiusZ,lowerRadiusZ,shoulder);
   const world=new THREE.Vector3(
    cx+radiusX*Math.cos(angle),baseY+(topY-baseY)*t+wave,
    cz+radiusZ*Math.sin(angle));
   const local=world.applyMatrix4(inverse);
   verts.push(local.x,local.y,local.z);uv.push(i/count,t);
  }
 }
 for(let r=0;r<rings-1;r++)for(let i=0;i<count;i++){
  const a=r*count+i,b=r*count+(i+1)%count,c=a+count,d=b+count;
  indices.push(a,b,c,b,d,c);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const material=new THREE.MeshStandardMaterial({
  color:0x536a7e,roughness:.91,metalness:0,side:THREE.DoubleSide
 });
 const mesh=new THREE.Mesh(geometry,material);
 mesh.name='STUDIO_RAISED_INNER_TUNIC_COLLAR_V59';
 mesh.frustumCulled=false;
 mesh.userData={previewOnly:true,attachedToActualSewnCollar:true,
  replacesExposedLowerNeck:true,notPartOfFace:true,
  v60VisibleNeckReduction:.18,v61VisibleNeckReduction:.24,
  v61AnatomicalWidth:true};
 wardrobeRoot.add(mesh);
 return {applied:true,mesh,topY,baseY,visibleSkinLength:joined.seamMinY-topY,
  v61TopHalfWidthX:upperRadiusX,v61TopHalfDepthZ:upperRadiusZ,
  source:collar.mesh,sourceColor:'#536a7e',rings,count};
}
