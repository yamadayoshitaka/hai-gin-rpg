// Transferable state for the GPU crowd renderer's CPU-side mirror. Only values
// that change during a tick cross the thread boundary; meshes and BOM data do not.
export const MASS_UNIT_FIELDS=Object.freeze([
  'x','z','fromX','fromZ','moveElapsed','moveDuration',
  'hp','maxHp','cooldown','phase','completedSteps','vx','vz',
  'facingX','facingZ','hitFlash','attackElapsed',
  'deathAt','deathX','deathZ','alive','crossed','action','jobIndex','order',
  'mp','maxMp','skillPoseUntil','burningUntil','burnAccum',
  'guardUntil','fireWardUntil','stealthUntil','reflectUntil','absorbUntil'
]);
export const MASS_UNIT_STRIDE=MASS_UNIT_FIELDS.length;
const ACTIONS=Object.freeze(['advance','walk','attack','hold','blocked','skill','idle']);
const ACTION_INDEX=new Map(ACTIONS.map((name,index)=>[name,index]));
const ORDERS=Object.freeze([null,'charge','defend','hold','retreat']);
const ORDER_INDEX=new Map(ORDERS.map((name,index)=>[name,index]));

export function packMassUnits(units,buffer){
  const required=units.length*MASS_UNIT_STRIDE*Float32Array.BYTES_PER_ELEMENT;
  const result=new Float32Array(buffer?.byteLength===required?buffer:new ArrayBuffer(required));
  let index=0;
  for(const unit of units){
    for(const field of MASS_UNIT_FIELDS){
      result[index++]=field==='action'?(ACTION_INDEX.get(unit.action)??0):
        field==='order'?(ORDER_INDEX.get(unit.order??null)??0):
        field==='alive'||field==='crossed'?Number(unit[field]):unit[field];
    }
  }
  return result;
}

export function applyMassUnits(units,buffer){
  const values=new Float32Array(buffer);
  if(values.length!==units.length*MASS_UNIT_STRIDE)throw Error('大軍Workerスナップショットの兵数が一致しません');
  let index=0;
  for(const unit of units){
    for(const field of MASS_UNIT_FIELDS){
      const value=values[index++];
      unit[field]=field==='action'?(ACTIONS[value]??'advance'):
        field==='order'?(ORDERS[value]??null):
        field==='alive'||field==='crossed'?Boolean(value):value;
    }
  }
}

export function snapshotMassStats(sim){
  return {time:sim.time,tickCount:sim.tickCount,attacks:sim.attacks,
    lastAiMs:sim.lastAiMs,live:sim.live.slice(),crossings:sim.crossings.slice(),
    actionEvents:sim.actionEvents,objects:sim.objects,
    actionRuntime:{time:sim.actions.time,castCount:sim.actions.castCount,
      objectDamage:sim.actions.objectDamage,nextObjectId:sim.actions.nextObjectId},
    // Only units casting this tick need their cooldown map synchronized.
    skillCooldowns:sim.actionEvents.filter(e=>e.type==='skill').map(e=>({id:e.sourceId,
      next:{...sim.units[e.sourceId]?._skillNext}}))};
}

export function applyMassStats(sim,stats){
  sim.time=stats.time;sim.tickCount=stats.tickCount;sim.attacks=stats.attacks;
  sim.lastAiMs=stats.lastAiMs;sim.live=stats.live.slice();sim.crossings=stats.crossings.slice();
  sim.actionEvents=stats.actionEvents??[];
  if(stats.objects){
    sim.actions.objects=stats.objects;sim.objects=sim.actions.objects;
    for(const u of sim.units)u.mountId=null;
    for(const o of sim.objects)if(o.alive&&['mount','summon'].includes(o.category)&&o.mountedBy!=null&&sim.units[o.mountedBy])
      sim.units[o.mountedBy].mountId=o.id;
  }
  if(stats.actionRuntime)Object.assign(sim.actions,stats.actionRuntime);
  for(const {id,next} of stats.skillCooldowns??[])if(sim.units[id])sim.units[id]._skillNext=next;
}
