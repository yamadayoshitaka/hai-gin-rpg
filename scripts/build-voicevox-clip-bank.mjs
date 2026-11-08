/**
 * Free offline VOICEVOX rendering. Runs only on GitHub-hosted standard runner.
 * Generated MP3 files are published as static assets; no commercial TTS API.
 * Always obey the engine AND voice library licenses:
 * https://voicevox.hiroshiba.jp/term/
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {bundledBattleVoiceLines} from '../src/battle-voice-library.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DEST=path.join(ROOT,'audio/voicevox');
const CLIPS=path.join(DEST,'clips');
const URL='http://127.0.0.1:50021';
const CREDITS=['VOICEVOX:玄野武宏','VOICEVOX:四国めたん'];
const SPEAKERS={male:'玄野武宏',female:'四国めたん'};
const MAX_NEW=Number(process.env.VOICEVOX_MAX_NEW||'56');
if(!Number.isInteger(MAX_NEW)||MAX_NEW<1||MAX_NEW>150)throw Error('VOICEVOX_MAX_NEW must be an integer between 1 and 150');
mkdirSync(CLIPS,{recursive:true});
const manifestFile=path.join(DEST,'manifest.json');
const manifest=existsSync(manifestFile)?JSON.parse(readFileSync(manifestFile,'utf8')):{format:1,credits:CREDITS,clips:{}};
if(!manifest.clips||typeof manifest.clips!=='object')throw Error('Invalid manifest');
const fetchJSON=async (endpoint,options)=>{
 const response=await fetch(URL+endpoint,options);
 if(!response.ok)throw Error('VOICEVOX '+response.status+' '+endpoint);
 return response;
};
const speakers=await (await fetchJSON('/speakers')).json();
const speakerByName={};
for(const gender of Object.keys(SPEAKERS)){
 const name=SPEAKERS[gender],found=speakers.find(s=>s.name===name);
 const normal=found?.styles?.find(x=>/ノーマル|ふつう/.test(x.name))||found?.styles?.[0];
 if(!normal)throw Error('Missing compatible speaker: '+name);
 speakerByName[gender]=normal.id;
}
const jobs=bundledBattleVoiceLines();
let generated=0,skipped=0;
outer:for(const [job,events] of Object.entries(jobs)){
 const [event,lines]=Object.entries(events)[0];
 // First build covers all jobs and both genders; extend with optional further batches.
 for(const line of lines.slice(0,2)){
  for(const gender of ['male','female']){
   const key=job+'::'+event+'::'+line+'::'+gender;
   const hash=createHash('sha256').update(key).digest('hex').slice(0,16);
   const relPath='audio/voicevox/clips/'+hash+'.wav';
   const filePath=path.join(ROOT,relPath);
   if(existsSync(filePath)&&manifest.clips[key]===relPath){skipped++;continue}
   if(generated>=MAX_NEW)break outer;
   const id=speakerByName[gender];
   const query=await (await fetchJSON('/audio_query?'+new URLSearchParams({text:line,speaker:String(id)}),{method:'POST'})).json();
   // Restrained delivery rather than exaggerated speed/pitch and foreign accent.
   query.speedScale=job==='軍師'?.94:job==='忍者'?1.09:1.03;
   query.pitchScale=0;
   query.intonationScale=job==='剣士'||job==='格闘家'?1.25:1.12;
   query.volumeScale=.85;
   query.prePhonemeLength=.08;query.postPhonemeLength=.11;
   const audio=await fetchJSON('/synthesis?'+new URLSearchParams({speaker:String(id)}),
    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(query)});
   const wav=new Uint8Array(await audio.arrayBuffer());
   // VOICEVOX output is already an Android-playable PCM WAV; keep it lossless.
   // Avoid ffmpeg installation/dependency failures on free CI runners.
   if(wav.length<44||String.fromCharCode(...wav.slice(0,4))!=='RIFF')throw Error('Invalid WAV returned from VOICEVOX');
   writeFileSync(filePath,wav);
   manifest.clips[key]=relPath;generated++;
   process.stdout.write('VOICEVOX '+generated+'/'+MAX_NEW+' '+job+' / '+event+' / '+gender+'\n');
  }
 }
}
manifest.credits=CREDITS;manifest.format=1;
writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
process.stdout.write(JSON.stringify({generated,skipped,total:Object.keys(manifest.clips).length})+'\n');
