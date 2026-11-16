import assert from 'node:assert/strict';
import {createBattleObjectiveCheckpoints} from '../src/battle-objective-checkpoints.js';
const units=[
 ...Array.from({length:4},(_,i)=>({team:1,squadId:'E1',hp:10,alive:true})),
 ...Array.from({length:2},(_,i)=>({team:1,squadId:'E2',hp:10,alive:true}))
];
const locations=new Map([['A',{x:20,z:20}],['B',{x:30,z:30}]]);
let objects=[{id:'bridge',alive:true}],messages=[],displays=[];
const tracker=createBattleObjectiveCheckpoints({
 getUnits:()=>units,getObjects:()=>objects,
 getSquadCenter:id=>locations.get(id),
 onReport:t=>messages.push(t),onChange:t=>displays.push(t)
});
tracker.register({groupId:2,mode:'charge',squadIds:['A','B'],targetIds:['E1','E2']});
assert.equal(tracker.snapshot()[0].progress,0);
units.slice(0,3).forEach(u=>u.hp=0);tracker.update();
assert.equal(tracker.snapshot()[0].progress,50);
units.forEach(u=>u.hp=0);tracker.update();
assert.equal(tracker.snapshot()[0].status,'達成');
tracker.register({groupId:1,mode:'defend',squadIds:['A','B'],point:{x:20,z:20}});
tracker.update();assert.equal(tracker.snapshot()[1].progress,50);
locations.set('B',{x:21,z:19});tracker.update();
assert.equal(tracker.snapshot()[1].status,'達成');
tracker.register({groupId:3,mode:'destroy',squadIds:['B'],targetIds:['bridge']});
objects=[];tracker.update();
assert.equal(tracker.snapshot()[2].progress,0,'missing target must not falsely count as destroyed');
objects=[{id:'bridge',alive:false}];tracker.update();
assert.equal(tracker.snapshot()[2].progress,100);
tracker.register({groupId:1,mode:'weaken',squadIds:['A'],targetIds:['E1']});
assert.equal(tracker.snapshot().at(-1).status,'達成');
assert.ok(messages.some(t=>t.includes('CP1')&&t.includes('50%')));
assert.ok(displays.some(t=>t.includes('第2班')));
console.log('PASS: attack, map arrival, explicit object destruction, instant actions and checkpoint reports');
