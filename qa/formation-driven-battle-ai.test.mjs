import {solidInteriorPart,furnitureFootprintCells,strategistRearIntent} from '../src/battle-interior-collision.js';
import assert from 'node:assert/strict';
import {buildSkirmishAssaultFlow,nextSkirmishAssaultStep} from '../src/battle-skirmish-assault-flow.js';
import {readFileSync} from 'node:fs';
import {formationCombatIntent,isHighGroundFiringJob,highGroundShieldIntent,highGroundGroupKey,highGroundRoofGoal,highGroundBaitActive} from '../src/formation-driven-ai.js';
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

// Physical job subdivisions share one army group, not one squad id.
assert.equal(highGroundGroupKey({team:0,armyGroupId:3,squadId:8}),highGroundGroupKey({team:0,armyGroupId:3,squadId:9}));
assert.notEqual(highGroundGroupKey({team:0,armyGroupId:3}),highGroundGroupKey({team:1,armyGroupId:3}));
assert.equal(highGroundGroupKey({team:1,squadId:4}),'1:4');
assert.equal(highGroundRoofGoal({floors:[{},{}]},true),3);
assert.equal(highGroundRoofGoal({floors:[{},{},{}]},true),4);
assert.equal(highGroundRoofGoal({floors:[{},{}]},false),2);
assert.equal(highGroundRoofGoal({floors:[{}]},true),0);
assert.equal(highGroundShieldIntent({assigned:true,ready:true,anchorDistance:12,enemyDistance:Infinity,luring:true}).phase,'return');

