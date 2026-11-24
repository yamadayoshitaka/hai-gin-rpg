import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formationCombatIntent,isHighGroundFiringJob,highGroundShieldIntent} from '../src/formation-driven-ai.js';
import {reachableRoomExit} from '../src/formation-ai-indoor-route.js';
import {FORMATION_ROLES} from '../src/sortie-formation-logic.js';
import {FORMATION_TEMPLATE_LIMITS} from '../src/sortie-formation-template-rules.js';
import {FORMATION_SIGNATURE_STRATEGIES} from '../src/formation-signature-strategies.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

for(const formation of ['attack','balanced','support','highground','pincer','fortress']){
 const ally=formationCombatIntent({formation,jobId:'archer',hasEnemies:true});
 const enemy=formationCombatIntent({formation,jobId:'archer',hasEnemies:true});
 assert.deepEqual(ally,enemy,'no team-specific behavior '+formation);
 assert.equal(ally.order,'charge','non-wait formation attacks '+formation);
}
assert.equal(formationCombatIntent({command:'hold',hasEnemies:true}).order,'hold');
assert.equal(formationCombatIntent({command:'retreat',hasEnemies:true}).order,'retreat');
assert.equal(formationCombatIntent({command:'defend',hasEnemies:true}).order,'defend');
assert.equal(formationCombatIntent({command:'defend',hasEnemies:true,enemyDistance:100}).advance,false);
assert.equal(formationCombatIntent({command:'defend',hasEnemies:true,enemyDistance:4}).advance,true);
assert.equal(formationCombatIntent({formation:'highground',jobId:'archer'}).seekHighGround,true);
assert.equal(formationCombatIntent({formation:'highground',jobId:'mage'}).seekHighGround,true);
assert.equal(formationCombatIntent({formation:'highground',jobId:'shield'}).seekHighGround,false);
assert.equal(formationCombatIntent({formation:'highground',jobId:'archer',indoors:true}).seekHighGround,false);
assert.equal(isHighGroundFiringJob('priest'),false);
assert.equal(isHighGroundFiringJob('summoner'),true);
assert.equal(formationCombatIntent({formation:'highground',jobId:'summoner'}).seekHighGround,true);
assert.equal(formationCombatIntent({formation:'highground',jobId:'summoner'}).role,'highground-summon');
assert.equal(highGroundShieldIntent({assigned:false}).phase,'fallback');
assert.equal(highGroundShieldIntent({assigned:true,ready:false,anchorDistance:8,enemyDistance:3}).phase,'return');
assert.equal(highGroundShieldIntent({assigned:true,ready:true,anchorDistance:3,enemyDistance:12,enemyAnchorDistance:14}).phase,'approach');
assert.equal(highGroundShieldIntent({assigned:true,ready:true,anchorDistance:10,enemyDistance:3,enemyAnchorDistance:12}).phase,'return');
assert.equal(highGroundShieldIntent({assigned:true,ready:true,anchorDistance:3,enemyDistance:2,enemyAnchorDistance:4,luring:true}).phase,'guard');
assert.equal(highGroundShieldIntent({assigned:true,ready:true,anchorDistance:8,healthRatio:.2}).phase,'return');

const room={minX:2,maxX:8,minZ:2,maxZ:8};
const tiles=new Set();
for(let x=3;x<=7;x++)for(let z=3;z<=7;z++)tiles.add(x+','+z);
tiles.add('5,8');tiles.add('5,9');
const walk=(x,z)=>tiles.has(x+','+z);
assert.deepEqual(reachableRoomExit({x:4,z:4},room,walk),{x:5,z:8},
 'a real south doorway is selected from arbitrary starting tiles');
tiles.delete('5,8');
assert.equal(reachableRoomExit({x:4,z:4},room,walk),null,
 'solid walls or locked doors cannot be traversed');
tiles.add('5,8');
assert.deepEqual(reachableRoomExit({x:5,z:8},room,walk),{x:5,z:8});

assert.equal(FORMATION_TEMPLATE_LIMITS.highground.slots,3);
assert.deepEqual(FORMATION_ROLES.highground.slice(0,3),['guard','ranged','ranged']);
assert.equal(FORMATION_SIGNATURE_STRATEGIES.highground.final.length,3);
const battle=read('tactics-wireframe.html');
const mass=read('src/mass-battle-grid-sim.js');
const stage=read('src/three-team-core-bridge.js');
assert.match(battle,/runFormationHighGroundAI\(\)/);
assert.match(battle,/formationCombatIntent\(\{/);
assert.match(battle,/reachableRoomExit\(a\.cell,bounds,/);
assert.match(battle,/monsterId=team===1&&i<6&&previewMonsterId/);
assert.match(battle,/formationType:storyUnit\?\.formationType/);
assert.match(mass,/formationCombatIntent\(\{/);
assert.match(battle,/highGroundShieldIntent\(\{/);
assert.match(mass,/highGroundShieldIntent\(\{/);
assert.match(mass,/formationRolesOnly:best\.formationType==='highground'/);
assert.match(battle,/summoning&&a\._pendingCast/);
assert.match(mass,/u\.jobId==='summoner'&&u\._pendingCast/);
assert.match(mass,/if\(route\.kind==='interior'\)continue/);
assert.match(mass,/this\._releaseHighGroundUnit\(u\);return false/);
assert.doesNotMatch(stage,/orders\[key\]='hold'/);
console.log('PASS: symmetric formation intent, 3-job high-ground fire, real indoor exits and visible skeleton squad');
