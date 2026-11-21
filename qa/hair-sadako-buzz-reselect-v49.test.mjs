import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {buzzHairlineFractionAtPoint,createSadakoCrownFlow,FACE_HAIR_RUNTIME_BUILD}
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
   assert.ok(fraction(x,z)>=.495&&fraction(x,z)<=.91);
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
 assert.match(page,/long-pigment-underlay/,
  'long hair must report an opaque underlay instead of a misleading scalp clip');
});

test('Sadako is a long, face-draping style with an opaque low-gloss crown',()=>{
 const page=read('face-mesh-studio.html'),hair=read('src/face-scalp-wig.js');
 assert.match(FACE_HAIR_RUNTIME_BUILD,/v5[0-9]$/);
 assert.match(page,/Math\.max\(wigDensity,1200\)/,
  'restored low-density user preferences must not expose the entire crown');
 assert.match(hair,/sadakoGravity\?d\.y\*\(longFactor/,
  'over-face collision detection may not turn Sadako into short bangs');
 assert.match(hair,/fringe\|\|overFace\?d\.z\*\.17/,
  'front curtains must drape ahead of the face instead of inside the skull');
 assert.match(hair,/roughness:\.95,metalness:0,clearcoat:0/);
 assert.match(hair,/roughness:\.90,metalness:0/);
 assert.match(hair,/roughness:\.91,metalness:0/);
 assert.match(page,/sadako-crown-fibre-curtain-v50/,
  'studio cache URL must import the new version');
 assert.match(read('face-body-studio.html'),/sadako-crown-fibre-curtain-v50/,
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
 assert.match(src,/crownUnderlay=shortHair\|\|styleId==='sadako-straight-long'/);
 assert.match(src,/sadakoCrownFlow=style.id==='sadako-straight-long'/);
 assert.match(src,/node.userData\?\.styledHairGeometry/,
  'Crown fibres must be retained by single-mesh consolidation');
});
