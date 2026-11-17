import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const get=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const page=get('tactics-wireframe.html'),pipeline=get('character-quality-pipeline.html'),
 outfit=get('src/character-system/rigged-outfit-runtime.js'),
 model=get('src/outfit-maintenance-model.js'),
 face=get('src/character-system/battle-artist-head-graft.js'),
 mass=get('src/mass-battle-real-army.js'),
 contract=get('src/character-system/battle-visual-pipeline.js');
assert.doesNotMatch(model,/add\('complete-back-tunic-lining'/,
 'old rectangular back sheet must not be generated');
assert.match(model,/imported Ranger\/Peasant torso is already a real 65-bone garment/,
 'real skinned clothing replaces procedural cardboard covering');
assert.match(outfit,/const closedBack=battleClosedBackCoverage\(\{/);
assert.match(outfit,/forceCoveredRegions:forcedTorsoOcclusion/);
assert.doesNotMatch(outfit,/thiefHasClosedBack\?\['torso'\]/);
assert.match(outfit,/closedBackPanelSkinned:closedBack\.closed/);
assert.match(outfit,/function getHairState\(\)/);
assert.match(page,/window\.getBattleCharacterPipelineReport=\(\)=>auditBattleCharacterPipeline/);
assert.match(page,/ensureBattleScalpCoverage\(next\)/);
assert.match(page,/ensureBattleScalpCoverage\(a\)/);
assert.match(mass,/scalp\.after\.source==='missing'/);
assert.match(mass,/equipBattleStudioHair\(representative\.masterHead/);
assert.match(mass,/ハゲ軍団への焼き込みを中断します/);
assert.match(mass,/quality:'near',hero:false/,
 'mass GPU source uses dense groom fitted to new sculpt rather than old donor');
assert.match(face,/faceContour = smoothstep/);
assert.match(face,/battleFaceContourStrength=\.105/);
assert.match(face,/BATTLE_FACE_LIGHT_RESPONSE_VERSION='battle-face-light-response-v5-face-contour'/);
assert.match(contract,/sourceSteps:\[/);
assert.match(pipeline,/getBattleCharacterPipelineReport/);
assert.match(pipeline,/getBattleStartupStats/);
assert.match(pipeline,/army=/);
for(const target of ['master-model-manager.html','face-body-studio.html',
  'action-test.html','model-validation.html','tactics-wireframe.html'])
 assert.match(pipeline,new RegExp(target.replace('.','\\.')),'pipeline reference '+target);
const script=pipeline.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'pipeline must have a real browser inspection script');
assert.doesNotThrow(()=>new vm.Script(script));
assert.match(get('master-model-manager.html'),/character-quality-pipeline\.html/);
console.log('PASS: actual skinned 17-job garments without backboards, head shadows, scalp pipeline, mobile inspection');
