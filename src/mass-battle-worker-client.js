import {applyMassStats,applyMassUnits} from './mass-battle-worker-protocol.js';

/** Main-thread presentation mirror; the authoritative 2000-unit AI runs in a Worker. */
export function createMassBattleWorkerClient(sim,{width,height,walkable,water,opaque,bridges,riverXAt,elevationMap=null},{onSnapshot,onFailure,preferWebGpu=false,basicCombatOnly=false}={}){
  if(typeof Worker!=='function')return null;
  let worker;
  try{worker=new Worker(new URL('./mass-battle-worker.js?v=4.6.27',import.meta.url),{type:'module'});}
  catch(error){onFailure?.(error);return null;}
  let ready=false,busy=false,failed=false,pending=0,terrainRevision=0,paused=false;
  let backend='initializing',gpuFallbackReason='';
  const fail=error=>{
    if(failed)return;
    failed=true;worker.terminate();onFailure?.(error);
  };
  const sendNext=()=>{
    if(!ready||busy||failed||paused||!pending)return;
    pending--;busy=true;worker.postMessage({type:'step'});
  };
  worker.onmessage=event=>{
    const message=event.data;
    if(message.type==='error'){fail(new Error(message.message));return;}
    if(message.type==='ready'){
      backend=message.backend||'cpu-worker';gpuFallbackReason=message.gpuFallbackReason||'';
      ready=true;sendNext();return;
    }
    if(message.type!=='snapshot')return;
    try{
      backend=message.backend||backend;gpuFallbackReason=message.gpuFallbackReason||gpuFallbackReason;
      // A bridge collapse can occur while the previous tick is in flight.
      // Never resurrect its casualties with that now-stale snapshot.
      const fresh=message.terrainRevision===terrainRevision;
      if(fresh){applyMassUnits(sim.units,message.buffer);applyMassStats(sim,message.stats);}
      busy=false;
      if(fresh)onSnapshot?.();
      // Return the transferred allocation to the Worker for reuse.
      worker.postMessage({type:'recycle',buffer:message.buffer},[message.buffer]);
      sendNext();
    }catch(error){fail(error);}
  };
  worker.onerror=error=>fail(error instanceof Error?error:new Error(error.message||'Worker起動エラー'));
  worker.onmessageerror=()=>fail(new Error('Workerデータの受信に失敗しました'));
  const riverRows=new Float32Array(height);
  for(let z=0;z<height;z++)riverRows[z]=riverXAt(z);
  const walkableCopy=walkable.slice(),waterCopy=water?.slice()??new Uint8Array(walkable.length),opaqueCopy=opaque.slice();
  const heightCopy=elevationMap?.slice()??null;
  worker.postMessage({type:'init',sideCount:sim.sideCount,seed:sim.seed,width,height,
    walkable:walkableCopy,water:waterCopy,opaque:opaqueCopy,bridges,riverRows,elevationMap:heightCopy,
    preferWebGpu,basicCombatOnly,
    unitOverrides:sim.units.map(unit=>({...unit})),
    structures:sim.actions.objects.filter(o=>o.category==='structure').map(o=>({
      id:o.id,x:o.x,z:o.z,type:o.type,hp:o.hp,bounds:o.bounds,height:o.height,
      blocking:o.blocking,walkableWhenOpened:o.walkableWhenOpened,
      fireDamagePerSecond:o.fireDamagePerSecond,burnSeconds:o.burnSeconds
    }))},
    [walkableCopy.buffer,waterCopy.buffer,opaqueCopy.buffer,riverRows.buffer,...(heightCopy?[heightCopy.buffer]:[])]);
  return {
    get active(){return !failed},
    get ready(){return ready&&!failed},
    get pending(){return pending},
    get backend(){return failed?'main-thread':backend},
    get gpuFallbackReason(){return gpuFallbackReason},
    step(){if(!failed&&!paused){pending=Math.min(3,pending+1);sendNext();return true;}return false;},
    setPaused(value){paused=Boolean(value);if(paused)pending=0;else sendNext();},
    setStrategy(strategy){if(!failed)worker.postMessage({type:'strategy',strategy});},
    setSquadDestination(squadId,x,z){if(!failed)worker.postMessage({type:'squadDestination',squadId,x,z});},
    warpStrategist(unitId,x,z){if(!failed)worker.postMessage({type:'strategistWarp',unitId,x,z});},
    healItem(unitId,amount){if(!failed)worker.postMessage({type:'healItem',unitId,amount});},
    setSquadStrategy(squadId,strategy){if(!failed)worker.postMessage({type:'squadStrategy',squadId,strategy});},
    setSquadCommand(squadId,command){if(!failed)worker.postMessage({type:'squadCommand',squadId,command});},
    setSquadMission(squadId,missionType,target){if(!failed)worker.postMessage({type:'squadMission',squadId,missionType,target});},
    requestSquadHealing(targetSquadId,supportSquadId){if(!failed)worker.postMessage({type:'squadHealing',targetSquadId,supportSquadId});},
    clearSquadDestination(squadId){if(!failed)worker.postMessage({type:'clearSquadDestination',squadId});},
    setOrder(id,order){if(!failed)worker.postMessage({type:'order',id,order});},
    igniteStructure(id,options){if(!failed)worker.postMessage({type:'igniteStructure',id,options});},
    updateTerrain(walkable,destroyedCells,opaque=null){
      if(failed)return;
      const copy=walkable.slice(),opaqueCopy=opaque?.slice()??null;
      terrainRevision++;
      worker.postMessage({type:'terrain',walkable:copy,opaque:opaqueCopy,
        destroyedCells:[...destroyedCells],terrainRevision},
        opaqueCopy?[copy.buffer,opaqueCopy.buffer]:[copy.buffer]);
    },
    terminate(){failed=true;worker.terminate();}
  };
}
