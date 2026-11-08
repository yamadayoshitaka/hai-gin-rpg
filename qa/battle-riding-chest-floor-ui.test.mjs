import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {riderSeatHeight,riderSeatLocalOffset} from '../src/combat-creature-performance.js';
import {openTreasureChestModel,syncTreasureChestState,TREASURE_CHEST_OBJECT_ID}
 from '../src/treasure-chest-state.js';
import {ROOM_ITEM_TYPES,RoomItemRegistry} from '../src/room-item-registry.js';
import {formatSquadIntent} from '../src/battle-squad-intent.js';

const horse={type:'horse',id:'horse-1',commanderMount:true,alive:true};
assert.ok(riderSeatHeight(horse)>1.55,'horse rider is raised above the leather saddle');
assert.ok(riderSeatLocalOffset(horse).z<-.25,'seat moves behind the shoulders');
assert.ok(riderSeatHeight({type:'dragon',alive:true})>2.6,'broad dragon back has a higher throne');
assert.ok(riderSeatHeight({type:'wolf',alive:true})>1,'wolf rider cannot be inside the spine');

assert.equal(TREASURE_CHEST_OBJECT_ID,'treasure_chest_001');
const objectSource=readFileSync(new URL('../src/object-catalog.js',import.meta.url),'utf8');
assert.match(objectSource,/treasure_chest_001:\{[^\n]*openable:true/);
const lid={rotation:{x:0}},chest={visible:false,userData:{opened:false},getObjectByName(name){
 return name==='treasure_chest_lid'?lid:null;
}};
assert.equal(syncTreasureChestState(chest,'placed'),false);
assert.equal(openTreasureChestModel(chest),true);
assert.equal(chest.visible,true);
assert.equal(chest.userData.opened,true);
assert.ok(lid.rotation.x<-1,'hinge rotates lid backwards');
assert.equal(openTreasureChestModel(chest),false,'opening same chest twice does nothing');
assert.equal(syncTreasureChestState(chest,'collected'),false);

const registry=new RoomItemRegistry();
for(const id of ['healing_potion','high_potion','elixir','iron_key','steel_fragment','arcane_crystal','ancient_emblem'])
 assert.ok(ROOM_ITEM_TYPES[id],id+' listed');
const placed=registry.place('castle-1',{
 id:'loot',floor:1,roomId:'hall',roomName:'大広間',
 x:0,z:0,itemId:'healing_potion',quantity:1
});
assert.ok(registry.setPlacement(placed.id,{itemId:'high_potion',quantity:3}));
assert.equal(registry.get(placed.id).item,'上級回復薬');
assert.equal(registry.pickup(placed.id,'first-soldier'),true);
assert.equal(registry.pickup(placed.id,'second-soldier'),false);
assert.equal(registry.owned('first-soldier')[0].quantity,3);
assert.equal(registry.setPlacement(placed.id,{itemId:'elixir'}),false,
 'opened treasure contents cannot be edited');
assert.equal(registry.consume('first-soldier','high_potion',{hp:20,maxHp:500}),150);

const charge=formatSquadIntent({mode:'charge',commanderOrder:'攻撃速度強化'});
assert.equal(charge.order,'号令：突撃','command names must be identical in buttons and status');
assert.match(charge.purpose,/軍師号令：攻撃速度強化/);
assert.equal(formatSquadIntent({mode:'support'}).order,'号令：支援');

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const mountedRenderer=readFileSync(new URL('../src/combat-world-object-renderer.js',import.meta.url),'utf8');
const mass=readFileSync(new URL('../src/mass-battle-grid-sim.js',import.meta.url),'utf8');
const geometry=readFileSync(new URL('../src/building-structure.js',import.meta.url),'utf8');
assert.match(mass,/object\.x=rider\.x;object\.z=rider\.z/,'lone horse follows rider in authority');
assert.match(mountedRenderer,/riderSmooth\.frame===frame/,'mount and GPU rig share fresh frame');
assert.match(mountedRenderer,/riderX:rider\?riderX:o\.x|rider\?riderX:o\.x/,
 'a culled rider falls back to interpolated grid coordinates');
assert.match(html,/massRenderFrame\);/,'renderer receives current frame ID');
assert.match(geometry,/chest\.userData\.catalogId='treasure_chest_001'/);
assert.match(geometry,/lid\.name='treasure_chest_lid'/);
assert.match(html,/if\(marker\)openTreasureChestModel\(marker\)/);
assert.match(html,/function pursueEnemyOnAnotherFloor\(a\)/);
assert.match(html,/requestUnitFloor\(a,direction,best\.building,\{forceStairs:true\}\)/);
assert.match(html,/function squadEffectiveOrder\(id,team=0\)/);
assert.match(html,/const live=massSim\?\.squadCommands\?\.get\(key\)/);
assert.match(html,/document\.body\.classList\.toggle\('squad-closeup',hide\)/);
assert.match(html,/const catalogHeading=document\.createElement\('h3'\)/);
assert.match(html,/ROOM_ITEM_TYPES\[stack\.itemId\]\?\.kind==='heal'/);
assert.match(html,/const fps=framePerformance\.getStats\(\)\.fps/);
assert.match(html,/if\(hitFxInBatch\+\+<massFxBudget\.hits\)/,
 'VFX density uses the adaptive budget, not the old 12-hit ceiling');
console.log('PASS: saddle clearance, lone rider sync, opened chests, item catalogue, floor chase, squad HUD and GPU VFX budget');
