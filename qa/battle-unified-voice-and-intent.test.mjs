import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formatSquadIntent} from '../src/battle-squad-intent.js';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const menu=read('index.html');
const storyMenu=read('game.html');
const battle=read('tactics-wireframe.html');
const preview=read('battle-voice-test.html');
const sound=read('src/battle-voice-library.js');
const reports=read('src/battle-report-speech.js');
const creature=read('src/combat-creature-sounds.js');
const manifest=JSON.parse(read('audio/voicevox/manifest.json'));

assert.match(menu,/game\.html/,'Index opens the current story-first game menu');
assert.match(storyMenu,/tactics-wireframe\.html\?army=50/,'CPU battle remains accessible');
assert.match(storyMenu,/灰銀戦記/,'Latest game title is preserved');
const battleVersion=battle.match(/version:'(\d+\.\d+(?:\.\d+)?)'/)?.[1];
assert.ok(battleVersion,'The battle runtime exposes a version');
assert.ok(battle.includes(`リアルタイム軍団戦 v${battleVersion}`));
assert.ok(preview.includes('battle-voice-library.js?v=voice-roster-25'));
assert.ok(battle.includes('battle-voice-library.js?v=voice-roster-25'));
assert.ok(preview.includes('battle-report-speech.js?v=natural-reports-3')||
  preview.includes('battle-report-speech.js?v=natural-reports-3'));
assert.ok(battle.includes('battle-report-speech.js?v=natural-reports-3'));
assert.ok(battle.includes('createCreatureSoundRuntime({'));
assert.ok(battle.includes("createBattleOrchestralScore()"));
assert.ok(battle.includes("battleVoice.command(actor,command)"));
assert.ok(battle.includes("battleVoice.cue(kind,actor)"));
assert.ok(battle.includes("reportSpeech.update()"));
assert.ok(!battle.includes('SpeechSynthesisUtterance'),'Old native TTS must be removed from game runtime');
assert.ok(!battle.includes('speechSynthesis'),'Old browser speech fallback must not return');
assert.ok(!battle.includes('function startBgm()'),'Do not keep two BGM engines');
assert.ok(!preview.includes('speechSynthesis'),'Voice preview must not depend on device-generated voices');
assert.ok(!sound.includes('speechSynthesis'),'Shared recorded voice director must remain natural only');
assert.ok(!reports.includes('speechSynthesis'),'Recorded commander reports have no electronic fallback');
assert.ok(!creature.slice(creature.indexOf('export function createCreatureSoundRuntime(')).includes('synthesizeCreatureVoice('),'The game creature sound runtime cannot call electronic voice synthesis');
const recordings=Object.keys(manifest.clips||{});
assert.ok(recordings.some(key=>key.startsWith('report::')),'Commander natural reports are published');
assert.ok(recordings.some(key=>key.includes('剣士::attack')),'Recorded soldier voices are published');

assert.match(battle,/import \{formatSquadIntent\} from '\.\/src\/battle-squad-intent\.js\?v=[^']+';/);
assert.ok(battle.includes("currentOrder.className='squadCurrentOrder'"));
assert.ok(battle.includes("objective.className='squadObjective'"));
assert.ok(battle.includes("currentOrder.textContent=intent.order;objective.textContent=intent.purpose"));
assert.ok(battle.includes('label.userDataCurrentOrder.textContent=shortOrder'));
assert.ok(battle.includes("label.userDataStrength.textContent=sum.n+'/'+sum.total"));
assert.ok(battle.includes('label.userDataObjective.textContent=intent.purpose'));
// Both armies use circular markers showing live counts; tapping an allied circle opens the action chooser.
assert.ok(battle.includes('label.userDataCurrentOrder.hidden=false'),
 'Status must remain legible inside the overhead callout circle');
assert.ok(battle.includes('label.userDataObjective.hidden=true'));
assert.ok(battle.includes('compactSquadMarkerStyles'));
assert.ok(battle.includes("label.classList.toggle('defeated',sum.n===0)"));
assert.ok(battle.includes('function refreshSquadCircleInfo()'));
assert.ok(battle.includes('function positionSquadCircleInfo(label)'));
assert.ok(battle.includes("['戦死 '+fallen+'名','squadLoss']"));
assert.ok(battle.includes("['作戦 '+fixedStrategy,'squadFixedStrategy']"));
assert.ok(battle.includes('[intent.order,\'\']'));
assert.ok(battle.includes('[intent.purpose,\'\']'));
assert.ok(battle.includes('else openSquadTactics(id);'),
 'Tap on an allied circle opens the command/item chooser');
assert.ok(battle.includes('#allySquadRibbon,#enemySquadRibbon,#squadCircleInfo{display:none!important}'),
 'Sidebars and obsolete one-line status strip are retired');
assert.ok(battle.includes('lockedStrategyPanel.hidden=true'),
 'Fixed strategy must not appear as an in-battle menu control');
assert.ok(!battle.includes("heading('個別命令')"),'Remove manual individual missions from squad popup');
assert.ok(!battle.includes("add('📍 行き先を指定','move',()=>beginSquadDestination(id))"),
 'Current quick orders deliberately omit destination');
assert.ok(battle.includes('id="squadDestination" hidden aria-hidden="true"'));

assert.ok(battle.includes('id="squadCircleInfo" hidden'));
assert.ok(battle.includes('#squadCircleInfoContent{display:flex'));

assert.ok(battle.includes('id="battleCasualties"'));
assert.ok(battle.includes('id="corpseLifetime"'));

const defend=formatSquadIntent({mode:'defend'});
assert.equal(defend.order,'号令：守備');
assert.match(defend.purpose,/HP回復・物理\/魔法耐性強化/);
const move=formatSquadIntent({mode:'move',destination:{x:30,z:48}});
assert.equal(move.order,'号令：移動');
assert.equal(move.purpose,'目的：座標(30,48)へ進軍');
const mission=formatSquadIntent({mode:'mission',mission:'橋を壊す',destination:{x:12,z:36}});
assert.equal(mission.order,'号令：任務遂行');
assert.match(mission.purpose,/橋を壊す \(12,36\)/);
const recovery=formatSquadIntent({mode:'defend',healingFrom:'第3部隊'});
assert.match(recovery.order,/守備＋回復要請/);
assert.match(recovery.purpose,/第3部隊が救護中/);
const support=formatSquadIntent({mode:'heal',targetName:'第1部隊'});
assert.match(support.purpose,/第1部隊を広域治癒/);
const enemy=formatSquadIntent({team:1,mode:'charge'});
assert.equal(enemy.order,'号令：突撃','The enemy also advertises its selected initial command');
assert.equal(formatSquadIntent({team:1,mode:'balanced'}).order,'号令：自動戦闘');
assert.match(formatSquadIntent({team:1,mode:'explore',destination:{buildingName:'城'}}).purpose,/城を探索・物資回収/);
const fallen=formatSquadIntent({mode:'charge',commanderUnavailable:true});
assert.match(fallen.order,/軍師不在・追加命令不可/);
const defeated=formatSquadIntent({mode:'defend',defeated:true});
assert.equal(defeated.purpose,'目的：生存兵なし');

console.log('PASS: natural voice game + single-tap circular squad markers, casualties and selected details');
