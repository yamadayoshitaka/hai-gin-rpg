import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {installGreyWolfActions} from '../src/grey-wolf-action-runtime.js';

function createWolfHarness(){
 const root=new THREE.Group();root.userData={};
 const source=new THREE.Group();source.name='OriginalLicensedWolfSource';
 root.add(source);
 const limbNames=['front_leg.L','front_leg.R','hind_thigh.L','hind_thigh.R'];
 const bones=limbNames.map(name=>{
  const bone=new THREE.Bone();bone.name=name;
  bone.position.x=name.endsWith('.L')?-.2:.2;
  source.add(bone);return bone;
 });
 const native=[];
 const handle={
  root,clips:['metarig.002|eating','metarig.002|IDLE','metarig.002|RRAR','metarig.002|SLEEP'],
  play(action,options){native.push({action,options});return true},
  update(dt){native.push({dt})},
  dispose(){native.push({dispose:true})}
 };
 installGreyWolfActions(handle);
 return {handle,bones,root,native};
}
test('real licensed wolf keeps original source, adds only a transform pivot',()=>{
 const {handle,root,bones,native}=createWolfHarness();
 assert.equal(root.userData.greyWolfActions,true);
 assert.equal(root.userData.greyWolfRuntimeState.meshAdditions,0);
 assert.equal(root.children.length,1);
 assert.equal(root.children[0].name,'grey-wolf-pose-pivot');
 assert.equal(root.children[0].children[0].name,'OriginalLicensedWolfSource');
 assert.equal(root.userData.greyWolfRuntimeState.joints,4);
 assert.equal(native[0].action,'idle');
 assert.ok(bones.every(b=>b.isBone));
 handle.dispose();
 assert.equal(native.at(-1).dispose,true);
});
test('walk and run articulate existing source bones and never accumulate drift',()=>{
 const {handle,root,bones}=createWolfHarness();
 handle.play('walk');handle.update(.08);
 assert.equal(root.userData.greyWolfRuntimeState.action,'walk');
 assert.equal(root.userData.greyWolfRuntimeState.sourceAction,'idle');
 assert.ok(bones.some(b=>Math.abs(b.quaternion.x)>.001),'walk must move native limb bones');
 const pivot=root.children[0];
 assert.ok(pivot.position.y>1);
 handle.play('run');handle.update(.08);
 assert.equal(root.userData.greyWolfRuntimeState.action,'run');
 assert.ok(bones.every(b=>Math.abs(b.quaternion.length()-1)<1e-6));
 for(let i=0;i<600;i++)handle.update(1/60);
 assert.ok(bones.every(b=>Math.abs(b.quaternion.length()-1)<1e-6));
 assert.equal(root.userData.greyWolfRuntimeState.meshAdditions,0);
 handle.play('idle');handle.update(.05);
 assert.ok(bones.every(b=>Math.abs(b.quaternion.x)<1e-6));
 handle.dispose();
});
test('RRAR powers attack/roar, hit has short pose, SLEEP terminates defeat',()=>{
 const {handle,root,native}=createWolfHarness();
 for(const action of ['attack','roar','special']){
  handle.play(action,{restart:true});handle.update(.15);
  assert.equal(root.userData.greyWolfRuntimeState.sourceAction,'roar');
  assert.equal(native.filter(x=>x.action==='roar').length>=1,true);
  for(let i=0;i<30;i++)handle.update(.05);
  assert.equal(root.userData.greyWolfRuntimeState.action,'idle');
 }
 handle.play('hit');handle.update(.15);
 assert.ok(Math.abs(root.children[0].rotation.x)>.001);
 for(let i=0;i<15;i++)handle.update(.05);
 assert.equal(root.userData.greyWolfRuntimeState.action,'idle');
 handle.play('defeat');for(let i=0;i<4;i++)handle.update(.1);
 assert.equal(root.userData.greyWolfRuntimeState.sourceAction,'defeat');
 assert.ok(root.children[0].rotation.z>.1);
 for(let i=0;i<50;i++)handle.update(.05);
 assert.equal(root.userData.greyWolfRuntimeState.action,'defeat');
 assert.equal(root.userData.greyWolfRuntimeState.meshAdditions,0);
 handle.dispose();
});
