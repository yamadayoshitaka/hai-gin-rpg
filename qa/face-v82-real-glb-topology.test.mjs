import {sealOriginalOralAperture} from '../src/face-mouth-seal-v86.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {makeIndependentFaceMaster} from '../src/independent-face-masters.js';
import {createFaceExpressionAnimator,FACE_EXPRESSIONS}
 from '../src/face-expression-animation-v48.js';
import {integrateMouthIntoFace,poseIntegratedMouth}
 from '../src/face-integrated-mouth-v82.js';

/** Parse only the mesh-accessor data from the ACTUAL bundled CC0 head.
 * This avoids browser/ImageBitmap dependencies and catches failures that
 * small synthetic spheres cannot reproduce. The source asset stays intact.
 */
function sourceGeometry(){
 const bytes=readFileSync(new URL(
  '../assets/master-sources/blender/realistic-head-animation.glb',import.meta.url));
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 assert.equal(bytes.readUInt32LE(4),2);
 const jsonLength=bytes.readUInt32LE(12);
 const gltf=JSON.parse(bytes.toString('utf8',20,20+jsonLength));
 const bufferOffset=20+jsonLength+8;
 const glb=bytes;
 const primitive=gltf.meshes[0].primitives[0];
 const readAccessor=id=>{
  const a=gltf.accessors[id];
  const width=({SCALAR:1,VEC2:2,VEC3:3,VEC4:4})[a.type];
  const bytesFor={5121:1,5123:2,5125:4,5126:4};
  const componentBytes=bytesFor[a.componentType];
  assert.ok(width&&componentBytes);
  const read=(type,at)=>type===5126?glb.readFloatLE(at):
   type===5125?glb.readUInt32LE(at):
   type===5123?glb.readUInt16LE(at):glb.readUInt8(at);
  // Real GLB morph accessors can be entirely sparse, with NO base
  // bufferView. Our previous test crashed before checking anything.
  const values=new Array(a.count*width).fill(0);
  if(a.bufferView!==undefined){
   const view=gltf.bufferViews[a.bufferView];
   const stride=view.byteStride||width*componentBytes;
   const start=bufferOffset+(view.byteOffset||0)+(a.byteOffset||0);
   for(let i=0;i<a.count;i++)for(let k=0;k<width;k++)
    values[i*width+k]=read(a.componentType,
     start+i*stride+k*componentBytes);
  }
  if(a.sparse){
   const sparse=a.sparse,idxView=gltf.bufferViews[sparse.indices.bufferView],
    valueView=gltf.bufferViews[sparse.values.bufferView];
   const idxType=sparse.indices.componentType;
   const idxStart=bufferOffset+(idxView.byteOffset||0)+
    (sparse.indices.byteOffset||0);
   const valueStart=bufferOffset+(valueView.byteOffset||0)+
    (sparse.values.byteOffset||0);
   for(let i=0;i<sparse.count;i++){
    const index=read(idxType,idxStart+i*bytesFor[idxType]);
    assert.ok(index>=0&&index<a.count);
    for(let k=0;k<width;k++)
     values[index*width+k]=read(a.componentType,
      valueStart+(i*width+k)*componentBytes);
   }
  }
  return {array:values,width,count:a.count,componentType:a.componentType};
 };
 const position=readAccessor(primitive.attributes.POSITION);
 const index=readAccessor(primitive.indices);
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(position.array,3));
 geo.setIndex(index.array);
 if(primitive.attributes.TEXCOORD_0!==undefined){
  const uv=readAccessor(primitive.attributes.TEXCOORD_0);
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv.array,2));
 }
 // Seven real facial blendshapes from the source Blender head.
 const morphs=primitive.targets?.map(target=>
  readAccessor(target.POSITION))||[];
 geo.morphTargetsRelative=true;
 geo.morphAttributes.position=morphs.map(m=>
  new THREE.Float32BufferAttribute(m.array,3));
 return {geo,morphs:morphs.length,glbVertexCount:position.count};
}

