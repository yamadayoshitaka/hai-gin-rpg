import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {comicChapterPlan} from '../src/story-chapter-comic.js';
import {STORY_VOICE_PROFILES,STORY_NARRATOR_PROFILE} from '../src/story-voice-director.js';
const manifest=JSON.parse(fs.readFileSync('audio/voicevox/manifest.json','utf8'));
const unique=new Set();let variants=0;
for(let chapter=1;chapter<=5;chapter++){
 const plan=comicChapterPlan(chapter);
 assert.equal(plan.stageCount,10);
 for(const edition of plan.editions){
  variants++;
  assert.equal(edition.pages.length,1,'Only one sheet per edition in 1-5: '+edition.stageId+' '+edition.edition);
  for(const panel of edition.panels){
   const speaker=STORY_VOICE_PROFILES[panel.characterId]||STORY_NARRATOR_PROFILE;
   const key='story::panel::'+panel.id+'::'+panel.voiceText.slice(0,380)+'::'+speaker.voicevoxSpeaker;
   unique.add(key);
  }
 }
}
for(const key of unique){
 const file=manifest.clips[key];
 assert.ok(file,'VOICEVOX clip not registered: '+key);
 assert.match(file,/^audio\/voicevox\/clips\/[a-f\d]{16}\.(mp3|wav)$/);
 assert.ok(fs.statSync(path.resolve(file)).size>1000,'Empty VOICEVOX recording: '+file);
}
console.log('PASS chapters 1-5: '+variants+' manga editions, '+unique.size+' distinct registered spoken lines');
