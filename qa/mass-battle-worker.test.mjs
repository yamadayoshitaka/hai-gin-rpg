import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {applyMassStats,applyMassUnits,packMassUnits} from '../src/mass-battle-worker-protocol.js';
import {createMassBattleWorkerClient} from '../src/mass-battle-worker-client.js';

// Browser startup regression: crossingData is block-scoped during sim setup.
// Passing that local again when starting the Worker threw ReferenceError and
// left the entire 1000v1000 screen blank even though headless AI tests passed.
const gameHtml=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(gameHtml,/createMassBattleWorkerClient\(massSim,\{[\s\S]*?opaque:massSim\.opaque,bridges:massSim\.bridges,riverXAt:riverAt/,
  '1000対1000 Worker起動時の橋データはスコープ外変数を参照しない');

const width=232,height=232;
const walkable=new Uint8Array(width*height).fill(1);
const water=new Uint8Array(width*height);
const opaque=new Uint8Array(width*height);
for(let z=0;z<height;z++)for(let x=111;x<=121;x++){walkable[z*width+x]=0;water[z*width+x]=1;}
const bridges=[{x:116,z:55,type:'stone'},{x:116,z:116,type:'stone'},{x:116,z:177,type:'timber'}];
for(const bridge of bridges){
  for(let z=bridge.z-6;z<=bridge.z+6;z++)for(let x=111;x<=121;x++)walkable[z*width+x]=1;
}
const options={width,height,walkable,water,opaque,bridges,riverXAt:()=>116};
const seed=20261104,sideCount=1000;
const reference=new MassBattleGridSimulation(sideCount,seed,options);
const mirror=new MassBattleGridSimulation(sideCount,seed,options);
// Preserve the appearance/job setup applied by the game after construction.
for(const sim of [reference,mirror]){
  sim.units[0].jobIndex=8;sim.units[0].jobId='summoner';sim.units[0].rarity='UR';
  sim.units[1].jobIndex=6;sim.units[1].jobId='mage';sim.units[1].rarity='R';
}
const riverRows=new Float32Array(height).fill(116);
const worker=new Worker(new URL('./mass-battle-worker-thread.mjs',import.meta.url),{type:'module'});

function nextMessage(){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{cleanup();reject(new Error('Workerの応答がタイムアウトしました'));},15000);
    const message=msg=>{cleanup();msg.type==='error'?reject(new Error(msg.message)):resolve(msg)};
    const error=err=>{cleanup();reject(err)};
    const cleanup=()=>{clearTimeout(timer);worker.off('message',message);worker.off('error',error)};
    worker.on('message',message);worker.on('error',error);
  });
}
async function command(data,expected){
  const response=nextMessage();worker.postMessage(data);
  const result=await response;
  assert.equal(result.type,expected);
  return result;
}

try{
  const ready=await command({type:'init',sideCount,seed,width,height,walkable:walkable.slice(),
    water:water.slice(),opaque:opaque.slice(),bridges,riverRows,
    unitOverrides:reference.units.map(u=>({...u}))},'ready');
  assert.equal(ready.type,'ready');
  assert.equal(ready.backend,'cpu-worker','GPUがないNodeではWorker方式を維持する');
  for(let tick=0;tick<70;tick++){
    if(tick===15){reference.strategy='charge';worker.postMessage({type:'strategy',strategy:'charge'});}
    if(tick===22){reference.units[0].order='hold';worker.postMessage({type:'order',id:0,order:'hold'});}
    if(tick===25){
      assert.ok(reference.setSquadDestination(0,92,116));
      worker.postMessage({type:'squadDestination',squadId:0,x:92,z:116});
    }
    if(tick===29){
      assert.ok(reference.setSquadCommand(0,'charge'));
      worker.postMessage({type:'squadCommand',squadId:0,command:'charge'});
    }
    if(tick===33){
      assert.ok(reference.setSquadCommand(0,'support'));
      worker.postMessage({type:'squadCommand',squadId:0,command:'support'});
    }
    if(tick===38){
      const brokenCells=new Set();const next=walkable.slice();
      for(let z=171;z<=183;z++)for(let x=111;x<=121;x++){
        next[z*width+x]=0;brokenCells.add(x+','+z);
      }
      reference.killAtCells(brokenCells);reference.updateWalkable(next);
      worker.postMessage({type:'terrain',walkable:next.slice(),destroyedCells:[...brokenCells],terrainRevision:1});
    }
    reference.step(.1);
    const message=await command({type:'step'},'snapshot');
    assert.equal(message.backend,'cpu-worker');
    assert.equal(message.terrainRevision,tick<38?0:1,'橋更新の世代番号');
    applyMassUnits(mirror.units,message.buffer);
    applyMassStats(mirror,message.stats);
    const expected=packMassUnits(reference.units);
    const actual=packMassUnits(mirror.units);
    assert.deepEqual(actual,expected,`Workerと従来AIに差異があります (tick ${tick})`);
    assert.deepEqual(mirror.live,reference.live,'戦闘不能数');
    assert.deepEqual(mirror.crossings,reference.crossings,'橋通過数');
    assert.equal(mirror.attacks,reference.attacks,'攻撃回数');
    assert.deepEqual(mirror.actionEvents,reference.actionEvents,'職業スキル・魔法・召喚イベント');
    assert.deepEqual(mirror.objects,reference.objects,'軍馬・召喚獣・罠のオブジェクト同期');
    assert.equal(mirror.actions.castCount,reference.actions.castCount,'スキル使用数');
    for(const event of reference.actionEvents.filter(e=>e.type==='skill')){
      assert.deepEqual(mirror.units[event.sourceId]._skillNext,reference.units[event.sourceId]._skillNext,
        'CPUフォールバック時のスキル待機時間を維持');
    }
    worker.postMessage({type:'recycle',buffer:message.buffer},[message.buffer]);
  }
  console.log('1000対1000: 実Worker 70tick / 職業魔法・召喚・軍馬・HP・橋破壊・個別命令の完全同期 OK');
}finally{await worker.terminate();}

