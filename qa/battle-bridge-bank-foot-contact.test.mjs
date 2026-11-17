import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {triangleTerrainHeight,battleWalkSurfaceY,anchoredStandingY}
 from '../src/battle-terrain-contact.js';
import {createCrowdGroundAnchor,normalizeCrowdCaptureFootOrigin,CROWD_GROUND_POSE_CHANNELS}
 from '../src/crowd-run-grounding.js';

// The visible terrain is tessellated into two triangles per 1-cell tile:
// (bottomLeft,topLeft,topRight) and (bottomLeft,topRight,bottomRight).
// On a sharp bank the visible plane differs from smoothHeight(x,z).
const values=new Map([
 ['9.5,19.5',0],['9.5,20.5',2],
 ['10.5,20.5',4],['10.5,19.5',8]
]);
const sample=(x,z)=>values.get(x+','+z)??-99;
assert.equal(triangleTerrainHeight(10.25,19.75,sample),5,
 'down-slope ankle height must match the actual lower terrain triangle');
assert.equal(triangleTerrainHeight(9.75,20.25,sample),2,
 'upper terrain triangle must match its three rendered vertices');
assert.equal(triangleTerrainHeight(10,20,sample),2,
 'shared diagonal of the two triangles must have a continuous height');
assert.throws(()=>triangleTerrainHeight(NaN,20,sample),/Invalid/);

// A raised deck wins ONLY in its authored cell. Intact stone stairs beat
// terrain, while a neighbouring river-bank tile uses its real ground polygon.
const bridges=new Map([['10,20',9]]),steps=new Map([['11,20',{height:6}]]);
assert.equal(battleWalkSurfaceY(10.25,19.75,bridges,steps,sample),9);
assert.equal(battleWalkSurfaceY(10.25,19.75,new Map(),steps,sample),5);
assert.equal(battleWalkSurfaceY(11,20,bridges,steps,()=>3),6);
assert.equal(battleWalkSurfaceY(11,20,new Map(),new Map(),()=>3),3);
assert.equal(anchoredStandingY(5),5.018);
assert.equal(anchoredStandingY(5,1.8),6.8,
 'mount saddle height uses exactly one floor contact, without foot clearance');

// In a fully dressed 2000-soldier army the bare foot mesh may be clipped,
// so opaque real boots (not hands or weapon tips) supply the local foot origin.
const anatomy=new THREE.BufferGeometry();
const boot=new THREE.BufferGeometry();
const upper=[0,.6,0,.2,1.1,0,0,1.7,0];
const shoe=[-.25,-.22,0,.25,-.20,0,.25,.04,0];
for(const channel of CROWD_GROUND_POSE_CHANNELS){
 anatomy.setAttribute(channel,new THREE.Float32BufferAttribute(upper,3));
 boot.setAttribute(channel,new THREE.Float32BufferAttribute(shoe,3));
}
const sources=[
 {geometry:anatomy,isHumanBody:true,isFootSurface:false},
 {geometry:boot,isHumanBody:false,isFootSurface:true}
];
const anchor=createCrowdGroundAnchor(sources.map(s=>({
 isHumanBody:s.isHumanBody,isFootSurface:s.isFootSurface,
 base:s.geometry.getAttribute('position').array
})));
assert.ok(Math.abs(anchor.floor+.22)<1e-6,'actual boots outrank clipped-away bare feet');
const correction=normalizeCrowdCaptureFootOrigin(sources,anchor);
assert.ok(Math.abs(correction.offset-.22)<1e-6);
assert.equal(correction.correctedAttributes,CROWD_GROUND_POSE_CHANNELS.length*2);
for(const channel of CROWD_GROUND_POSE_CHANNELS){
 assert.ok(Math.abs(boot.getAttribute(channel).getY(0))<1e-5,
  'boot contact must be world foot origin for '+channel);
 assert.ok(Math.abs(anatomy.getAttribute(channel).getY(0)-.82)<1e-5,
  'the face, hair, torso and armour must shift by the exact same amount');
}

// Verify actual gameplay connects the same collision height to both modes
// and re-anchors AFTER worker smoothing, not before the final render.
const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const army=readFileSync(new URL('../src/mass-battle-real-army.js',import.meta.url),'utf8');
assert.match(game,/battleWalkSurfaceY\(x\/CELL\+6,z\/CELL\+6,bridgeHeights,stairCells,renderedTerrainVertexY\)/,
 '50 and 1000 terrainY must match the rendered ground mesh');
assert.match(game,/terrainContactVertexHeights\[\(z\+iz\)\*\(WORLD_SIZE\+1\)\+x\+ix\]=y/,
 'ground contact cache must use the SAME exact y values as terrain vertices');
assert.match(game,/return terrainContactVertexHeights\[iz\*\(WORLD_SIZE\+1\)\+ix\]/,
 '2000 soldiers cannot recalculate expensive bicubic patches per draw frame');
assert.match(game,/const corrected=anchoredStandingY\(floor,seat\)/,
 'all mass soldiers use the same final ground after interpolation');
assert.match(game,/out\.y=corrected;smooth\.y=corrected/,
 'cached visual motion cannot reinsert feet into the bank polygon');
assert.match(game,/if\(upperPoint\)/,
 'authored 2F/roof heights must not be overridden by ground contact');
const atlas=readFileSync(new URL('../src/crowd-impostor-atlas.js',import.meta.url),'utf8');
assert.match(army,/footOriginY:footAnchor\?\.floor\?\?0/,
 'photo and 3D sprites use the same boot-space baseline');
assert.match(atlas,/person\.position\.set\(0,Number\.isFinite\(footOriginY\)\?-footOriginY:0,0\)/,
 'the distant photographed feet are baked at local ground zero');
assert.match(army,/normalizeCrowdCaptureFootOrigin\(sources,footAnchor\)/,
 'the 2000-soldier GPU source is normalized once, not per draw');
assert.match(army,/isFootSurface:source\.isFootSurface/,
 'covered feet choose a real boot geometry, not a bare-hand lower bound');
console.log('PASS: 50/1000 exact triangle contact, raised bridge and stairs, all-pose foot origin');
