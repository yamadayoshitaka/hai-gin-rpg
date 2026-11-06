import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {headwearAllowsHair,maskHairGeometry,createVisibleHeadwearWisps} from '../src/character-system/hair-headwear-occlusion.js';
import {fitHairToForehead} from '../src/character-system/hair-attachment-runtime.js';

const head=new THREE.Box3(new THREE.Vector3(-.12,-.11,-.12),new THREE.Vector3(.12,.13,.12));
const fit={position:new THREE.Vector3(),scale:new THREE.Vector3(1,1,1)};
const geometry=new THREE.SphereGeometry(.17,36,24);
geometry.translate(0,.015,0);
const sourceCount=geometry.index.count;
for(const mode of ['helmet','hood']){
 const cut=maskHairGeometry(geometry,new THREE.Matrix4(),fit,head,mode);
 assert.ok(cut.sourceTriangles>100,`${mode}: source style must be real geometry`);
 assert.ok(cut.keptTriangles>0,`${mode}: safe strands should remain when available`);
 assert.ok(cut.keptTriangles<cut.sourceTriangles,`${mode}: intersecting headwear hair must be removed`);
 const position=cut.geometry.getAttribute('position');
 for(let i=0;i<cut.geometry.index.count;i++){
  const vertex=cut.geometry.index.getX(i);
  const point=new THREE.Vector3().fromBufferAttribute(position,vertex);
  assert.ok(headwearAllowsHair(point,head,mode),`${mode}: a rendered hair vertex enters the headpiece`);
 }
 assert.equal(maskHairGeometry(geometry,new THREE.Matrix4(),fit,head,mode).geometry,cut.geometry,
  `${mode}: clipped index buffer must be reused across identical soldiers`);
 const depth=head.max.z-head.min.z;
 const forehead=head.max.z-depth*.30;
 const wisp=createVisibleHeadwearWisps(head,0x664632,mode,forehead);
 assert.ok(wisp.geometry.getAttribute('position').count>(mode==='hood'?2000:300),
   `${mode}: hair became a few sparse cards instead of a full face/neck fringe`);
 const p=wisp.geometry.getAttribute('position');
 let highFaceStrands=0;
 let helmetTempleStrands=0;
 const width=head.max.x-head.min.x;
 const center=head.getCenter(new THREE.Vector3());
 for(let i=0;i<p.count;i++){
  const point=new THREE.Vector3().fromBufferAttribute(p,i);
  if(mode==='hood'){
   assert.ok(point.y<=head.max.y-(head.max.y-head.min.y)*.16,
    'Hood strands must stay below the covered crown');
   assert.ok(Math.abs(point.z-forehead)<depth*.05,
     'Hood fringe must follow the sampled forehead surface, not float at nose depth');
   if(point.y>head.max.y-(head.max.y-head.min.y)*.35)highFaceStrands++;
  }else{
   const frontLock=point.z>center.z+depth*.15;
   const templeLock=point.z>center.z&&point.z<center.z+depth*.13&&
     Math.abs(point.x-center.x)>=width*.32;
   if(frontLock){
    assert.ok(point.y<=head.max.y-(head.max.y-head.min.y)*.24,
      `${mode}: exposed locks entered the covered crown above the brow rim`);
    assert.ok(point.y>=head.max.y-(head.max.y-head.min.y)*.415,
      `${mode}: forehead fringe still hangs across eyebrows or eyes`);
   }
   if(templeLock){
    assert.ok(point.y>=head.max.y-(head.max.y-head.min.y)*.68,
      `${mode}: temple strands reach the cheek and jaw`);
    helmetTempleStrands++;
   }
   if(frontLock&&point.y>head.max.y-(head.max.y-head.min.y)*.60){
    assert.ok(Math.abs(point.z-forehead)<depth*.05,
      `${mode}: bangs float in front of the eyes rather than touching the forehead`);
    highFaceStrands++;
   }
  }
 }
 if(mode==='hood')assert.ok(highFaceStrands>500,'Hooded character needs full bangs at the exposed forehead, not just a few tiny cards');
 if(mode==='hood'){
  const roots=new Set();for(let i=0;i<56;i++)roots.add(p.getY(i*12).toFixed(4));
  assert.ok(roots.size>40,'Fringe roots must be staggered, not identical checkerboard cards');
 }
 if(mode==='helmet'){
  assert.ok(helmetTempleStrands>60,'Helmet needs short temple locks, not a central hair rectangle');
  // 114 layered face locks precede the temple and nape batches. In v4.4.62
  // just 53 thin locks left mobile soldiers practically bald under helmets.
  const faceLocks=114;
  assert.ok(p.count>=faceLocks*12+56*3,'Helmet fringe density regressed');
  const tips=Array.from({length:faceLocks},(_,i)=>p.getY(i*12+8));
  const spread=Math.max(...tips)-Math.min(...tips);
  assert.ok(spread>(head.max.y-head.min.y)*.055,
    `Helmet fringe is still a straight line (${spread} height units)`);
  const roots=new Set(Array.from({length:faceLocks},(_,i)=>p.getY(i*12).toFixed(5)));
  assert.ok(roots.size>65,'Helmet fringe roots are too regularly aligned');
  // A large central bald patch survived the prior global-density test: the
  // GLB side locks looked fine, but the convex forehead hid every middle
  // wisp. Require visible tapered strands across the WHOLE centre opening.
  const centralFillStart=faceLocks*12,centralFillCount=76*12;
  const middleBuckets=[0,0,0];
  for(let i=centralFillStart;i<centralFillStart+centralFillCount;i++){
    const x=(p.getX(i)-center.x)/width;
    const drop=(head.max.y-p.getY(i))/(head.max.y-head.min.y);
    const z=p.getZ(i);
    if(drop<.345||drop>.415||z<forehead+depth*.025)continue;
    if(x>=-.20&&x<.20){
      const bucket=Math.min(2,Math.floor((x+.20)/(.40/3)));
      middleBuckets[bucket]++;
    }
    assert.ok(z<=forehead+depth*.05,'centre bangs float too far in front of the skin');
  }
  assert.ok(middleBuckets.every(count=>count>14),
    `helmet has a centre-part bald patch: ${middleBuckets.join('/')} visible fringe vertices`);
  // Every segment of the fine underlying hairline must connect to the next
  // and span the central brow, not draw separated rectangular patches.
  const hairlineStart=(faceLocks+76)*12,hairlineSegments=92;
  for(let i=0;i<hairlineSegments-1;i++){
    const right=hairlineStart+i*6+1,left=hairlineStart+(i+1)*6;
    assert.ok(Math.abs(p.getX(right)-p.getX(left))<1e-6&&
      Math.abs(p.getY(right)-p.getY(left))<1e-6&&
      Math.abs(p.getZ(right)-p.getZ(left))<1e-6,
      `helmet hairline has a gap at segment ${i}`);
  }
  assert.ok(p.getX(hairlineStart)<center.x-width*.36&&
    p.getX(hairlineStart+(hairlineSegments-1)*6+1)>center.x+width*.36,
    'helmet hairline must span the whole forehead opening');
  const bottomEdge=Array.from({length:hairlineSegments},(_,i)=>
    (head.max.y-p.getY(hairlineStart+i*6+2))/(head.max.y-head.min.y));
  const tipSpread=Math.max(...bottomEdge)-Math.min(...bottomEdge);
  assert.ok(tipSpread>.07,
    `helmet bangs have a blunt straight-across cut: ${tipSpread.toFixed(3)} head heights`);
  const average=items=>items.reduce((sum,item)=>sum+item,0)/items.length;
  assert.ok(Math.abs(average(bottomEdge.slice(0,23))-average(bottomEdge.slice(-23)))>.012,
    'forehead hairline must sweep to one side instead of ending horizontally');
  const otherCut=createVisibleHeadwearWisps(head,0x664632,mode,forehead,8);
  assert.notDeepEqual(Array.from(otherCut.geometry.attributes.position.array.slice(0,72)),
    Array.from(p.array.slice(0,72)),'Different haircuts must not receive identical helmet bangs');
  otherCut.geometry.dispose();otherCut.material.dispose();
  // Hair under the steel shell is harmless: the depth buffer hides it. The
  // previous top-down cutoff deleted nearly every fitted scalp triangle,
  // leaving a visible bald stripe as soon as a helmet was equipped.
  const fittedCap=new THREE.SphereGeometry(1,32,20);
  fittedCap.scale(.105,.108,.102);fittedCap.translate(0,.015,0);
  const innerCut=maskHairGeometry(fittedCap,new THREE.Matrix4(),fit,head,mode,forehead);
  assert.ok(innerCut.keptTriangles>innerCut.sourceTriangles*.35,
    `helmet stripped the scalp hidden inside the metal shell: ${innerCut.keptTriangles}/${innerCut.sourceTriangles}`);
  fittedCap.dispose();
  assert.ok(highFaceStrands>400,'Helmet needs dense visible bangs behind the face opening');
  assert.equal(headwearAllowsHair(new THREE.Vector3(0,head.max.y-.33*(head.max.y-head.min.y),forehead),head,mode,forehead),true,
    'real hair at the measured forehead surface must survive helmet clipping');
  for(const drop of [.28,.39,.415]){
   assert.equal(headwearAllowsHair(new THREE.Vector3(0,head.max.y-drop*(head.max.y-head.min.y),forehead),head,mode,forehead),true,
     `actual fringe at ${drop} head height was shaved by a horizontal helmet cutoff`);
  }
  const naturalFringe=new THREE.BufferGeometry();
  const yAt=drop=>head.max.y-drop*(head.max.y-head.min.y);
  naturalFringe.setAttribute('position',new THREE.Float32BufferAttribute([
   -.025,yAt(.28),forehead,.025,yAt(.28),forehead,
   -.025,yAt(.41),forehead,.025,yAt(.41),forehead],3));
  naturalFringe.setIndex([0,2,1,1,2,3]);
  const survivingFringe=maskHairGeometry(naturalFringe,new THREE.Matrix4(),fit,head,mode,forehead);
  assert.equal(survivingFringe.keptTriangles,2,'a real forehead GLB lock must survive from rim to just above eyebrow');
  naturalFringe.dispose();
  const templePoint=new THREE.Vector3(head.getSize(new THREE.Vector3()).x*.43,
    yAt(.55),head.getCenter(new THREE.Vector3()).z+depth*.055);
  assert.equal(headwearAllowsHair(templePoint,head,mode,forehead),true,
    'safe hair at the temple opening must not be shaved away with the cheek guards');
  assert.equal(headwearAllowsHair(new THREE.Vector3(0,head.max.y-.45*(head.max.y-head.min.y),forehead),head,mode,forehead),false,
    'hair must not survive over the eyebrows and eyes');
  assert.equal(headwearAllowsHair(new THREE.Vector3(0,head.max.y-.15*(head.max.y-head.min.y),head.getCenter(new THREE.Vector3()).z),head,mode,forehead),true,
    'hair inside the helmet shell should remain and be hidden naturally by opaque steel');
  assert.equal(headwearAllowsHair(new THREE.Vector3(head.getSize(new THREE.Vector3()).x*.65,head.max.y-.15*(head.max.y-head.min.y),head.getCenter(new THREE.Vector3()).z),head,mode,forehead),false,
    'hair outside the inner helmet shell must be trimmed before crossing the metal');
  assert.equal(headwearAllowsHair(new THREE.Vector3(head.getSize(new THREE.Vector3()).x*.43,head.max.y-.55*(head.max.y-head.min.y),head.getCenter(new THREE.Vector3()).z-.02*depth),head,mode,forehead),false,
    'oversized GLB side hair must not protrude through the helmet ear opening as black wedges');
  assert.equal(headwearAllowsHair(new THREE.Vector3(0,head.max.y-.35*(head.max.y-head.min.y),forehead+depth*.06),head,mode,forehead),false,
    'bulky front locks must be recessed inside the visor, not protrude over its steel lip');
  let detachedCheekHair=0;
  for(let i=0;i<p.count;i++){
   const z=p.getZ(i),y=p.getY(i);
   if(y<head.max.y-(head.max.y-head.min.y)*.68&&z>head.getCenter(new THREE.Vector3()).z)
    detachedCheekHair++;
  }
  assert.equal(detachedCheekHair,0,'helmet locks may not dangle across the cheek and jaw');
  assert.equal(headwearAllowsHair(new THREE.Vector3(0,head.max.y-.33*(head.max.y-head.min.y),head.max.z-.30*(head.max.z-head.min.z)),head,mode),true,
    'real GLB fringe at the helmet forehead opening must survive clipping');
  assert.equal(headwearAllowsHair(new THREE.Vector3(0,head.max.y-.20*(head.max.y-head.min.y),head.max.z),head,mode),false,
    'hair may not protrude through the helmet crown');
  assert.equal(headwearAllowsHair(new THREE.Vector3(.10,head.min.y+.05,head.max.z-.02),head,mode),false,
    'below-rim hair near the cheek must not leave black triangular facial fragments');
 }
 wisp.geometry.dispose();wisp.material.dispose();
 console.log(`PASS ${mode}: ${cut.keptTriangles}/${cut.sourceTriangles} safely clipped triangles + visible wisps`);
}
geometry.dispose();