test('V82 actual CC0 face is cut/stiched with all original 7 blendshapes',()=>{
 const {geo,morphs,glbVertexCount}=sourceGeometry();
 assert.ok(glbVertexCount>3000);
 assert.equal(morphs,7);
 const face=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
 geo.computeBoundingBox();
 const box=geo.boundingBox,size=box.getSize(new THREE.Vector3());
 const cx=(box.min.x+box.max.x)/2,cy=box.min.y+size.y*.509;
 const report=integrateMouthIntoFace(face,{
  centerX:cx,centerY:cy,halfWidth:size.x*.057,
  headHeight:size.y,surfaceZ:box.max.z*.91
 });
 assert.equal(report.integrated,true,
  'Do not fall back to the old floating mouth for the real donor');
 assert.ok(report.removedTriangles>150);
 assert.ok(report.boundaryEdges>25);
 assert.ok(geo.getAttribute('position').count>glbVertexCount);
 assert.equal(geo.groups.length,0,
  'Old GLB material groups must not truncate the new stitched mesh');
 assert.equal(geo.morphAttributes.position.length,7);
 for(const morph of geo.morphAttributes.position)
  assert.equal(morph.count,geo.getAttribute('position').count,
   'Original blendshape must grow together with the stitched mouth');
 const upper=report.pairs.find(p=>p.sign>0&&Math.abs(p.t)<.45);
 const lower=report.pairs.find(p=>p.sign<0&&Math.abs(p.t)<.45);
 assert.ok(upper&&lower);
 const positions=geo.getAttribute('position');
 const yBefore=[positions.getY(upper.inner),positions.getY(lower.inner)];
 assert.equal(poseIntegratedMouth(face,{smile:1,open:1,cheek:.8}),true);
 assert.ok(positions.getY(upper.inner)>yBefore[0],
  'Upper lip must rise with cheeks and zygomaticus');
 assert.ok(positions.getY(lower.inner)<yBefore[1],
  'The lower jaw must open the actual skin aperture');
 assert.equal(poseIntegratedMouth(face,{smile:1,open:1,cheek:.8}),false,
  'The mobile renderer avoids recomputing identical mouth poses');
 geo.dispose();face.material.dispose();
});

