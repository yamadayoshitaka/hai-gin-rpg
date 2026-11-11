/**
 * Generate cached, no-per-playback-cost Japanese voices with a local VOICEVOX
 * engine. Example:
 *   VOICEVOX_URL=http://127.0.0.1:50021 node scripts/generate-story-panel-voicevox.mjs --chapter 1
 * Run only where VOICEVOX is already installed; this script never uses Gemini
 * or any billed cloud TTS. Existing manifests and WAV files are preserved.
 */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {mangaForStage} from '../src/story-stage-manga.js';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
import {STORY_VOICE_PROFILES,STORY_NARRATOR_PROFILE} from '../src/story-voice-director.js';
const URL_BASE=(process.env.VOICEVOX_URL||'http://127.0.0.1:50021').replace(/\/$/,'');
const chapterArg=process.argv.indexOf('--chapter');
const chapter=chapterArg>=0?Number(process.argv[chapterArg+1]):1;
if(!Number.isInteger(chapter)||chapter<1||chapter>20)throw Error('Please choose --chapter 1..20');
const base=path.resolve('audio/voicevox');
const manifestPath=path.join(base,'manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const get=async route=>{
 const response=await fetch(URL_BASE+route);
 if(!response.ok)throw Error('VOICEVOX '+route+' '+response.status);
 return response.json();
};
const speakerData=await get('/speakers');
const speakerIds=new Map(speakerData.map(s=>[s.name,s.styles?.[0]?.id]));
let created=0,reused=0;
for(const stage of CAMPAIGN_STAGES.filter(s=>s.chapter===chapter)){
 for(const panel of mangaForStage(stage.id).panels){
  const profile=STORY_VOICE_PROFILES[panel.characterId]||STORY_NARRATOR_PROFILE;
  const speaker=speakerIds.get(profile.voicevoxSpeaker);
  if(!Number.isInteger(speaker))throw Error('VOICEVOX voice missing: '+profile.voicevoxSpeaker);
  const content=panel.text.slice(0,380);
  const key='story::panel::'+panel.id+'::'+content+'::'+profile.voicevoxSpeaker;
  if(manifest.clips[key]){reused++;continue;}
  const voiceQuery=await fetch(URL_BASE+'/audio_query?text='+encodeURIComponent(content)+'&speaker='+speaker,{method:'POST'});
  if(!voiceQuery.ok)throw Error('VOICEVOX audio_query '+voiceQuery.status);
  const voiceParams=await voiceQuery.json();
  const speak=await fetch(URL_BASE+'/synthesis?speaker='+speaker,{method:'POST',
   headers:{'Content-Type':'application/json'},body:JSON.stringify(voiceParams)});
  if(!speak.ok)throw Error('VOICEVOX synthesis '+speak.status);
  const bytes=Buffer.from(await speak.arrayBuffer());
  const name=crypto.createHash('sha256').update(key).digest('hex').slice(0,16)+'.wav';
  await fs.mkdir(path.join(base,'clips'),{recursive:true});
  await fs.writeFile(path.join(base,'clips',name),bytes,{flag:'wx'}).catch(async e=>{
   if(e.code!=='EEXIST')throw e;
  });
  manifest.clips[key]='audio/voicevox/clips/'+name;created++;
 }
}
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({chapter,created,reused,total:created+reused}));
