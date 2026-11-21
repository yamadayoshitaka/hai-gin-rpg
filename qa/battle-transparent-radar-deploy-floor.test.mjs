import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
 parseExplorationDestination,explorationDestination,buildingFloorChoices
} from '../src/battle-exploration-floor.js';

const battle=()=>readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const ui=()=>readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');

test('building picker retains both building ID and intended floor',()=>{
 const id='house-uuid-17';
 assert.deepEqual(parseExplorationDestination(explorationDestination(id,3)),{buildingId:id,floor:3});
 assert.deepEqual(parseExplorationDestination(id),{buildingId:id,floor:1});
 assert.deepEqual(buildingFloorChoices({structure:{floors:[{}, {}, {}]}}),[1,2,3]);
 assert.deepEqual(buildingFloorChoices({structure:{floors:[{}, {}, {}]}},{enableUpperFloors:false}),[1]);
 assert.deepEqual(buildingFloorChoices({structure:{floors:[{}]}}),[1]);
 assert.equal(explorationDestination(id,0),id+'@1');
});

test('cyan deploy tiles require the same complete team plan as the onDeploy callback',()=>{
 const source=ui(),world=battle();
 assert.match(source,/previewDeploy\(selectedId,point\)/);
 assert.match(source,/deploymentTiles\.find\(tile=>/);
 assert.match(source,/chooseMapCell\(hit\.x,hit\.z\)/);
 assert.match(source,/mode==='deploy'\?\{x,z\}:getLegalPoint/);
 assert.match(world,/function skirmishTeamDeploymentPlan\(id,point\)/);
 assert.match(world,/previewDeploy:\(id,point\)=>/);
 assert.match(world,/const slots=skirmishTeamDeploymentPlan\(id,point\)/);
});

test('selected floor controls real building exploration and staircase route',()=>{
 const world=battle();
 assert.match(world,/className='exploreFloorControl'/);
 assert.match(world,/explorationDestination\(b\.id,floors\.get\(b\.id\)\|\|1\)/);
 assert.match(world,/const \{buildingId,floor\}=parseExplorationDestination\(destination\)/);
 assert.match(world,/find\(item=>item\.floor===floor\)/);
 assert.match(world,/requestUnitFloor\(a,1,exploring\.building,\{forceStairs:true\}\)/);
 assert.match(world,/manualHighGroundGoal=wantedFloor/);
 assert.match(world,/instanceId:task\.buildingId,floor:task\.floor\|\|1/);
});