test('V84 actual GLB skin avoids mouth-triangle reversal for ALL 22 expressions',()=>{
 const {geo}=sourceGeometry();
 const face=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
 face.name='FEMALE_INDEPENDENT_CLAY_FACE';
 geo.computeBoundingBox();
 const bounds=geo.boundingBox.clone(),size=bounds.getSize(new THREE.Vector3());
 const centerX=(bounds.min.x+bounds.max.x)/2;
 const mouthY=bounds.min.y+size.y*.509;
 face.userData.v83SafeOriginalMouthTopology=true;
 face.userData.actualMouthCreaseY=mouthY;
 const baseline=geo.getAttribute('position').array.slice();
 const index=geo.getIndex().array;
 const sensitive=[];
 for(let k=0;k<index.length;k+=3){
  const ids=[index[k],index[k+1],index[k+2]];
  const cx=ids.reduce((s,i)=>s+baseline[i*3],0)/3;
  const cy=ids.reduce((s,i)=>s+baseline[i*3+1],0)/3;
  const cz=ids.reduce((s,i)=>s+baseline[i*3+2],0)/3;
  if(Math.abs(cx-centerX)<size.x*.15 &&
     Math.abs(cy-mouthY)<size.y*.065 &&
     cz>bounds.min.z+size.z*.56)sensitive.push(ids);
 }
 assert.ok(sensitive.length>80,
  'Safety test must cover the actual open-mouth region, not an empty mask');
 const cross=(positions,[a,b,c])=>{
  const i=a*3,j=b*3,k=c*3;
  const ab=[positions[j]-positions[i],
   positions[j+1]-positions[i+1],positions[j+2]-positions[i+2]];
  const ac=[positions[k]-positions[i],
   positions[k+1]-positions[i+1],positions[k+2]-positions[i+2]];
  return [ab[1]*ac[2]-ab[2]*ac[1],
   ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
 };
 const animator=createFaceExpressionAnimator({face,parts:new THREE.Group()},
  {autoBlink:false});
 const pos=geo.getAttribute('position');
 for(const expression of Object.keys(FACE_EXPRESSIONS)){
  animator.setExpression(expression);
  const state=animator.getState();
  assert.equal(state.v84JawOpeningQuarantined,true);
  assert.equal(state.v84OralSkinInversionGuard,true);
  assert.equal(state.mouthOpen,0,
   expression+' cannot advertise opening without a real lip aperture');
  let reversed=0,checked=0,maxDelta=0;
  for(const ids of sensitive){
   const orig=cross(baseline,ids),current=cross(pos.array,ids);
   const a2=orig.reduce((s,v)=>s+v*v,0);
   const b2=current.reduce((s,v)=>s+v*v,0);
   if(a2<1e-17||b2<1e-17)continue;
   checked++;
   if(orig.reduce((s,v,i)=>s+v*current[i],0)<0)reversed++;
   for(const i of ids){
    const dy=pos.getY(i)-baseline[i*3+1];
    maxDelta=Math.max(maxDelta,Math.abs(dy));
   }
  }
  assert.ok(checked>65);
  assert.equal(reversed,0,
   expression+' must not invert real donor mouth triangles');
  assert.ok(maxDelta<size.y*.017,
   expression+' must not yank original mouth into overlapping skin');
 }
 animator.dispose();geo.dispose();face.material.dispose();
});

test('V88 retains bounded donor lip relief and stable native jaw expression',()=>{
 const {geo}=sourceGeometry();
 const positions=geo.getAttribute('position').array.slice();
 geo.computeBoundingBox();
 const box=geo.boundingBox.clone(),size=box.getSize(new THREE.Vector3());
 const originalCount=geo.getAttribute('position').count;
 const root=new THREE.Group();
 const head=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
 head.name='CC0_SOURCE_GEO-head_animation_realistic';
 root.add(head);
 const model=makeIndependentFaceMaster(root,'female',{
  femaleControls:{ageBand:'twenties',mouthWidth:1}
 });
 const face=model.face,rest=face.geometry.getAttribute('position');
 const rgb=face.geometry.getAttribute('color');
 assert.equal(rgb.count,rest.count,'Actual GLB makeup needs 1 RGB per vertex');
 assert.ok(rgb.array.every(Number.isFinite),
  'Actual GLB mouth/skin pigments must all be finite to avoid black GPU polygons');
 assert.ok(face.userData.v85SourceOralGeometryProtected);
 assert.ok(face.userData.v85RestoredOralVertices>10,
  'On a real GLB many mouth vertices should be restored to the donor');
 let examined=0;
 for(let i=0;i<originalCount;i++){
  const x=positions[i*3],y=positions[i*3+1],z=positions[i*3+2];
  const xn=(x-(box.min.x+box.max.x)/2)/(size.x*.5);
  const yn=(y-box.min.y)/size.y,zn=(z-box.min.z)/size.z;
  if(Math.abs(xn)<.17&&Math.abs(yn-.509)<.028&&zn>.84){
   examined++;
   for(let axis=0;axis<3;axis++)
    assert.ok(Math.abs(rest.array[i*3+axis]-positions[i*3+axis])<size.z*.012,
     'V80-inspired native lip relief must stay localized to the original skin');
  }
 }
 assert.ok(examined>=8,'Must exercise genuine face oral donor vertices');
 const animator=createFaceExpressionAnimator({
  face:model.face,parts:model.parts
 },{autoBlink:false});
 const neutral=face.geometry.getAttribute('position').array.slice();
 for(const id of ['neutral','smile','laugh','shout','surprised']){
  animator.setExpression(id);
  const state=animator.getState();
  assert.equal(state.v85BuildSignature,'face-v85-source-mouth-restored-closed-20261122');
  assert.equal(state.v85SourceOralGeometryProtected,true);
  assert.ok(state.v88OralAnatomy?.ready,'Verified CC0 head needs functioning structural aperture');
  assert.ok(state.mouthOpen>=0);
  const posed=face.geometry.getAttribute('position').array;
  for(let i=0;i<originalCount;i++){
   const x=positions[i*3],y=positions[i*3+1],z=positions[i*3+2];
   const xn=(x-(box.min.x+box.max.x)/2)/(size.x*.5);
   const yn=(y-box.min.y)/size.y,zn=(z-box.min.z)/size.z;
   if(Math.abs(xn)<.14&&Math.abs(yn-.509)<.015&&zn>.84)
    assert.ok(Math.abs(posed[i*3+1]-neutral[i*3+1])<size.y*.058,
     id+' native jaw movement must stay within mouth structural envelope');
  }
 }
 animator.dispose();
 model.root.traverse(o=>{if(!o.isMesh)return;
  o.geometry?.dispose();
  if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());
  else o.material?.dispose();
 });
});


