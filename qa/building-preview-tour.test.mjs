import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCatalogBuildingStructure} from '../src/building-structure.js';
import {buildingPreviewPhase,buildingPreviewCamera} from '../src/building-preview-tour.js';

const castle=createCatalogBuildingStructure({id:'castle_001',widthCells:100,depthCells:100},{cellSize:1});
const home=createCatalogBuildingStructure({id:'town_house_001',widthCells:10,depthCells:10},{cellSize:1});
assert.deepEqual([0,6,12,18,24,30].map(t=>buildingPreviewPhase(castle,t)?.floor),[0,1,2,3,0,1]);
assert.deepEqual([0,6,12,18].map(t=>buildingPreviewPhase(home,t)?.floor),[0,1,2,0]);
for(const [structure,floors] of [[castle,3],[home,2]]){
 for(let n=1;n<=floors;n++){
  const pose=buildingPreviewCamera(structure,n);
  assert.equal(pose.target.y,structure.floors[n-1].baseY+structure.floors[n-1].height*.28);
  const castleOverview=structure.id==='castle_001'&&n>1;
  assert.equal(pose.target.x,castleOverview?0:structure.stair.stair.x);
  assert.equal(pose.target.z,castleOverview?0:structure.stair.stair.z);
  assert.ok(pose.offset.y>8);
 }
}
assert.throws(()=>buildingPreviewCamera(castle,4),/does not exist/);
assert.equal(buildingPreviewPhase(null,0),null);
const list=readFileSync(new URL('../object-list.html',import.meta.url),'utf8');
const viewer=readFileSync(new URL('../src/tree-seasons.js',import.meta.url),'utf8');
assert.match(list,/royal-rooms-43/,'Object-list loader must bust the old preview cache');
assert.match(viewer,/function updateBuildingTour\(/,'Object list must drive the automatic floor tour');
assert.match(viewer,/roof\.visible=phase\.mode==='exterior'/,'Roof opens without tapping');
assert.match(viewer,/slab\.visible=slabFloor<=phase\.floor/,'Only reached floors are shown in cutaway');
assert.match(viewer,/buildingPreviewCamera\(/,'Camera follows real stair BOM elevations');
console.log('Object list automatically cycles building exterior, second floor and castle third floor');
