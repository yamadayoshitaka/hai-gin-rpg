import test from 'node:test';
import assert from 'node:assert/strict';
import {v114NaturalEyeAperture} from '../src/face-feature-meshes.js';
import {PART_CATALOG,defaultPartSelection,resolvePartSelection} from '../src/face-part-catalog-v32.js';
import {LIBRARY_FACE_PRESET,normalizeFemaleFaceControls} from '../src/face-v7-controls.js';
import {resolveEditedFaceControls} from '../src/face-state-v49.js';
import {AGE_PROFILES} from '../src/character-demographics-v47.js';

test('v114 shared almond eyelid curve is closed at each canthus and has natural slightly hooded upper lid',()=>{
 for(const side of [-1,1]){
  const args={radius:0.047,halfHeight:.047*.375,eyeWidth:1,side,female:true};
  for(const t of [-1,1]){
   const p=v114NaturalEyeAperture({...args,t});
   assert.ok(Math.abs(p.top-p.bottom)<1e-10,
    'Canthus edges must meet; no black socket gap');
  }
  const mid=v114NaturalEyeAperture({...args,t:0});
  assert.ok(mid.top>mid.bottom&&mid.top>0);
  assert.ok(mid.top-mid.bottom<args.halfHeight*2*.94,
   'Female neutral aperture must not look permanently startled');
  assert.ok(mid.top-mid.bottom>args.halfHeight*2*.82,
   'Must not overclose eyes');
  for(const t of [-.8,-.4,0,.4,.8]){
   const a=v114NaturalEyeAperture({...args,t});
   const mirrored=v114NaturalEyeAperture({...args,t:-t,side:-side});
   assert.ok(Math.abs(a.top-mirrored.top)<1e-10);
   assert.ok(Math.abs(a.bottom-mirrored.bottom)<1e-10);
  }
 }
});

test('v114 male keeps legacy aperture; reference library numeric eye preset is untouched',()=>{
 const m=v114NaturalEyeAperture({t:0,radius:.05,halfHeight:.019,side:1,female:false});
 assert.ok(Math.abs((m.top-m.bottom)-.038)<1e-8);
 assert.equal(LIBRARY_FACE_PRESET.femaleControls.irisDiameter,1);
 assert.equal(LIBRARY_FACE_PRESET.femaleControls.eyeSize,1);
});

test('v114 default feminine eye profile is narrower, longer and has a larger brown iris',()=>{
 const [a]=PART_CATALOG.female.eye,[old]=PART_CATALOG.male.eye;
 assert.equal(a.id,'female-eye-01');
 assert.match(a.label,/アーモンド/);
 assert.ok(a.values.eyeHeight>=.87&&a.values.eyeHeight<=1);
 assert.ok(a.values.eyeWidth>=1.12&&a.values.eyeWidth<=1.23);
 assert.ok(a.values.irisDiameter>=1.2&&a.values.irisDiameter<=1.40);
 assert.equal(old.values.eyeHeight,1.28,'Male catalog must remain unchanged');
 assert.equal(defaultPartSelection().bodyType,'normal');
 const parts=defaultPartSelection();
 const selected=resolvePartSelection('female',parts);
 const normal=resolveEditedFaceControls('female',selected.controls,
  'twenties','normal',{},false);
 assert.ok(Math.abs(normal.eyeHeight-a.values.eyeHeight*AGE_PROFILES.twenties.eyelidScale)<1e-6);
 assert.ok(Math.abs(normal.eyeWidth-a.values.eyeWidth)<1e-6);
 const thin=resolveEditedFaceControls('female',selected.controls,
  'twenties','thin',{},false);
 const restored=resolveEditedFaceControls('female',selected.controls,
  'twenties','normal',{},false);
 assert.deepEqual(restored,normal,'Thin -> normal cannot accumulate eye transforms');
 assert.ok(Number.isFinite(thin.eyeHeight));
 const changed=resolveEditedFaceControls('female',selected.controls,
  'twenties','normal',{eyeHeight:1.14,irisDiameter:.98},false);
 assert.ok(Math.abs(changed.eyeHeight-1.14*AGE_PROFILES.twenties.eyelidScale)<1e-8,
  'Explicit eye settings must never be overwritten by new default');
 assert.equal(changed.irisDiameter,.98);
});

test('v114 male sclera and pupil retain legacy profile without female hooded geometry',async()=>{
 const source=(await import('node:fs')).readFileSync(
  new URL('../src/face-feature-meshes.js',import.meta.url),'utf8');
 assert.match(source,/const apertureY=female\?\(natural\.top-natural\.bottom\)\*\.5/);
 assert.match(source,/const centerY=female\?y\+\(natural\.top\+natural\.bottom\)\*\.5:y/);
 assert.match(source,/const yy=female\?y\+fitted\.bottom/);
 assert.match(source,/female\?Math\.min\(requested,opening\*\.58,\(v114IrisProjectedRadius\|\|opening\)\*\.49\):/);
 assert.match(source,/Math\.min\(requested,opening\*\.72\)/);
});

test('v114 source is anatomical geometry and retains iris/eye layer for animation',async()=>{
 const source=(await import('node:fs')).readFileSync(
  new URL('../src/face-feature-meshes.js',import.meta.url),'utf8');
 const html=(await import('node:fs')).readFileSync(
  new URL('../face-mesh-studio.html',import.meta.url),'utf8');
 assert.match(source,/v114NaturalEyeAperture\(\{t:tx,side,radius:eyeRadius/);
 assert.match(source,/v114NaturalEyeAperture\(\{t,side,radius:eyeRadius/);
 assert.match(source,/v114LowerEyelidRollOnRealMesh/);
 assert.match(source,/v114IrisProjectedRadius/);
 assert.match(source,/v114PupilRelativeIrisMax:female\?\.49:null/);
 assert.match(html,/dataset\.faceMeshReady='v117'/);
 assert.match(html,/v114-natural-realistic-eyes/); // versioned browser source, not cached v113
 assert.match(html,/function syncWireOverlay\(face\)/);
 assert.match(html,/experimentalCheekRetopo/);
});
