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
assert.match(html,/heading\('号令：タップですぐ実行'\)/,
 'One-click formation orders are listed directly under the label');
assert.match(html,/instant\('⚔ 進撃','charge'\)/);
assert.match(html,/instant\('🛡 守備','defend'\)/);
assert.match(html,/instant\('↘ 後退','retreat'\)/);
assert.match(html,/mission\('🌉 橋を壊す','destroy_bridge'\)/);
assert.match(html,/if\(issueSquadOrder\(mode\)\)closeSquadTactics\(\)/,
 'An immediate order should not require a second confirmation');
assert.match(html,/select\.dispatchEvent\(new Event\('change',\{bubbles:true\}\)\)/,
 'Targeted orders skip the dropdown and go directly to the map picker');
assert.match(html,/btn\.disabled=needsCommander&&!commander\|\|!enabled/,
 'Unavailable orders are disabled, not faked as completed');
assert.match(html,/lastSquadMenuPlacementAt<110/,
 'Avoid position and layout measurement on every rendered frame');
assert.match(html,/const bottomLimit=report&&!report\.hidden\?report\.getBoundingClientRect\(\)\.top-7/,
 'The command popup must not cover the spoken bottom dialogue');
assert.match(html,/onDisplay:report=>reportSpeech\.enqueue\(report\)/);
assert.match(html,/reportSpeech\.update\(\)/);

let time=1000;
const synthesizer={speaking:true,pending:false,speakCount:0,
 getVoices:()=>[{lang:'ja-JP',name:'Japanese natural'}],
 speak(u){this.speaking=true;this.spoken=u;this.speakCount++;},
 cancel(){throw Error('Must never globally cancel active soldier speech');}
};
const speech=createBattleReportSpeech({synth:synthesizer,
 Utterance:class {constructor(text){this.text=text;}},
 storage:{getItem:()=>null,setItem(){}},now:()=>time,enabled:()=>true});
assert.equal(speech.enqueue({key:'critical',text:'第1隊が危険です',priority:98,kind:'critical'}),true);
assert.equal(speech.update(),false,'Auto-play is blocked until a player gesture');
speech.unlock();
assert.equal(speech.update(),false,'Native speech must not interrupt existing combat TTS');
synthesizer.speaking=false;
assert.equal(speech.update(),true,'Report speech starts on its own logical channel');
assert.equal(synthesizer.speakCount,1);
assert.equal(synthesizer.spoken.text,'第1隊が危険です');
assert.equal(speech.status.active,'軍師');
synthesizer.spoken.onend();
synthesizer.speaking=false;
assert.equal(speech.status.active,null);
speech.enqueue({key:'second',text:'敵が接近しています'});
time+=810;
assert.equal(speech.update(),true);
assert.equal(synthesizer.speakCount,2);
speech.enable(false);
assert.equal(speech.status.enabled,false);
console.log('PASS bottom report, simultaneous audio-channel contract and one-click relevant squad commands');
