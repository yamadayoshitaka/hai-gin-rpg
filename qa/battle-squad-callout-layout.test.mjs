import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {layoutSquadCallouts,squadCalloutLeader} from '../src/battle-squad-callout-layout.js';

const check=(points,bounds)=>{
 const laid=layoutSquadCallouts(points,bounds);
 assert.equal(laid.placements.size,points.length,
  'Overhead view must retain every living and defeated ally/enemy squad');
 const positions=[...laid.placements.values()];
 const gap=laid.diameter+4;
 for(const p of positions){
  assert.ok(p.x-laid.diameter/2>=bounds.left-1&&p.x+laid.diameter/2<=bounds.right+1);
  assert.ok(p.y-laid.diameter/2>=bounds.top-1&&p.y+laid.diameter/2<=bounds.bottom+1);
  assert.ok(Number.isFinite(p.anchorX)&&Number.isFinite(p.anchorY));
  const leader=squadCalloutLeader(p);
  if(leader)assert.match(leader,/^M /);
 }
 for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++)
  assert.ok(Math.abs(positions[i].x-positions[j].x)>=gap||
    Math.abs(positions[i].y-positions[j].y)>=gap,
   'No squad bubbles overlap, even when all troops stand in the same tile');
 const repeat=layoutSquadCallouts(points,bounds,laid.placements);
 assert.deepEqual([...repeat.placements], [...laid.placements],
  'Same overhead view must keep bubble slots stable instead of flickering');
};
const coincident=Array.from({length:20},(_,n)=>({
 key:(n%2)+':'+Math.floor(n/2),team:n%2,x:195,y:400,priority:0
}));
check(coincident,{left:4,right:386,top:220,bottom:610}); // 20 squads on Android
check(coincident.slice(0,10),{left:4,right:386,top:220,bottom:610}); // 50v50
check(coincident,{left:4,right:346,top:220,bottom:425}); // short screen

// Two explicit army columns: friends never join the red column and vice versa.
// Fallen squads move to the bottom of their OWN army's callout stack.
const roster=[
 ...Array.from({length:10},(_,i)=>({key:'a'+i,team:0,squadIndex:i,x:190,y:450,defeated:i===1||i===3})),
 ...Array.from({length:10},(_,i)=>({key:'e'+i,team:1,squadIndex:i,x:190,y:450,defeated:i===2||i===5}))
];
const columns=layoutSquadCallouts(roster,{left:4,right:386,top:220,bottom:1050});
assert.equal(columns.lanesPerTeam,1,'Portrait overhead view should use one left and one right column');
const leftColumn=roster.filter(p=>p.team===0).map(p=>columns.placements.get(p.key));
const rightColumn=roster.filter(p=>p.team===1).map(p=>columns.placements.get(p.key));
assert.ok(leftColumn.every(p=>p.x<195),'Every blue label stays at the left edge');
assert.ok(rightColumn.every(p=>p.x>195),'Every red label stays at the right edge');
assert.ok(Math.max(...leftColumn.filter(p=>!p.defeated).map(p=>p.y))<
 Math.min(...leftColumn.filter(p=>p.defeated).map(p=>p.y)),
 'All defeated blue squads sort after every living blue squad');
assert.ok(Math.max(...rightColumn.filter(p=>!p.defeated).map(p=>p.y))<
 Math.min(...rightColumn.filter(p=>p.defeated).map(p=>p.y)),
 'All defeated red squads sort after every living red squad');
const offscreen=layoutSquadCallouts([{key:'0:1',team:0,x:-200,y:900}],
 {left:4,right:386,top:220,bottom:610});
assert.equal(offscreen.placements.get('0:1').outside,true,
 'Off-screen units get edge-connected callouts, not silently omitted');
assert.equal(squadCalloutLeader({x:50,y:50,anchorX:50,anchorY:50,diameter:60}),'');
assert.match(squadCalloutLeader({x:70,y:70,anchorX:150,anchorY:120,diameter:60}),/^M /);

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(html,/id="squadCalloutLines"/);
assert.match(html,/layoutSquadCallouts\(points,bounds,prior\)/);
assert.match(html,/squadCalloutLeader\(pos\)/);
assert.match(html,/lineLayer\.append\(leader,anchorDot\)/);
assert.match(html,/const points=\[\];/);
assert.doesNotMatch(html,/occupied\.some\(p=>/,
 'Old overlapping-squad suppression must not return');
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(source,'Battle JS module available');
const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{
 input:source,encoding:'utf8',timeout:15000
});
assert.equal(syntax.status,0,syntax.stderr||'Battle HTML module must compile');
console.log('PASS all-squad leader-line layout: 50/1000 squads, 20 coincident targets, edges, stable tapping');
