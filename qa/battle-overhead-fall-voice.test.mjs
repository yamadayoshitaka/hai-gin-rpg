import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBattleVoiceDirector} from '../src/battle-voice-library.js';
import {createBattleReportSpeech} from '../src/battle-report-speech.js';

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const gpu=readFileSync(new URL('../src/mass-battle-real-army.js',import.meta.url),'utf8');
assert.match(game,/aria-label="上空から見下ろす戦場全域レーダー"/);
assert.match(game,/const elevation=terrainY\(wx,wz\),north=terrainY\(wx,wz-CELL\)/);
assert.match(game,/for\(const building of townInstances\)/);
assert.match(game,/const anchor=squadCenter\(id\)/);
assert.match(game,/const soldiers=alive\.filter\(u=>!u\.isStrategist\)/);
assert.match(game,/focusedHumanUnitId=massSim\?representative\?\.id\?\?null:null/);
assert.match(game,/a\.deathDropVelocity=\(a\.deathDropVelocity\|\|0\)-9\.81\*dt/);
assert.match(game,/out\.y=Math\.max\(ground,u\._corpseFallStartY-4\.905\*age\*age\)/);
assert.match(gpu,/getWorldPosition\(u,world,alpha,corpseTime\)/);
assert.match(game,/voice-roster-25/);

const audio=[];
const originalAudio=globalThis.Audio;
let now=100000;
const storage={getItem:()=>null,setItem(){}};
globalThis.Audio=class {
 constructor(src){this.src=src;this.paused=true;audio.push(this);}
 play(){this.paused=false;return Promise.resolve();}
 pause(){this.paused=true;}
};
try{
 const clips={
  '剣士::attack::この一撃で決める！::male':'audio/voicevox/clips/0123456789abcdef.mp3',
  '剣士::attack::切り込むぞ！::male':'audio/voicevox/clips/1234567890abcdef.mp3',
  '魔法使い::magic::我が魔力よ、燃え上がれ！::male':'audio/voicevox/clips/234567890abcdef.mp3',
  '魔法使い::magic::術式展開！::male':'audio/voicevox/clips/34567890abcdef12.mp3'
 };
 const voice=createBattleVoiceDirector({storage,now:()=>now,fetcher:async()=>({ok:true,json:async()=>({clips})})});
 await new Promise(resolve=>setImmediate(resolve));
 voice.unlock();
 voice.cue('attack',{id:1,team:0,gender:'male',job:{name:'剣士'}});
 assert.equal(voice.status.playing,1);
 now+=1100;
 voice.cue('magic',{id:2,team:0,gender:'male',job:{name:'魔法使い'}});
 assert.equal(voice.status.playing,2,'Different recorded shouts can overlap');
 // Military dispatches now use separate prerecorded Japanese voice
 // files, not browser TTS. Verify both audio channels really overlap.
 const reportLine='前線が押されている！守備を固めろ！';
 const reportClips={
  ['report::warning::'+reportLine+'::麒ヶ島宗麟']:'audio/voicevox/clips/abcdefabcdefabcd.wav'
 };
 const reports=createBattleReportSpeech({AudioCtor:globalThis.Audio,storage,now:()=>now,
  fetcher:async()=>({ok:true,json:async()=>({clips:reportClips})})});
 await new Promise(resolve=>setImmediate(resolve));
 reports.unlock();
 assert.equal(reports.enqueue({key:'warning',text:'前線が押されている！守備を固めろ！'}),true);
 assert.equal(reports.update(),true,'Recorded report starts during recorded character shouts');
 assert.equal(reports.status.active,'軍師');
 assert.equal(reports.status.spokenSummary,reportLine);
 assert.equal(voice.status.playing,2);
 assert.equal(audio.length,3,'Two character voices and one dispatch may play in parallel');
 audio[0].onended();
 assert.equal(voice.status.playing,1);
 voice.setAudioAllowed(false);
 assert.equal(voice.status.playing,0);
}finally{
 if(originalAudio===undefined)delete globalThis.Audio;
 else globalThis.Audio=originalAudio;
}
console.log('Bird-eye radar / commander zoom / airborne death fall / concurrent recorded voices PASS');
