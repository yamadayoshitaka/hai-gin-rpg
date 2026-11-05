import assert from 'node:assert/strict';
import {createSpiralStairPlan,spiralStairLanding,spiralStairProgress} from '../src/spiral-staircase.js';
import {createCatalogBuildingStructure} from '../src/building-structure.js';
import {STARTER_TOWN} from '../src/starter-town.js';
import {getBuildingLayouts} from '../src/interior-scenes.js';
import {createInteriorAreaGraph,AreaPortalSystem} from '../src/interior-areas.js';
import {createBuildingBlueprint} from '../src/world-blueprints.js';
import {stairCollision} from '../src/stair-collision.js';

const catalogFixtures={
 castle_001:{id:'castle_001',widthCells:100,depthCells:100},
 town_house_001:{id:'town_house_001',widthCells:10,depthCells:10},
 stone_hut_001:{id:'stone_hut_001',widthCells:20,depthCells:20},
 manor_noble_001:{id:'manor_noble_001',widthCells:17,depthCells:15},
 church_001:{id:'church_001',widthCells:11,depthCells:13}
};
const castle=createCatalogBuildingStructure(catalogFixtures.castle_001);
assert.equal(castle.floors.length,3,'Castle has 3 genuinely addressable decks');
assert.equal(castle.stair.flights.length,2,'Castle has two consecutive spiral flights');
assert.equal(castle.entrance.floor,1,'Only exterior entrance on 1F');
assert.equal(castle.entrance.door.lockLevel,5);
for(const flight of castle.stair.flights){
 assert.ok(flight.steps.length>=45);
 assert.equal(flight.steps.length,castle.stair.stair.steps);
 assert.equal(flight.toFloor,flight.fromFloor+1);
 assert.ok(flight.steps.every((step,i)=>i===0||step.top>flight.steps[i-1].top));
 assert.equal(new Set(flight.steps.map(s=>s.middleAngle.toFixed(3))).size,flight.steps.length);
}
assert.ok(castle.floors.slice(1).every(f=>f.stairOpening.width>0));
for(const id of ['town_house_001','stone_hut_001','manor_noble_001','church_001']){
 const structure=createCatalogBuildingStructure(catalogFixtures[id]);
 assert.equal(structure.floors.length,2,id);
 assert.equal(structure.stair.flights.length,1,id);
 assert.equal(structure.entrance.floor,1,id);
}
const blueprint=createBuildingBlueprint({id:'castle',kind:'manor',floors:3});
assert.equal(blueprint.floors.length,3);
assert.equal(blueprint.stair.type,'spiral');
assert.equal(blueprint.entrance.floor,1);
assert.equal(blueprint.entrance.door.lockLevel,5);
const path=createSpiralStairPlan(blueprint.stair,{floors:3});
const bottom=spiralStairLanding(blueprint.stair,'bottom');
const top=spiralStairLanding(blueprint.stair,'top');
assert.ok(spiralStairProgress(blueprint.stair,bottom).progress<.001);
assert.ok(spiralStairProgress(blueprint.stair,top).progress>.999);
assert.equal(stairCollision(blueprint.stair,{x:blueprint.stair.x,z:blueprint.stair.z}).blocked,true,'Central post blocks movement');
assert.equal(stairCollision(blueprint.stair,bottom,.25).blocked,false,'Walkable tread');
assert.equal(path.flights.length,2);
const graph=createInteriorAreaGraph(STARTER_TOWN.buildings,getBuildingLayouts);
const transit=new AreaPortalSystem();
assert.equal(transit.execute({graph,currentAreaId:'castle:floor:2',portalId:'castle:upstairs:2'}).to,'castle:floor:3');
assert.equal(transit.execute({graph,currentAreaId:'castle:floor:3',portalId:'castle:downstairs:3'}).to,'castle:floor:2');
console.log('Spiral building structure and three-story castle validated');