test('V86: real CC0 donor native 38-vertex lip fissure is safely sealed, no black hole',()=>{
 const {geo}=sourceGeometry();
 const face=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
 const originalIndices=Array.from(geo.getIndex().array);
 const originalPositions=Array.from(geo.getAttribute('position').array);
 const originalMorphCounts=geo.morphAttributes.position.map(p=>p.count);
 const r=sealOriginalOralAperture(face);
 assert.equal(r.sealed,true,
  'The real GLB has an existing lip opening; it must be capped: '+JSON.stringify(r));
 assert.ok(r.ringVertexCount>=32&&r.ringVertexCount<=48,
  'Only the small front lip ring must be selected');
 assert.ok(r.addedTriangles>=60&&r.addedTriangles<130,
  'Both native lip slit and wider oral opening need surface triangles: '+JSON.stringify(r));
 assert.ok(r.outerPatchTriangles>=30,
  'Large lip boundary must be closed too, not just the tiny inner slit');
 assert.equal(r.addedVertices,0,'Never replace head/eye/morph vertices');
 assert.deepEqual(Array.from(geo.getAttribute('position').array),originalPositions,
  'The original skin positions must be preserved');
 assert.deepEqual(geo.morphAttributes.position.map(p=>p.count),originalMorphCounts);
 assert.equal(geo.getIndex().count,originalIndices.length+3*r.addedTriangles);
 assert.deepEqual(Array.from(geo.getIndex().array).slice(0,originalIndices.length),
  originalIndices,'No original face triangles may be deleted');
 assert.equal(geo.groups.length,0,'One skin material must render the new seal');
 assert.ok(geo.getAttribute('normal').array.every(Number.isFinite));
 assert.equal(face.userData.v86SourceMouthHoleClosed,true);
 assert.equal(face.userData.v86NoForegroundOralOverlay,true);
 // Preserve original eye, cheek and scalp rims and refuse double-sealing.
 const second=sealOriginalOralAperture(face);
 assert.equal(second.sealed,false,'Never duplicate mouth cap triangles');
 geo.dispose();face.material.dispose();
});

test('V86: actual independent male/female head has no exposed original lip hole',()=>{
 for(const gender of ['female','male']){
  const {geo}=sourceGeometry();
  const root=new THREE.Group();
  const donor=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
  donor.name='CC0_SOURCE_GEO-head_animation_realistic';
  root.add(donor);
  const model=makeIndependentFaceMaster(root,gender,{
   femaleControls:{ageBand:'twenties'},
   maleControls:{ageBand:'twenties'}
  });
  const summary=model.face.userData.v86OralSealSummary;
  assert.equal(summary.sealed,true,
   gender+' should seal native lip opening: '+JSON.stringify(summary));
  assert.ok(summary.addedTriangles>=60,
   gender+' must seal both nested oral loops: '+JSON.stringify(summary));
  assert.equal(model.face.userData.v88NativeOralRig?.ready,true,
   gender+' must have a validated native donor mouth rim');
  assert.equal(model.face.userData.v83SafeOriginalMouthTopology,false);
  const animator=createFaceExpressionAnimator({face:model.face,parts:model.parts},
    {autoBlink:false});
  for(const id of ['neutral','laugh','shout','surprised']){
   animator.setExpression(id);
   assert.equal(animator.getState().v88OralAnatomy?.ready,true);
   if(['laugh','shout','surprised'].includes(id))
    assert.ok(animator.getState().mouthOpen>.5);
   assert.ok(model.face.geometry.getAttribute('position').array.every(Number.isFinite));
  }
  animator.dispose();
  model.root.traverse(o=>{
   if(!o.isMesh)return;
   o.geometry?.dispose();
   for(const mat of (Array.isArray(o.material)?o.material:[o.material]))
    mat?.dispose?.();
  });
 }
});

