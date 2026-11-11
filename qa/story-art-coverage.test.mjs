import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {mangaForStage} from '../src/story-stage-manga.js';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
import {storyBackdropPolicy,individualStoryPanelAsset} from '../src/story-cinematic-assets.js';
const report=JSON.parse(await fs.readFile(new URL('../assets/story/panel-art-coverage.json',import.meta.url),'utf8'));
const list=JSON.parse(await fs.readFile(new URL('../qa-reports/story-art-shotlist.json',import.meta.url),'utf8'));
assert.equal(report.stats.totalPanels,2000);
assert.equal(report.stats.totalStages,200);
assert.equal(report.byChapter.length,20);
assert.equal(report.byChapter.reduce((n,c)=>n+c.total,0),2000);
assert.equal(report.stats.maleDedicated+report.stats.maleMissing,2000);
assert.equal(report.stats.femaleUsable+report.stats.femaleMissing,2000);
assert.equal(report.stats.femaleUsable,report.stats.femaleSpecific+report.stats.genderNeutralShared);
assert.equal(list.pending.length,report.stats.maleMissing+report.stats.femaleMissing);
assert.equal(storyBackdropPolicy({protagonistGender:'male'}),'chapter-composite');
assert.equal(storyBackdropPolicy({protagonistGender:'female'}),'npc-portrait-neutral-scene');
assert.equal(storyBackdropPolicy({protagonistGender:'unspecified'}),'npc-portrait-neutral-scene');
assert.ok((await fs.readFile(new URL('../src/story-cinematic-assets.js',import.meta.url),'utf8')).includes('paintNeutralStoryBackdrop(ctx,panel)'));
const ids=new Set();
for(const stage of CAMPAIGN_STAGES){
 for(const p of mangaForStage(stage.id,{protagonistGender:'female'}).panels){
  assert.ok(!ids.has(p.id));ids.add(p.id);
  const path=individualStoryPanelAsset(p);
  assert.ok(path.endsWith('-female.webp')||path.endsWith('c01-s01-m05.webp'));
 }
}
assert.equal(ids.size,2000);
for(const p of report.present){
 for(const file of [p.male,p.female]){
  if(!file)continue;
  const bytes=await fs.readFile(new URL('../'+file,import.meta.url));
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.ok(bytes.length>12000);
 }
}
assert.equal(new Set(list.pending.map(p=>p.outputPath)).size,list.pending.length);
assert.ok(list.pending.every(p=>!p.artDirection.includes('gameplay screenshot')||p.artDirection.includes('No text')));
console.log('PASS art inventory: '+report.stats.totalPanels+' panel IDs, '+report.stats.maleDedicated+' male-specific/neutral files, '+report.stats.femaleUsable+' heroine-usable files and '+list.pending.length+' ungenerated shot briefs');
