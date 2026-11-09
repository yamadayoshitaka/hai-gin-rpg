import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 STORY_TITLE,STORY_ACTS,STORY_ENDINGS,STORY_CHAPTERS,
 storyProgress,unlockedStoryChapters,storyVoiceKey,
} from '../src/story-chapters.js';
import {createCampaign,TERRITORIES} from '../src/story-campaign.js';

assert.equal(STORY_TITLE,'灰銀戦記 ― 沈黙の星鐘');
assert.equal(STORY_ACTS.length,4);
assert.equal(STORY_CHAPTERS.length,20);
assert.deepEqual(STORY_CHAPTERS.map(c=>c.id),Array.from({length:20},(_,i)=>i+1));
assert.deepEqual(STORY_CHAPTERS.map(c=>c.act),Array.from({length:20},(_,i)=>Math.floor(i/5)+1));
assert.deepEqual(STORY_CHAPTERS.map(c=>c.score),[0,1,2,3,4,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33]);
const locators=new Set(TERRITORIES.map(t=>t.id)),keys=new Set();
for(const chapter of STORY_CHAPTERS){
 assert.ok(chapter.title.length>2,'第'+chapter.id+'章 title');
 assert.ok(chapter.synopsis.length>=55,'第'+chapter.id+'章 story body');
 assert.ok(chapter.narration.length>=40,'第'+chapter.id+'章 narration');
 assert.ok(chapter.objective.length>=8,'第'+chapter.id+'章 objective');
 assert.ok(locators.has(chapter.territory),'第'+chapter.id+'章 existing campaign territory');
 assert.equal(chapter.dialogues.length,3,'第'+chapter.id+'章 dialogue count');
 assert.ok(chapter.dialogues.every(d=>d.speaker&&d.line.length>=15),'第'+chapter.id+'章 dialogue lines');
 assert.ok(['玄野武宏','四国めたん'].includes(chapter.narrator));
 const key=storyVoiceKey(chapter);assert.ok(!keys.has(key),'Unique narration key');keys.add(key);
 assert.ok(key.startsWith('story::chapter::'+chapter.id+'::'));
}
assert.equal(Object.keys(STORY_ENDINGS).length,3);
const saved=createCampaign('保護対象のセーブ');
assert.equal(unlockedStoryChapters(saved),1);
assert.equal(storyProgress(saved),0);
const oldSaved=structuredClone(saved);
delete oldSaved.narrativeEnding;
assert.equal(unlockedStoryChapters(oldSaved),1,'Legacy saves without narration state work');
oldSaved.month=30;
assert.equal(unlockedStoryChapters(oldSaved),19,'Final choice remains locked before unification');
const victory=structuredClone(saved);
victory.owners['flame-fort']='player';victory.owners['green-capital']='player';
victory.gameOver='両勢力の本拠地を制圧！天下統一に成功しました。';
assert.equal(unlockedStoryChapters(victory),20);
const ui=readFileSync(new URL('../story-mode.html',import.meta.url),'utf8');
const builder=readFileSync(new URL('../scripts/build-voicevox-clip-bank.mjs',import.meta.url),'utf8');
for(const marker of ['panelChronicle','storyActNav','storyChapterButtons','storyVoiceButton','storyVoiceStatus','storyVoiceKey(chapter)','storyManifestPromise','data-story-ending']){
 assert.ok(ui.includes(marker),'Story UI integration '+marker);
}
for(const marker of ['STORY_CHAPTERS','STORY_ENDINGS','storyVoiceKey(chapter)','event:\'narration\'']){
 assert.ok(builder.includes(marker),'VOICEVOX prerecorded audio '+marker);
}
assert.ok(!ui.includes('speechSynthesis'),'No robotic browser TTS on story screen');
console.log('20 chapters, 3 endings, existing save migration, VOICEVOX narration wiring: OK');