let lure=highGroundShieldIntent({assigned:true,ready:true,anchorDistance:31,enemyDistance:12,enemyAnchorDistance:43});
assert.equal(lure.phase,'approach');
lure=highGroundShieldIntent({assigned:true,ready:true,anchorDistance:35,enemyDistance:5,enemyAnchorDistance:40});
assert.deepEqual(lure,{phase:'return',luring:true});
lure=highGroundShieldIntent({assigned:true,ready:false,anchorDistance:16,enemyDistance:Infinity,luring:lure.luring});
assert.deepEqual(lure,{phase:'return',luring:true});
assert.equal(highGroundShieldIntent({assigned:true,ready:true,anchorDistance:4,luring:lure.luring}).phase,'guard');
assert.equal(highGroundBaitActive({distance:12,now:8,until:30,order:'charge'}),true);
assert.equal(highGroundBaitActive({distance:12,now:30,until:30}),false);
assert.equal(highGroundBaitActive({distance:12,now:8,until:30,order:'hold'}),false);
assert.equal(highGroundBaitActive({distance:12,now:8,until:30,alive:false}),false);
// A shield must not turn around immediately after reaching its firing post.
let phase=highGroundShieldIntent({assigned:true,ready:true,anchorDistance:20,enemyDistance:3,enemyAnchorDistance:22,contact:false});
assert.equal(phase.phase,'approach','a wall is not bait contact');
phase=highGroundShieldIntent({assigned:true,ready:true,anchorDistance:20,enemyDistance:3,contact:true});
assert.equal(phase.phase,'return');
for(const distance of [17,12,8,5,4]){
 phase=highGroundShieldIntent({assigned:true,ready:true,anchorDistance:distance,enemyDistance:12,luring:phase.luring,holding:true});
 assert.equal(phase.phase,distance>5?'return':'guard');
}
assert.equal(highGroundShieldIntent({assigned:true,ready:true,anchorDistance:4,enemyDistance:20,holding:true}).phase,'guard');
assert.equal(highGroundShieldIntent({assigned:true,ready:true,anchorDistance:4,enemyDistance:20,holding:false}).phase,'approach');
assert.equal(highGroundBaitActive({distance:40,now:20,until:45,maxDistance:48}),true);
assert.equal(highGroundBaitActive({distance:49,now:20,until:45,maxDistance:48}),false);
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
assert.match(battle,/!preciseGoal&&!a\.isStrategist/);
assert.match(battle,/moveActor\(a,anchor,\.18,CELL\*4,\{preciseGoal:true\}\)/);
assert.match(battle,/enemy\._highGroundBaitId=a\.id/);
assert.match(mass,/target\._highGroundBaitId=u\.id/);
assert.match(mass,/const baitFlow=chaseBait/);
assert.match(mass,/highGroundShieldIntent\(\{/);
assert.match(battle,/highGroundGroupKey\(v\)===highGroundGroupKey\(a\)/);
assert.match(battle,/a\.indoorFloor<travel\.formationRoofGoal/);
assert.match(battle,/a\.floorTravel\.formationRoofGoal=goal/);
assert.match(battle,/formation\.formation==='highground'&&!massSim/);
assert.match(battle,/!a\.floorTravel\.formationHighGround&&\['upstairs','roof'\]/);
assert.match(mass,/formationPosts\.get\(highGroundGroupKey\(u\)\)/);
assert.match(mass,/formationRolesOnly:best\.formationType==='highground'/);
assert.match(battle,/summoning&&a\._pendingCast/);
assert.match(mass,/u\.jobId==='summoner'&&u\._pendingCast/);
assert.match(mass,/if\(route\.kind==='interior'\)continue/);
assert.match(mass,/this\._releaseHighGroundUnit\(u\);return false/);
assert.doesNotMatch(stage,/orders\[key\]='hold'/);
console.log('PASS: symmetric formation intent, 3-job high-ground fire, real indoor exits and visible skeleton squad');

assert.equal(solidInteriorPart({name:'table_top',y:1.17,height:.19},0),true);
assert.equal(solidInteriorPart({name:'woven_rug',y:.18,height:.055},0),false);
assert.deepEqual(furnitureFootprintCells({minX:4.7,maxX:5.2,minZ:1.8,maxZ:2.2},1,0,.26),[{x:5,z:2}]);
assert.equal(strategistRearIntent({home:{x:2,z:2},position:{x:2,z:2}}).phase,'hold');
const evade=strategistRearIntent({home:{x:2,z:2},position:{x:2,z:2},threat:{x:5,z:2}});
assert.equal(evade.phase,'evade');assert.ok(evade.goal.x<2);
assert.match(battle,/furnitureBlocks\(key\)/);
assert.match(battle,/if\(a\.isStrategist\)\{/);
assert.match(battle,/d>range\|\|routeOccludedByTerrain/);
assert.match(mass,/strategistRearIntent\(/);

assert.match(battle,/holding:waiting,contact/);
assert.match(battle,/follower\._highGroundBaitId=a\.id/);
assert.match(battle,/baitDistance>a\.job\.range\/CELL\|\|blocked/);
assert.match(battle,/moveActor\(a,a\._baitChaseGoal\.pos/);

// Execute the real browser bridge controller on a land stage. No bridge,
// navigation, or river coordinate globals may be needed on this branch.
const bridgeStart=battle.indexOf('function crossingWaypoint(actor,worldGoal){');
const bridgeEnd=battle.indexOf('function recoverBlockedActor(a,goal){',bridgeStart);
assert.ok(bridgeStart>=0&&bridgeEnd>bridgeStart);
const landCrossing=new Function('stageHasRiver',battle.slice(bridgeStart,bridgeEnd)+';return crossingWaypoint;')(false);
for(const jobId of ['knight','shield','archer','summoner','ninja']){
 const actor={jobId,cell:{x:90,z:100},crossing:{bridge:{row:100}}};
 assert.equal(landCrossing(actor,{x:140,z:100}),null,'no imaginary river on land: '+jobId);
 assert.equal(actor.crossing,null);
}
// Route around a long fence, including movement away from the enemy along
// the fence and eventual passage at the only genuine opening.
const w=24,h=24,passable=new Uint8Array(w*h).fill(1);
for(let z=0;z<21;z++)passable[z*w+12]=0;
const target={x:18,z:5};
const field=buildSkirmishAssaultFlow(w,h,passable,[target]);
let cell={x:8,z:5},steps=0,passedFence=false;
while(field[cell.z*w+cell.x]>0&&steps<100){
 const next=nextSkirmishAssaultStep(cell,field,w,h,passable,(x,z)=>!!passable[z*w+x]);
 assert.ok(next,'must advance around a real fence');
 assert.ok(field[next.z*w+next.x]<field[cell.z*w+cell.x]);
 assert.equal(passable[next.z*w+next.x],1);
 if(next.x>12)passedFence=true;
 cell=next;steps++;
}
assert.ok(passedFence&&steps<100&&field[cell.z*w+cell.x]===0);
assert.match(battle,/moveActor\(a,goal,0,stop,\{preciseGoal\}\)/);
console.log('PASS: land stages bypass imaginary bridges and real fence route reaches enemy');

// A baited enemy can cross the whole map and a distant bridge before arriving.
for(const distance of [49,100,160,231,327]){
 assert.equal(highGroundBaitActive({distance,now:180,until:Infinity,maxDistance:Infinity,order:'charge'}),true);
 assert.equal(highGroundBaitActive({distance,now:180,until:Infinity,maxDistance:Infinity,order:'retreat'}),false);
}
assert.equal(highGroundShieldIntent({assigned:true,ready:true,anchorDistance:1,enemyDistance:220,enemyAnchorDistance:220}).phase,'approach');
assert.equal(highGroundShieldIntent({assigned:true,ready:true,anchorDistance:220,enemyDistance:4,contact:true}).phase,'return');
assert.equal(highGroundShieldIntent({assigned:true,ready:true,anchorDistance:100,enemyDistance:90,luring:true}).phase,'return');
assert.match(battle,/maxDistance:Infinity,now:elapsed/);
assert.match(mass,/maxDistance:Infinity,now:this.time/);
assert.match(battle,/enemy\._highGroundBaitUntil=Infinity/);
assert.match(mass,/target\._highGroundBaitUntil=Infinity/);
assert.match(battle,/applyLadderPose\(a\)/);
console.log('PASS: long-range bait lock and physical ladder integration');
