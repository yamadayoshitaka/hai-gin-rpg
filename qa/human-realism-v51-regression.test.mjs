import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {BODY_PROFILES,resolveBodyType,applyDemographicFaceControls}
 from '../src/character-demographics-v47.js';
import {applySkinnedBuildMorph} from '../src/body-build-morph-v48.js';
import {enhanceStudioBodyMaterials,syncStudioBodyOutfitVisibility,
 HEROINE_STUDIO_HEAD_LIFT,HEROINE_STUDIO_HEAD_FORWARD,fitStudioCuirassBelowChin,
 alignStudioHeadToSkinnedTorso}
 from '../src/heroine-battle-costume-bridge.js';
import {applyHeroineSkinMaterial} from '../src/heroine-skin-material.js';

test('normal human build stays standard-width but has slimmer skinned legs and softer cheeks',()=>{
 assert.equal(BODY_PROFILES.normal.width,1);
 assert.equal(BODY_PROFILES.normal.depth,1);
 assert.ok(BODY_PROFILES.normal.legRadius<1);
 assert.ok(BODY_PROFILES.thin.legRadius<BODY_PROFILES.normal.legRadius);
 assert.ok(BODY_PROFILES.fat.legRadius>BODY_PROFILES.normal.legRadius);
 assert.ok(BODY_PROFILES.normal.faceFullness>0);
 const shape=applyDemographicFaceControls({eyeWidth:1,eyeHeight:1,faceMorph:0},
  'twenties','normal','female');
 assert.ok(shape.faceMorph>0);
 assert.equal(resolveBodyType('average').id,'normal');
});

test('skinned legs taper around each leg axis and reselect without accumulating vertex errors',()=>{
 const actor=new THREE.Group();
 const legs=new THREE.SkinnedMesh(
  new THREE.BoxGeometry(1,1,.4,8,14,8),
  new THREE.MeshStandardMaterial({color:0xd2a28a}));
 legs.name='Female_Ranger_Legs';
 actor.add(legs);
 const originalGeometry=legs.geometry;
 const before=originalGeometry.getAttribute('position').array.slice();
 const first=applySkinnedBuildMorph(actor,'normal');
 assert.ok(first.meshes>=1);
 assert.equal(first.legRadius,BODY_PROFILES.normal.legRadius);
 assert.notEqual(legs.geometry,originalGeometry,'cache/source mesh untouched');
 const normal=legs.geometry.getAttribute('position').array.slice();
 const farthest=array=>Math.max(...Array.from({length:array.length/3},(_,i)=>Math.abs(array[i*3])));
 assert.ok(farthest(normal)<farthest(before),'normal leg silhouettes should narrow');
 applySkinnedBuildMorph(actor,'fat');
 const fuller=legs.geometry.getAttribute('position').array.slice();
 assert.ok(farthest(fuller)>farthest(normal));
 applySkinnedBuildMorph(actor,'normal');
 assert.deepEqual(legs.geometry.getAttribute('position').array,normal,
  'normal -> fat -> normal must produce identical geometry');
 assert.deepEqual(originalGeometry.getAttribute('position').array,before,
  'shared GLTF source geometry remains unchanged');
 actor.clear();
 originalGeometry.dispose();
 legs.geometry.dispose();legs.material.dispose();
});

test('hiding outfit restores the full unclothed torso, without resurrecting old eyes',()=>{
 const torso={name:'Female_Ranger_Torso',isSkinnedMesh:true,visible:false};
 const arms={name:'Female_Ranger_Arms',isSkinnedMesh:true,visible:false};
 const eyes={name:'Eyes',isSkinnedMesh:true,visible:true};
 const model={traverse(callback){[torso,arms,eyes].forEach(callback)}};
 const history=[];
 const outfit={root:{visible:true},setBodyOcclusion(mask){history.push(mask)}};
 const hidden=syncStudioBodyOutfitVisibility(model,outfit,
  {showBody:true,showOutfit:false});
 assert.deepEqual(hidden,{bodyVisible:true,outfitVisible:false,bodyOccludedByGarment:false});
 assert.equal(outfit.root.visible,false);
 assert.ok(torso.visible&&arms.visible,'body meshes must remain visible');
 assert.equal(eyes.visible,false,'donor eyes never return');
 assert.equal(history.at(-1),false,'unclothed body geometry restored');
 const clothed=syncStudioBodyOutfitVisibility(model,outfit,
  {showBody:true,showOutfit:true});
 assert.equal(clothed.bodyOccludedByGarment,true);
 assert.equal(history.at(-1),true);
 assert.equal(outfit.root.visible,true);
 syncStudioBodyOutfitVisibility(model,outfit,{showBody:false,showOutfit:true});
 assert.equal(torso.visible,false);
 assert.equal(outfit.root.visible,false);
});

