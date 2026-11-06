import assert from 'node:assert/strict';
import * as THREE from 'three';
import {headwearAllowsHair,maskHairGeometry,createVisibleHeadwearWisps} from '../src/character-system/hair-headwear-occlusion.js';

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
  // 53 tapered face locks precede the temple and nape batches, each with
  // 12 vertices. Their tips must form a non-horizontal silhouette.
  const tips=Array.from({length:53},(_,i)=>p.getY(i*12+8));
  const spread=Math.max(...tips)-Math.min(...tips);
  assert.ok(spread>(head.max.y-head.min.y)*.045,
    `Helmet fringe is still a straight line (${spread} height units)`);
  const roots=new Set(Array.from({length:53},(_,i)=>p.getY(i*12).toFixed(5)));
  assert.ok(roots.size>35,'Helmet fringe roots are too regularly aligned');
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
