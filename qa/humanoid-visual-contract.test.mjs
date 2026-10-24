import test from 'node:test';
import assert from 'node:assert/strict';
import {checkHumanoidManifest,checkArmDirections,HUMANOID_VISUAL_CONTRACT} from '../src/humanoid-visual-contract.js';
const names=[...HUMANOID_VISUAL_CONTRACT.requiredBones];
test('valid rig and height accepted',()=>{assert.equal(checkHumanoidManifest({boneNames:names,skinnedMeshCount:4,modelHeight:1.4,targetHeight:1.4}).valid,true)});
test('wrong bone and giant height rejected',()=>{const result=checkHumanoidManifest({boneNames:['neck_01'],skinnedMeshCount:0,modelHeight:5.8,targetHeight:1.4});assert.equal(result.valid,false);assert.ok(result.problems.includes('height-mismatch'))});
test('T pose rejected and downward arms accepted',()=>{
 const bones=new Map([['upperarm_l','l'],['lowerarm_l','ll'],['upperarm_r','r'],['lowerarm_r','rr']]);
 const point={l:{x:-.25,y:1.4,z:0},ll:{x:-.6,y:1.4,z:0},r:{x:.25,y:1.4,z:0},rr:{x:.6,y:1.4,z:0}};
 assert.equal(checkArmDirections(bones,b=>point[b]).valid,false);
 point.ll={x:-.30,y:1.05,z:0};point.rr={x:.30,y:1.05,z:0};
 assert.equal(checkArmDirections(bones,b=>point[b]).valid,true);
});
