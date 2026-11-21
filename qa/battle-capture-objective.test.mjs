import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBattleCaptureObjective} from '../src/battle-capture-objective.js';

test('enemy starting position becomes a real walkable victory marker',()=>{
 const tracker=createBattleCaptureObjective({worldSize:60,isWalkable:(x,z)=>!(x===35&&z===30)});
 assert.equal(tracker.ensure([]),null,'no invented location before enemy squads are known');
 const marker=tracker.ensure([{x:35,z:30}]);
 assert.equal(marker.kind,'capture');
 assert.ok(marker.x!==35||marker.z!==30,'impassable enemy center is not a winning tile');
 assert.equal(marker.radius,11);
 assert.deepEqual(tracker.ensure([{x:3,z:4}]),marker,'capture point remains fixed after enemies move');
});

test('capture requires living allies in zone, no living enemies, and eight seconds of control',()=>{
 const goal=createBattleCaptureObjective({worldSize:60,radius:6,holdSeconds:8});
 const marker=goal.ensure([{x:30,z:30}]);
 const ally={team:0,hp:100,alive:true,x:marker.x,z:marker.z};
 const enemy={team:1,hp:50,alive:true,x:marker.x,z:marker.z};
 goal.tick([ally,enemy],0);
 goal.tick([ally,enemy],1);
 assert.equal(goal.snapshot().progress,0,'a contested base never progresses');
 goal.tick([ally],2);
 goal.tick([ally],3);
 assert.ok(goal.snapshot().progress>0,'capture begins when defenders leave the circle');
 goal.tick([{...ally,hp:0}],4);
 assert.ok(goal.snapshot().progress<25,'fallen allies cannot hold the flag');
 for(let second=5;second<=15;second++)goal.tick([ally],second);
 assert.equal(goal.snapshot().complete,true,'holding the point without defenders wins');
 assert.equal(goal.snapshot().progress,100);
 goal.tick([enemy],17);
 assert.equal(goal.snapshot().complete,true,'completed victory stays complete');
});

test('quick orders keep only the four prebattle strategies plus usable inventory',()=>{
 const ui=readFileSync(new URL('../src/targeted-strategy-runtime.js',import.meta.url),'utf8');
 const main=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 const hud=readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');
 for(const kind of ['assault','defense','balanced','explore'])
  assert.match(ui,new RegExp('data-strategy-quick="'+kind+'"'));
 assert.match(ui,/step='quick';family='attack'/);
 assert.match(ui,/data-strategy-start="item"/);
 assert.match(ui,/onQuickOrder\(\{groupId,strategy,squadIds:/);
 assert.match(main,/captureObjective\.tick\(massSim\?\.units\?\?actors,elapsed\)/);
 assert.equal((main.match(/if\(!ally\|\|\(!foe&&!captureObjective\)\)completeBattle\(Boolean\(ally\)/g)||[]).length,2,
  'capture battles must not end when all defenders die until the zone is secured');
 assert.match(hud,/const captureMessage=goal\?\.kind==='capture'/);
 assert.match(hud,/ctx\.fillText\('⚑',gx/);
});
