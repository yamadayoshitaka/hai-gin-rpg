import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBattleReportSpeech} from '../src/battle-report-speech.js';
import {registerSquadCircleTap,chooseSquadZoomTarget,SQUAD_CIRCLE_DOUBLE_TAP_MS,shouldHideSquadLabelsAtDistance,SQUAD_CLOSEUP_HIDE_DISTANCE,SQUAD_CLOSEUP_SHOW_DISTANCE} from '../src/battle-squad-circle-tap.js';

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
assert.doesNotMatch(html,/mission\('🌉 橋を壊す','destroy_bridge'\)/,
 'The manual per-object mission menu is no longer available');
assert.match(html,/add\('📍 行き先','move',\(\)=>beginSquadDestination\(id\)\)/,
 'Squad destination remains one tap away');
assert.match(html,/#squadMissionChoice,#squadTacticsMissions[^\n]*display:none!important/);
assert.match(html,/if\(issueSquadOrder\(mode\)\)closeSquadTactics\(\)/,
 'An immediate order should not require a second confirmation');
assert.doesNotMatch(html,/select\.dispatchEvent\(new Event\('change',\{bubbles:true\}\)\)/,
 'Do not present the obsolete individual mission picker');
assert.match(html,/btn\.disabled=\(needsCommander&&\(!commander\|\|cooldown>0\)\)\|\|!enabled/,
 'Unavailable orders and orders still under cooldown must be disabled');
assert.match(html,/lastSquadMenuPlacementAt<110/,
 'Avoid position and layout measurement on every rendered frame');
assert.match(html,/const bottomLimit=report&&!report\.hidden\?report\.getBoundingClientRect\(\)\.top-7/,
 'The command popup must not cover the spoken bottom dialogue');
assert.match(html,/onDisplay:report=>reportSpeech\.enqueue\(report\)/);
assert.match(html,/reportSpeech\.update\(\)/);

// Mobile marker interaction: only a genuine second tap on the SAME squad
// zooms, never the pointerup+synthetic-click pair of a single gesture.
assert.match(html,/function zoomToSquadMember\(id,team\)/);
assert.match(html,/registerSquadCircleTap\(lastSquadCircleTap,/);
assert.match(html,/label\.style\.touchAction='manipulation'/);
assert.match(html,/performance\.now\(\)-lastSquadPointerReleaseAt<350/);
assert.match(html,/activateSquadLabel\(id,team,event\.clientX,event\.clientY\)/);
assert.match(html,/followCamera=true;\s*setBattleCamera\(focus,/);
assert.equal(SQUAD_CIRCLE_DOUBLE_TAP_MS,420,
 'The single-tap disclosure delay matches the double-tap recognition window');
assert.match(html,/followCamera=true;\s*closeSquadCircleInfo\(\);\s*setBattleCamera\(focus,/,
 'Double-tap must close previous squad information before a character close-up');
assert.match(html,/syncSquadCloseupLabels\(\);\s*setCameraActive\(null\)/,
 'Camera close-up must immediately hide squad overlays without a frame of flicker');
assert.match(html,/pendingSquadCircleInfoTimer=setTimeout\(\(\)=>\{/,
 'Single-tap info waits until the gesture is unambiguously a single tap');
assert.match(html,/\},SQUAD_CIRCLE_DOUBLE_TAP_MS\);/,
 'Single-tap render delay uses the same window as double-tap detection');
assert.match(html,/if\(tap.doubleTap\)\{\s*zoomToSquadMember\(id,team\);\s*return;/,
 'Double-tap zoom never reopens the squad status strip');
assert.match(html,/function closeSquadCircleInfo\(\)\{\s*cancelPendingSquadCircleInfo\(\);/,
 'Closing info must also cancel a pending delayed display');
assert.match(html,/if\(!battleReady\|\|finished\|\|squadCloseupLabelsHidden\|\|!lastSquadCircleTap\|\|/,
 'The delayed info timer must not reopen the strip in close-up mode');
assert.equal(SQUAD_CLOSEUP_HIDE_DISTANCE,12);
assert.equal(SQUAD_CLOSEUP_SHOW_DISTANCE,16);
assert.equal(shouldHideSquadLabelsAtDistance(8.8,false),true,'8.8m close-up hides all squad labels');
assert.equal(shouldHideSquadLabelsAtDistance(15.3,false),false,'normal battle camera keeps ribbons');
assert.equal(shouldHideSquadLabelsAtDistance(14,true),true,'hysteresis prevents flicker');
assert.equal(shouldHideSquadLabelsAtDistance(20,true),false,'zooming out restores ribbons');
for(const id of ['allySquadRibbon','enemySquadRibbon','squadScreenLabels','squadCircleInfo'])
 assert.match(html,new RegExp('body\\.squad-closeup #'+id),
  id+' must be hidden together during close-up');
assert.match(html,/document\.body\.classList\.toggle\('squad-closeup',hide\)/,
 'camera sync controls all squad label visibility');
assert.match(html,/syncSquadCloseupLabels\(\);\s*updateSquadScreenLabels\(dt\)/,
 'manual pinch zoom also synchronizes close-up labels');
const firstTap=registerSquadCircleTap(null,{key:'0:3',x:120,y:220,at:1000});
assert.equal(firstTap.doubleTap,false);
assert.equal(registerSquadCircleTap(firstTap.pending,{key:'0:3',x:122,y:222,at:1175}).doubleTap,true);
assert.equal(registerSquadCircleTap(firstTap.pending,{key:'0:4',x:122,y:222,at:1175}).doubleTap,false,
 'A different squad circle is never a double tap');
assert.equal(registerSquadCircleTap(firstTap.pending,{key:'0:3',x:122,y:222,at:1600}).doubleTap,false,
 'Two independent taps outside the time window must stay separate');
assert.equal(registerSquadCircleTap(firstTap.pending,{key:'0:3',x:200,y:320,at:1175}).doubleTap,false,
 'Dragged/distant taps must not trigger a zoom');
const squadMembers=[
 {id:1,alive:true,hp:90,isStrategist:true,x:17,z:20},
 {id:2,alive:true,hp:75,isStrategist:false,x:14,z:21},
 {id:3,alive:true,hp:82,isStrategist:false,x:15,z:22}
];
const firstZoom=chooseSquadZoomTarget(squadMembers);
assert.equal(firstZoom.unit.id,1,'First double tap prioritizes the living strategist');
const secondZoom=chooseSquadZoomTarget(squadMembers,firstZoom.nextPreferred);
assert.notEqual(secondZoom.unit.id,1,'Next double tap focuses a living soldier');
assert.equal(chooseSquadZoomTarget(squadMembers.filter(u=>u.id!==1),'strategist').role,'soldier',
 'A lost strategist must fall back to living troops');
assert.equal(chooseSquadZoomTarget(squadMembers.map(u=>({...u,hp:0}))).unit,null,
 'An annihilated squad must never zoom to a corpse');

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
