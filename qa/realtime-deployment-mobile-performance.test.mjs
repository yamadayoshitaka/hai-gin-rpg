import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRealtimeBattleCommands} from '../src/battle-realtime-commands.js';

function mockDocument(){
 const controls=new Map(),actions=new Map();
 const ctxCalls={draw:0};
 const ctx=new Proxy({}, {get(_,name){
  if(name==='drawImage'||name==='fillRect'||name==='clearRect')
   return ()=>{ctxCalls.draw++};
  if(['beginPath','moveTo','lineTo','stroke','arc','fill','fillText'].includes(name))return ()=>{};
  return null;
 },set(){return true}});
 const mk=()=>({
  hidden:false,textContent:'',dataset:{},style:{},value:'',disabled:false,
  attributes:{},events:new Map(),classList:{toggle(){},add(){}},
  addEventListener(event,callback){this.events.set(event,callback)},
  setAttribute(key,value){this.attributes[key]=value},
  getBoundingClientRect(){return {left:0,top:0,width:240,height:240}},
  replaceChildren(){},append(){},setPointerCapture(){},getContext(){return ctx},
  tap(event='click',props={}){return this.events.get(event)?.(props)}
 });
 const root=mk();
 root.querySelector=selector=>{
  const id=selector.replace(/^#/,'');
  if(!controls.has(id))controls.set(id,mk());
  return controls.get(id);
 };
 root.querySelectorAll=selector=>selector==='[data-action-after-move]'?[...actions.values()]:
  selector==='[data-realtime-zoom]'?[controls.get('zoomin'),controls.get('zoomout')]:[];
 for(const name of ['defend','charge','hold','support']){
  const button=mk();button.dataset.actionAfterMove=name;actions.set(name,button);
 }
 const zoomIn=mk(),zoomOut=mk();
 zoomIn.dataset.realtimeZoom='1';zoomOut.dataset.realtimeZoom='-1';
 controls.set('zoomin',zoomIn);controls.set('zoomout',zoomOut);
 const body=mk();body.append=root=>{body.lastRoot=root};
 const document={body,createElement(){return root}};
 controls.get('realtimeBattleMapOverlay')?.hidden;
 root.querySelector('#realtimeBattleMapOverlay').hidden=true;
 root.querySelector('#realtimeBattleDock').hidden=true;
 return {document,controls,actions,ctxCalls,root};
}
test('mobile map has left zoom controls, persistent actions and no repeated deployment redraw',()=>{
 const dom=mockDocument(),seen=[];
 let rosterCalls=0,deploys=0;
 const command=createRealtimeBattleCommands({
  documentRef:dom.document,worldSize:232,
  getSquads:()=>{rosterCalls++;return [
   {id:'1',label:'第1隊 剣士',job:'剣士',alive:5,total:5,hp:500,maxHp:500,x:80,z:110},
   {id:'2',label:'第2隊 盾騎士',job:'盾騎士',alive:5,total:5,hp:500,maxHp:500,x:82,z:112}
  ]},
  getMapBackground:()=>null,
  getLegalPoint:(x,z)=>({x,z}),
  canDeploy:()=>true,
  onDeploy:(id,point)=>{deploys++;seen.push(['deploy',id,point]);return true},
  onStart:()=>seen.push(['start']),
  onMove:(id,point)=>{seen.push(['move',id,point]);return true},
  onOrder:(id,mode)=>{seen.push(['order',id,mode]);return true}
 });
 command.openDeployment();
 assert.match(dom.root.innerHTML,/class="realtimeMapViewport"/);
 assert.ok(dom.root.innerHTML.indexOf('data-realtime-zoom="1"')<
  dom.root.innerHTML.indexOf('id="realtimeBattleCanvas"'));
 assert.equal(dom.root.querySelector('#realtimeMapActionSheet').hidden,false);
 dom.actions.get('hold').tap();
 assert.deepEqual(command.preferredActions,[['1','hold']]);
 command.selectSquad('2');
 assert.equal(dom.root.querySelector('#realtimeMapActionSheet').hidden,false);
 dom.actions.get('support').tap();
 assert.deepEqual(command.preferredActions,[['1','hold']]);
 assert.equal(dom.root.querySelector('#realtimeMapSupportChoices').hidden,false);
 command.selectSquad('1');
 const canvas=dom.root.querySelector('#realtimeBattleCanvas');
 canvas.tap('pointerdown',{pointerId:1,clientX:50,clientY:110});
 canvas.tap('pointerup',{pointerId:1,clientX:50,clientY:110});
 assert.equal(deploys,1);
 assert.deepEqual(command.preferredActions,[['1','hold']]);
 const redraws=dom.ctxCalls.draw;
 for(let i=0;i<30;i++)command.update([]);
 assert.equal(dom.ctxCalls.draw,redraws,'paused deployment must not repaint map on every squad status update');
 assert.ok(rosterCalls<=3,'roster snapshots are reused between map taps and UI updates');
 dom.root.querySelector('#realtimeStart').onclick();
 assert.ok(seen.some(x=>x[0]==='start'));
 command.openMove();
 assert.equal(dom.root.querySelector('#realtimeMapActionSheet').hidden,false);
 canvas.tap('pointerdown',{pointerId:2,clientX:120,clientY:120});
 canvas.tap('pointerup',{pointerId:2,clientX:120,clientY:120});
 assert.ok(seen.some(x=>x[0]==='move'));
 assert.ok(command.queuedArrivalActions.includes('1'),'previously selected hold queues on arrival');
});
test('map controls and roster aggregation retain real 3D movement and squad identities',()=>{
 const js=readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/battle-realtime-commands.css',import.meta.url),'utf8');
 const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 assert.match(css,/\.realtimeMapViewport/);
 assert.match(css,/\.realtimeMapZoom\{[\s\S]*?flex-direction:column/);
 assert.match(css,/\.realtimeMapActionSheet[\s\S]*?display:flex/);
 assert.match(js,/squadSnapshotAt/);
 assert.match(js,/scheduleMapDraw/);
 assert.match(js,/mode==='move'&&!\$\('realtimeBattleMapOverlay'\)\.hidden/);
 assert.match(battle,/const groups=new Map\(squadIds\.map\(id=>/);
 assert.match(battle,/buildBattleSquadLeaderPins\(squadRoster/);
});

test('job-based tactics expose ninja ranged and real mission / inventory integration',async()=>{
 const {battleAttackCommand,isRangedBattleJob}=await import('../src/battle-attack-choices.js');
 const {battleJobSpecialActions}=await import('../src/battle-job-special-actions.js');
 assert.equal(isRangedBattleJob('忍者'),true);
 assert.equal(battleAttackCommand('far','忍者'),'hold');
 assert.equal(battleAttackCommand('far','剣士'),null);
 assert.ok(battleJobSpecialActions('魔法使い').some(x=>x.id==='destroy_bridge'));
 assert.ok(battleJobSpecialActions('召喚士').some(x=>x.id==='break_structure'));
 assert.ok(battleJobSpecialActions('シーフ').some(x=>x.id==='unlock_door'));
 assert.ok(battleJobSpecialActions('シーフ').some(x=>x.id==='steal_item'));
 const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 const realtime=readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');
 const mass=readFileSync(new URL('../src/mass-battle-grid-sim.js',import.meta.url),'utf8');
 assert.match(game,/onSpecial:\(id,action,targetId,arrival=false\)=>issueRealtimeSpecial/);
 assert.match(game,/roomItemRegistry\.transfer\(enemy\.id,thief\.id,stack\.itemId,1\)/);
 assert.match(game,/onUseItem:\(id,itemId,arrival=false\)=>performSquadBattleItem/);
 assert.match(mass,/type==='break_structure'/);
 assert.match(realtime,/showSpecialChoices\('dock'\)/);
 assert.match(realtime,/showSupportChoices\('map'\)/);
 assert.match(realtime,/onSpecial\(id,entry.special,entry.targetId,true\)/);
});
