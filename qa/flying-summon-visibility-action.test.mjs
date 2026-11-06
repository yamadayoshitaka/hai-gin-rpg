import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CombatActionRuntime} from '../src/combat-action-runtime.js';
import {COMBAT_OBJECT_SPECS} from '../src/combat-action-spec.js';
import {FLYING_CREATURE_ATTACK_RATE,creatureAttackProgress} from '../src/combat-creature-performance.js';

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(game,/function focusFlyingCreatureAt\(screenX,screenY\)/,
  'Flying summons receive a direct screen-space tap target');
assert.match(game,/creatureFlightHeight\(o,creatureVisualTime\)/,
  'Selection height follows real airborne and rooftop altitude');
assert.match(game,/setBattleCamera\(picked.world/,
  'Tap moves the close-up camera to the flying creature rather than the ground');

const geometry=readFileSync(new URL('../src/combat-creature-geometry.js',import.meta.url),'utf8');
assert.match(geometry,/Visible dorsal barding/,
  'Dragon back must have real leather/metal covering in both LODs');

const owner={id:0,team:0,jobId:'summoner',x:7,z:7,hp:1000,alive:true};
const foe={id:1,team:1,jobId:'fighter',x:9,z:7,hp:1000,alive:true};
const runtime=new CombatActionRuntime({width:20,height:20,walkable:new Uint8Array(400).fill(1)});
const sectors=new Map([['1:1',[owner,foe]]]);
runtime.beginTick(.1,[owner,foe],{sectors});
const wyvern=runtime.spawnObject('wyvern',owner);
assert.ok(wyvern?.flying);
let windups=0,hits=0;
for(let tick=0;tick<40;tick++){
  runtime.beginTick(.1,[owner,foe],{sectors});
  for(const event of runtime.events){
    if(event.objectId!==wyvern.id)continue;
    if(event.type==='objectWindup')windups++;
    if(event.type==='objectAttack')hits++;
  }
}
assert.equal(FLYING_CREATURE_ATTACK_RATE,5);
assert.ok(windups>=7&&hits>=7,'A flying familiar visibly attacks many times in four seconds');
assert.ok(foe.hp>1000-40*COMBAT_OBJECT_SPECS.wyvern.attack/FLYING_CREATURE_ATTACK_RATE,
  'Fivefold attack frequency must not become fivefold damage');
assert.equal(creatureAttackProgress({...wyvern,attackStartedAt:2},2+.03)>0,true,
  'Wing/jaw motion follows shortened flying attack cycle');
console.log('飛空召喚獣タップ接近・鞍／背甲・攻撃5倍・威力維持 PASS');
