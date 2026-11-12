import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sortSquadRibbon,squadRibbonStatus,squadCommandPriority,secondsUntilNextOrder,ORDER_COOLDOWN_SECONDS} from '../src/battle-command-roster.js';
import {BattleHotspotMap} from '../src/battle-hotspot-map.js';
import {createBattleOrchestralScore} from '../src/battle-orchestral-score.js';

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
for(const id of ['allySquadRibbon','allySquadRibbonList','enemySquadRibbon','enemySquadRibbonList',
 'enemySquadIntel','squadActiveOrder','loadingStart','loadingSkipAudio']){
 assert.ok(html.includes('id="'+id+'"'),'Missing interactive UI '+id);
}
assert.match(html,/squadRibbonStatus\(row\)/);
assert.match(html,/button\.disabled=pendingCircleTarget\?!selectable:!state\.enabled\|\|/,
 'Squad ribbon state remains gated by target selection and commander availability');
assert.match(html,/if\(!battleReady\|\|finished\|\|battleCeremony\.locked\|\|pendingCircleTarget\|\|/,
 'Enemy squad inspection is blocked during current command target selection');
assert.match(html,/if\(pendingCircleTarget\)\{chooseCircleActionTarget\(id,team\);return;\}/,
 'the actual circular squad markers must support two-step target selection');
assert.ok(html.includes('else openSquadTactics(id);'),
 'friendly squad circle opens orders');
assert.ok(html.includes('const row=lastRibbonSums.get(key),intent=squadIntent(id,1,row?.n===0);'),
 'enemy squad circle only exposes scout information');
assert.ok(html.includes('#allySquadRibbon,#enemySquadRibbon,#squadCircleInfo{display:none!important}'),
 'old ribbons are intentionally hidden and cannot obscure combat');
assert.match(html,/markRibbonOrderIssued\(id\)/);
assert.match(html,/lastSquadOrderAt\.set\(String\(id\),elapsed\)/);
assert.match(html,/if\(!canChangeSquadOrder\(id\)\)return false/);
assert.match(html,/if\(squad!=null&&!canChangeSquadOrder\(squad\)\)/);
assert.match(html,/if\(!canChangeSquadOrder\(id\)\)return false;/);
assert.match(html,/squadOrderCooldownSeconds\(selectedSquadId\)/);
assert.match(html,/\$\('strategy'\)\.disabled=true/,'Strategy display stays read-only during battle');
assert.doesNotMatch(html,/const remaining=secondsUntilNextOrder\(lastGlobalOrderAt,elapsed\)/,'Global strategy hot-swap was removed');
assert.match(html,/button\.userDataCooldown\.textContent='⏳'\+remaining\+'秒'/);
assert.match(html,/width:clamp\(48px,12\.5vw,62px\)/);
assert.match(html,/const anchor=tracked\?\.alive&&\(tracked\._visualMotion\?/,
 'Follow camera anchor is computed from a living tracked soldier at animated position');
assert.match(html,/const soldiers=alive\.filter\(u=>!u\.isStrategist\)/);
assert.match(html,/focusedHumanUnitId=null;\s*followCamera=false;/,
 'Squad ribbon opens commands without enabling follow-camera close-up');
assert.match(html,/lastRibbonOrderAt\.set\(squadKey\(0,String\(id\)\),elapsed\*1000\)/);
assert.match(html,/const now=elapsed\*1000/);
assert.match(html,/renderSquadRibbons\(sums\)/);
assert.match(html,/const sorted=entries;/,'circle selection keeps squad order stable');
assert.match(html,/battleHotspots\.add\(\{x:hit\.x,z:hit\.z,damage:hit\.damage/);
assert.match(html,/battleHotspots\.draw\(miniCtx,\{limit:24\}\)/);
assert.match(html,/topQuickActions'\)\.appendChild\(\$\('battleMenuToggle'\)\)/);
assert.doesNotMatch(html,/topMenuSlot'\)\.appendChild\(\$\('battleMenuToggle'\)\)/);
assert.match(html,/const stageBgmReady=battleAudio\.prepare\(\)/);
assert.match(html,/const recordingLoaded=await stageBgmReady/);
assert.match(html,/const playing=await battleAudio\.unlock\(\)/);
assert.match(html,/if\(playing\)\{launch\(\);return\}/);
assert.match(html,/onPhase:phase=>\{if\(phase==='intro'\)battleAudio\.orderFanfare\(\)/);
assert.match(html,/else battleAudio\.setPhase\(phase\)/);
assert.match(html,/battleCeremony\.startIntro\(\{stageName:selectedStage\.name,stageFeature:stageCharacter\.feature\}\)/);

assert.equal(ORDER_COOLDOWN_SECONDS,120);
assert.equal(secondsUntilNextOrder(undefined,10),0,'First command is free');
assert.equal(secondsUntilNextOrder(0,0),120,'First change locks for two minutes');
assert.equal(secondsUntilNextOrder(0,3.2),117);
assert.equal(secondsUntilNextOrder(1.5,121.49),1);
assert.equal(secondsUntilNextOrder(1.5,121.5),0,'Unlock exactly at 120s');
assert.equal(secondsUntilNextOrder(5,5),120,'Each squad has its own issue timestamp');
assert.equal(secondsUntilNextOrder(5,125),0);

const list=[
 {id:'balanced',index:0,alive:10,total:10,hpFraction:.94,order:'balanced',commanderAlive:true},
 {id:'critical',index:1,alive:2,total:10,hpFraction:.19,order:'charge',commanderAlive:true},
 {id:'done',index:2,alive:10,total:10,hpFraction:1,order:'defend',commanderAlive:true,changedAt:199000},
 {id:'fallen',index:3,alive:9,total:10,hpFraction:.9,order:'charge',commanderAlive:false}
];
const sorted=sortSquadRibbon(list,200000);
assert.equal(sorted[0].id,'critical','Urgent squad must be at top');
assert.equal(sorted.at(-1).id,'done','Immediately commanded squad must move to the bottom');
assert.equal(squadRibbonStatus({team:0,alive:9,total:10,commanderAlive:false}).enabled,false);
assert.equal(squadRibbonStatus({team:1,alive:9,total:10,commanderAlive:false}).enabled,false);
assert.equal(squadRibbonStatus({team:1,alive:9,total:10}).enabled,true);
assert.equal(squadRibbonStatus({team:1,alive:9,total:10}).reason,'敵軍（号令閲覧のみ）');
assert.equal(squadCommandPriority({alive:3,total:10,hpFraction:.1,order:'charge'})>
 squadCommandPriority({alive:10,total:10,hpFraction:1,order:'balanced'}),true);

let time=5000;
const hotspots=new BattleHotspotMap({now:()=>time});
assert.equal(hotspots.hottest().length,0);
hotspots.add({x:44,z:60,damage:23});
hotspots.add({x:45,z:61,damage:58});
hotspots.add({x:160,z:38,damage:12});
const hits=hotspots.hottest();
assert.ok(hits[0].score>hits[1].score);
const ctx={save(){},restore(){},beginPath(){},arc(){},fill(){},fillText(){},
 createRadialGradient(){return {addColorStop(){}}},set fillStyle(x){},set font(x){},
 set textAlign(x){}};
assert.ok(hotspots.draw(ctx).length>=1);
time+=100000;assert.equal(hotspots.hottest().length,0,'Battle heat must fade after fighting stops');

const made=[];
class FakeAudio{
 constructor(src){this.src=src;this.readyState=4;this.paused=true;made.push(this)}
 play(){this.paused=false;return Promise.resolve()}
 pause(){this.paused=true}
 load(){}
}
const soundtrack=createBattleOrchestralScore({AudioContextClass:null,AudioClass:FakeAudio});
soundtrack.setStage({id:'pine-forest',biome:'forest'});
assert.equal(await soundtrack.prepare(),true,'Real CC0 battle recording is preloaded before start');
assert.equal(await soundtrack.unlock(),true,'Player gesture starts actual recorded soundtrack');
assert.equal(soundtrack.status.recordedBattle,true);
assert.match(soundtrack.status.recordedTrack,/forest\.ogg$/);
soundtrack.setPhase('victory');
assert.match(soundtrack.phase,/victory/);
soundtrack.setEnabled(false);
assert.equal(soundtrack.enabled,false);
console.log('PASS: squad circle commands, enemy scouting, cooldown, battle radar heat, and recorded BGM');
