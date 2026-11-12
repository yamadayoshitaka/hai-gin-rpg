import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {STORY_CHAPTERS} from '../src/story-chapters.js';
import {mangaForStage} from '../src/story-stage-manga.js';

const read=async path=>JSON.parse(await fs.readFile(new URL('../'+path,import.meta.url),'utf8'));
const contract=await read('assets/story/characters/c01-s01-visual-contract.json');
const plan=await read('qa-reports/story-art-batch-plan.json');
assert.equal(contract.stageId,'c01-s01');
assert.equal(contract.chapterSynopsis,STORY_CHAPTERS[0].synopsis,
 'The art brief must use the real first-chapter synopsis, not invented royal commands');
assert.equal(contract.prePanelStoryboard.length,10);
const actual=mangaForStage('c01-s01',{protagonistGender:'male'}).panels
 .filter(p=>p.phase==='pre').map(p=>p.id);
assert.deepEqual(contract.prePanelStoryboard.map(p=>p.panelId),actual,
 'Comic page must use exact live ten-panel scene order');
assert.deepEqual(contract.prePanelStoryboard.map(p=>p.cell),[1,2,3,4,5,6,7,8,9,10]);
const refs=contract.visualReferences;
assert.equal(refs.lucia.path,'assets/story/characters/lucia/master.webp',
 'Regent Lucia must use her dedicated silver-haired noblewoman reference');
assert.equal(refs.protagonistFemale.path,'assets/story/characters/commander/female-master.webp',
 'Female commander and Regent Lucia must be different characters');
assert.notEqual(refs.lucia.path,refs.protagonistFemale.path);
assert.equal(refs.garan.kind,'crop-from-ensemble-unverified-master');
assert.equal(refs.iris.kind,'crop-from-ensemble-unverified-master');
for(const [name,ref] of Object.entries(refs)){
 const path=ref.path;
 const bytes=await fs.readFile(new URL('../'+path,import.meta.url));
 assert.equal(bytes.toString('ascii',0,4),'RIFF',name+' invalid webp header');
 assert.equal(bytes.toString('ascii',8,12),'WEBP',name+' invalid webp type');
 assert.ok(bytes.length>15000,name+' is not a usable image reference');
}
const [pre,post]=plan.batches;
assert.equal(pre.stages[0],'c01-s01');
assert.equal(pre.phase,'pre');
assert.equal(post.stages[0],'c01-s01');
assert.equal(post.phase,'post');
for(const batch of [pre,post]){
 assert.equal(batch.referencePolicy.canonicalSynopsis,contract.chapterSynopsis);
 assert.equal(batch.referencePolicy.actualImagesMustBeAttached,true);
 assert.ok(batch.sheetPrompt.includes('FORBIDDEN PLOT:'));
 assert.ok(batch.sheetPrompt.includes('FIRST CHAPTER SYNOPSIS:'));
 assert.equal(batch.masterReferences.cast.find(x=>x.id==='lucia')?.path,refs.lucia.path);
 assert.notEqual(batch.masterReferences.cast.find(x=>x.id==='lucia')?.kind,
   'cast-composite-crop-not-character-master');
 assert.ok(batch.masterReferences.cast.find(x=>x.id==='garan'));
 assert.ok(batch.masterReferences.cast.find(x=>x.id==='iris'));
}
assert.equal(pre.referencePolicy.storyboards.length,10);
assert.equal(post.referencePolicy.storyboards.length,0);
console.log('PASS first-stage image references: silver-haired Lucia, distinct commander genders, Garan and Iris roles, canonical plot and all ten exact scenes');
