import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {FEMALE_MAKEUP_STRENGTH,v67NaturalEyeMakeup}
 from '../src/face-feature-meshes.js';
import {femaleInnerFeatureDelta} from '../src/independent-face-masters.js';
import {makeStyleSpecificHair} from '../src/face-wig-ornaments-v49.js';
import {catalogHairGroom,groomGuideOffset} from '../src/face-hair-groom-v50.js';

test('female cosmetics receive fivefold pigment without applying makeup to men',()=>{
 assert.equal(FEMALE_MAKEUP_STRENGTH,5);
 const params={nx:.123,ny:.725,lidY:.695,front:1};
 const female=v67NaturalEyeMakeup({...params,gender:'female'});
 const male=v67NaturalEyeMakeup({...params,gender:'male'});
 const rear=v67NaturalEyeMakeup({...params,gender:'female',front:0});
 assert.ok(female.shadow>.80&&female.shadow<=.94,'fivefold cosmetics must cover the real upper eyelid');
 assert.ok(v67NaturalEyeMakeup({...params,nx:.346,gender:'female'}).shadow<.02,'pigment must fade before the outer cheek');
 assert.equal(male.shadow,0);
 assert.equal(rear.shadow,0);
 const sculpt=readFileSync(new URL('../src/face-feature-meshes.js',import.meta.url),'utf8');
 assert.match(sculpt,/const halfWidth=d\.x\*\(female\?\.057:\.044\)/,'female lip surface must grow without changing male mouth');
 assert.match(sculpt,/const mouthX=.*d\.x\*\.066\*settings\.lipstickWidth/,'lip pigment follows the widened mouth');
 assert.match(sculpt,/const anatomicalLipX=.*d\.x\*\.073\*/s,'wider lip tint stays inside the anatomical mouth');
 assert.match(sculpt,/cosmeticOpacity\(\.32\)\*fadeU\*fadeV/,'full vermilion tint');
 assert.match(sculpt,/cosmeticOpacity\(\.64\)\*bell\(nx/,'cheek makeup must receive the same multiplier');
 assert.match(sculpt,/noseBridgeContour/,'nose contours are restricted to the real face skin');
});
test('nose ridge is sculpted centrally but remains local to face',()=>{
 const controls={noseTipLift:0,nostrilCover:2,noseBridgeSharpness:2.5};
 const delta=(xn)=>femaleInnerFeatureDelta({xn,yn:.65,zn:.9,offsetX:.02,depth:.2,height:.3,controls});
 assert.ok(delta(0).dz>delta(.12).dz+.003,'nose ridge needs a defined frontal highlight plane');
 assert.equal(delta(.3).dz,0,'nose cannot deform cheeks');
 assert.equal(delta(-.12).dz,delta(.12).dz);
});
test('both braids are scalp rooted, woven continuously and end in a tapered closed tip',()=>{
 const box=new THREE.Box3(new THREE.Vector3(-.5,0,-.5),new THREE.Vector3(.5,1,.5));
 const anchors=[-1,1].map(side=>new THREE.Vector3(side*.30,.75,-.26));
 const hair=makeStyleSpecificHair('female-twin-braids',box,new THREE.Color(0x874a3d),
  {scalpCandidates:anchors});
 const strands=hair.meshes.filter(mesh=>mesh.name.startsWith('BRAID_INTERLEAVED_STRAND_'));
 assert.equal(strands.length,6);
 for(const mesh of strands){
  assert.equal(mesh.userData.braidScalpAnchor,'real-scalp-vertex');
  assert.equal(mesh.userData.braidContinuousFromScalp,true);
  const side=Number(mesh.name.split('_')[3]);
  const root=anchors.find(v=>Math.sign(v.x)===side);
  const p=mesh.geometry.getAttribute('position');
  const first=new THREE.Vector3().fromBufferAttribute(p,0);
  assert.ok(first.distanceTo(root)<.023,'braid floats away from anatomical scalp');
  const n=p.count,tip=new THREE.Vector3().fromBufferAttribute(p,n-1);
  let firstRadius=0,lastRadius=0;
  for(let k=0;k<8;k++){
   firstRadius+=new THREE.Vector3().fromBufferAttribute(p,k).distanceTo(root)/8;
   lastRadius+=new THREE.Vector3().fromBufferAttribute(p,n-9+k).distanceTo(tip)/8;
  }
  assert.ok(lastRadius<firstRadius*.20,'braid ends are blunt/rounded instead of tapered');
  assert.ok(mesh.geometry.index.count>32*8*6,'tip cap missing');
 }
 for(const mesh of hair.meshes){mesh.geometry.dispose();mesh.material.dispose();}
});
test('pointed groom guides ease toward the tip instead of forming bulbous spikes',()=>{
 const profile=catalogHairGroom('male-short-spiky');
 const mid=groomGuideOffset(profile,{t:.75,zone:'crown',partSide:1});
 const end=groomGuideOffset(profile,{t:1,zone:'crown',partSide:1});
 assert.ok(mid.y>0&&end.y>0);
 assert.ok(end.y<mid.y*1.1,'blunt protruding terminal spike');
 assert.deepEqual(groomGuideOffset(profile,{t:0,zone:'crown',partSide:1}),{x:0,y:0,z:0});
});
