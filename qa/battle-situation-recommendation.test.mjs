import assert from 'node:assert/strict';
import {recommendBattleTactics} from '../src/battle-quick-recommendation.js';
const ally=(hp,maxHp=100)=>({team:0,hp,maxHp,alive:hp>0,jobId:'swordsman'});
assert.equal(recommendBattleTactics([ally(20),ally(30)]).order,'defend');
assert.equal(recommendBattleTactics([ally(20),ally(0),ally(0)]).order,'retreat');
console.log('situation recommendation: OK');