import assert from 'node:assert/strict';
import {selectActiveBattleEngagement} from '../src/battle-engagement-camera.js';
const unit=(id,team,squadId,x,z,hp=100)=>({id,team,squadId,x,z,hp,alive:hp>0});
const roster=[unit(1,0,'A',10,10),unit(2,0,'A',10,11),
 unit(3,1,'X',12,12),unit(4,0,'B',80,80),unit(5,1,'Y',90,90)];
const focus=selectActiveBattleEngagement(roster,{mass:true});
assert.equal(focus?.squadId,'A');
assert.equal(focus?.enemySquadId,'X');
assert.equal(focus?.contacts,2);
assert.equal(selectActiveBattleEngagement([unit(1,0,'A',0,0),unit(2,1,'X',20,20)],{mass:true}),null);
assert.equal(selectActiveBattleEngagement([unit(1,0,'A',10,10,0),unit(3,1,'X',11,10)],{mass:true}),null);
console.log('battle contact camera: OK');
