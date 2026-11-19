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
 assert.equal(command.openMove(),false,'standalone movement stays retired');
 assert.equal(dom.root.querySelector('#realtimeBattleMapOverlay').hidden,true);
 assert.equal(seen.some(x=>x[0]==='move'),false,
  'deployment does not dispatch a live move without a confirmed action and target');
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
 assert.match(game,/onUseItem:\(id,itemId,arrival=false\)=>issueCommanderReinforcements/);
 assert.match(game,/onRally:\(id,type,targets\)=>issueCommanderRally/);
 assert.match(mass,/type==='break_structure'/);
 assert.match(realtime,/showSpecialChoices\('dock'\)/);
 assert.match(realtime,/showSupportChoices\('map'\)/);
 assert.match(realtime,/onSpecial\(id,entry.special,entry.targetId,true\)/);
});

test('live panel rejects movement-only and confirms action-target approach or shared-item use',()=>{
 const dom=mockDocument(),seen=[];
 let paused=false;
 const ui=createRealtimeBattleCommands({
  documentRef:dom.document,worldSize:232,
  getSquads:()=>[{id:'1',label:'第1隊 忍者',job:'忍者',
   alive:5,total:5,hp:500,maxHp:500,x:80,z:110}],
  getEnemies:()=>[],
  getMapBackground:()=>null,
  getLegalPoint:(x,z)=>({x,z}),
  getMoveTargets:kind=>kind==='people'?[{id:'npc1',label:'旅人',x:85,z:111}]:[],
  onMove:(id,point)=>{seen.push(['move',id,point]);return true;},
  onOrder:(id,order)=>{seen.push(['order',id,order]);return true;},
  getSharedItems:()=>[{id:'war_banner',name:'勇猛の軍旗',label:'勇猛の軍旗',
   quantity:3,collected:2,usable:true}],
  onSharedItem:(itemId,id)=>{seen.push(['item',itemId,id]);return true;},
  getRallyInfo:()=>({phase:'ready',level:1,targets:[{id:'1',label:'第1隊 忍者',alive:true}]}),
  onRally:(id,kind,targets)=>{seen.push(['rally',id,kind,targets]);return true;},
  onPause:()=>{paused=!paused;},getPaused:()=>paused
 });
 ui.openDeployment();
 dom.root.querySelector('#realtimeStart').onclick();
 ui.showSquadControls('1');
 assert.doesNotMatch(dom.root.innerHTML,/id="realtimeMove"/);
 const kind=dom.root.querySelector('#realtimeTargetKind');
 kind.value='point';kind.onchange();
 const map=dom.root.querySelector('#realtimeInlineTargetMap');
 map.tap('click',{clientX:120,clientY:110});
 assert.equal(seen.length,0,'selecting a map point cannot issue the move early');
 dom.root.querySelector('#realtimeConfirmStrategy').onclick();
 assert.equal(seen.length,0,'a map point alone never issues an order');
 dom.root.querySelector('#realtimeHold').onclick();
 dom.root.querySelector('#realtimeConfirmStrategy').onclick();
 assert.equal(seen[0][0],'move','the chosen action authorizes approach on confirmation');
 ui.showSquadControls('1');
 dom.root.querySelector('#realtimeTabItems').onclick();
 assert.match(dom.root.querySelector('#realtimeInlineItemStatus').textContent,/戦闘取得累計 2/);
 assert.equal(seen.filter(row=>row[0]==='item').length,0);
 dom.root.querySelector('#realtimeConfirmItem').onclick();
 assert.deepEqual(seen[1],['item','war_banner','1']);
 ui.showSquadControls('1');
 dom.root.querySelector('#realtimeTabRally').onclick();
 dom.root.querySelector('#realtimeRallyTarget').value='1';
 dom.root.querySelector('#realtimeRallyKind').value='attack';
 assert.equal(seen.filter(row=>row[0]==='rally').length,0);
 dom.root.querySelector('#realtimeConfirmRally').onclick();
 assert.deepEqual(seen[2],['rally','1','attack',['1']]);
});
