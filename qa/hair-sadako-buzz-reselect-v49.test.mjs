import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {buzzHairlineFractionAtPoint,createSadakoCrownFlow,createCloseCutScalpFibres,FACE_HAIR_RUNTIME_BUILD}
 from '../src/face-scalp-wig.js';
import {synchronizeHeroHairSelection} from '../src/hero-hair-controls-v43.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('buzz hairline is shared, curved, and symmetric around the ears',()=>{
 const box=new THREE.Box3(new THREE.Vector3(-1,-1,-1),new THREE.Vector3(1,1,1));
 const d=box.getSize(new THREE.Vector3()),c=box.getCenter(new THREE.Vector3());
 const fraction=(x,z)=>buzzHairlineFractionAtPoint({x,y:.6,z},box,d,c);
 assert.ok(Math.abs(fraction(0,-.8)-.495)<.002,'nape must reach the lower rear scalp');
 assert.ok(Math.abs(fraction(0,.8)-.885)<.002,'forehead must remain uncovered');
 assert.ok(fraction(.6,-.4)>fraction(0,-.8),'behind the ears should rise');
 assert.ok(fraction(.6,.2)<fraction(.6,.75),'sideburn lower than forehead');
 for(const z of [-.8,-.4,0,.2,.8])
  assert.equal(fraction(.6,z),fraction(-.6,z));
 for(const x of [.01,.2,.6])
  for(const z of [-.8,-.4,0,.2,.8])
   assert.ok(fraction(x,z)>=.48&&fraction(x,z)<=.91);
});

