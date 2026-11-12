/**
 * Generate ACTUAL per-panel VOICEVOX sound files, without paid APIs.
 * Local VOICEVOX Engine:  http://127.0.0.1:50021
 * Usage:
 *   node scripts/generate-story-panel-voicevox.mjs --stage c01-s01
 *   node scripts/generate-story-panel-voicevox.mjs --chapter 1
 *   node scripts/generate-story-panel-voicevox.mjs --all
 * Optional --format wav (default compressed MP3 to keep mobile/GitHub lean).
 *
 * Safe to rerun: uses text+speaker content hashes, retains existing prerecorded clips,
 * emits a JSON report, and never deletes a previous file.
 */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {mangaForStage} from '../src/story-stage-manga.js';
import {comicEditionsForStage} from '../src/story-chapter-comic.js';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
import {STORY_VOICE_PROFILES,STORY_NARRATOR_PROFILE} from '../src/story-voice-director.js';

const args=process.argv.slice(2);
function option(name,fallback=null){const i=args.indexOf(name);return i===-1?fallback:args[i+1];}
const chapterValue=option('--chapter');
const stageValue=option('--stage');
const all=args.includes('--all');
const dryRun=args.includes('--dry-run');
const format=option('--format','mp3');
if(!['mp3','wav'].includes(format))throw Error('--format must be mp3 or wav');
if(!all&&!chapterValue&&!stageValue)throw Error('Choose --stage c01-s01, --chapter 1..20 or --all explicitly');
const chapter=chapterValue===null?null:Number(chapterValue);
if(chapter!==null&&(!Number.isInteger(chapter)||chapter<1||chapter>20))throw Error('Invalid chapter: '+chapterValue);
if(stageValue&&!/^c\d{2}-s\d{2}$/.test(stageValue))throw Error('Invalid stage ID: '+stageValue);
const stages=CAMPAIGN_STAGES.filter(s=>all||(stageValue&&s.id===stageValue)||(chapter&&s.chapter===chapter));
if(!stages.length)throw Error('No matching stage');
const base=path.resolve('audio/voicevox'),root=process.env.VOICEVOX_URL?.replace(/\/$/,'')||'http://127.0.0.1:50021';
const manifestPath=path.join(base,'manifest.json'),manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.clips??={};
if(format==='mp3'&&!dryRun&&spawnSync('ffmpeg',['-version'],{encoding:'utf8'}).status!==0)
 throw Error('ffmpeg is required to compress voices (or use --format wav)');

