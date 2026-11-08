import assert from 'node:assert/strict';
import {createBattleReportSpeech} from '../src/battle-report-speech.js';
import {BATTLE_REPORT_VOICES,reportAudioCategory} from '../src/battle-report-voice-lines.js';

const played=[],errors=[];
let now=1000,remoteRequests=0;
class Recording{
 constructor(url){this.src=url;this.paused=true;played.push(this)}
 play(){this.paused=false;return Promise.resolve()}
 pause(){this.paused=true}
}
const manifest={format:2,clips:{
 ['report::critical::'+BATTLE_REPORT_VOICES.critical.lines[0]+'::'+BATTLE_REPORT_VOICES.critical.voices[0]]:
  'audio/voicevox/clips/0123456789abcdef.wav',
 ['report::close::'+BATTLE_REPORT_VOICES.close.lines[0]+'::'+BATTLE_REPORT_VOICES.close.voices[0]]:
  'audio/voicevox/clips/fedcba9876543210.wav'
}};
const report=createBattleReportSpeech({
 storage:{getItem:()=>null,setItem(){}},now:()=>now,AudioCtor:Recording,
 fetcher:async()=>{remoteRequests++;return {ok:true,json:async()=>manifest}},
 onError:error=>errors.push(error)});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(report.status.electronicTts,false);
assert.equal(report.status.recordedClips,2);
assert.equal(report.enqueue({key:'critical:3',text:'第3隊 残存20名！',speaker:'軍師',priority:98}),true);
assert.equal(report.update(),false,'Gesture unlock required');
report.unlock();
assert.equal(report.update(),true,'Matched high-quality prerecorded summary must play');
assert.equal(played[0].src,'./audio/voicevox/clips/0123456789abcdef.wav');
assert.equal(report.status.active,'軍師');
played[0].onended();
assert.equal(report.status.spokenCount,1);
now+=900;
assert.equal(report.enqueue({key:'close:4',text:'敵影、約8マス',speaker:'斥候'}),true);
assert.equal(report.update(),true);
assert.equal(played[1].src,'./audio/voicevox/clips/fedcba9876543210.wav');
report.enable(false);
assert.equal(played[1].paused,true);
assert.equal(report.status.active,null);
assert.equal(report.status.enabled,false);
assert.equal(remoteRequests,1,'Do not call AI or TTS endpoints');
assert.deepEqual(errors,[]);
assert.equal(reportAudioCategory({key:'massmission:4:1'}),'mission');
assert.equal(report.enqueue({key:'anythingelse',text:'想定外の報告'}),false,'Unsupported reports must remain text-only');
console.log('PASS recorded natural commander and scout reports, never electronic TTS');
