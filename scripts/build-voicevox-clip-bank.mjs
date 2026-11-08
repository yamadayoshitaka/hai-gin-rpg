/** Cost-free offline VOICEVOX audio for the public GitHub Pages RPG.
 * Batch across all jobs / situations, up to a bounded 480 clips per run.
 * Commercial-safe voice library catalog: see src/battle-voice-profiles.js.
 * Voice libraries remain subject to their individual license terms.
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {bundledBattleVoiceLines,bundledBattleCommonLines} from '../src/battle-voice-library.js';
import {voiceOptionsForJob} from '../src/battle-voice-profiles.js';
import {BATTLE_REPORT_VOICES,reportAudioKey} from '../src/battle-report-voice-lines.js';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DEST=path.join(ROOT,'audio/voicevox');
const CLIPS=path.join(DEST,'clips');
const HOST='http://127.0.0.1:50021';
const MAX_NEW=Number(process.env.VOICEVOX_MAX_NEW||'440');
if(!Number.isInteger(MAX_NEW)||MAX_NEW<1||MAX_NEW>600)throw Error('VOICEVOX_MAX_NEW must be 1..600');
mkdirSync(CLIPS,{recursive:true});
const manifestFile=path.join(DEST,'manifest.json');
const manifest=existsSync(manifestFile)?JSON.parse(readFileSync(manifestFile,'utf8')):{format:2,credits:[],clips:{}};
if(!manifest.clips||typeof manifest.clips!=='object')throw Error('Invalid manifest');
async function request(endpoint,options){
 const response=await fetch(HOST+endpoint,options);
 if(!response.ok)throw Error('VOICEVOX '+response.status+' '+endpoint);
 return response;
}
const speakers=await (await request('/speakers')).json();
const speakerByName=new Map();
for(const sp of speakers){
 const style=sp.styles?.find(s=>/ノーマル|ふつう|通常/.test(s.name))||sp.styles?.[0];
 if(style)speakerByName.set(sp.name,style.id);
}
const jobs=bundledBattleVoiceLines(),commons=bundledBattleCommonLines();
const eventsPriority=['attack','magic','heal','guard','critical','hit','dead','start','victory','run'];
const makeEntry=(job,event,line,gender,speaker)=>({
 job,event,line,gender,speaker,
 key:[job,event,line,gender,speaker].join('::')
});
const entries=[],seen=new Set();
// Generate military spoken messages first: no more robotic commander/scout reports.
for(const [category,profile] of Object.entries(BATTLE_REPORT_VOICES)){
 for(const line of profile.lines)for(const speaker of profile.voices){
  if(!speakerByName.has(speaker))continue;
  const key=reportAudioKey(category,line,speaker);
  if(!seen.has(key)){
   entries.push({job:profile.speaker,event:category,line,speaker,key});
   seen.add(key);
  }
 }
}
const add=(job,event,lines)=>{
 for(const line of lines){
  for(const gender of ['male','female']){
   for(const speaker of voiceOptionsForJob(job,gender)){
    if(!speakerByName.has(speaker))continue;
    const e=makeEntry(job,event,line,gender,speaker);
    if(!seen.has(e.key)){entries.push(e);seen.add(e.key)}
   }
  }
 }
};
// First complete the representative phrases for ALL jobs before the less common events.
for(const [job,events] of Object.entries(jobs)){
 const [event,lines]=Object.entries(events)[0]||[];
 if(event)add(job,event,lines.slice(0,2));
}
// Next cover class-specific battle situations evenly, then standard shared situations.
for(const [job,events] of Object.entries(jobs)){
 const custom=Object.entries(events).slice(1);
 for(const [event,lines] of custom)add(job,event,lines.slice(0,2));
}
for(const event of eventsPriority){
 for(const job of Object.keys(jobs)){
  if(jobs[job][event])continue;
  add(job,event,(commons[event]||[]).slice(0,2));
 }
}
let generated=0,skipped=0;
for(const e of entries){
 const hash=createHash('sha256').update(e.key).digest('hex').slice(0,16);
 const relPath='audio/voicevox/clips/'+hash+'.wav';
 const filePath=path.join(ROOT,relPath);
 if(existsSync(filePath)&&manifest.clips[e.key]===relPath){skipped++;continue}
 if(generated>=MAX_NEW)break;
 const id=speakerByName.get(e.speaker);
 const query=await (await request('/audio_query?'+new URLSearchParams({text:e.line,speaker:String(id)}),{method:'POST'})).json();
 query.speedScale=e.job==='軍師'?.94:e.job==='忍者'?1.10:1.04;
 query.pitchScale=0;
 query.intonationScale=e.event==='critical'?1.4:e.event==='attack'?1.28:1.16;
 query.volumeScale=.84;
 query.prePhonemeLength=.06;query.postPhonemeLength=.10;
 const audio=await request('/synthesis?'+new URLSearchParams({speaker:String(id)}),
  {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(query)});
 const wav=new Uint8Array(await audio.arrayBuffer());
 if(wav.length<44||String.fromCharCode(...wav.slice(0,4))!=='RIFF')throw Error('Invalid VOICEVOX WAV');
 writeFileSync(filePath,wav);
 manifest.clips[e.key]=relPath;generated++;
 if(generated%20===0)process.stdout.write('Recorded '+generated+' / '+MAX_NEW+' new voice lines\n');
}
const credits=new Set(['VOICEVOX:玄野武宏','VOICEVOX:四国めたん']);
for(const key of Object.keys(manifest.clips)){
 const parts=key.split('::');
 if(parts.length>=5)credits.add('VOICEVOX:'+parts[4]);
 else if(parts[0]==='report'&&parts.length===4)credits.add('VOICEVOX:'+parts[3]);
}
manifest.format=2;manifest.credits=[...credits].sort();
writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
process.stdout.write(JSON.stringify({generated,skipped,total:Object.keys(manifest.clips).length,voices:credits.size,unfilled:entries.length-generated-skipped})+'\n');
