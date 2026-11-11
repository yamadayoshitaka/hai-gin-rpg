import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mangaForStage} from '../src/story-stage-manga.js';
import {individualStoryPanelAsset} from '../src/story-cinematic-assets.js';
import {storyStageContext} from '../src/story-narrative-flow.js';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';

const town=await readFile(new URL('../town-hub.html',import.meta.url),'utf8');
const engine=await readFile(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const title=await readFile(new URL('../game.html',import.meta.url),'utf8');
const maintenance=await readFile(new URL('../story-maintenance.html',import.meta.url),'utf8');
for(const id of ['townRadar','townRadarCanvas','townRadarPins','townRadarPlayer','previewGender']){
 assert.ok((town+maintenance).includes('id="'+id+'"'),'Missing town/map/gender UI: '+id);
}
assert.ok(town.includes("townRadarHeader').onclick"),'Radar must open the overview');
assert.ok(town.includes("sendTown('hai-gin-town-enter-facility',{facilityId})"),
 'Building selection must request real 3D entry');
assert.ok(town.includes("if(data.type==='hai-gin-town-entered')"),
 'Map must not claim entry before the 3D engine acknowledges it');
assert.ok(engine.includes("data.type==='hai-gin-town-enter-facility'"));
assert.ok(engine.includes('townEnterBuilding(building)'),
 'Minimap must use the existing physical indoor scene, not a substitute menu');
assert.ok(engine.includes('townLeaveBuilding()'),'Building switching must leave the old interior first');
assert.ok(town.includes('townMapImage'),'Radar should display the authoritative 3D town overview');
assert.ok(title.includes('getSavedGame(localStorage)?.campaign?.commander?.gender'));

const femaleContext={protagonistGender:'female'};
const maleContext={protagonistGender:'male'};
const introFemale=mangaForStage('c01-s01',femaleContext).panels;
const introMale=mangaForStage('c01-s01',maleContext).panels;
assert.equal(introFemale.length,10);
assert.equal(introFemale[0].protagonistGender,'female');
assert.equal(individualStoryPanelAsset(introFemale[0]),'./assets/story/panels/c01-s01-m01-female.webp');
assert.equal(individualStoryPanelAsset(introMale[0]),'./assets/story/panels/c01-s01-m01.webp');
assert.equal(individualStoryPanelAsset(introFemale[4]),individualStoryPanelAsset(introMale[4]),
 'Only a verified gender-neutral seal image can be shared');

const heroFemale={campaign:{commander:{gender:'female'}}},heroMale={campaign:{commander:{gender:'male'}}};
assert.equal(storyStageContext(heroFemale,'c13-s01').protagonistGender,'female');
assert.equal(storyStageContext(heroMale,'c13-s01').protagonistGender,'male');
for(const stage of CAMPAIGN_STAGES){
 const female=mangaForStage(stage.id,femaleContext),male=mangaForStage(stage.id,maleContext);
 for(let p=0;p<7;p++){
  assert.equal(female.panels[p].id,male.panels[p].id);
  assert.equal(female.panels[p].text,male.panels[p].text);
  assert.equal(female.panels[p].protagonistGender,'female');
 }
}
for(const path of ['assets/story/panels/c01-s01-m01-female.webp','assets/story/characters/commander/female-master.webp']){
 const bytes=await readFile(new URL('../'+path,import.meta.url));
 assert.equal(bytes.toString('ascii',0,4),'RIFF');
 assert.equal(bytes.toString('ascii',8,12),'WEBP');
 assert.ok(bytes.length>30000,'Female master/art must not be a placeholder');
}
const maleBytes=await readFile(new URL('../assets/story/panels/c01-s01-m01.webp',import.meta.url));
const femaleBytes=await readFile(new URL('../assets/story/panels/c01-s01-m01-female.webp',import.meta.url));
assert.ok(maleBytes.length>=180000&&femaleBytes.length>=180000,'original 960x540 male/female paintings must remain full resolution');
assert.notEqual(createHash('sha256').update(maleBytes).digest('hex'),
 createHash('sha256').update(femaleBytes).digest('hex'),
 'male and female arrival paintings must be separately illustrated');
const assetSource=await readFile(new URL('../src/story-cinematic-assets.js',import.meta.url),'utf8');
assert.match(assetSource,/panelrev=20261111-levna-arrival-v2/,'mobile WebP cache must refresh');
console.log('PASS town radar direct-entry, 2000 gender-safe IDs, and two distinct original male/female Chapter 1 arrival paintings');