// Exercise the actual browser-facing client with a Node Worker API adapter.
// Its worker remains a separate OS thread and transfer lists are honored.
globalThis.Worker=class BrowserWorkerAdapter{
  constructor(){
    this.thread=new Worker(new URL('./mass-battle-worker-thread.mjs',import.meta.url),{type:'module'});
    this.thread.on('message',data=>this.onmessage?.({data}));
    this.thread.on('error',error=>this.onerror?.(error));
  }
  postMessage(message,transfers){this.thread.postMessage(message,transfers);}
  terminate(){return this.thread.terminate();}
};
const browserMirror=new MassBattleGridSimulation(100,seed,options);
browserMirror.actions.registerStructure({id:'actual-map-stone-bridge',x:116,z:116,type:'bridge',hp:220,
  bounds:{minX:101,maxX:131,minZ:115,maxZ:117},blocking:false,walkableWhenOpened:false});
let received=0;
const client=createMassBattleWorkerClient(browserMirror,options,{onSnapshot:()=>received++});
async function waitUntil(predicate){
  const until=Date.now()+10000;
  while(!predicate()){
    if(Date.now()>until)throw Error('Workerクライアントがタイムアウトしました');
    await new Promise(resolve=>setTimeout(resolve,5));
  }
}
try{
  await waitUntil(()=>client.ready);
  for(let i=1;i<=4;i++){
    client.step();
    await waitUntil(()=>received===i);
    assert.equal(browserMirror.tickCount,i);
    assert.ok(browserMirror.objects.some(o=>o.id==='actual-map-stone-bridge'&&o.type==='bridge'),
      'Workerの戦闘オブジェクト同期に実マップの石橋が含まれる');
  }
  const changed=walkable.slice(),destroyedCells=new Set();
  for(let z=171;z<=183;z++)for(let x=111;x<=121;x++){
    changed[z*width+x]=0;destroyedCells.add(x+','+z);
  }
  browserMirror.killAtCells(destroyedCells);
  browserMirror.updateWalkable(changed);
  client.updateTerrain(changed,destroyedCells);
  client.igniteStructure('actual-map-stone-bridge',{
    initialDamage:16,burnSeconds:3,fireDamagePerSecond:4});
  client.setStrategy('defend');client.setOrder(0,'hold');
  client.step();await waitUntil(()=>received===5);
  const ignitedBridge=browserMirror.objects.find(o=>o.id==='actual-map-stone-bridge');
  assert.equal(ignitedBridge.hp,204,'Worker指示で橋の耐久力にダメージ');
  assert.ok(ignitedBridge.burningUntil>browserMirror.time,'火災の継続状態をWorkerから同期');
  assert.equal(browserMirror.units.filter(u=>u.alive).length,browserMirror.live[0]+browserMirror.live[1]);
  assert.equal(client.active,true);
  console.log('ブラウザWorkerクライアント: 実スレッド・転送バッファ再利用・橋更新・作戦変更 OK');
}finally{client.terminate();delete globalThis.Worker;}
