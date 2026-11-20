import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {placeOverviewSquadPins} from '../src/battle-overview-squad-pins.js';

test('chosen active squad keeps its projected real position when other badges overlap',()=>{
 const bounds={left:0,right:400,top:0,bottom:400};
 const points=[
  {key:'1:enemy',team:1,squadIndex:0,x:200,y:200,priority:0},
  {key:'0:other',team:0,squadIndex:0,x:201,y:202,priority:0},
  {key:'0:chosen',team:0,squadIndex:1,x:200,y:200,priority:1}
 ];
 const positions=placeOverviewSquadPins(points,bounds,{width:42,height:40});
 const chosen=positions.get('0:chosen'),enemy=positions.get('1:enemy');
 assert.equal(chosen.x,200);assert.equal(chosen.y,200);
 assert.equal(chosen.anchorX,200);assert.equal(chosen.anchorY,200);
 assert.ok(Math.hypot(enemy.x-200,enemy.y-200)>5,'other badges move aside');
 assert.equal(positions.size,3);
});

test('the mobile battle map always marks the actually selected squad and offers a locate action',()=>{
 const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 assert.match(html,/id="overviewCurrentSquadPointer"/);
 assert.match(html,/id="overviewLocateSquad"/);
 assert.match(html,/classList\.toggle\('current-squad',own\)/);
 assert.match(html,/realPosition=points\.find\(p=>p\.key===squadKey\(0,currentAllyId\)\)/);
 assert.match(html,/priority:key===overviewSelectedKey\?2:node\.team===0/);
 assert.match(html,/overviewLocateSquad\.onclick=\(\)=>/);
 assert.match(html,/setBattleCamera\(new THREE\.Vector3\(x,terrainY\(x,z\),z\),cameraOverviewOffset\)/);
 assert.match(html,/const radarSquadId=String\(selectedSquadId\?\?trackedAllySquadId\?\?'\'\)/);
 assert.match(html,/!selected&&k<8&&usedPinCenters/);
 assert.match(html,/◎ 現在位置/);
});
