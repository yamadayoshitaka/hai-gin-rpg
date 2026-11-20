import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {CombatActionRuntime} from '../src/combat-action-runtime.js';
import {mountBattleCommandWizard} from '../src/battle-command-wizard.js';
import {battleJobSpecialActions} from '../src/battle-job-special-actions.js';

const SIZE=232, create=(n=50)=>new MassBattleGridSimulation(n,20261120,{
 width:SIZE,height:SIZE,walkable:new Uint8Array(SIZE*SIZE).fill(1),
 bridges:[],riverXAt:()=>SIZE/2
});
const alive=(sim,team,id)=>sim.units.filter(u=>u.team===team&&
 String(u.squadId)===String(id)&&u.alive&&u.hp>0);
test('all four commands affect exactly the addressed squad at 50 and 1000 soldiers',()=>{
 for(const n of [50,1000]){
  const sim=create(n),first=alive(sim,0,'0'),other=alive(sim,0,'1');
  assert.ok(first.length&&other.length);
  for(const mode of ['hold','defend','retreat','charge']){
   assert.equal(sim.setSquadCommand('0',mode,0),true);
   assert.equal(sim.squadCommands.get('0'),mode);
   assert.equal(sim.squadCommands.has('1'),false,
     'one order may not issue a hidden command to a different squad');
  }
  assert.equal(sim.setSquadDestination('0',80,110),true);
  assert.equal(sim.squadCommands.get('0'),'move');
  assert.equal(sim.squadDestinations.get('0').x,80);
  assert.ok(sim.squadFlows.has('0'),'movement is routed via one squad field');
  assert.equal(sim.setSquadCommand('0','charge'),true);
  assert.equal(sim.squadDestinations.has('0'),false,'a new order supersedes old movement');
  assert.equal(sim.setSquadCommand('0','invalid'),false);
 }
});
test('moving 50v50 squads visibly make progress instead of accepting only a UI command',()=>{
 const sim=create(50),members=alive(sim,0,'0');
 const target={x:85,z:115};
 const distance=()=>members.reduce((n,u)=>n+Math.hypot(u.x-target.x,u.z-target.z),0)/members.length;
 const before=distance();
 assert.equal(sim.setSquadDestination('0',target.x,target.z),true);
 for(let i=0;i<85;i++)sim.step(.1);
 assert.ok(distance()<before,'the destination changes actual world coordinates');
 assert.ok(members.some(u=>u.completedSteps>0),'the members walk, not only update a target marker');
});
test('actual 50 and 1000 unit summoner orders consume MP and create owned world objects',()=>{
 for(const count of [50,1000]){
  const sim=create(count),summoner=sim.units.find(u=>u.team===0&&!u.isStrategist&&u.jobId==='summoner'&&u.alive);
  assert.ok(summoner,'summoner must be present in the 10-job roster');
  const mp=summoner.mp;
  assert.equal(sim.summonSquadCreature(summoner.squadId),true,
   'manual summon must spawn an object in actual simulation');
  const creatures=sim.actions.summonOf(summoner);
  assert.equal(creatures.length,1);
  assert.equal(creatures[0].squadId,String(summoner.squadId));
  assert.ok(summoner.mp<mp,'MP is spent only on a successful summon');
  assert.equal(sim.summonSquadCreature(summoner.squadId),false,'a live familiar is not cast again');
 }
});
test('explicit priest revival updates the actual fallen unit and MP budget',()=>{
 const sim=create(50);
 const priest=sim.units.find(u=>u.team===0&&!u.isStrategist&&u.jobId==='priest'&&u.alive);
 const victim=sim.units.find(u=>u.team===0&&u.squadId!==priest.squadId&&u.alive);
 assert.ok(priest&&victim);priest.rarity='UR';priest.mp=100;
 victim.x=victim.fromX=priest.x+1;victim.z=victim.fromZ=priest.z;
 sim._markDead(victim);
 const mp=priest.mp,live=sim.live[0];
 assert.equal(sim.reviveSquadTarget(priest.squadId,victim.squadId),true);
 assert.ok(victim.alive&&victim.hp>0,'a real dead actor is revived');
 assert.ok(priest.mp<mp,'the real priest pays the revival spell cost');
 assert.equal(sim.live[0],live+1);
 assert.equal(sim.reviveSquadTarget(priest.squadId,victim.squadId),false,'cannot revive living actors');
});
test('densely surrounded ground summoners find a safe real spawn tile beyond radius two',()=>{
 const width=32,occupancy=new Int32Array(width*width).fill(1);
 occupancy[(16+3)*width+16]=-1; // one available tile at radius 3
 const owner={id:1,team:0,squadId:'4',jobId:'summoner',
  x:16,z:16,alive:true,hp:100,maxHp:100,mp:100,rarity:'N'};
 const rt=new CombatActionRuntime({width,height:width,walkable:new Uint8Array(width*width).fill(1)});
 rt.beginTick(.1,[owner],{occupancy});
 const summon=rt.spawnObject('wolf',owner);
 assert.ok(summon,'dense infantry must not prevent an available adjacent-ring spawn');
 assert.equal(Math.max(Math.abs(summon.x-owner.x),Math.abs(summon.z-owner.z)),3);
 assert.equal(occupancy[summon.z*width+summon.x],-2,'real wolf collision tile is reserved');
});
test('two allied flying summons do not overlap or crash in shared airspace',()=>{
 const width=25,rt=new CombatActionRuntime({width,height:width,walkable:new Uint8Array(width*width).fill(1)});
 const a={id:1,team:0,squadId:'1',x:10,z:10,hp:100,alive:true};
 const b={id:2,team:0,squadId:'2',x:10,z:10,hp:100,alive:true};
 rt.beginTick(.1,[a,b]);
 const first=rt.spawnObject('wyvern',a);
 const second=rt.spawnObject('wyvern',b);
 assert.ok(first&&second,'allied casters spawn distinct flying creatures');
 assert.ok(Math.abs(first.x-second.x)>1||Math.abs(first.z-second.z)>1,
  'airspace placement must keep separate flying creature meshes');
});
test('automatic six-second summoner chant resolves into a creature, not perpetual idle',()=>{
 const width=30,owner={id:1,team:0,squadId:'7',jobId:'summoner',rarity:'N',
  x:8,z:8,hp:100,maxHp:100,alive:true,mp:100,cooldown:0};
 const enemy={id:2,team:1,squadId:'8',jobId:'sword',rarity:'N',
  x:22,z:22,hp:100,maxHp:100,alive:true,mp:100,cooldown:0};
 const rt=new CombatActionRuntime({width,height:width,walkable:new Uint8Array(width*width).fill(1)});
 rt.beginTick(.1,[owner,enemy]);
 assert.equal(rt.tryAutoAction(owner,null,[owner,enemy]),true);
 assert.ok(owner._pendingCast,'a real cast starts');
 assert.ok(rt.getStats().summons===0,'no phantom creature during chanting');
 rt.beginTick(6.2,[owner,enemy]);
 assert.equal(rt.tryAutoAction(owner,null,[owner,enemy]),true);
 assert.ok(rt.getStats().summons>=1,'the finished chant creates an independently rendered world object');
});
class Node {
 constructor(tag='div'){
  this.tagName=tag;this.children=[];this.hidden=false;this.disabled=false;
  this.className='';this.textContent='';this.attrs={};this.style={};
  const css=new Set();
  this.classList={add:x=>css.add(x),remove:x=>css.delete(x),contains:x=>css.has(x)};
 }
 append(...xs){this.children.push(...xs)}
 replaceChildren(...xs){this.children=xs}
 remove(){this.children=[]}
 setAttribute(k,v){this.attrs[k]=v}
 querySelector(q){
  const cls=q.startsWith('.')?q.slice(1):q;
  function walk(n){
   if(String(n.className).split(/\s+/).includes(cls))return n;
   for(const c of n.children){const found=walk(c);if(found)return found;}
   return null;
  }
  return walk(this);
 }
 getContext(){return {fillRect(){},drawImage(){},beginPath(){},arc(){},stroke(){},fill(){}}}
 getBoundingClientRect(){return {left:0,top:0,width:440,height:235}}
}
const doc={createElement:tag=>new Node(tag)};
const click=(wizard,part)=>{
 const body=wizard.root.querySelector('.battleWizardBody');
 const button=body?.children.find(n=>n.tagName==='button'&&String(n.textContent).includes(part)&&!n.disabled);
 assert.ok(button,'Missing selectable '+part+' on stage '+wizard.stage+' choices: '+(body?.children||[]).map(x=>x.textContent).join(' / '));
 button.onclick();return button;
};
function setupWizard(job,options={}){
 const events=[],arrivals=[],cancelled=[],state={cooldown:0,moving:false,blocked:false,...options.state};
 const id='1',self={id,label:'第1隊',job,alive:10,hp:100};
 const enemy={id:'enemy-1',team:1,squadId:'enemy',label:'敵第1隊',x:150,z:120};
 const specialTargets=(key)=>{
  if(key==='high_ground')return [{id:'3',label:'城3階',available:true,x:40,z:40}];
  return [{id:'self',label:'有効な対象',available:true,x:100,z:100}];
 };
 const wizard=mountBattleCommandWizard({
  documentRef:doc,dock:new Node(),worldSize:232,
  getSquads:()=>[self],getEnemies:()=>[enemy],getSelected:()=>self,
  selectSquad:()=>true,getLegalPoint:(x,z)=>({x,z}),
  getMoveTargets:()=>[enemy],getSpecialTargets:(_,kind)=>specialTargets(kind),
  getSharedItems:()=>[{id:'potion',label:'回復薬',usable:true,quantity:2}],
  getRallyInfo:()=>({phase:'ready',targets:[{id:'1',alive:true,label:'第1隊'}]}),
  getOrderState:()=>state,
  onMove:(...args)=>{events.push(['move',...args]);return true},
  onOrder:(...args)=>{events.push(['order',...args]);return true},
  onTargetOrder:(...args)=>{events.push(['attack',...args]);return true},
  onSpecial:(...args)=>{events.push(['special',...args]);return true},
  onSharedItem:(...args)=>{events.push(['item',...args]);return true},
  onRally:(...args)=>{events.push(['rally',...args]);return true},
  queueArrival:(...args)=>arrivals.push(args),
  cancelArrival:id=>cancelled.push(id)
 });
 wizard.open('1');click(wizard,'第1隊');return {wizard,events,arrivals,cancelled,state};
}
const act=(job,choices)=>{
 const w=setupWizard(job);
 for(const choice of choices)click(w.wizard,choice);
 assert.equal(w.wizard.stage,'confirm',job+': confirm stage must be present');
 click(w.wizard,'この内容で確定');
 assert.ok(w.events.length,job+' must reach an executing callback');
 w.wizard.dispose();return w;
};
test('wizard routes hold, defend, targeted attack, item and rally into executable callbacks',()=>{
 assert.deepEqual(act('剣士',['行動を選択','待機']).events[0],['order','1','hold']);
 assert.deepEqual(act('盾騎士',['行動を選択','守備','通常守備']).events[0],['order','1','defend']);
 assert.equal(act('剣士',['行動を選択','攻撃','近距離','敵第1隊']).events[0][0],'attack');
 assert.equal(act('剣士',['アイテムを使用','回復薬','第1隊']).events[0][0],'item');
 assert.equal(act('剣士',['行動を選択','号令','総攻撃','第1隊']).events[0][0],'rally');
});
test('wizard exposes all job specials and routes each into a real handler',()=>{
 for(const [job,part] of [
  ['召喚士','召喚獣を呼ぶ'],['魔法使い','橋を破壊'],
  ['盾騎士','身代わり防御'],['シーフ','鍵開け'],['忍者','屋根'],
  ['僧侶','味方を回復'],['弓使い','高所攻撃']
 ]){
  assert.ok(battleJobSpecialActions(job).length);
  const w=act(job,['行動を選択','固有技',part,part==='屋根'||part==='高所攻撃'?'城3階':'有効な対象']);
  assert.equal(w.events[0][0],'special',job);
 }
});
test('every published job special is confirmable and reaches its exact execution ID',()=>{
 for(const job of ['召喚士','魔法使い','盾騎士','盾兵','シーフ','忍者','僧侶','弓使い']){
  for(const ability of battleJobSpecialActions(job)){
   const target=ability.id==='high_ground'?'城3階':'有効な対象';
   const w=act(job,['行動を選択','固有技',ability.label,target]);
   assert.deepEqual(w.events[0],['special','1',ability.id,
     ability.id==='high_ground'?'3':'self'],job+' / '+ability.id);
  }
 }
});
test('steal action travels to a distant target and schedules a genuine inventory transfer',()=>{
 const page=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');
 assert.match(page,/if\(action==='steal_item'\)\{/);
 assert.match(page,/Math\.hypot\(origin\.x-target\.x,origin\.z-target\.z\)>8/);
 assert.match(page,/queueSpecialArrival\(id,'steal_item',targetId,point\)/);
 assert.match(page,/roomItemRegistry\.transfer\(enemy\.id,thief\.id,stack\.itemId,1\)/);
 assert.match(ui,/queueSpecialArrival:\(id,special,targetId,point\)=>arrivalActions\.set/);
});
test('wizard higher-floor movement dispatches a real target and arrival callback',()=>{
 const w=act('弓使い',['行動を選択','移動','高所へ移動','城3階','交戦']);
 assert.deepEqual(w.events[0],['special','1','high_ground','3']);
 assert.equal(w.arrivals.length,1);
 assert.equal(w.arrivals[0][1].highGroundTarget,'3');
});
test('wizard ground movement dispatches a destination and deferred arrival',()=>{
 const w=setupWizard('剣士');
 click(w.wizard,'行動を選択');click(w.wizard,'移動');click(w.wizard,'通常移動');
 assert.equal(w.wizard.stage,'map');
 const body=w.wizard.root.querySelector('.battleWizardBody');
 const canvas=body.children.find(c=>c.tagName==='canvas');
 assert.ok(canvas);canvas.onclick({clientX:180,clientY:105});
 click(w.wizard,'この地点に移動');
 click(w.wizard,'待機');
 click(w.wizard,'この内容で確定');
 assert.equal(w.events[0][0],'move');
 assert.equal(w.arrivals.length,1);
 assert.equal(w.arrivals[0][1].command,'hold');
 w.wizard.dispose();
});
test('new explicit hold cancels stale arrival; active movement cannot swallow it',()=>{
 const w=setupWizard('剣士',{state:{moving:true}});
 click(w.wizard,'行動を選択');click(w.wizard,'待機');
 click(w.wizard,'この内容で確定');
 assert.deepEqual(w.events[0],['order','1','hold']);
 assert.deepEqual(w.cancelled,['1']);
 w.wizard.dispose();
});
test('all UI routes are wired to the real runtime and Worker, not decoration',()=>{
 const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const page=read('tactics-wireframe.html');
 const ui=read('src/battle-realtime-commands.js');
 const worker=read('src/mass-battle-worker-runtime.js');
 for(const id of ['onMove:','onOrder:','onTargetOrder:','onSpecial:','onSharedItem:','onRally:'])
  assert.ok(page.includes(id),'missing live callback: '+id);
 for(const id of ['squadDestination','squadCommand','squadMission','squadHealing',
  'orderSquadHighGround','summonSquadCreature','squadHighGroundArrival','shieldCover','squadRevival'])
  assert.ok(worker.includes("case '"+id+"'"),'Worker cannot execute '+id);
 assert.ok(ui.includes('commandWizard.tick()'),'queued commands must be driven every battle update');
 assert.match(page,/for\(const id of squadIds\)setStartingSquadOrder\(0,id,'charge'\)/);
 assert.match(page,/const usedAt=lastSquadOrderAt\.get\(String\(id\)\)/);
});