test('human skin surface clones skin materials while preserving source maps',()=>{
 const actor=new THREE.Group();
 const texture=new THREE.Texture();
 const original=new THREE.MeshStandardMaterial({roughness:.98,metalness:.1,map:texture});
 original.name='body-skin';
 const arms=new THREE.SkinnedMesh(new THREE.BoxGeometry(.1,.3,.1,3,3,3),original);
 arms.name='Female_Ranger_Arms';
 actor.add(arms);
 const report=enhanceStudioBodyMaterials(actor);
 assert.ok(report.skinMaterials>0);
 assert.equal(arms.material.map,texture);
 assert.equal(original.roughness,.98);
 assert.equal(original.metalness,.1);
 assert.ok(arms.material.roughness>=.64&&arms.material.roughness<=.78);
 assert.equal(arms.material.metalness,0);
 const face=new THREE.Mesh(new THREE.SphereGeometry(.3,8,8),
  new THREE.MeshStandardMaterial({map:texture,roughness:.92}));
 assert.equal(applyHeroineSkinMaterial(face).applied,true);
 assert.equal(face.material.map,texture);
 assert.equal(face.material.roughness,.74);
 assert.equal(applyHeroineSkinMaterial(face).reused,true);
 actor.clear();
 arms.geometry.dispose();arms.material.dispose();original.dispose();
 face.geometry.dispose();face.material.dispose();texture.dispose();
});

test('neck correction and donor face clipping occur before garment coverage caching',()=>{
 assert.ok(HEROINE_STUDIO_HEAD_LIFT>=.26&&HEROINE_STUDIO_HEAD_LIFT<=.45);
 assert.ok(HEROINE_STUDIO_HEAD_FORWARD>=.12&&HEROINE_STUDIO_HEAD_FORWARD<=.20);
 const bridge=readFileSync(new URL('../src/heroine-battle-costume-bridge.js',import.meta.url),'utf8');
 const cut=bridge.indexOf('const cut=hideBattleDonorFace(fresh.model);');
 const garment=bridge.indexOf('clothing=await buildRiggedJobOutfit(');
 assert.ok(cut>=0&&garment>cut,'face cut must precede coverage cache');
 assert.ok(bridge.includes('outfit?.setBodyOcclusion?.('));
});

test('studio cuirass follows real chin landmark rather than obscuring eyes and mouth',()=>{
 const actor=new THREE.Group();
 const face=new THREE.Mesh(new THREE.SphereGeometry(.13,16,16),
  new THREE.MeshStandardMaterial());
 face.position.set(0,1.42,.10);actor.add(face);
 const outfit=new THREE.Group();actor.add(outfit);
 const source=new THREE.BoxGeometry(.50,.68,.20,4,8,4);
 const chest=new THREE.Mesh(source,new THREE.MeshStandardMaterial());
 chest.position.set(0,1.30,.11);
 chest.userData={equipmentClass:'armor',equipmentSlot:'chest'};
 outfit.add(chest);
 const decoration=new THREE.Mesh(new THREE.BoxGeometry(.05,.08,.05),
  new THREE.MeshStandardMaterial());
 decoration.position.set(.2,1.50,.12);
 decoration.userData={equipmentClass:'armor',equipmentSlot:'shoulder'};
 outfit.add(decoration);
 const original=source.getAttribute('position').array.slice();
 const shoulderGeometry=decoration.geometry;
 const report=fitStudioCuirassBelowChin({faceMesh:face,wardrobeRoot:outfit});
 assert.equal(report.applied,true);
 assert.equal(report.chestPieces,1);
 assert.equal(report.compressed,true);
 assert.ok(report.compressionRatio<1);
 assert.ok(report.correctedTopY<=report.chinY-.008,
  'the chest metal must end below the chin, not across the mouth');
 assert.equal(chest.geometry===source,false,'preview owns a geometry clone');
 assert.deepEqual(source.getAttribute('position').array,original,
  'original armor GLB vertices stay identical');
 assert.equal(decoration.geometry,shoulderGeometry,
  'no unrelated shoulder, blade or hair mesh is modified');
 const refitted=fitStudioCuirassBelowChin({faceMesh:face,wardrobeRoot:outfit});
 assert.ok(Math.abs(refitted.compressionRatio-report.compressionRatio)<1e-6);
 assert.ok(Math.abs(refitted.correctedTopY-report.correctedTopY)<1e-6,
  'repeated fits restore source instead of flattening geometry cumulatively');
 face.position.y-=.05;
 const younger=fitStudioCuirassBelowChin({faceMesh:face,wardrobeRoot:outfit});
 assert.ok(younger.compressionRatio<report.compressionRatio,
  'moving the chin lower forces the cuirass below it on age changes');
 assert.ok(younger.correctedTopY<=younger.chinY-.008);
 assert.deepEqual(source.getAttribute('position').array,original);
 face.geometry.dispose();face.material.dispose();source.dispose();
 chest.geometry.dispose();chest.material.dispose();
 shoulderGeometry.dispose();decoration.material.dispose();
});

