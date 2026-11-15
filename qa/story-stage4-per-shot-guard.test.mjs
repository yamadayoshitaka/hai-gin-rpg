#!/usr/bin/env node
/* Stage 4 per-shot provenance and 800px native size regression.
 * This does not certify actual image pixels or automatically approve art.
 */
import assert from 'node:assert/strict';
import {buildStage45ArtPrompt} from '../src/story-c01-stage45-art-guard.js';
import {readFileSync} from 'node:fs';

const manifest=JSON.parse(readFileSync(new URL('../assets/story/stage-manifests/c01-s04.manifest.json',import.meta.url),'utf8'));
assert.deepEqual(manifest.generatorRequestSizing.nativeFrameMinimum,[800,450]);
assert.deepEqual(manifest.generatorRequestSizing.nativeFramePreferred,[1024,576]);
assert.equal(manifest.generatorRequestSizing.separateGenerationPerShot,true);
assert.equal(manifest.manualQARequirements.rejectUnexpectedMultiPanelOutput,true);
assert.equal(manifest.manualQARequirements.prohibitsAutoApproval,true);

const actors={lucia:'Silver-haired regent in navy fur-trimmed robes',garan:'Older gray-bearded armored knight',iris:'Hooded healer with pale ceremonial clothing'};
const make=(id,actorIds)=>{
 const gender='female',styleRef={path:'assets/story/chapters/c01/panels/c01-s01-m02-female.webp',sha:'a'.repeat(64),gender};
 const shot={id,subtitleText:'Canonical authored event: '+id,kind:'dialogue',scenery:'wilds',expression:'thoughtful',
  visualDirection:manifest.perShotCameraDirections[id]};
 return buildStage45ArtPrompt({stageId:'c01-s04',stageName:'森と遺構の調査',edition:'pre',gender,shot,
   actorRefs:actorIds.map(id=>({id,path:'assets/story/'+id+'.webp',sha:'f'.repeat(64),rule:actors[id]})),
   stageStory:'A forest ruin clue linked to an executed bell-keeper; no battle result yet.',styleRef});
};
const m2=make('c01-s04-m2',['lucia','garan']);
const m4=make('c01-s04-m4',['lucia','iris']);
assert.match(m2,/P0 UNIQUE SHOT DIRECTION/);
assert.match(m2,/medium two-shot/i);
assert.match(m2,/lucia, garan/i);
assert.doesNotMatch(m2,/iris shows/i);
assert.match(m4,/BLANK missing-names death registry/);
assert.match(m4,/TWO women ONLY/i);
assert.match(m4,/lucia, iris/i);
assert.doesNotMatch(m4,/P0 VISIBLE CAST STRICT = lucia, garan/i);
for(const prompt of [m2,m4]){
 assert.match(prompt,/>=800x450/);
 assert.match(prompt,/do not auto-approve/i);
 assert.match(prompt,/never repeat their scenery/i);
 assert.match(prompt,/do not turn a one-frame shot into a diptych/i);
 assert.doesNotMatch(prompt,/native original frame at >=1536x864/);
}
console.log('PASS: separate Stage 4 m2/m4 per-shot directing, cast, native 800 threshold, no collage; raster review pending.');
