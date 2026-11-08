import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCreatureSoundRuntime} from '../src/combat-creature-sounds.js';
import {BATTLE_REPORT_VOICES,reportAudioCategory,reportAudioKey} from '../src/battle-report-voice-lines.js';
import {createBattleReportSpeech} from '../src/battle-report-speech.js';
const src=readFileSync(new URL('../src/combat-creature-sounds.js',import.meta.url),'utf8');
const runtime=src.slice(src.indexOf('export function createCreatureSoundRuntime('));
assert.doesNotMatch(runtime,/synthesizeCreatureVoice\(/,'Creature runtime must never generate electronic voices');
const events=['start','overview','leader','commander-fallen','critical','warning','recovered','close','mission','commander-warp','summon-fall'];
for(const event of events){
 assert.ok(BATTLE_REPORT_VOICES[event]?.lines?.length,'Missing natural report: '+event);
 assert.ok(BATTLE_REPORT_VOICES[event]?.voices?.length);
}
assert.equal(reportAudioCategory({key:'massmission:1:44'}),'mission');
assert.equal(reportAudioCategory({key:'commander-fallen:2'}),'commander-fallen');
assert.equal(reportAudioCategory({key:'unknown:42'}),null);
assert.ok(reportAudioKey('critical','救援を','玄野武宏').startsWith('report::critical::'));
let createBufferCalls=0;
const oldAudioContext=globalThis.AudioContext,oldFetch=globalThis.fetch;
class TestAudioContext{
 constructor(){this.state='running';this.currentTime=1}
 createBuffer(){createBufferCalls++;throw Error('Electronic oscillator audio is prohibited')}
 resume(){return Promise.resolve()}
 close(){return Promise.resolve()}
}
globalThis.AudioContext=TestAudioContext;
globalThis.fetch=async()=>({ok:true,json:async()=>({format:1,license:'CC0-1.0',species:{}})});
try{
 const runtimeAudio=createCreatureSoundRuntime();
 assert.equal(runtimeAudio.unlock(),true);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(runtimeAudio.play('horse','spawn',{force:true}),false,
  'An animal without recorded clips stays silent, never electronic');
 assert.equal(runtimeAudio.play('wolf','attack',{force:true}),false);
 assert.equal(createBufferCalls,0);
 runtimeAudio.dispose();
 const mockStorage={getItem:()=>null,setItem(){}};
 const message=createBattleReportSpeech({storage:mockStorage,fetcher:async()=>({ok:true,json:async()=>({clips:{}})}),
  AudioCtor:class{play(){throw Error('Unrecorded report must never play')}},
  now:()=>1000});
 await new Promise(resolve=>setImmediate(resolve));
 message.unlock();
 assert.equal(message.enqueue({key:'critical:1',speaker:'軍師',text:'残り人数11名'}),true);
 assert.equal(message.update(),false,'Missing prerecorded summary must remain text-only');
 assert.equal(message.status.electronicTts,false);
 console.log('PASS: battle voices/animals/reports cannot fall back to electronic voice');
}finally{
 if(oldAudioContext===undefined)delete globalThis.AudioContext;else globalThis.AudioContext=oldAudioContext;
 if(oldFetch===undefined)delete globalThis.fetch;else globalThis.fetch=oldFetch;
}
