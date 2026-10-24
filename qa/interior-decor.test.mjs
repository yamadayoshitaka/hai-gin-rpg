import assert from 'node:assert/strict';
import {STARTER_TOWN} from '../src/starter-town.js';
import {getBuildingLayouts} from '../src/interior-scenes.js';
import {deriveCarpetObjects} from '../src/interior-decor.js';
for(const building of STARTER_TOWN.buildings){
 const layouts=getBuildingLayouts(building);
 const ids=new Set();
 for(const layout of layouts)for(const object of layout.objects){
  assert.ok(!ids.has(layout.id+':'+object.id));
  ids.add(layout.id+':'+object.id);
  if(object.generatedFromId){
   assert.equal(object.model,'carpet');
   assert.equal(object.collision,false);
   assert.ok(layout.objects.some(item=>item.id===object.generatedFromId));
   assert.ok(object.size[0]>0&&object.size[1]>0);
  }
 }
}
const derived=deriveCarpetObjects({objects:[{id:'dinner',model:'table_low',position:[10,0,8]}]});
assert.equal(derived[0].id,'dinner:carpet');
assert.equal(derived[0].collision,false);
assert.equal(deriveCarpetObjects({objects:[{id:'stairs-desk',model:'desk',position:[0,0,-9]}]},{stair:{x:0,z:-9,width:3,run:5.6}}).length,0);
assert.equal(deriveCarpetObjects({objects:[{id:'a',model:'bed_single_A',position:[10,0,8],carpet:false}]}).length,0);
console.log('Data-driven indoor carpets valid');
