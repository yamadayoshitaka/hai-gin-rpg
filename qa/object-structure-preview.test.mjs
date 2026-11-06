import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describeCatalogPreviewStructure} from '../src/structure-preview-state.js';
import {STRUCTURE_DURABILITY,STRUCTURE_BURN_RATE} from '../src/destructible-world.js';
import {CombatActionRuntime} from '../src/combat-action-runtime.js';

for(const [id,kind,category] of [
 ['castle_001','castle','建造物'],
 ['town_house_001','house','建造物'],
 ['timber_bridge_001','timber_bridge','建造物'],
 ['stone_bridge_001','stone_bridge','建造物']
]){
 const spec=describeCatalogPreviewStructure(id,{category,kind:kind.endsWith('bridge')?'bridge':'building',widthCells:20,depthCells:10});
 assert.equal(spec.hp,STRUCTURE_DURABILITY[kind]);
 assert.equal(spec.fireDamagePerSecond,STRUCTURE_BURN_RATE[kind]);
 assert.equal(spec.bounds.maxX-spec.bounds.minX,20);
 assert.equal(spec.bounds.maxZ-spec.bounds.minZ,10);
 const runtime=new CombatActionRuntime();
 const object=runtime.registerStructure(spec);
 runtime.hitStructure(object,58,'blast');
 assert.equal(object.hp,spec.hp-58,'C4 should not immediately destroy a structure');
 runtime.igniteStructure(object.id,{initialDamage:18});
 const before=object.hp;
 runtime.beginTick(1,[]);
 assert.equal(object.hp,before-spec.fireDamagePerSecond,'fire must use shared battlefield burn damage');
 if(id==='town_house_001'){
  for(let i=0;i<40&&object.alive;i++)runtime.beginTick(1,[]);
  assert.equal(object.alive,false,'wooden homes should eventually burn and collapse');
 }
}
assert.equal(describeCatalogPreviewStructure('tree',{category:'自然',widthCells:1,depthCells:1}),null);
const preview=readFileSync(new URL('../src/object-structure-demo.js',import.meta.url),'utf8');
assert.match(preview,/new StructureCollapseVfx\(/);
assert.match(preview,/this\.vfx\.collapse\(/);
assert.match(preview,/this\.runtime\.hitStructure\(this\.object,amount,element\)/);
assert.match(preview,/\[data-action="blast"\]/);
const loader=readFileSync(new URL('../src/tree-seasons.js',import.meta.url),'utf8');
assert.match(loader,/structureDemo\.update\(dt,camera\.position\)/);
console.log('Object list previews structural HP, C4 damage, building fire and shared collapse effects');