const tasks=stages.flatMap(stage=>{
 // Production chapters 1-5: synthesize ALL actual comic editions, including
 // decision, victory, loss and fatal protagonist endings, not just legacy
 // fixed-panel winning and retreat script. IDs/text/speaker remain cache keys.
 const different=stage.chapter<=5
  ?comicEditionsForStage(stage.id).flatMap(edition=>edition.panels)
  :[...mangaForStage(stage.id,{battleOutcome:{victory:true}}).panels,
    ...(stage.kind==='town'?[]:mangaForStage(stage.id,{battleOutcome:{victory:false}})
      .panels.filter(panel=>panel.phase==='post'))];
 const seen=new Set();
 return different.filter(panel=>{
  const voice=STORY_VOICE_PROFILES[panel.characterId]||STORY_NARRATOR_PROFILE;
  const key='story::panel::'+panel.id+'::'+panel.voiceText.slice(0,380)+'::'+voice.voicevoxSpeaker;
  if(seen.has(key))return false;
  seen.add(key);return true;
 }).map(panel=>{
 const voice=STORY_VOICE_PROFILES[panel.characterId]||STORY_NARRATOR_PROFILE;
 const text=panel.voiceText.slice(0,380);
 const key='story::panel::'+panel.id+'::'+text+'::'+voice.voicevoxSpeaker;
 return {panel,voice,text,key,filename:crypto.createHash('sha256').update(key).digest('hex').slice(0,16)+'.'+format};
 });
});
const preexisting=tasks.filter(t=>manifest.clips[t.key]).length;
if(dryRun){
 console.log(JSON.stringify({dryRun:true,stages:stages.length,panels:tasks.length,alreadyRegistered:preexisting,required:tasks.length-preexisting,format},null,2));
 process.exit(0);
}
async function ensureResponse(route,init={}){
 const response=await fetch(root+route,{...init,signal:AbortSignal.timeout(180000)});
 if(!response.ok)throw Error('VOICEVOX '+route+' '+response.status+' '+(await response.text()).slice(0,250));
 return response;
}
const speakers=await (await ensureResponse('/speakers')).json();
const styles=new Map(speakers.map(s=>[s.name,s.styles?.find(v=>/ノーマル|normal/i.test(v.name))?.id??s.styles?.[0]?.id]));
const fallback=styles.get('玄野武宏')??speakers[0]?.styles?.[0]?.id;
if(!Number.isInteger(fallback))throw Error('VOICEVOX has no available voice styles');
let created=0,reused=0,bytes=0;const missingSpeakers=new Set();
await fs.mkdir(path.join(base,'clips'),{recursive:true});
const output={engine:root,chapter:chapter??null,stage:stageValue??null,stages:stages.length,panels:tasks.length,
 canonicalStagePanels:stages.length*20,includesDefeatVariants:true,includesComicChoicesAndGameover:true,
 format,created:0,reused:0,missingSpeakers:[],files:[]};
for(const [index,t] of tasks.entries()){
 if(manifest.clips[t.key]){
  reused++;continue;
 }
 let voiceId=styles.get(t.voice.voicevoxSpeaker);
 if(!Number.isInteger(voiceId)){missingSpeakers.add(t.voice.voicevoxSpeaker);voiceId=fallback;}
 const qp=await ensureResponse('/audio_query?text='+encodeURIComponent(t.text)+'&speaker='+voiceId,{method:'POST'});
 const params=await qp.json();
 params.speedScale=Math.max(.78,Math.min(1.2,t.voice.rate||.94));
 params.pitchScale=Math.max(-.1,Math.min(.1,((t.voice.pitch||1)-1)*.15));
 const wav=Buffer.from(await (await ensureResponse('/synthesis?speaker='+voiceId,{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(params)
 })).arrayBuffer());
 if(wav.toString('ascii',0,4)!=='RIFF'||wav.length<2000)throw Error('Bad sound clip '+t.panel.id);
 let buffer=wav;
 if(format==='mp3'){
  const encoded=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-f','wav','-i','pipe:0',
   '-ac','1','-b:a','80k','-f','mp3','pipe:1'],{input:wav,maxBuffer:12*1024*1024});
  if(encoded.status!==0||!encoded.stdout?.length)throw Error('ffmpeg failed '+t.panel.id+': '+String(encoded.stderr));
  buffer=encoded.stdout;
 }
 const filePath=path.join(base,'clips',t.filename);
 await fs.writeFile(filePath,buffer,{flag:'wx'}).catch(async error=>{
  if(error.code!=='EEXIST')throw error;
  const old=await fs.readFile(filePath);
  if(!old.equals(buffer))throw Error('Content hash collision: '+t.filename);
 });
 const rel='audio/voicevox/clips/'+t.filename;
 manifest.clips[t.key]=rel;
 // Write progress after every clip, so an interrupted run can resume.
 await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 created++;bytes+=buffer.length;output.files.push(rel);
 if((index+1)%10===0)console.log('VOICEVOX: '+(index+1)+'/'+tasks.length+' clips, created '+created);
}
output.created=created;output.reused=reused;output.bytes=bytes;output.missingSpeakers=[...missingSpeakers];
await fs.mkdir('qa-reports',{recursive:true});
await fs.writeFile('qa-reports/story-voicevox-generation.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({...output,files:output.files.slice(0,5)},null,2));
