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
