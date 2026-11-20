import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {placeOverviewSquadPins} from '../src/battle-overview-squad-pins.js';

test('mobile battlefield keeps all position dots uncovered while displacing number badges',()=>{
 const bounds={left:0,right:390,top:30,bottom:350};
 const points=[
  {key:'0:a',x:185,y:171,team:0,squadIndex:0,priority:1},
  {key:'0:b',x:185,y:171,team:0,squadIndex:1,priority:0},
  {key:'1:c',x:188,y:174,team:1,squadIndex:0,priority:0},
  {key:'1:d',x:205,y:184,team:1,squadIndex:1,priority:0}
 ];
 const result=placeOverviewSquadPins(points,bounds,{width:42,height:40,avoidAnchors:true});
 assert.equal(result.size,points.length,'every living squad has a badge');
 for(const p of points){
  const badge=result.get(p.key);
  assert.deepEqual({x:badge.anchorX,y:badge.anchorY},{x:p.x,y:p.y},
   'underlying position dot must remain on the real centroid');
  assert.equal(badge.displaced,true,'labels move aside to reveal original position');
  for(const dot of points){
   assert.ok(Math.abs(badge.x-dot.x)>=34||Math.abs(badge.y-dot.y)>=33,
    'no badge may cover a visible real-position dot in typical clustered scenes');
  }
 }
});

test('all valid positions render a foreground visible cyan/red or yellow dot, not only displaced labels',()=>{
 const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 assert.match(html,/#overviewPinDots\{[^}]*z-index:7/);
 assert.match(html,/<svg id="overviewPinDots" aria-hidden="true">/);
 assert.match(html,/overviewPinDots\.append\(dot\)/);
 assert.match(html,/avoidAnchors:true/);
 assert.match(html,/node\.dot\.setAttribute\('cx',String\(loc\.anchorX\)\)/);
 assert.match(html,/node\.dot\.setAttribute\('cy',String\(loc\.anchorY\)\)/);
 assert.match(html,/node\.dot\.style\.display='';/);
 assert.match(html,/currentDot\?'#ffe25e':node\.team\?'#ff5269':'#45e5ff'/);
 assert.doesNotMatch(html,/node\.dot\.style\.display=loc\.displaced\?'':'none'/,
  'old bug hid undisturbed source dots');
});
