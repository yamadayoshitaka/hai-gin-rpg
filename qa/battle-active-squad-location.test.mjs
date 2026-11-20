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

test('mobile overview keeps the real position marker without an obstructing location button',()=>{
 const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 assert.match(html,/id="overviewCurrentSquadPointer"/);
 assert.doesNotMatch(html,/id="overviewLocateSquad"/);
 assert.doesNotMatch(html,/📍 操作中/);
 assert.doesNotMatch(html,/#overviewCurrentSquadPointer::after/);
 assert.match(html,/classList\.toggle\('current-squad',own\)/);
 assert.match(html,/realPosition=points\.find\(p=>p\.key===squadKey\(0,currentAllyId\)\)/);
 assert.match(html,/priority:key===overviewSelectedKey\?2:node\.team===0/);
 assert.match(html,/const radarSquadId=String\(selectedSquadId\?\?trackedAllySquadId\?\?'\'\)/);
 assert.match(html,/!selected&&k<8&&usedPinCenters/);
 assert.match(html,/◎ 現在位置/);
});

test('selecting one squad makes other map badges, dots and leaders translucent and restores them on close',()=>{
 const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 assert.match(html,/function syncOverviewSelectionHighlight\(\)/);
 assert.match(html,/node\.pin\.classList\.toggle\('deemphasized',dim\)/);
 assert.match(html,/node\.dot\.classList\.toggle\('deemphasized',dim\)/);
 assert.match(html,/node\.line\.classList\.toggle\('deemphasized',dim\)/);
 assert.match(html,/\.overviewSquadPin\.deemphasized\{opacity:\.27/);
 assert.match(html,/overviewSelectedKey=key;overviewInspectorSignature='';[\s\S]*?syncOverviewSelectionHighlight\(\);/);
 assert.match(html,/overviewSelectedKey=null;overviewInspector\.hidden=true;overviewInspectorSignature='';\s*syncOverviewSelectionHighlight\(\);/);
});
