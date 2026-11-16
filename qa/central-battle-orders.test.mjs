import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SourceTextModule} from 'node:vm';
import {createTargetedStrategyUi,planStrategyDistribution} from '../src/targeted-strategy-runtime.js';

class FakeNode {
 constructor(){this.id='';this.hidden=true;this.innerHTML='';this.listeners={};this.attrs={};this.style={};}
 getContext(){return {fillRect(){},drawImage(){},beginPath(){},arc(){},stroke(){},fill(){},fillText(){},moveTo(){},lineTo(){},
  save(){},restore(){},createImageData:(width,height)=>({data:new Uint8ClampedArray(width*height*4)}),putImageData(){},
  set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set font(v){},
  set textAlign(v){},set textBaseline(v){},set imageSmoothingEnabled(v){},set shadowColor(v){},set shadowBlur(v){},set globalAlpha(v){}
 };}
 setAttribute(name,value){this.attrs[name]=value;}
 append(){}
 addEventListener(name,handler){this.listeners[name]=handler;}
 querySelector(name){
  if(name!=='#centralCommandMap')return null;
  return {width:464,height:464,getContext:()=>this.getContext(),
   getBoundingClientRect:()=>({left:0,top:0,width:464,height:464})};
 }
}
const panel=new FakeNode();
globalThis.document={createElement:tag=>tag==='section'?panel:new FakeNode(),
 body:{append(){}}};
let pause=0,resume=0,commands=[],maps=[],mapPositions=[],items=[];
const squads=[
 {id:'1001',label:'第1分隊・騎士',jobs:['sword'],soldiers:6,allowed:['charge','defend','hold','retreat']},
 {id:'1002',label:'第2分隊・騎士',jobs:['sword'],soldiers:4,allowed:['charge','defend','hold','retreat']}
];
const secondarySquads=[
 {id:'2001',label:'第1分隊・弓使い',jobs:['archer'],soldiers:3,allowed:['charge','defend','hold','retreat']}
];
const make=()=>createTargetedStrategyUi({
 getPlan:id=>({squads:String(id)==='1'?squads:String(id)==='2'?secondarySquads:[],allowed:['charge','defend','hold','retreat']}),
 getTemplates:()=>[{id:'assault',name:'集中殲滅',methodId:'melee_focus',score:92,reason:'目的に一致'}],
 getEnemyTargets:()=>[{id:'enemy1',label:'敵剣士隊',team:'enemy',x:30,z:40},
  {id:'enemy2',label:'敵弓隊',team:'enemy',x:185,z:190}],
 getAllyTargets:()=>[{id:'1001',label:'第1分隊',team:'ally',groupId:1,x:60,z:140},
  {id:'1002',label:'第2分隊',team:'ally',groupId:1,x:150,z:180},
  {id:'2001',label:'第1分隊',team:'ally',groupId:2,x:200,z:20}],
 getRadarTargets:()=>[{id:'enemy1',team:'enemy',x:30,z:40},{id:'enemy2',team:'enemy',x:185,z:190},
  {id:'1001',team:'ally',x:60,z:140},{id:'1002',team:'ally',x:150,z:180},
  {id:'2001',team:'ally',x:200,z:20}],
 getObjects:()=>[{id:'obj1',label:'橋'}],
 getItems:()=>[{id:'potion',label:'治癒の薬',quantity:2}],
 onExecute:plan=>{commands.push(plan);return true;},
 onMapRequest:plan=>{maps.push(plan);return true;},
 onMapPick:point=>{mapPositions.push(point);return true;},
 onItemExecute:command=>{items.push(command);return true;},
 onOpen:()=>{pause++;return true;},
 onClose:()=>{resume++;},
 getMapSize:()=>232,
 getRadarCanvas:()=>null
});
const ui=make();
const button=(datasetKey,value)=>({
 disabled:false,hasAttribute:name=>name===datasetKey,
 dataset:{[datasetKey.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]:value}
});
function click(name,value=''){
 const attr='data-strategy-'+name;
 const b=button(attr,String(value));
 panel.listeners.click({target:{closest:()=>b}});
}
function radarTap(x,z){
 panel.listeners.pointerup({target:{closest:sel=>sel==='#centralCommandMap'?panel.querySelector(sel):null},
  clientX:x*2,clientY:z*2});
}
assert.equal(ui.open(1),true);
assert.equal(ui.currentStep(),'scope');
assert.match(panel.innerHTML,/班単位の作戦/);
assert.match(panel.innerHTML,/個別の作戦/);
assert.equal(pause,1);
click('next');assert.equal(ui.currentStep(),'family');
click('family','attack');assert.equal(ui.currentStep(),'intent');
click('intent','melee');assert.equal(ui.currentStep(),'method');
click('method','melee_focus');
click('next');assert.equal(ui.currentStep(),'target');
assert.match(panel.innerHTML,/敵部隊を選択/);
assert.match(panel.innerHTML,/centralCommandMap/,'enemy selection uses the enlarged radar');
radarTap(30,40);radarTap(185,190);click('next');
assert.equal(ui.currentStep(),'confirm');assert.match(panel.innerHTML,/作戦の内容を確認/);
click('next');assert.equal(ui.isOpen(),false);
assert.equal(resume,1);
assert.equal(commands.length,1);
assert.deepEqual(commands[0].targetIds.sort(),['enemy1','enemy2']);
assert.deepEqual(commands[0].squadIds.sort(),['1001','1002']);
assert.equal(planStrategyDistribution({squads,allowed:['charge','defend']},
 squads.map(x=>x.id),['melee_focus']).totalSoldiers,10);

