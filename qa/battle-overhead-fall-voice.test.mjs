import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBattleVoiceDirector} from '../src/battle-voice-library.js';
import {createBattleReportSpeech} from '../src/battle-report-speech.js';

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const gpu=readFileSync(new URL('../src/mass-battle-real-army.js',import.meta.url),'utf8');
assert.match(game,/aria-label="上空から見下ろす戦場全域レーダー"/);
assert.match(game,/const elevation=terrainY\(wx,wz\),north=terrainY\(wx,wz-CELL\)/);
assert.match(game,/for\(const building of townInstances\)/);
assert.match(game,/const commander=squadStrategist\(id\)/);
assert.match(game,/focusedHumanUnitId=commander\?\.id\?\?null/);
assert.match(game,/a\.deathDropVelocity=\(a\.deathDropVelocity\|\|0\)-9\.81\*dt/);
assert.match(game,/out\.y=Math\.max\(ground,u\._corpseFallStartY-4\.905\*age\*age\)/);
assert.match(gpu,/getWorldPosition\(u,world,alpha,corpseTime\)/);
assert.match(game,/voice-roster-24/);

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
 let spoken=null;
 const synth={speaking:false,pending:false,getVoices:()=>[],
  speak(item){spoken=item;}};
 const reports=createBattleReportSpeech({synth,Utterance:class{constructor(text){this.text=text;}},
  storage,now:()=>now});
 reports.unlock();
 assert.equal(reports.enqueue({key:'warning',text:'伝令より報告、敵が接近しています'}),true);
 assert.equal(reports.update(),true,'Report TTS starts during prerecorded character shouts');
 assert.match(spoken.text,/敵が接近/);
 assert.equal(voice.status.playing,2);
 audio[0].onended();
 assert.equal(voice.status.playing,1);
 voice.setAudioAllowed(false);
 assert.equal(voice.status.playing,0);
}finally{
 if(originalAudio===undefined)delete globalThis.Audio;
 else globalThis.Audio=originalAudio;
}
console.log('Bird-eye radar / commander zoom / airborne death fall / concurrent recorded voices PASS');