// Test the actual male knight hair rather than only synthetic spheres. The
// nose-tip fitting bug once kept 32 of 875 forehead triangles while the QA
// still passed because the separate fake fringe had enough vertices.
const data=fs.readFileSync(new URL('../assets/characters/hair-fitted-v1/male_hair_03_lod0.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.length),'');
gltf.scene.updateMatrixWorld(true);
const assetBox=new THREE.Box3().setFromObject(gltf.scene);
const realForehead=head.max.z-(head.max.z-head.min.z)*.30;
const hairFit=fitHairToForehead(assetBox,head,realForehead);
assert.ok(hairFit.scale.z<hairFit.scale.x,'source hair depth must follow scalp, not nose-tip bounds');
let sourceHair=null;
gltf.scene.traverse(n=>{if(n.isMesh&&n.geometry?.index&&!sourceHair)sourceHair=n});
assert.ok(sourceHair,'real male haircut mesh unavailable');
const clippedHair=maskHairGeometry(sourceHair.geometry,sourceHair.matrixWorld,hairFit,head,'helmet',realForehead);
const center=head.getCenter(new THREE.Vector3()),size=head.getSize(new THREE.Vector3());
const point=new THREE.Vector3(),vertex=new THREE.Vector3();
function countForeheadTriangles(geometry){
 let found=0;const positions=geometry.getAttribute('position');
 for(let i=0;i<geometry.index.count;i+=3){
  point.set(0,0,0);
  for(let k=0;k<3;k++){
   vertex.fromBufferAttribute(positions,geometry.index.getX(i+k));
   vertex.applyMatrix4(sourceHair.matrixWorld).multiply(hairFit.scale).add(hairFit.position);
   point.add(vertex);
  }
  point.divideScalar(3);
  const drop=(head.max.y-point.y)/size.y;
  if(Math.abs(point.x-center.x)<size.x*.44&&
    point.z>head.max.z-size.z*.46&&drop>.25&&drop<.44)found++;
 }
 return found;
}
const sourceForehead=countForeheadTriangles(sourceHair.geometry);
const keptForehead=countForeheadTriangles(clippedHair.geometry);
const fringeBuckets=geometry=>{
 const buckets=[0,0,0,0,0],positions=geometry.getAttribute('position');
 for(let i=0;i<geometry.index.count;i+=3){
  point.set(0,0,0);
  for(let k=0;k<3;k++){
   vertex.fromBufferAttribute(positions,geometry.index.getX(i+k));
   vertex.applyMatrix4(sourceHair.matrixWorld).multiply(hairFit.scale).add(hairFit.position);
   point.add(vertex);
  }
  point.divideScalar(3);
  const drop=(head.max.y-point.y)/size.y,u=(point.x-center.x)/size.x;
  if(Math.abs(u)>.44||point.z<=head.max.z-size.z*.46||drop<=.25||drop>=.44)continue;
  buckets[Math.min(4,Math.floor((u+.44)/(.88/5)))]++;
 }
 return buckets;
};
const sourceBuckets=fringeBuckets(sourceHair.geometry),keptBuckets=fringeBuckets(clippedHair.geometry);
console.log('Real fringe distribution before/after helmet:',sourceBuckets.join('/'),keptBuckets.join('/'));
assert.ok(sourceForehead>300,'test hairstyle must contain substantial real forehead mesh');
assert.ok(keptForehead>sourceForehead*.35,
 `helmet still shaves real bangs: ${keptForehead}/${sourceForehead} triangles`);
console.log(`PASS real GLB helmet hairline: ${keptForehead}/${sourceForehead} forehead triangles preserved`);