test('V87 native mouth corners narrow on actual CC0 donor while cheeks, eyes and scalp remain fixed',()=>{
 const snapshots=[];
 for(const width of [0.65,0.85,1,1.25]){
  const {geo}=sourceGeometry();
  const scene=new THREE.Group();
  const donor=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
  donor.name='CC0_SOURCE_GEO-head_animation_realistic';scene.add(donor);
  const model=makeIndependentFaceMaster(scene,'female',{
   femaleControls:{ageBand:'twenties',mouthWidth:width}
  });
  const face=model.face,pos=face.geometry.getAttribute('position');
  const ring=face.userData.v86OralSeal?.lipRing;
  assert.ok(ring?.length>=32&&ring.length<=48,
   'V87 must preserve the original donor lip boundary and v86 seal: '+
    JSON.stringify({width,seal:face.userData.v86OralSealSummary,report:face.userData.v86OralSeal}));
  const xs=ring.map(id=>pos.getX(id));
  const span=Math.max(...xs)-Math.min(...xs);
  assert.ok(pos.array.every(Number.isFinite));
  assert.ok(face.geometry.getAttribute('color').array.every(Number.isFinite));
  assert.equal(face.userData.v87AnatomicalMouthWidth,width);
  assert.equal(face.userData.v87MouthWidthOnOriginalSkin,true);
  snapshots.push({width,span,positions:pos.array.slice(),model});
 }
 const [minimum,narrower,neutral,maximum]=snapshots;
 assert.ok(narrower.span<neutral.span*.97&&narrower.span>neutral.span*.75,
  'V87 default mouth must be visibly narrower without crushing the native lip seal');
 assert.ok(minimum.span<narrower.span*.96,
  'Narrower slider setting should actually move native mouth corners');
 assert.ok(maximum.span>neutral.span*1.08,
  'The real-mouth slider must affect actual head vertices');
 // The multiplier must only modify the oral skin area, not cheeks/eyes.
 const source=snapshots[0].model.face.userData.v86OriginalDonorPositions;
 const origGeo=snapshots[0].model.face.geometry;
 origGeo.computeBoundingBox();
 const bounds=origGeo.boundingBox,d=bounds.getSize(new THREE.Vector3());
 const center=(bounds.min.x+bounds.max.x)/2;
 let protectedCount=0;
 for(let i=0;i<source.length/3;i++){
  const x=source[i*3],y=source[i*3+1],z=source[i*3+2];
  const xn=(x-center)/(d.x*.5),yn=(y-bounds.min.y)/d.y,
   zn=(z-bounds.min.z)/d.z;
  if(Math.abs(xn)>.49||Math.abs(yn-.509)>.13||zn<.42){
   protectedCount++;
   for(let k=0;k<3;k++)
    assert.ok(Math.abs(snapshots[0].positions[i*3+k]-
      narrower.positions[i*3+k])<1e-8,
     'Mouth width should not modify any other part of the face');
  }
 }
 assert.ok(protectedCount>1000,'QA must inspect real cheeks and eye/scalp vertices');
 for(const snapshot of snapshots){
  snapshot.model.root.traverse(o=>{
   if(!o.isMesh)return;
   o.geometry?.dispose();
   for(const mat of (Array.isArray(o.material)?o.material:[o.material]))
    mat?.dispose?.();
  });
 }
});

test('v100 actual real donor must receive cheek and nasal geometry correction, not a success label',()=>{
 const {geo}=sourceGeometry(),source=new THREE.Group();
 const face=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
 face.name='CC0_SOURCE_GEO-head_animation_realistic';
 source.add(face);
 const model=makeIndependentFaceMaster(source,'female',{
  femaleControls:{ageBand:'twenties',bodyType:'normal'}
 });
 const status=model.report.v99FeminineMalarAlar;
 console.log('ACTUAL_DONOR_V99_STATUS',JSON.stringify(status));
 assert.equal(status?.applied,true,
  'A real GLB may not silently bypass the cheek/nasal sculpt: '+JSON.stringify(status));
 assert.ok(status.cheekVertices>5&&status.alarVertices>1,
  'Must change both the native malar and nasal ring');
 model.root.traverse(o=>{
  if(!o.isMesh)return;
  o.geometry?.dispose();
  for(const mat of Array.isArray(o.material)?o.material:[o.material])
   mat?.dispose?.();
 });
});

