import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
import {compactComicForStage} from '../src/story-compact-comic.js';
import {STORY_RECAP_ART} from '../src/story-dialogue-art-binding.js';
const p=STORY_RECAP_ART.replace(/^\.\//,'');
const b=fs.readFileSync(p);
assert.equal(b.toString('ascii',0,4),'RIFF');
assert.equal(b.toString('ascii',8,12),'WEBP');
assert(b.length>120000,'Premium recap needs a real 1600px asset, not a placeholder');
const codec=b.toString('ascii',12,16);
let width=0,height=0;
if(codec==='VP8 '){width=b.readUInt16LE(26)&0x3fff;height=b.readUInt16LE(28)&0x3fff;}
if(codec==='VP8L'){const n=b.readUInt32LE(21);width=(n&0x3fff)+1;height=((n>>>14)&0x3fff)+1;}
if(codec==='VP8X'){width=b.readUIntLE(24,3)+1;height=b.readUIntLE(27,3)+1;}
assert.deepEqual([width,height],[1600,900]);
assert.equal(crypto.createHash('sha256').update(b).digest('hex'),
 'd0a15407058329a1f3909caa5214c9eb7dd3f864735059ee7b31b8096717e1cc',
 'Only the exact owner-accepted recap-derived illustration is allowed');
let stages=0,dialogues=0;
for(const stage of CAMPAIGN_STAGES){
 const pre=compactComicForStage(stage.id,'pre',{protagonistGender:'female'});
 const recap=pre.recap;
 assert(recap,'Missing dedicated recap for '+stage.id);
 assert.equal(recap.speaker,'語り手');
 assert.equal(recap.characterId,null);
 assert.equal(recap.artAsset,STORY_RECAP_ART);
 assert.equal(recap.extraCGSlot,false);
 assert.equal(recap.rubyTokens.map(x=>x.text).join(''),recap.text);
 for(const shot of pre.panels){
  assert(shot.dialogueTurns.length>=1,stage.id);
  for(const dialogue of shot.dialogueTurns){
   assert(dialogue.characterId,stage.id+' '+shot.id+' should not narrate over face');
   assert.notEqual(dialogue.speaker,'語り手',stage.id+' '+shot.id);
   assert(dialogue.rubyTokens.map(x=>x.text).join('')===dialogue.text);
   dialogues++;
  }
 }
 stages++;
}
for(const id of ['c01-s03','c01-s05']){
 const first=compactComicForStage(id,'pre',{protagonistGender:'female'}).panels[0].dialogueTurns[0];
 assert.equal(first.speaker,'リュシア','Incorrect screenshot face/dialogue speaker '+id);
 assert.equal(first.characterId,'lucia');
}
const viewer=fs.readFileSync('src/story-manga-viewer.js','utf8');
const review=fs.readFileSync('story-compact-review.html','utf8');
assert.match(viewer,/showRecap.*recap/);
assert.match(viewer,/人物の会話へ/);
assert.match(review,/recap\.artAsset/);
console.log(JSON.stringify({status:'PASS',recapNative:[width,height],recapBytes:b.length,
 exactOriginalDerivedArtwork:true,allStageRecaps:stages,characterCGDialogues:dialogues,
 noIncompatiblePortraitOverlay:true}));
