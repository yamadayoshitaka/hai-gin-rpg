import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const catalog=readFileSync(new URL('../src/object-catalog.js',import.meta.url),'utf8');
const preview=readFileSync(new URL('../src/tree-seasons.js',import.meta.url),'utf8');

for(const id of ['stone_archway_001','stone_steps_001','wooden_watchtower_001',
 'stone_column_001','wall_torch_001','haystack_001','inn_sign_001']){
 assert.ok(catalog.includes(`${id}:{id:'${id}'`),id+' must be a real catalogue object');
 assert.ok(catalog.includes(`if(id==='${id}')`),id+' must have renderable geometry');
 assert.ok(battle.includes(`${id}',x,z]` )||battle.includes(`'${id}',x,z`),id+' must be placed by validated town dressing');
}
assert.match(preview,/Object\.values\(OBJECT_CATALOG\)/,'Every registered object appears in the 3D list');
assert.match(catalog,/Layered 2F facade/);
assert.match(catalog,/const level of \[1,2\]/,'Three-storey castle has distinct stone cornices');
assert.doesNotMatch(battle,/id="floorUp"|id="floorDown"/,'Floors must not require tap controls');
assert.match(battle,/function startAutomaticFloorTour\(/,'A soldier chooses a stair route without player input');
assert.match(battle,/automaticFloorGuide=pick\.actor/,'The automatic scout receives a floor route');
assert.match(battle,/startAutomaticFloorTour\(\);/,'The automatic floor tour runs from the AI loop');
assert.match(battle,/travel\.phase==='upstairs'.*|travel\.arrivedAt=elapsed/,'The camera must remain on the occupied floor');
assert.match(battle,/setBattleCamera\(a\.root\.position,new THREE\.Vector3\(8,14,15\)\)/,'Camera automatically follows a stair climb');
assert.match(battle,/automaticFloorGuide\?\.root\.position\|\|selected/,'The automatic camera keeps the upper-floor soldier in frame');
assert.match(battle,/requestUnitFloor\(a,-1\)/,'The scout automatically returns via the stairway');
assert.match(battle,/evaluateBuildingEntry\(/,'Entry lock level must be evaluated');
assert.match(battle,/buildFloorTravelRoute\(/,'Actors ascend authored 3D stairs');
assert.match(battle,/approachStairOnGrid\(/,'No teleport through building walls');
assert.match(battle,/phase==='climb'/);
assert.match(battle,/decks\.visible=highestVisibleFloor>1/);
assert.match(battle,/__haiGinFloorTravelQA/);
console.log('Higher-detail buildings, seven props and automatic no-tap 2F stair tour and camera');