test('v102 REAL CC0 donor reduces malar cliff while retaining v100 nose tip and original topology',()=>{
 const {geo}=sourceGeometry();
 geo.computeBoundingBox();
 const bound=geo.boundingBox.clone(),size=bound.getSize(new THREE.Vector3());
 const center=bound.getCenter(new THREE.Vector3()),source=new THREE.Group();
 const head=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
 head.name='CC0_SOURCE_GEO-head_animation_realistic';
 source.add(head);
 const options={femaleControls:{ageBand:'twenties',bodyType:'normal'}};
 const before=makeIndependentFaceMaster(source,'female',{
  ...options,cheekContourMode:'v100'
 });
 const after=makeIndependentFaceMaster(source,'female',{
  ...options,cheekContourMode:'v102'
 });
 const b=before.face.geometry.getAttribute('position');
 const a=after.face.geometry.getAttribute('position');
 const sourcePos=geo.getAttribute('position');
 assert.equal(a.count,b.count);
 assert.deepEqual(Array.from(before.face.geometry.index.array),
  Array.from(after.face.geometry.index.array),
  'New midface field never replaces or cuts triangles');
 assert.equal(after.report.v99FeminineMalarAlar.applied,true);
 assert.equal(after.report.v99FeminineMalarAlar.version,99);
 assert.equal(after.report.v102CheekContour?.applied,true,
  JSON.stringify(after.report.v102CheekContour));
 assert.equal(after.report.v102CheekContour.maxNoseChange,0);
 let crest=0,lower=0,nose=0,crestSum=0,lowerSum=0;
 let noseMaxY=0,noseMaxZ=0,noseTipMaxZ=0,tipSamples=0,crestRetreated=0;
 let noseWorst=null;
 for(let i=0;i<sourcePos.count;i++){
  const x=Math.abs((sourcePos.getX(i)-center.x)/(size.x*.5));
  const y=(sourcePos.getY(i)-bound.min.y)/size.y;
  const z=(sourcePos.getZ(i)-bound.min.z)/size.z;
  const deltaZ=a.getZ(i)-b.getZ(i);
  if(z>.57&&x>.39&&x<.64&&y>.54&&y<.615){
   crest++;crestSum+=deltaZ;
   if(deltaZ<-size.z*.001)crestRetreated++;
  }
  if(z>.50&&x>.32&&x<.70&&y>.42&&y<.54){
   lower++;lowerSum+=deltaZ;
  }
  if(z>.58&&x<.18&&y>.54&&y<.67){
   nose++;
   noseMaxY=Math.max(noseMaxY,Math.abs(a.getY(i)-b.getY(i)));
   if(Math.abs(deltaZ)>noseMaxZ){noseMaxZ=Math.abs(deltaZ);noseWorst={index:i,x,y,z,deltaZ,donorX:sourcePos.getX(i),bZ:b.getZ(i),aZ:a.getZ(i)};}
   if(y<.605){tipSamples++;
    noseTipMaxZ=Math.max(noseTipMaxZ,Math.abs(deltaZ));}
  }
 }
 const measured={crest,lower,nose,crestMean:crestSum/Math.max(1,crest),
  lowerMean:lowerSum/Math.max(1,lower),crestRetreated,noseMaxY,noseMaxZ,
  noseTipMaxZ,tipSamples};
 console.log('V102_REAL_GLb_CHEEK_NOSE_AB',JSON.stringify({...measured,noseWorst}),JSON.stringify(after.report.v102CheekContour));
 assert.ok(crest>8&&lower>8&&nose>8,
  'Audit must cover real CC0 malar/lower-cheek and nasal vertices');
 assert.ok(crestRetreated>8,
  'The upper cheek high point must retreat on the actual female mesh');
 assert.ok(crestSum/crest<0,
  'v102 should flatten, not increase the malar protrusion');
 assert.ok(lowerSum/lower>crestSum/crest,
  'The lower cheek must transition without the former steep trough');
 assert.equal(noseMaxY,0,
  'Nose-tip 3D Y remains bitwise identical to the approved v100 profile');
 assert.ok(tipSamples>10,'Real native nasal-tip samples must be covered');
 assert.equal(noseTipMaxZ,0,
  'The v100 nasal TIP stays bitwise identical through the v102 cheek pass');
 assert.ok(noseMaxZ<Math.min(.0008,Math.max(.0007,size.z*.003)),
  'Upper orbital-corner displacement must remain below 0.8 mm; nasal tip itself stays exact');
 for(const model of [before,after])model.root.traverse(o=>{
  if(!o.isMesh)return;
  o.geometry?.dispose();
  for(const mat of Array.isArray(o.material)?o.material:[o.material])
   mat?.dispose?.();
 });
 geo.dispose();
});

