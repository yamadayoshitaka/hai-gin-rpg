import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createFaceExpressionAnimator} from '../src/face-expression-animation-v48.js';
import {chooseHeroFacePreset,HERO_FACE_PRESETS} from '../src/hero-face-presets-v45.js';
import {defaultPartSelection,resolvePartSelection} from '../src/face-part-catalog-v32.js';

const studio=()=>readFileSync(new URL('../face-mesh-studio.html',import.meta.url),'utf8');
test('v82 actual facial aperture is clearly labelled separately from v72 hair and actual photo state is visible',()=>{
 const html=studio();
 assert.match(html,/<h1>顔・髪の編集｜顔品質 v113・髪造形 v72<\/h1>/);
 assert.match(html,/id="faceQualityRelease"/);
 assert.match(html,/function facePhotoRuntimeStatus\(\)/);
 assert.match(html,/v76RealSkinPhoto/);
 assert.match(html,/state==='CC0-real-photo-microrelief'\?'反映済'/);
 assert.match(html,/実写肌PBR：/);
 assert.match(html,/face-expression-animation-v48\.js\?v=20261122-v107-animated-laugh/);
 assert.doesNotMatch(html,/<h1>顔・髪の編集 v75/);
});
test('16 complete face choices per sex are not cosmetic-only, retain existing hair',()=>{
 const html=studio();
 assert.match(html,/完成顔を選ぶ（男女それぞれ16種類）/);
 for(const sex of ['male','female']){
  assert.equal(HERO_FACE_PRESETS[sex].length,16);
  const seed={...defaultPartSelection(),hair:2,hairColor:'blonde',hairVolume:'natural',ageBand:'sixties'};
  const a=chooseHeroFacePreset(sex,0,seed);
  const b=chooseHeroFacePreset(sex,1,seed);
  assert.notDeepEqual([a.face,a.eye,a.nose,a.mouth],
   [b.face,b.eye,b.nose,b.mouth]);
  assert.equal(a.hair,seed.hair);
  assert.equal(b.hair,seed.hair);
  assert.equal(a.ageBand,'sixties');
  assert.notDeepEqual(
   resolvePartSelection(sex,a).controls,
   resolvePartSelection(sex,b).controls);
 }
 assert.match(html,/const faceChanged=completeFace\|\|/);
 assert.match(html,/if\(facePartChanged\|\|completeFace\)modelChanges=nextControls/);
 assert.match(html,/if\(facePartChanged\|\|completeFace\)maleChanges=/);
 assert.match(html,/id="facePresetApplied"/);
 assert.match(html,/performanceMetrics\.headRebuilds/);
 assert.match(html,/if\(faceChanged\)rebuildFemale\(\)/);
 assert.match(html,/if\(faceChanged\)rebuildMale\(\)/);
});
test('v79 3D expressions use live seam-welded normals and restore neutral',()=>{
 // Intentionally split the geometry: a recomputation would turn its
 // original smooth per-vertex normals into hard-lit per-triangle planes.
 const sphere=new THREE.SphereGeometry(.3,24,18);
 const split=sphere.toNonIndexed();
 sphere.dispose();
 const face=new THREE.Mesh(split,new THREE.MeshStandardMaterial());
 const parts=new THREE.Group();face.add(parts);
 const animator=createFaceExpressionAnimator({face,parts},{
  expressionIntensity:1,autoBlink:false,speaking:false
 });
 const normals=split.getAttribute('normal').array.slice();
 const rest=split.getAttribute('position').array.slice();
 animator.setExpression('smile');
 assert.notDeepEqual(split.getAttribute('position').array,rest);
 assert.notDeepEqual(split.getAttribute('normal').array,normals,
  'The surface normals must follow the changed smile geometry');
 animator.setExpression('angry');
 assert.notDeepEqual(split.getAttribute('normal').array,normals);
 animator.setActionUnits({smile:.5,brow:.2});
 assert.equal(animator.getState().v79ActionUnitChannels,20);
 assert.equal(animator.getState().v79ManualActionUnits.smile,.5);
 assert.equal(animator.getState().v76FacialSculptNormalsPreserved,true);
 assert.equal(animator.getState().v76ExpressionKeepsSmoothShading,true);
 animator.setExpression('neutral');
 assert.deepEqual(split.getAttribute('normal').array,normals);
 assert.deepEqual(split.getAttribute('position').array,rest,
  'Returning to neutral must not accumulate facial distortion');
 animator.dispose();
 split.dispose();face.material.dispose();
});
