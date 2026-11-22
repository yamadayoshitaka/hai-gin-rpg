import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
 parseExplorationDestination,explorationDestination,buildingFloorChoices
} from '../src/battle-exploration-floor.js';

const battle=()=>readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const ui=()=>readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');

test('building picker retains both building ID and intended floor',()=>{
 const id='house-uuid-17';
 assert.deepEqual(parseExplorationDestination(explorationDestination(id,3)),{buildingId:id,floor:3});
 assert.deepEqual(parseExplorationDestination(id),{buildingId:id,floor:1});
 assert.deepEqual(buildingFloorChoices({structure:{floors:[{}, {}, {}]}}),[1,2,3]);
 assert.deepEqual(buildingFloorChoices({structure:{floors:[{}, {}, {}]}},{enableUpperFloors:false}),[1]);
 assert.deepEqual(buildingFloorChoices({structure:{floors:[{}]}}),[1]);
 assert.equal(explorationDestination(id,0),id+'@1');
});

test('cyan deploy tiles require the same complete team plan as the onDeploy callback',()=>{
 const source=ui(),world=battle();
 assert.match(source,/previewDeploy\(selectedId,point\)/);
 assert.match(source,/deploymentTiles\.find\(tile=>/);
 assert.match(source,/chooseMapCell\(hit\.x,hit\.z\)/);
 assert.match(source,/mode==='deploy'\?\{x,z\}:getLegalPoint/);
 assert.match(world,/function skirmishTeamDeploymentPlan\(id,point\)/);
 assert.match(world,/previewDeploy:\(id,point\)=>/);
 assert.match(world,/const slots=skirmishTeamDeploymentPlan\(id,point\)/);
});

test('selected floor controls real building exploration and staircase route',()=>{
 const world=battle();
 assert.match(world,/className='exploreFloorControl'/);
 assert.match(world,/explorationDestination\(b\.id,floors\.get\(b\.id\)\|\|1\)/);
 assert.match(world,/const \{buildingId,floor\}=parseExplorationDestination\(destination\)/);
 assert.match(world,/find\(item=>item\.floor===floor\)/);
 assert.match(world,/requestUnitFloor\(a,1,exploring\.building,\{forceStairs:true\}\)/);
 assert.match(world,/manualHighGroundGoal=wantedFloor/);
 assert.match(world,/instanceId:task\.buildingId,floor:task\.floor\|\|1/);
});

test('battle inspector restores tactical colors, stable three-team pins and floor controls',()=>{
 const style=readFileSync(new URL('../src/battle-realtime-commands.css',import.meta.url),'utf8');
 const source=ui(),world=battle();
 assert.match(style,/#battleRealtimeControls #realtimeBattleMapOverlay:has\(#realtimeMapDetail:not\(\[hidden\]\)\)/);
 assert.match(style,/background:rgba\(3,13,23,\.66\)/);
 assert.match(source,/globalAlpha=mode==='inspect'\?\.94:1/);
 assert.match(source,/saturate\(1\.7\) contrast\(1\.35\)/);
 assert.match(source,/id="realtimeMapLegend"/);
 assert.match(source,/BATTLE_TEAM_COLORS\.ally:BATTLE_TEAM_COLORS\.enemy/);
 assert.match(source,/const groupNumber=Number\(s\.groupId\)/);
 assert.match(source,/getMapBuildings=\(\)=>\[\]/);
 assert.match(source,/inspectedBuilding\.floor=Number\(selection\.value\)/);
 assert.ok(source.includes('detail.dataset?.inspectorKey===detailKey'));
 assert.match(world,/getMapBuildings:\(\)=>availableExplorationBuildings\(\{all:true\}\)/);
 assert.match(world,/if\(THREE_TEAM_BATTLE\)\{overviewInspector\.hidden=true;return;\}/);
 assert.match(style,/body\.battle-realtime-clean #overviewSquadInspector\{display:none!important\}/);
 assert.match(source,/if\(requirePrebattleChoices\|\|!started\|\|!selectedId\)\{orderNotice\.hidden=true;return;\}/);
});

test('mobile map accepts click without pointerup and does not double-deploy on both events',async()=>{
 const {createRealtimeBattleCommands}=await import('../src/battle-realtime-commands.js');
 const controls=new Map();
 const ctx=new Proxy({},{
  get(target,prop){return target[prop]??(()=>{});},
  set(target,prop,value){target[prop]=value;return true;}
 });
 const element=()=>({
  hidden:false,dataset:{},style:{},textContent:'',value:'',disabled:false,
  id:'',children:[],attributes:{},events:new Map(),innerHTML:'',
  classList:{toggle(){},add(){},remove(){},contains(){return false}},
  addEventListener(type,callback){this.events.set(type,callback);},
  setAttribute(key,value){this.attributes[key]=value;},
  getBoundingClientRect(){return {left:0,top:0,width:240,height:240};},
  setPointerCapture(){},getContext(){return ctx;},
  replaceChildren(...children){this.children=children;},
  remove(){},
  append(...children){this.children.push(...children);},
  tap(type,data={}){return this.events.get(type)?.(data);}
 });
 const root=element();
 root.querySelector=query=>{
  const id=query.replace(/^#/,'');
  if(!controls.has(id))controls.set(id,element());
  return controls.get(id);
 };
 root.querySelectorAll=()=>[];
 const doc={body:{append(){}},createElement:tag=>tag==='section'?root:element()};
 const teams=[{id:'1',groupId:1,label:'第1隊',job:'剣士',alive:4,total:4,
  hp:400,maxHp:400,x:32,z:42}];
 const deployed=[];
 const battleUi=createRealtimeBattleCommands({
  documentRef:doc,worldSize:232,getSquads:()=>teams,getDeploymentTeams:()=>teams,
  getMapBackground:()=>null,getLegalPoint:(x,z)=>({x,z}),canDeploy:()=>true,
  previewDeploy:()=>true,onDeploy:(id,point)=>{deployed.push({id,point});return true;},
  onStart:()=>true,onOrder:()=>true,
  getMapBuildings:()=>[{id:'castle-one',label:'城',x:100,z:120,floors:3}]
 });
 battleUi.openDeployment();
 const map=root.querySelector('#realtimeBattleCanvas');
 map.tap('click',{clientX:120,clientY:120});
 assert.equal(deployed.length,1,'a click alone must place the selected squad');
 map.tap('pointerdown',{pointerId:1,clientX:140,clientY:140});
 map.tap('pointerup',{pointerId:1,clientX:140,clientY:140,preventDefault(){}});
 map.tap('click',{clientX:140,clientY:140});
 assert.equal(deployed.length,2,'pointerup + synthetic click must only deploy once');
 const start=root.querySelector('#realtimeStart');
 start.onclick();start.onclick();
 assert.equal(battleUi.started,true);
 root.querySelector('#realtimeRadarExpand').onclick();
 assert.equal(root.querySelector('#realtimeMapDetail').hidden,false);
 const bx=100/232*240,bz=120/232*240;
 map.tap('pointerdown',{pointerId:2,clientX:bx,clientY:bz});
 map.tap('pointerup',{pointerId:2,clientX:bx,clientY:bz,preventDefault(){}});
 const detail=root.querySelector('#realtimeMapDetail');
 const selector=detail.children.find(x=>x.id==='realtimeInspectBuildingFloor');
 assert.ok(selector,'tapping a building must open a floor selector');
 selector.value='3';selector.onchange();
 assert.match(root.querySelector('#realtimeMapMessage').textContent,/3階/);
 const updated=detail.children.find(x=>x.id==='realtimeInspectBuildingFloor');
 assert.equal(updated.value,'3');
 root.querySelector('#realtimeMapReset').onclick();
 assert.equal(detail.children.find(x=>x.id==='realtimeInspectBuildingFloor'),updated,
  'live map redraw should keep the same open dropdown element');
 battleUi.dispose();
});