test('v104 real donor rolls back v103, preserving exact v102 nose and bounded cheek',()=>{
 const {geo}=sourceGeometry();
 geo.computeBoundingBox();
 const b=geo.boundingBox.clone(),d=b.getSize(new THREE.Vector3()),
  cx=(b.max.x+b.min.x)*.5;
 const source=new THREE.Group();
 const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
 mesh.name='CC0_SOURCE_GEO-head_animation_realistic';
 source.add(mesh);
 const options={femaleControls:{ageBand:'twenties',bodyType:'normal'}};
 const pristine=makeIndependentFaceMaster(source,'female',{
  ...options,cheekContourMode:'v102-only'
 });
 const adjusted=makeIndependentFaceMaster(source,'female',{
  ...options,cheekContourMode:'v102'
 });
 const report=adjusted.report.v104CheekMicrofair;
 console.log('V104_ACTUAL_CC0_SAFE_MICROFAIR',JSON.stringify(report));
 assert.equal(adjusted.report.v103NormalCheekRepair?.applied,false);
 assert.equal(adjusted.report.v103NormalCheekRepair?.reason,
  'v103-reverted-lumpy-surface');
 assert.equal(report?.applied,true,
  'Native cheek microfairing must run safely: '+JSON.stringify(report));
 assert.equal(report.base,'v102');
 assert.equal(report.noseVertexDelta,0);
 assert.ok(report.changedVertices>=5);
 assert.ok(report.maxVertexDisplacement<=report.maxAllowed*1.01);
 const p=pristine.face.geometry.getAttribute('position'),
  q=adjusted.face.geometry.getAttribute('position'),
  orig=geo.getAttribute('position');
 assert.equal(p.count,q.count);
 assert.deepEqual(Array.from(pristine.face.geometry.index.array),
  Array.from(adjusted.face.geometry.index.array));
 let noseCount=0,strictNoseChanged=0,otherChanged=0,
  maxZ=0,changedMidcheek=0,cheekDelta=0;
 for(let i=0;i<orig.count;i++){
  const ax=Math.abs((orig.getX(i)-cx)/(d.x*.5)),
   y=(orig.getY(i)-b.min.y)/d.y;
  const difference=q.getZ(i)-p.getZ(i);
  assert.equal(q.getX(i),p.getX(i),'X remains exact');
  assert.equal(q.getY(i),p.getY(i),'Y remains exact');
  assert.ok(Number.isFinite(q.getZ(i)));
  maxZ=Math.max(maxZ,Math.abs(difference));
  if(ax<=.345){noseCount++;if(difference!==0)strictNoseChanged++;}
  if(ax>.38&&ax<.70&&y>.465&&y<.615&&Math.abs(difference)>1e-9){
   changedMidcheek++;cheekDelta+=difference;
  }
  if(ax>.85&&difference!==0)otherChanged++;
 }
 console.log('V104_CC0_CONTOUR_DELTA',JSON.stringify({
  noseCount,strictNoseChanged,changedMidcheek,maxZ,cheekDelta,otherChanged
 }));
 assert.ok(noseCount>100,'Protect many original nasal indices');
 assert.equal(strictNoseChanged,0,'Nose/lips EXACTLY equal to approved v102');
 assert.equal(otherChanged,0,'Outer ear and hairline untouched');
 assert.ok(changedMidcheek>5,'Small correction acts on real cheek vertices');
 assert.ok(maxZ<=d.z*.0025,'No broad extrusion or deep crease');
 for(const model of [pristine,adjusted])model.root.traverse(o=>{
  if(!o.isMesh)return;
  o.geometry?.dispose();
  for(const m of Array.isArray(o.material)?o.material:[o.material])
   m?.dispose?.();
 });
 geo.dispose();
});

