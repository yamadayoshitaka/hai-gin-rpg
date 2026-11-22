/** Read-only expanded radar hit testing. Coordinates are canvas pixels, never world orders. */
export function findBattleMapPin(pins=[],x=0,y=0,{radius=24}={}){
 if(!Number.isFinite(x)||!Number.isFinite(y))return null;
 let best=null,dist=radius*radius;
 for(const pin of pins){
  if(!Number.isFinite(pin?.px)||!Number.isFinite(pin?.py))continue;
  const candidate=(pin.px-x)**2+(pin.py-y)**2;
  if(candidate<=dist){dist=candidate;best=pin;}
 }
 return best;
}
export const formatBattleMapPercent=(value,max)=>max>0?
 Math.max(0,Math.min(100,Math.round(100*value/max))):0;

/**
 * Preserve the last valid live command-team anchor through brief missing
 * coordinate samples. A group confirmed defeated is removed immediately.
 * This cache is presentation-only: it never alters movement or combat state.
 */
export function stableBattleMapPins(livePins=[],cache=new Map(),{
 now=0,ttlMs=2200,aliveByGroup=new Map()
}={}){
 const result=[],present=new Set();
 for(const pin of livePins){
  if(!pin)continue;
  const key=String(pin.team)+':'+String(pin.groupId??pin.id);
  // Fresh live position wins over a slightly older status-row snapshot.
  if(!Number.isFinite(pin.x)||!Number.isFinite(pin.z))continue;
  present.add(key);
  cache.set(key,{pin:{...pin},updatedAt:now});
  result.push(pin);
 }
 for(const [key,entry] of cache){
  if(aliveByGroup.get(key)===0||now-entry.updatedAt>ttlMs){
   cache.delete(key);continue;
  }
  if(!present.has(key))result.push({...entry.pin});
 }
 return result;
}

/** Keep static building icons steady through brief scene-visibility transitions. */
export function stableBattleMapBuildings(buildings=[],cache=new Map(),now=0,ttlMs=2200){
 const output=[],present=new Set();
 for(const building of buildings){
  if(building?.id==null||!Number.isFinite(building.x)||!Number.isFinite(building.z))continue;
  const key=String(building.id);
  cache.set(key,{building:{...building},updatedAt:now});
  present.add(key);output.push(building);
 }
 for(const [key,entry] of cache){
  if(now-entry.updatedAt>ttlMs){cache.delete(key);continue;}
  if(!present.has(key))output.push({...entry.building});
 }
 return output;
}
