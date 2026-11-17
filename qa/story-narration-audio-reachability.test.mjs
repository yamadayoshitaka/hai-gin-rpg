import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
import {compactComicForStage} from '../src/story-compact-comic.js';
import {readerIntroForChapter} from '../src/story-reader-intros.js';
import {screenplayVoiceText,screenplayRubyTokens} from '../src/story-screenplay-v2.js';

const manifest=JSON.parse(fs.readFileSync('audio/voicevox/manifest.json','utf8'));
const all=new Set(fs.readdirSync('audio/voicevox/clips'));
const refs=new Set();
for(const [key,location] of Object.entries(manifest.clips)){
 assert.match(location,/^audio\/voicevox\/clips\/[a-f0-9]{16}\.(?:wav|mp3)$/);
 const filename=path.basename(location);
 assert(all.has(filename),'missing VOICEVOX clip for '+key);
 refs.add(filename);
 // Old 20-panel manga-only voice lines were removed, but common CG voice
 // and every job/battle/chapter voice must remain available.
 if(key.startsWith('story::panel::')){
  const id=key.split('::')[2]||'';
  assert(!/^c\d{2}-s\d{2}-m(?:7|8|9|11|12|13|14|16|17|18|19|20)$/.test(id),
   'obsolete full-manga voice remains '+id);
 }
}
assert.equal(refs.size,all.size,'unused files left on disk');
let narrations=0,dialogues=0;
for(const stage of CAMPAIGN_STAGES){
 for(const gender of ['male','female']){
  const ctx={protagonistGender:gender};
  const pre=compactComicForStage(stage.id,'pre',ctx);
  assert.equal(pre.recap.speaker,'語り手');
  assert.equal(pre.recap.characterId,null);
  assert(pre.panels.every(panel=>panel.dialogueTurns.every(turn=>turn.characterId)),
   'Narrated setup must not be assigned to character pictures');
  if(stage.slot===1){
   assert(pre.recap.text.includes(readerIntroForChapter(stage.chapter)),'Chapter intro must play on recap image');
   assert.equal(pre.panels.length,6);
  }else assert.equal(pre.panels.length,2);
  for(const phase of ['pre','post']){
   const stories=phase==='pre'?[pre]:[
    compactComicForStage(stage.id,'post',{...ctx,battleOutcome:{victory:true}}),
    compactComicForStage(stage.id,'post',{...ctx,battleOutcome:{victory:false}}),
    compactComicForStage(stage.id,'post',{...ctx,battleOutcome:{victory:false,playerCommanderDead:true}})
   ];
   for(const story of stories)for(const shot of story.panels)for(const turn of shot.dialogueTurns){
    assert.equal(turn.voiceText,screenplayVoiceText(turn.text));
    assert.equal(turn.rubyTokens.map(t=>t.text).join(''),turn.text);
    assert.deepEqual(turn.rubyTokens,screenplayRubyTokens(turn.text));
    if(turn.speaker==='語り手')narrations++;else dialogues++;
   }
  }
 }
}
assert(narrations>=400);
assert(dialogues>=200);
console.log(JSON.stringify({status:'PASS',chapters:20,stages:200,narrations,dialogues,
 remainingReferencedClips:refs.size,removedLegacyMangaOnlyVoice:true}));
