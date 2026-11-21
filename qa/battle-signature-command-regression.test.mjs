import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 formationSignatureProgress,SIGNATURE_STALL_SECONDS,SIGNATURE_MAX_PHASE_SECONDS
} from '../src/formation-signature-progress.js';
import {createTargetedStrategyUi} from '../src/targeted-strategy-runtime.js';

const plan=(phase=0)=>({
 phase,points:[{x:18,z:10},{x:32,z:10}],issuedAt:0,
 closestDistance:18,lastProgressAt:0,final:'defend'
});

test('signature waits for arrival instead of advancing to another waypoint after a timer',()=>{
 const initial=plan();
 const first=formationSignatureProgress(initial,{x:0,z:10},0);
 assert.equal(first.action,'wait');
 const stuck=formationSignatureProgress(first.plan,{x:0,z:10},SIGNATURE_STALL_SECONDS+.2);
 assert.equal(stuck.action,'abort','stalled formations do not march to a second goal');
 assert.equal(stuck.reason,'stalled');
 const maxWait=formationSignatureProgress({...plan(),lastProgressAt:21,closestDistance:14},
  {x:2,z:10},SIGNATURE_MAX_PHASE_SECONDS+.1);
 assert.equal(maxWait.action,'abort','max phase timeout never counts as arrival');
});

test('real progress refreshes the stall clock and arrival alone changes the phase',()=>{
 const p=plan();
 const moving=formationSignatureProgress(p,{x:10,z:10},6);
 assert.equal(moving.action,'wait');
 assert.equal(moving.plan.lastProgressAt,6);
 assert.equal(formationSignatureProgress(moving.plan,{x:13,z:10},9).action,'next');
 const finish={...p,phase:1,issuedAt:9,closestDistance:16,lastProgressAt:9};
 assert.equal(formationSignatureProgress(finish,{x:29,z:10},12).action,'finish');
});

test('invalid center safely aborts formation rather than issuing a stray movement',()=>{
 assert.equal(formationSignatureProgress(plan(),null,8).action,'abort');
 assert.equal(formationSignatureProgress({...plan(),points:[null]}, {x:3,z:4},4).action,'abort');
});

class FakeElement{
 constructor(){
  this.hidden=true;this.innerHTML='';this.listeners={};
  this.dataset={};
 }
 setAttribute(){}
 addEventListener(name,handler){this.listeners[name]=handler}
}
test('basic attack, defense and balance remain enabled with one living group even if its optional order list is limited',()=>{
 const panel=new FakeElement();
 const doc=globalThis.document;
 globalThis.document={
  createElement:()=>panel,
  body:{append(){}}
 };
 try{
  const issued=[];
  const ui=createTargetedStrategyUi({
   getPlan:()=>({squads:[{id:'s1',soldiers:5,allowed:['charge'],jobs:['sword']}],
    allowed:['charge']}),
   onQuickOrder:p=>{issued.push(p.strategy);return true},
   getEnemyTargets:()=>[],getObjects:()=>[],
   getFormationId:()=> 'attack'
  });
  assert.equal(ui.open('1'),true);
  for(const strategy of ['assault','defense','balanced']){
   const marker='data-strategy-quick="'+strategy+'"';
   const index=panel.innerHTML.indexOf(marker);
   assert.ok(index>=0,'missing '+strategy+' button');
   const tag=panel.innerHTML.slice(panel.innerHTML.lastIndexOf('<button',index),
    panel.innerHTML.indexOf('</button>',index));
   assert.doesNotMatch(tag,/\bdisabled\b/,'baseline '+strategy+' must remain enabled');
  }
  panel.listeners.click({target:{closest:()=>({
   disabled:false,hasAttribute:key=>key==='data-strategy-quick',
   dataset:{strategyQuick:'defense'}
  })}});
  assert.deepEqual(issued,['defense']);
  assert.equal(ui.isOpen(),false,'successful basic order returns to battle');
 }finally{globalThis.document=doc;}
});

test('battle runtime cancels obsolete signature and enemy queues on successful manual commands',()=>{
 const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 assert.match(html,/formationSignatureProgress\(plan,center,elapsed\)/);
 assert.match(html,/activeFormationSignatures\.delete\(String\(id\)\)/);
 assert.match(html,/targetedArrivalOrders\.delete\(String\(id\)\)/);
 assert.match(html,/if\(!retainEnemyQueue\)targetedEnemyQueues\.delete\(String\(id\)\)/);
 assert.match(html,/retainEnemyQueue:true/);
 const quick=html.slice(html.indexOf('onQuickOrder:('),html.indexOf('getSignatureStrategy:groupId=>'));
 assert.ok(quick.length>100);
 assert.doesNotMatch(quick,/!canChangeSquadOrder\(id\)/,
  'basic commands must not be blocked by paused combat cooldown');
 assert.match(quick,/issueTargetedPlatoon\(id,mode\)/);
 assert.match(html,/const anchor=progress\.action==='finish'\?plan\.points\[1\]/,
  'a stalled guard must anchor at its actual reachable position');
});