test('cloth-only outfits never trigger armor neck morph or deform the face',()=>{
 const face=new THREE.Mesh(new THREE.SphereGeometry(.10,8,8),new THREE.MeshStandardMaterial());
 const wardrobe=new THREE.Group();
 const before=face.geometry.getAttribute('position').array.slice();
 const result=fitStudioCuirassBelowChin({faceMesh:face,wardrobeRoot:wardrobe});
 assert.equal(result.applied,false);
 assert.equal(result.reason,'no-chest-armor');
 assert.deepEqual(face.geometry.getAttribute('position').array,before);
 face.geometry.dispose();face.material.dispose();
});

test('real skinned torso neckline, not armor, sets whole head height without stacking lifts',()=>{
 const actor=new THREE.Group();actor.scale.setScalar(.84);
 const headBone=new THREE.Bone();headBone.name='head';actor.add(headBone);
 const faceRoot=new THREE.Group();headBone.add(faceRoot);
 const face=new THREE.Mesh(new THREE.BoxGeometry(.17,.24,.14),new THREE.MeshStandardMaterial());
 face.position.y=1.30;faceRoot.add(face);
 const wardrobe=new THREE.Group();actor.add(wardrobe);
 const torsoGeometry=new THREE.BoxGeometry(.34,.60,.25);
 const torso=new THREE.SkinnedMesh(torsoGeometry,new THREE.MeshStandardMaterial());
 torso.name='Female_Ranger_Body';torso.position.y=1.24;wardrobe.add(torso);
 actor.updateWorldMatrix(true,true);
 const sourcePosition=face.geometry.getAttribute('position').array.slice();
 const before=new THREE.Box3().setFromObject(face).min.y;
 const first=alignStudioHeadToSkinnedTorso({faceRoot,faceMesh:face,wardrobeRoot:wardrobe});
 assert.equal(first.applied,true);
 assert.equal(first.torsoMeshes,1);
 assert.ok(first.appliedLift>.05&&first.appliedLift<.28);
 assert.ok(first.faceBottomAfterY>=first.torsoNeckTopY+.007);
 const second=alignStudioHeadToSkinnedTorso({faceRoot,faceMesh:face,wardrobeRoot:wardrobe});
 assert.ok(second.appliedLift<1e-5,'fitting twice cannot accumulate head lift');
 assert.ok(Math.abs(second.faceBottomAfterY-first.faceBottomAfterY)<1e-5);
 assert.deepEqual(face.geometry.getAttribute('position').array,sourcePosition,
  'head geometry remains original while whole root moves');
 assert.ok(first.faceBottomAfterY>before);
 face.geometry.dispose();face.material.dispose();
 torsoGeometry.dispose();torso.material.dispose();
});

test('head alignment is also applied before cuirass fit and after animation pose',()=>{
 const source=readFileSync(new URL('../src/heroine-battle-costume-bridge.js',import.meta.url),'utf8');
 const facePos=source.indexOf('headRoot.position.set(',source.indexOf('function applyBodyShape()'));
 const align=source.indexOf('alignStudioHeadToSkinnedTorso({',facePos);
 const armor=source.indexOf('fitStudioCuirassBelowChin({',facePos);
 assert.ok(facePos>=0&&align>facePos&&armor>align,
  'face must be aligned to actual torso before the metal gets clipped');
 assert.match(source,/actor.update\(dt\);outfit\?\.sync\(\);[\s\S]*alignStudioHeadToSkinnedTorso/);
});
