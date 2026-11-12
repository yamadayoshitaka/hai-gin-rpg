import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shouldShowOverheadSquadCallouts,closestAliveBattleFocus} from '../src/battle-zoom-visibility-policy.js';
import {reportAudioCategory,BATTLE_REPORT_VOICES,reportAudioKey} from '../src/battle-report-voice-lines.js';
import {createBattleReportSpeech} from '../src/battle-report-speech.js';

assert.equal(shouldShowOverheadSquadCallouts(45),false,
 'Character closeups must not have offscreen squads pinned to the frame');
assert.equal(shouldShowOverheadSquadCallouts(160),true,
 'Whole-map overview must show all squads and leader lines');
assert.equal(shouldShowOverheadSquadCallouts(45,{selectingTarget:true}),true,
 'Target selection must still show tap-able candidate circles');
assert.equal(shouldShowOverheadSquadCallouts(45,{selectingDestination:true}),true);
const players=[
 {team:0,alive:true,hp:100,x:8,z:8},
 {team:1,alive:true,hp:100,x:13,z:11},
 {team:0,alive:false,hp:0,x:12,z:11},
 {team:0,alive:true,hp:100,x:40,z:40}
];
const focus=closestAliveBattleFocus(players,7,5,{gridOffset:6,cellSize:1,maxDistance:20});
assert.equal(focus.unit,players[1], 'Living actual combatant must be chosen instead of dead/offscreen figures');
assert.equal(closestAliveBattleFocus(players,100,100,{gridOffset:6,cellSize:1,maxDistance:10}),null);
assert.equal(closestAliveBattleFocus(players,7,5,{team:0,gridOffset:6,cellSize:1,maxDistance:20})?.unit,players[0]);

assert.equal(reportAudioCategory({key:'enemy-tactical:5:212'}),'overview',
 'Visible scout reports must no longer be silently ignored');
assert.equal(reportAudioCategory({key:'ally-auto-item:5:212'}),'overview');
assert.equal(reportAudioCategory({key:'explore-done:0:2'}),'mission');
const narrated=[];
const text=BATTLE_REPORT_VOICES.overview.lines[0];
const clip=reportAudioKey('overview',text,BATTLE_REPORT_VOICES.overview.voices[0]);
const speaking=createBattleReportSpeech({
 storage:{getItem:()=>null,setItem(){}},now:()=>1000,
 AudioCtor:class {constructor(url){this.src=url;narrated.push(this);} play(){return Promise.resolve()} pause(){}},
 fetcher:async()=>({ok:true,json:async()=>({clips:{[clip]:'audio/voicevox/clips/0123456789abcdef.mp3'}})})
});
await new Promise(resolve=>setImmediate(resolve));
speaking.unlock();
assert.equal(speaking.enqueue({key:'enemy-tactical:5:212',speaker:'斥候',text:'敵部隊が守備へ変更'}),true);
assert.equal(speaking.update(),true,'Prerendered generic command report should be audible');
assert.equal(speaking.status.active,'軍師','The playback status names the actual recording narrator');
assert.equal(narrated.length,1);

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
for(const token of [
 'shouldShowOverheadSquadCallouts(zoomDistance',
 'if(!showCallouts){',
 'marker.userData.screenLabel.hidden=true',
 'const roster=massSim?.units??actors;',
 'const nearby=closestAliveBattleFocus(roster,x,z,{',
 "battleVoice.cue(unit.action==='skill'?'magic':unit.action,a)",
 "id=\"battleVoiceHealth\"",
 'refreshBattleVoiceHealth();'
])assert.ok(html.includes(token),token+' is wired into the battle renderer');
const visibility=readFileSync(new URL('../src/battle-render-visibility.js',import.meta.url),'utf8');
assert.match(visibility,/frustum\.intersectsSphere\(bounds\)\|\|\(distance<14&&inFront\)/,
 'Never cull near-camera real rigs at the frustum edge');
assert.match(visibility,/actor\.character\.object3D\.visible=true/,
 'Recover a character root hidden by an older shared scene state');
const battleScore=readFileSync(new URL('../src/battle-orchestral-score.js',import.meta.url),'utf8');
const voices=readFileSync(new URL('../src/battle-voice-library.js',import.meta.url),'utf8');
assert.match(battleScore,/narrationActive\?\.14:\.43/);
assert.match(voices,/messagePriority\?\.42:\.74/);
console.log('PASS: battle closeups show people, overhead labels only when helpful, natural audio diagnostics and volume');
