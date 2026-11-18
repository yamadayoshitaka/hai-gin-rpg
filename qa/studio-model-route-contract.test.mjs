import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CHARACTER_QUALITY_SIX_LANES} from '../src/character-system/character-quality-six-lanes.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const face=read('face-mesh-studio.html');
const wardrobe=read('outfit-maintenance.html');
const body=read('face-body-studio.html');
const male=read('male-body-studio.html');
const rigged=read('src/character-system/rigged-outfit-runtime.js');
const game=read('tactics-wireframe.html');
const faceHair=CHARACTER_QUALITY_SIX_LANES.faceHair.gamePipeline;
const outfit=CHARACTER_QUALITY_SIX_LANES.outfit.gamePipeline;

test('phone face/hair editor actual procedural sources are mandatory batch inputs',()=>{
 for(const p of [
  'face-mesh-studio.html','face-body-studio.html','male-body-studio.html',
  'src/face-scalp-wig.js','src/independent-face-masters.js',
  'src/face-feature-meshes.js','src/face-wig-styles.js',
  'src/character-system/hair-attachment-runtime.js'
 ])assert.ok(faceHair.includes(p),p+' absent from batch fingerprint');
 assert.match(face,/from '\.\/src\/face-scalp-wig\.js\?v=[^']+'/);
 assert.match(face,/from '\.\/src\/independent-face-masters\.js\?v=[^']+'/);
 assert.match(face,/from '\.\/src\/face-feature-meshes\.js\?v=[^']+'/);
 assert.match(face,/createScalpAnchoredWig\(models\.get\('female'\)\.face/);
 assert.match(face,/createScalpAnchoredWig\(models\.get\('male'\)\.face/);
 assert.match(face,/makeIndependentFaceMaster\(femaleSource\.scene,'female'/);
 assert.match(face,/makeIndependentFaceMaster\(femaleSource\.scene,'male'/);
 assert.match(face,/id="quickWigStyle"/);
 assert.match(face,/id="faceExpression"/);
 assert.match(body,/face-mesh-studio\.html/);
 assert.match(male,/heroine-battle-costume-bridge\.js/);
});

test('17-job outfit preview and real battle production generators are both monitored',()=>{
 for(const p of [
  'outfit-maintenance.html','src/outfit-maintenance-model.js',
  'src/character-system/rigged-outfit-runtime.js',
  'src/character-system/garment-coverage-runtime.js',
  'tactics-wireframe.html'
 ])assert.ok(outfit.includes(p),p+' absent from batch fingerprint');
 assert.match(wardrobe,/from '\.\/src\/outfit-maintenance-model\.js\?v=[^']+'/);
 assert.match(wardrobe,/import\('\.\/src\/character-system\/rigged-outfit-runtime\.js\?v=[^']+'\)/);
 assert.match(wardrobe,/buildRiggedJobOutfit\(\{characterModel:body,parent:scene,job,sex,rarity\}\)/);
 assert.match(rigged,/from '\.\.\/outfit-maintenance-model\.js\?v=[^']+'/);
 assert.match(rigged,/from '\.\/garment-coverage-runtime\.js\?v=[^']+'/);
 assert.match(rigged,/from '\.\/hair-attachment-runtime\.js\?v=[^']+'/);
 assert.match(game,/rigged-outfit-runtime\.js/);
 assert.match(game,/buildRiggedJobOutfit/);
});

test('studio and battle remain separate 3D implementations; QA must protect both',()=>{
 assert.notEqual('src/face-scalp-wig.js','src/character-system/hair-attachment-runtime.js');
 assert.ok(faceHair.includes('src/face-scalp-wig.js'));
 assert.ok(faceHair.includes('src/character-system/hair-attachment-runtime.js'));
 assert.ok(faceHair.includes('tactics-wireframe.html'));
 assert.ok(outfit.includes('src/character-system/battle-visual-pipeline.js'));
 const batch=read('scripts/character-six-batch.mjs');
 assert.match(batch,/qa\/studio-model-route-contract\.test\.mjs/);
 assert.match(batch,/missingSources\.length/);
 assert.match(batch,/previewSourcePaths,battleSourcePaths/);
});
