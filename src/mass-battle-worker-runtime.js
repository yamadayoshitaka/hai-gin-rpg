import {MassBattleGridSimulation} from './mass-battle-grid-sim.js?v=4.6.23';
import {packMassUnits,snapshotMassStats} from './mass-battle-worker-protocol.js';
import {WebGpuMassBattleEngine} from './mass-battle-webgpu.js?v=4.4.17';

// Also callable in Node QA without a browser, to test the identical Worker logic.
export function createMassBattleWorkerHandler(emit){
  let sim=null;
  let gpu=null,gpuFallbackReason='';
  let terrainRevision=0;
  const recycled=[];
  return async function handle(message){
    try{
      switch(message.type){
        case 'init':{
          const {sideCount,seed,width,height,walkable,water,opaque,bridges,riverRows,elevationMap,unitOverrides,structures=[]}=message;
          const riverXAt=z=>riverRows[Math.max(0,Math.min(height-1,Math.round(z)))];
          sim=new MassBattleGridSimulation(sideCount,seed,{width,height,walkable,water,opaque,bridges,riverXAt,elevationMap});
          for(const structure of structures)sim.actions.registerStructure(structure);
          terrainRevision=0;
          for(const definition of unitOverrides){
            const {id}=definition;
            const u=sim.units[id];
            if(!u)throw Error('Workerへの兵士定義が不正です: '+id);
            Object.assign(u,definition);
          }
          // Full job combat includes status, spell, summon, revival and mounted
          // movement, which the simple WGSL backend cannot model faithfully.
          if(message.preferWebGpu===true&&message.basicCombatOnly===true){
            if(sim.water.some(Boolean)){
              // The optional attack-only WGSL path does not encode per-job
              // water traversal yet. Keep ninjas/bridge routing authoritative.
              gpuFallbackReason='忍者の水上歩行・橋崩落後の経路を優先してCPU Workerで実行';
            }else{
              try{gpu=await WebGpuMassBattleEngine.create(sim,riverXAt);}
              catch(error){gpuFallbackReason=error?.message||String(error);gpu=null;}
            }
          }else if(message.preferWebGpu){
            gpuFallbackReason='職業スキル・魔法・召喚・騎乗の互換性保護によりGPU通常攻撃モードは停止中';
          }
          emit({type:'ready',backend:gpu?'webgpu':'cpu-worker',gpuFallbackReason});
          break;
        }
        case 'step':{
          if(!sim)throw Error('Workerが初期化されていません');
          if(gpu){
            try{await gpu.step(sim.strategy);}
            catch(error){
              gpuFallbackReason=error?.message||String(error);
              gpu.destroy();gpu=null;
              sim.step(.1);
            }
          }else sim.step(.1);
          const packed=packMassUnits(sim.units,recycled.pop());
          emit({type:'snapshot',buffer:packed.buffer,stats:snapshotMassStats(sim),terrainRevision,
            backend:gpu?'webgpu':'cpu-worker',gpuFallbackReason},[packed.buffer]);
          break;
        }
        case 'strategy':if(sim)sim.setStrategy(message.strategy);break;
        case 'squadDestination':if(sim)sim.setSquadDestination(message.squadId,message.x,message.z);break;
        case 'strategistWarp':if(sim)sim.warpStrategist(message.unitId,message.x,message.z);break;
        case 'healItem':if(sim)sim.healFromItem(message.unitId,message.amount);break;
        case 'squadStrategy':if(sim)sim.setSquadStrategy(message.squadId,message.strategy);break;
         case 'squadCommand':if(sim)sim.setSquadCommand(message.squadId,message.command);break;
        case 'squadMission':if(sim)sim.setSquadMission(message.squadId,message.missionType,message.target);break;
        case 'squadHealing':if(sim)sim.requestSquadHealing(message.targetSquadId,message.supportSquadId);break;
        case 'clearSquadDestination':sim?.clearSquadDestination(message.squadId);break;
        case 'order':if(sim?.units[message.id]){sim.units[message.id].order=message.order;gpu?.setOrder(message.id,message.order);}break;
        case 'igniteStructure':sim?.actions.igniteStructure(message.id,message.options);break;
        case 'terrain':{
          if(!sim)throw Error('Workerが初期化されていません');
          sim.killAtCells(new Set(message.destroyedCells));
          sim.updateWalkable(message.walkable);
          if(message.opaque)sim.updateOpaque(message.opaque);
          // The manual bridge-burn command can also change terrain outside an
          // attack event: do not allow the Worker to target a vanished bridge.
          if(message.destroyedCells?.length)for(const o of sim.actions.objects){
            if(!o.alive||o.category!=='structure'||o.type!=='bridge')continue;
            if(message.destroyedCells.some(key=>{
              const [x,z]=key.split(',').map(Number);
              return x>=o.bounds.minX&&x<=o.bounds.maxX&&z>=o.bounds.minZ&&z<=o.bounds.maxZ;
            }))o.alive=false;
          }
          gpu?.updateTerrain();
          terrainRevision=message.terrainRevision;
          break;
        }
        case 'recycle':if(message.buffer instanceof ArrayBuffer)recycled.push(message.buffer);break;
        default:throw Error('不明なWorker命令: '+message.type);
      }
    }catch(error){emit({type:'error',message:error?.stack||String(error)});}
  };
}
