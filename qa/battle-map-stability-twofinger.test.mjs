import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {stableBattleMapPins} from '../src/battle-map-inspection.js';

test('battle map holds a live squad's pin across missing worker positions',()=>{
 const cache=new Map(),aliveByGroup=new Map([['0:1',5],['1:2',4]]);
 const blue={team:0,groupId:1,id:'ally',x:42,z:80,alive:5};
 const red={team:1,groupId:2,id:'enemy',x:184,z:109,alive:4};
 const first=stableBattleMapPins([blue,red],cache,{now:100,aliveByGroup});
 assert.deepEqual(first,[blue,red]);
 const briefGap=stableBattleMapPins([blue],cache,{now:900,aliveByGroup});
 assert.equal(briefGap.length,2,'a single missing enemy update must not hide its red pin');
 assert.equal(briefGap[1].x,184);
 const missingCoordinate=stableBattleMapPins([{...blue,x:NaN},red],cache,
  {now:1200,aliveByGroup});
 assert.equal(missingCoordinate.length,2,'a NaN ally update retains its previous pin');
 assert.equal(missingCoordinate.find(p=>p.team===0)?.x,42);
 aliveByGroup.set('1:2',0);
 const defeated=stableBattleMapPins([blue],cache,{now:1500,aliveByGroup});
 assert.equal(defeated.length,1,'confirmed defeated teams must disappear immediately');
 assert.equal(defeated[0].team,0);
 const timedOut=stableBattleMapPins([],cache,{now:5000,aliveByGroup});
 assert.equal(timedOut.length,0,'lost coordinates never leave permanent ghost markers');
});

test('actual live coordinates override one stale zero-count status sample',()=>{
 const cache=new Map(),pin={team:1,groupId:3,id:'e9',x:195,z:91};
 assert.deepEqual(stableBattleMapPins([pin],cache,{
  now:10,aliveByGroup:new Map([['1:3',0]])
 }),[pin]);
});

test('mobile map supports two-finger translation from 100 percent without phantom taps',async()=>{
 const {createRealtimeBattleCommands}=await import('../src/battle-realtime-commands.js');
 const elements=new Map();
 const ctx=new Proxy({},{get:(obj,key)=>obj[key]??(()=>{}),
  set:(obj,key,value)=>{obj[key]=value;return true;}});
 const element=()=>({
  hidden:false,dataset:{},style:{},value:'',textContent:'',disabled:false,
  children:[],events:new Map(),classList:{toggle(){},add(){},remove(){},contains(){return false}},
  append(...items){this.children.push(...items);},remove(){},replaceChildren(...items){this.children=items;},
  setAttribute(){},addEventListener(type,fn){this.events.set(type,fn);},
  getBoundingClientRect(){return {left:0,top:0,width:240,height:240};},
  setPointerCapture(){},getContext(){return ctx;},
  tap(type,props={}){return this.events.get(type)?.(props);}
 });
 const root=element();
 root.querySelector=query=>{
  const id=query.replace(/^#/,'');
  if(!elements.has(id))elements.set(id,element());
  return elements.get(id);
 };
 root.querySelectorAll=()=>[];
 const documentRef={body:{append(){}},createElement:tag=>tag==='section'?root:element()};
 const allies=[{id:'a1',groupId:1,alive:4,total:4,x:32,z:42,job:'剣士'}];
 const enemies=[{id:'e1',groupId:1,alive:4,total:4,x:195,z:160}];
 let deployments=0;
 const ui=createRealtimeBattleCommands({
  documentRef,worldSize:232,getSquads:()=>allies,getDeploymentTeams:()=>allies,
  getRadarSquads:()=>allies,getRadarEnemies:()=>enemies,getMapBackground:()=>null,
  onStart:()=>true,getInitialTeamPlan:()=>({strategy:'assault',allowedStrategies:['assault']}),
  onDeploy:()=>{deployments++;return true;},canDeploy:()=>true,previewDeploy:()=>true
 });
 ui.openDeployment();
 root.querySelector('#realtimeStart').onclick();
 root.querySelector('#realtimeStart').onclick();
 assert.equal(ui.started,true);
 root.querySelector('#realtimeRadarExpand').onclick();
 assert.equal(ui.mapView.zoom,1);
 const map=root.querySelector('#realtimeBattleCanvas');
 const touch=(type,id,x,y)=>map.tap(type,{
  pointerId:id,pointerType:'touch',clientX:x,clientY:y,preventDefault(){}
 });
 touch('pointerdown',11,80,120);touch('pointerdown',12,160,120);
 touch('pointermove',11,110,120);touch('pointermove',12,190,120);
 assert.ok(ui.mapView.zoom>1.2,'sliding two fingers at full extent must make the field pannable');
 assert.notEqual(ui.mapView.centerX,116,'two-finger slide changes the visible map center');
 touch('pointerup',11,110,120);touch('pointerup',12,190,120);
 map.tap('click',{clientX:150,clientY:120});
 assert.equal(deployments,0,'a two-finger gesture never issues a deployment command');
 ui.dispose();
});

test('battle squad centroids exclude invalid worker coordinates',()=>{
 const world=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 assert.match(world,/const positioned=members\.map\(u=>/);
 assert.match(world,/\.filter\(p=>Number\.isFinite\(p\.x\)&&Number\.isFinite\(p\.z\)\)/);
});
