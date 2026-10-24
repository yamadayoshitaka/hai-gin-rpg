import assert from 'node:assert/strict';
import { EntityDataSystem } from '../src/data-systems.js';

const system=new EntityDataSystem();
const definitions={
  hero:{state:{hp:100,gold:50},actions:{
    hurt:{requires:['damage'],updates:{hp:{op:'subtract',from:'damage',min:0}},effects:[{type:'animation',params:{name:'hit'}}]},
    earn:{requires:['amount'],updates:{gold:{op:'add',from:'amount'}}}
  }},
  inn:{state:{open:true},actions:{interact:{effects:[{type:'open-menu',params:{menu:'inn'}}]}}},
  door:{state:{open:false},actions:{interact:{updates:{open:{op:'toggle'}}},rename:{requires:['label'],updates:{label:{from:'label'}}}}}
};
const initial={hero:{hp:40,gold:50}};
const result=system.execute({definitions,state:initial,commands:[
 {entityId:'hero',action:'hurt',payload:{damage:10}},
 {entityId:'hero',action:'earn',payload:{amount:5}},
 {entityId:'inn',action:'interact'},
 {entityId:'door',action:'interact'}
]});
assert.equal(result.state.hero.hp,30);
assert.equal(result.state.hero.gold,55);
assert.equal(result.state.door.open,true);
assert.equal(result.state.inn.open,true);
assert.equal(result.effects.length,2);
assert.equal(result.effects[1].type,'open-menu');
assert.deepEqual(initial,{hero:{hp:40,gold:50}},'input state must not be mutated');
assert.equal(definitions.hero.state.hp,100,'definition must not be mutated');
assert.throws(()=>system.execute({definitions,commands:[{entityId:'hero',action:'hurt',payload:{}}]}),/Missing action input/);
assert.throws(()=>system.execute({definitions,commands:[{entityId:'hero',action:'undefined'}]}),/Unsupported action/);
assert.throws(()=>system.execute({definitions,commands:[{entityId:'missing',action:'interact'}]}),/Unknown entity/);
console.log('Entity data processor tests passed');
