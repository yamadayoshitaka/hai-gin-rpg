import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBattleReportSpeech} from '../src/battle-report-speech.js';

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const dialogue=readFileSync(new URL('../src/battle-strategist-dialogue.js',import.meta.url),'utf8');
assert.match(dialogue,/#battleDialogue\{[^}]*inset:auto 0 0 0!important/,
 'The whole military report is docked flush to the screen bottom');
assert.match(dialogue,/padding:7px 9px calc\(8px \+ env\(safe-area-inset-bottom,0px\)\)/,
 'The bottom dialogue respects Android gesture safe-area padding');
assert.match(dialogue,/#battleReportHistory\{[^}]*--battleReportHeight/,
 'Report history is always directly above the actual dialogue height');
assert.match(dialogue,/box\.getBoundingClientRect\(\)\.height/,
 'Report history follows changing speech bubble heights');
assert.match(html,/const squadQuickList=document\.createElement\('div'\)/);
assert.match(html,/function buildSquadQuickCommands\(\)/);
assert.match(html,/heading\(cooldown\?'号令：再変更まであと'\+cooldown\+'秒':'号令：タップですぐ実行'\)/,
 'One-click formation orders appear with a live 20-second countdown');
assert.match(html,/instant\('⚔ 突撃','charge'\)/);
assert.match(html,/instant\('🛡 守備','defend'\)/);
assert.match(html,/add\('✨ 回復要請','request_healing'/,
 'Recovery is a one-tap order instead of a control in the HP report');
assert.match(html,/instant\('↘ 退却','retreat'\)/);
assert.match(html,/mission\('🌉 橋を壊す','destroy_bridge'\)/);
assert.match(html,/if\(issueSquadOrder\(mode\)\)closeSquadTactics\(\)/,
 'An immediate order should not require a second confirmation');
assert.match(html,/select\.dispatchEvent\(new Event\('change',\{bubbles:true\}\)\)/,
 'Targeted orders skip the dropdown and go directly to the map picker');
assert.match(html,/btn\.disabled=\(needsCommander&&\(!commander\|\|cooldown>0\)\)\|\|!enabled/,
 'Unavailable orders and orders still under cooldown must be disabled');
assert.match(html,/lastSquadMenuPlacementAt<110/,
 'Avoid position and layout measurement on every rendered frame');
assert.match(html,/const bottomLimit=report&&!report\.hidden\?report\.getBoundingClientRect\(\)\.top-7/,
 'The command popup must not cover the spoken bottom dialogue');
assert.match(html,/onDisplay:report=>reportSpeech\.enqueue\(report\)/);
assert.match(html,/reportSpeech\.update\(\)/);

// Natural military dispatches: prerecorded summaries only, no browser TTS.
let time=1000,manifestFetches=0;
const played=[],storage={getItem:()=>null,setItem(){}};
const criticalLine='味方部隊が壊滅寸前だ！ 援軍を急げ！';
const closeLine='敵影を確認！近距離に敵がいます！';
const clips={
 ['report::critical::'+criticalLine+'::麒ヶ島宗麟']:'audio/voicevox/clips/0123456789abcdef.wav',
 ['report::close::'+closeLine+'::雀松朱司']:'audio/voicevox/clips/fedcba9876543210.wav'
};
class RecordedAudio{
 constructor(path){this.src=path;this.paused=true;played.push(this)}
 play(){this.paused=false;return Promise.resolve()}
 pause(){this.paused=true}
}
const speech=createBattleReportSpeech({
 fetcher:async()=>{manifestFetches++;return {ok:true,json:async()=>({format:2,clips})}},
 AudioCtor:RecordedAudio,storage,now:()=>time,enabled:()=>true
});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(speech.enqueue({key:'critical:1',text:'第1隊が危険です。残存14名。',priority:98,kind:'critical',speaker:'軍師'}),true);
assert.equal(speech.update(),false,'Report audio is blocked until a player gesture');
speech.unlock();
assert.equal(speech.update(),true,'A prerecorded natural military warning plays');
assert.equal(played.length,1);
assert.equal(played[0].src,'./audio/voicevox/clips/0123456789abcdef.wav');
assert.equal(speech.status.active,'軍師');
played[0].onended();
assert.equal(speech.status.active,null);
assert.equal(speech.status.spokenCount,1);
speech.enqueue({key:'close:1',text:'敵が近づいています。距離3マス。',kind:'info',speaker:'斥候'});
time+=810;
assert.equal(speech.update(),true);
assert.equal(played.length,2);
assert.equal(played[1].src,'./audio/voicevox/clips/fedcba9876543210.wav');
speech.enable(false);
assert.equal(speech.status.enabled,false);
assert.equal(played[1].paused,true);
assert.equal(speech.status.electronicTts,false);
assert.equal(speech.status.japaneseVoices,0);
assert.equal(manifestFetches,1);
assert.equal(speech.enqueue({key:'unrecognized',text:'想定外の情報',kind:'info'}),false,
 'Unknown messages remain text-only and cannot trigger an unrelated voice');
console.log('PASS bottom report, recorded-only natural speech, no electronic fallback and one-click relevant squad commands');
