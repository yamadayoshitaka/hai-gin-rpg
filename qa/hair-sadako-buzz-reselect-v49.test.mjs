import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {buzzHairlineFractionAtPoint,FACE_HAIR_RUNTIME_BUILD}
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
 assert.match(FACE_HAIR_RUNTIME_BUILD,/v49$/);
 assert.match(page,/Math\.max\(wigDensity,1200\)/,
  'restored low-density user preferences must not expose the entire crown');
 assert.match(hair,/sadakoGravity\?d\.y\*\(longFactor/,
  'over-face collision detection may not turn Sadako into short bangs');
 assert.match(hair,/fringe\|\|overFace\?d\.z\*\.17/,
  'front curtains must drape ahead of the face instead of inside the skull');
 assert.match(hair,/roughness:\.95,metalness:0,clearcoat:0/);
 assert.match(hair,/roughness:\.90,metalness:0/);
 assert.match(hair,/roughness:\.91,metalness:0/);
 assert.match(page,/hairline-reselect-sadako-matte-v49/,
  'studio cache URL must import the new version');
 assert.match(read('face-body-studio.html'),/hairline-reselect-sadako-matte-v49/,
  'full-body studio must not silently use the old hair shader');
});