test('v105 real GLB thin/normal cheeks lose the v102 deep indentation; nose is exactly conserved',()=>{
 for(const bodyType of ['thin','normal']){
  const {geo}=sourceGeometry();
  geo.computeBoundingBox();
  const box=geo.boundingBox.clone(),size=box.getSize(new THREE.Vector3()),
   cx=(box.min.x+box.max.x)*.5;
  const source=new THREE.Group();
  const donor=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
  donor.name='CC0_SOURCE_GEO-head_animation_realistic';
  source.add(donor);
  const opts={femaleControls:{ageBand:'twenties',bodyType}};
  const before=makeIndependentFaceMaster(source,'female',{
   ...opts,cheekContourMode:'v102-only'
  });
  const stable=makeIndependentFaceMaster(source,'female',{
   ...opts,cheekContourMode:'v105'
  });
  const base=makeIndependentFaceMaster(source,'female',{
   ...opts,cheekContourMode:'v100'
  });
  const report=stable.report.v105CheekGeometry;
  assert.equal(report?.applied,true,JSON.stringify(report));
  assert.equal(report.version,105);
  assert.equal(report.bodyType,bodyType);
  assert.equal(stable.report.v103NormalCheekRepair.applied,false);
  assert.equal(stable.report.v104CheekMicrofair.applied,false);
  assert.equal(report.maxNoseChange,0);
  const b=before.face.geometry.getAttribute('position'),
   v=stable.face.geometry.getAttribute('position'),
   original=base.face.geometry.getAttribute('position'),
   donorPos=geo.getAttribute('position');
  assert.deepEqual(Array.from(before.face.geometry.index.array),
   Array.from(stable.face.geometry.index.array));
  let relieved=0,crestPoints=0,deltaSum=0,nosePoints=0,
   worstNose=0,maxCutFromV100=0,maxPushFromV100=0;
  for(let i=0;i<donorPos.count;i++){
   const ax=Math.abs((donorPos.getX(i)-cx)/(size.x*.5)),
    y=(donorPos.getY(i)-box.min.y)/size.y,
    z=(donorPos.getZ(i)-box.min.z)/size.z;
   const delta=v.getZ(i)-b.getZ(i);
   const relative=v.getZ(i)-original.getZ(i);
   if(z>.49&&ax>.37&&ax<.64&&y>.51&&y<.62){
    crestPoints++;deltaSum+=delta;
    if(delta>size.z*.001)relieved++;
   }
   if(ax<=.345&&y>.4&&y<.72){
    nosePoints++;
    worstNose=Math.max(worstNose,Math.abs(relative));
   }
   maxCutFromV100=Math.min(maxCutFromV100,relative);
   maxPushFromV100=Math.max(maxPushFromV100,relative);
  }
  console.log('V105_REAL_CC0_CHEEK',JSON.stringify({
   bodyType,report,crestPoints,relieved,deltaMean:deltaSum/crestPoints,
   nosePoints,worstNose,maxCutFromV100,maxPushFromV100
  }));
  assert.ok(crestPoints>10&&relieved>6,
   'Remove the actual deep recessed topological cheek region');
  assert.ok(deltaSum/crestPoints>0,
   'Do not deepen the original v102 front-view crease');
  assert.ok(nosePoints>150&&worstNose===0,
   'Exact v100 nasal vertices are preserved');
  assert.ok(maxCutFromV100>=-size.z*.0053,
   'The new v105 cheek cannot excavate the baseline face');
  assert.ok(maxPushFromV100<=size.z*.0105,
   'No new swollen cheek ridge may appear');
  for(const model of [before,stable,base])model.root.traverse(o=>{
   if(!o.isMesh)return;
   o.geometry?.dispose();
   for(const m of Array.isArray(o.material)?o.material:[o.material])
    m?.dispose?.();
  });
  geo.dispose();
 }
});