ui.open('1',{squadId:'1002'});
assert.match(panel.innerHTML,/個別の作戦/);
assert.match(panel.innerHTML,/第2分隊/);
click('next');click('family','defense');click('intent','block');
click('method','block_passage');click('next');
assert.equal(ui.currentStep(),'target');
assert.match(panel.innerHTML,/centralCommandMap/);
radarTap(116,116);
assert.match(panel.innerHTML,/116, 116/);
click('next');click('next');
assert.equal(ui.isOpen(),false);
assert.equal(maps.length,1);assert.deepEqual(maps[0].squadIds,['1002']);
assert.deepEqual(mapPositions,[{x:116,z:116}]);
assert.equal(pause,2);assert.equal(resume,2);

ui.open();click('next');
click('family','item');assert.equal(ui.currentStep(),'items');
assert.match(panel.innerHTML,/治癒の薬/);
click('item','potion');assert.equal(ui.currentStep(),'target');
assert.match(panel.innerHTML,/味方分隊を選択/);
assert.match(panel.innerHTML,/centralCommandMap/,'ally item targeting uses the same radar');
radarTap(150,180);click('next');click('next');
assert.equal(items.length,1);
assert.deepEqual(items[0],{groupId:'1',issuerSquadId:'1001',targetSquadId:'1002',itemId:'potion'});
assert.equal(pause,3);assert.equal(resume,3);

ui.open();click('close');assert.equal(ui.isOpen(),false);
assert.equal(pause,4);assert.equal(resume,4,'cancel restores prior battle pause exactly once');
ui.open();
assert.match(panel.innerHTML,/第2班（紫）/,'teams have distinct radar colours and legend');
assert.match(panel.innerHTML,/弓使い3人/,'team card identifies job and headcount');
radarTap(200,20); // group mode: tap the second team by its radar pin
assert.match(panel.innerHTML,/<span>第2班<\/span>/,'tap switches the selected group');
click('close');
ui.open('1');click('next');
assert.match(panel.innerHTML,/集中殲滅/,'inn plans appear in the battle command panel');
click('template','assault');
assert.equal(ui.currentStep(),'method','template fills in the correct method and still requires target confirmation');
assert.match(panel.innerHTML,/集中突破/);
click('close');
const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(battle,/story-center-orders/);
assert.match(battle,/if\(!TOWN_MODE\)document.body.classList.add\('story-center-orders'\)/,
 'the public direct battle link gets the new UI even without storyBattle=1');
assert.match(battle,/directBattlePreview/,'the standalone battle loads into the new UI');
assert.match(battle,/getRadarTargets:/,'live radar gets both armies');
assert.match(battle,/central-battle-orders\.css/);
assert.match(battle,/objectiveCheckpoints\.update\(\)/);
assert.match(battle,/if\(document\.body\.classList\.contains\('story-center-orders'\)\)return/);
assert.match(battle,/onMapPick:point/);
assert.match(battle,/setBattlePaused\(true\)/);
assert.match(battle,/if\(wasPaused===false&&!finished\)setBattlePaused\(false\)/);
assert.match(battle,/const cameraCloseOffset=new THREE\.Vector3\(-8,6\.2,10\.5\)/);
assert.match(battle,/id="topStrategy"/);
const css=readFileSync(new URL('../src/central-battle-orders.css',import.meta.url),'utf8');
assert.match(css,/body\.story-center-orders #allySquadRibbon/);
assert.match(css,/body\.story-center-orders #enemySquadRibbon/);
assert.match(css,/#targetedStrategyCard/);
new SourceTextModule(readFileSync(new URL('../src/targeted-strategy-runtime.js',import.meta.url),'utf8'),
 {identifier:'targeted-strategy-runtime.js'});
console.log('PASS: center pause/close, group vs individual, multiple enemies, radar target and item tactical flow');
