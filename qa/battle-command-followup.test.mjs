import test from 'node:test';
import assert from 'node:assert/strict';
import {mountBattleCommandWizard} from '../src/battle-command-wizard.js';

class FakeNode{
 constructor(tag='div'){
  this.tagName=tag;this.children=[];this.hidden=false;this.disabled=false;
  this.className='';this.textContent='';this.type='';this.attrs={};
  const classes=new Set();
  this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)};
 }
 append(...nodes){for(const n of nodes)this.children.push(n)}
 replaceChildren(...nodes){this.children=nodes}
 remove(){this.children=[]}
 setAttribute(k,v){this.attrs[k]=v}
 querySelector(selector){
  if(!selector.startsWith('.'))throw new Error('Unsupported mock selector');
  const className=selector.slice(1);
  function visit(node){if(String(node.className).split(/\s+/).includes(className))return node;
   for(const child of node.children){const found=visit(child);if(found)return found;}return null}
  return visit(this);
 }
}
const doc={createElement:name=>new FakeNode(name)};
function findChoice(wizard,fragment){
 const body=wizard.root.querySelector('.battleWizardBody');
 const button=body?.children.find(node=>node.tagName==='button'&&String(node.textContent).includes(fragment));
 assert.ok(button,'Missing button: '+fragment+' (stage '+wizard.stage+')');return button;
}
function setup(initial={cooldown:0,moving:false,blocked:false}){
 const status={...initial},orders=[],committed=[];
 const wizard=mountBattleCommandWizard({
  documentRef:doc,dock:new FakeNode(),getSquads:()=>[{id:'0',label:'第1隊',job:'剣士',alive:4,total:5,hp:105}],
  selectSquad:()=>true,getOrderState:()=>({label:'⚔ 突撃中',...status}),
  onOrder:(id,command)=>{orders.push({id,command});return true},
  onCommandCommitted:entry=>committed.push(entry),
 });
 wizard.open('0');
 findChoice(wizard,'第1隊').onclick();
 findChoice(wizard,'行動を選択').onclick();
 findChoice(wizard,'守備').onclick();
 findChoice(wizard,'通常守備').onclick();
 assert.equal(wizard.stage,'confirm');
 return {wizard,status,orders,committed};
}
test('a second squad order queues during command cooldown, then executes once',()=>{
 const {wizard,status,orders,committed}=setup({cooldown:18});
 findChoice(wizard,'次の作戦として予約').onclick();
 assert.equal(orders.length,0);
 assert.match(wizard.queuedOrder('0'),/守備/);
 status.cooldown=0;
 wizard.tick();
 assert.deepEqual(orders,[{id:'0',command:'defend'}]);
 assert.equal(committed.length,1);
 wizard.tick();
 assert.equal(orders.length,1,'never duplicate a queued order');
 assert.equal(wizard.queuedOrder('0'),'');
 wizard.dispose();
});
test('active mission delays next order even after cooldown ends',()=>{
 const {wizard,status,orders}=setup({cooldown:0,moving:true});
 findChoice(wizard,'次の作戦として予約').onclick();
 wizard.tick();
 assert.equal(orders.length,0);
 status.moving=false;
 wizard.tick();
 assert.equal(orders.length,1);
 wizard.dispose();
});
test('commander unavailable explains why a new action is rejected',()=>{
 const {wizard,orders}=setup({commanderReason:'軍師不在'});
 findChoice(wizard,'この内容で確定').onclick();
 assert.equal(orders.length,0);
 const body=wizard.root.querySelector('.battleWizardBody');
 assert.ok(body.children.some(node=>String(node.textContent).includes('軍師不在')));
 wizard.dispose();
});