test('buzz can be selected, replaced by Sadako, then selected again',()=>{
 let parts={hair:0};
 for(const id of ['buzz-cut','sadako-straight-long','buzz-cut']){
  const next=synchronizeHeroHairSelection('female',parts,id);
  assert.equal(next.styleId,id);
  parts=next.parts;
 }
 const page=read('face-mesh-studio.html');
 assert.match(page,/setHairHiddenScalp\(m\.face,true,wigs\.get\(sex\)\)/,
  'color repaint must include the current wig, not silently restore the scalp');
 assert.match(page,/setHairHiddenScalp\(next\.face,true,oldWig\)/,
  'reparenting a wig must preserve scalp correction');
 assert.match(page,/buzzHairlineFractionAtPoint\(/,
  'native scalp clipping and the buzz root must share one anatomical contour');
 assert.match(page,/sadakoCover=wig\?\.root\?\.userData\?\.hairStyleId==='sadako-straight-long'/,
  'Sadako must clip the donor skin in the same way as buzzcut');
 assert.match(page,/v53-sadako-matched-donor-clipping/,
  'Sadako must report actual native scalp clipping, not the old no-op underlay mode');
 assert.match(page,/long-pigment-underlay/,
  'Other long hairstyles preserve the legacy untouched donor skin route');
});

test('Sadako is a long, face-draping style with an opaque low-gloss crown',()=>{
 const page=read('face-mesh-studio.html'),hair=read('src/face-scalp-wig.js');
 assert.match(FACE_HAIR_RUNTIME_BUILD,/v62$/);
 assert.match(page,/Math\.max\(wigDensity,1200\)/,
  'restored low-density user preferences must not expose the entire crown');
 assert.match(hair,/sadakoGravity\?d\.y\*\(longFactor/,
  'over-face collision detection may not turn Sadako into short bangs');
 assert.match(hair,/fringe\|\|overFace\?d\.z\*\.17/,
  'front curtains must drape ahead of the face instead of inside the skull');
 assert.match(hair,/roughness:\.95,metalness:0,clearcoat:0/);
 assert.match(hair,/roughness:\.90,metalness:0/);
 assert.match(hair,/roughness:\.91,metalness:0/);
 assert.match(page,/costume-mask-buzz-restored-v62/,
  'studio cache URL must import the new version');
 assert.match(read('face-body-studio.html'),/costume-mask-buzz-restored-v62/,
  'full-body studio must not silently use the old hair shader');
});

test('Sadako v50 crown microfibres are a stable real-donor matte mesh',()=>{
 const geo=new THREE.SphereGeometry(.5,32,24).toNonIndexed();
 geo.computeVertexNormals();geo.computeBoundingBox();
 const cap=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
 const fibres=createSadakoCrownFlow(cap,geo.boundingBox,0x665044);
 assert.equal(fibres.name,'SADAKO_CROWN_TANGENTIAL_FIBRE_FLOW_V50');
 assert.ok(fibres.userData.crownFibreCount>40,
  'No bald-looking empty crown: donor cap needs real strips');
 assert.ok(fibres.userData.crownFibreCount<=1600,
  'Crown surface detail must remain mobile bounded');
 assert.equal(fibres.geometry.index.count,
  fibres.userData.crownFibreCount*6);
 assert.equal(fibres.material.metalness,0);
 assert.ok(fibres.material.roughness>=.95);
 assert.ok(fibres.material.polygonOffset,
  'Donor-root strands should not z-fight the matching pigment foundation');
 const pos=fibres.geometry.getAttribute('position');
 for(let i=0;i<Math.min(pos.count,80);i++)
  assert.ok([pos.getX(i),pos.getY(i),pos.getZ(i)].every(Number.isFinite));
 fibres.geometry.dispose();fibres.material.dispose();geo.dispose();
});
test('v50 Sadako falls in front of the face without artificial centre parting',()=>{
 const src=read('src/face-scalp-wig.js');
 assert.match(src,/const partGap=style.id==='sadako-straight-long'\?0:/);
 assert.match(src,/const crownUnderlay=appendRealCrownUnderlay/);
 assert.match(src,/const sadakoCrownFlow=sadakoMaster\?createSadakoCrownFlow/,
  'Do not hide missing long roots under synthetic short black stubble');
 assert.match(src,/node.userData\?\.styledHairGeometry/,
  'Crown fibres must be retained by single-mesh consolidation');
});

test('v51 buzz-cut scalp fibres use the exact selected colour even at the crown',()=>{
 const geometry=new THREE.SphereGeometry(.5,16,12).toNonIndexed();
 geometry.computeVertexNormals();geometry.computeBoundingBox();
 const cap=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 const pigment=0x79503a;
 const fibres=createCloseCutScalpFibres(cap,geometry.boundingBox,pigment,1200);
 assert.ok(fibres.userData.fibreCount>=30000);
 assert.equal(fibres.material.type,'MeshBasicMaterial',
  'Opaque densely overlapping stubble must not turn black from surface normals');
 assert.equal(fibres.material.vertexColors,true);
 assert.equal(fibres.material.toneMapped,true);
 assert.equal(fibres.material.polygonOffset,true);
 assert.equal(fibres.castShadow,false,'Prevent 30k fibres shadowing their own scalp');
 assert.equal(fibres.receiveShadow,false);
 assert.equal(fibres.userData.paletteLocked,true);
 assert.equal(fibres.userData.selectedPigmentHex,'#79503a');
 const actual=fibres.geometry.getAttribute('color');
 const target=new THREE.Color(pigment);
 for(const vertex of [0,1,2,3,Math.floor(actual.count/4),actual.count-1]){
  for(const channel of ['r','g','b']){
   const value=actual.getComponent(vertex,{r:0,g:1,b:2}[channel]);
   const expected=target[channel];
   assert.ok(value>=expected*.885-1e-6&&value<=expected*.991+1e-6,
    'Stubble '+channel+' is outside selected hue range at vertex '+vertex);
  }
 }
 fibres.geometry.dispose();fibres.material.dispose();geometry.dispose();
});
test('v51 face studio disables buzz shadow only, preserves full-colour rear hair and bust',()=>{
 const hair=read('src/face-scalp-wig.js');
 const studio=read('face-mesh-studio.html');
 const body=read('face-body-studio.html');
 assert.match(FACE_HAIR_RUNTIME_BUILD,/v62$/);
 assert.match(hair,/consolidatedHair.castShadow=style.shortCutKind!=='buzz'/);
 assert.match(hair,/closeCutFibreShadeRange:closeCutFibres\?\.userData\.fibreShadeRange/);
 assert.match(hair,/createCloseCutScalpFibres\(\s*cap,box,color,lockCount\*fiberMultiplier/);
 assert.match(studio,/costume-mask-buzz-restored-v62/);
 assert.match(body,/costume-mask-buzz-restored-v62/);
 assert.match(studio,/report\.closeCutPigmentHex/);
});
