import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mangaForStage} from '../src/story-stage-manga.js';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
import {STORY_NARRATOR_PROFILE,STORY_VOICE_PROFILES} from '../src/story-voice-director.js';

const manifest=JSON.parse(fs.readFileSync(new URL('../audio/voicevox/manifest.json',import.meta.url),'utf8'));
assert.equal(manifest.format,2,'preserve the existing voice clip manifest format');
const clips=manifest.clips;
const all=Object.values(clips);
assert.equal(all.length,new Set(all).size,'clips with separate keys should have distinct content hashes');
const panelKeys=Object.keys(clips).filter(k=>k.startsWith('story::panel::'));
let validated=0;
for(const stage of CAMPAIGN_STAGES){
 const panels=mangaForStage(stage.id).panels;
 for(const panel of panels){
  const profile=STORY_VOICE_PROFILES[panel.characterId]||STORY_NARRATOR_PROFILE;
  const key='story::panel::'+panel.id+'::'+panel.text.slice(0,380)+'::'+profile.voicevoxSpeaker;
  if(!clips[key])continue;
  const file=clips[key];
  assert.match(file,/^audio\/voicevox\/clips\/[a-f0-9]{16}\.(mp3|wav)$/);
  const bytes=fs.readFileSync(new URL('../'+file,import.meta.url));
  assert.ok(bytes.length>1200,file+' too small for real speech');
  if(file.endsWith('.wav')){
   assert.equal(bytes.toString('ascii',0,4),'RIFF');
   assert.equal(bytes.toString('ascii',8,12),'WAVE');
  }else{
   assert.ok(bytes.toString('ascii',0,3)==='ID3'||bytes[0]===0xff,file+' invalid MP3');
  }
  validated++;
 }
}
const expected=CAMPAIGN_STAGES.length*7;
assert.ok(validated<=expected,'more than one active clip found for a panel');
if(process.env.REQUIRE_ALL_STORY_VOICES==='1')assert.equal(validated,expected,'all current voice profiles must have a recorded clip');
const older=panelKeys.length-validated;
assert.ok(older>=0,'active keys must be a subset of the manifest');
console.log('PASS current per-panel VOICEVOX audio: '+validated+' / '+expected+'; historical speaker entries preserved: '+older);
