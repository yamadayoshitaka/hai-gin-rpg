import assert from 'node:assert/strict';
import {AUTO_ORDER_MODES,FORMATION_DOCTRINES,summarizeSquad,
 chooseAutoSquadOrder,chooseSquadFormation,formationBuffMultipliers,
 adjacentSquadSynergy,chooseArmyDeployment} from '../src/battle-auto-command-formation-policy.js';
const leader={isStrategist:true,alive:true,hp:100};
const troops=Array.from({length:100},(_,i)=>({
 id:i,jobId:i<68?'sword':i<90?'archer':'priest',alive:true,hp:100,maxHp:100
}));
const healthy=summarizeSquad([...troops,leader]);
assert.equal(healthy.total,100);
assert.equal(healthy.roles.front,68);
assert.equal(healthy.roles.range,22);
assert.equal(healthy.roles.heal,10);
assert.equal(healthy.commanderAlive,true);
assert.deepEqual(AUTO_ORDER_MODES,['charge','defend','hold','retreat']);
assert.equal(Object.keys(FORMATION_DOCTRINES).length,6);
assert.equal(chooseSquadFormation({metrics:healthy,enemyRatio:.7}),'arrowhead');
assert.equal(chooseSquadFormation({metrics:healthy,terrain:'bridge'}),'snake');
assert.equal(chooseSquadFormation({metrics:healthy,locked:'diagonal',terrain:'bridge'}),'diagonal');
const injured=summarizeSquad([...troops.map(u=>({...u,hp:25})),leader]);
assert.deepEqual(chooseAutoSquadOrder({metrics:injured,now:1,lastChangedAt:0}).order,'retreat');
assert.equal(chooseAutoSquadOrder({metrics:injured,now:1,lastChangedAt:0}).change,true,'Emergency bypasses dwell');
assert.equal(chooseAutoSquadOrder({metrics:injured,currentOrder:'charge',manualOverride:true}).change,false);
assert.equal(chooseAutoSquadOrder({metrics:injured,currentOrder:'mission'}).change,false);
assert.equal(chooseAutoSquadOrder({metrics:{...injured,commanderAlive:false}}).change,false);
const bruised=summarizeSquad([...troops.map(u=>({...u,hp:45})),leader]);
assert.equal(chooseAutoSquadOrder({metrics:bruised,now:8,lastChangedAt:0}).change,false);
assert.equal(chooseAutoSquadOrder({metrics:bruised,now:22,lastChangedAt:0}).order,'defend');
assert.equal(chooseSquadFormation({metrics:injured,order:'defend'}),'square_circle');
assert.equal(chooseSquadFormation({metrics:healthy,terrain:'stairs'}),'snake');
assert.equal(formationBuffMultipliers('arrowhead',{cohesion:1}).attack,1.3);
assert.equal(formationBuffMultipliers('arrowhead',{cohesion:.3}).attack,1);
assert.ok(formationBuffMultipliers('square_circle',{cohesion:1,commanderAlive:false}).defense<1.25);
const b=adjacentSquadSynergy({nearbySupport:100,nearbyShield:100,nearbyArchers:100});
assert.ok(Object.values(b).every(n=>n<=1.1),'Synergy cannot scale with all 1000 soldiers');
assert.equal(chooseArmyDeployment({objective:'recovery'}),'layered_defense');
assert.equal(chooseArmyDeployment({objective:'environment_prepare'}),'siege');
const timer=performance.now();
for(let i=0;i<10000;i++)chooseAutoSquadOrder({
 metrics:healthy,currentOrder:'defend',now:i/10,lastChangedAt:i/10-40,localEnemyCount:3
});
assert.ok(performance.now()-timer<1200,'Ten squads at six-second intervals must remain cheap');
console.log('PASS allied auto order / six formations / bounded synergy / command safety');
