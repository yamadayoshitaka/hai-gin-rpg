/** Render-agnostic warning policy for destructible battlefield bridges. */
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
function standingOnBridge(unit,structure,definition){
  const cell=unit?.cell??unit, x=cell?.x,z=cell?.z;
  if(!Number.isInteger(x)||!Number.isInteger(z))return false;
  const cells=definition?.source?.cells,key=x+','+z;
  if(cells?.has)return cells.has(key);
  if(Array.isArray(cells))return cells.includes(key);
  const b=structure.bounds;
  return Boolean(b&&x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ);
}
/**
 * Low-cost snapshot, called at most once per second (even with 2000 soldiers).
 * Only living allied squads physically ON an endangered bridge are offered
 * evacuation. Burning alone is not an imminent-collapse alert unless the
 * remaining burn time can realistically consume the remaining HP.
 */
export function bridgeSafetySnapshot(objects,definitions,units,now=0){
  const bridges=[];
  for(const bridge of objects??[]){
    if(bridge?.category!=='structure'||bridge.type!=='bridge')continue;
    const definition=definitions?.get?.(bridge.id);
    const maxHp=Math.max(1,finite(bridge.maxHp,1));
    const hp=Math.max(0,finite(bridge.hp,0));
    const ratio=Math.min(1,hp/maxHp);
    const burning=bridge.alive!==false&&bridge.burningUntil>now;
    const dps=Math.max(0,finite(bridge.fireDamagePerSecond));
    const rawBurnSeconds=burning&&dps>0?hp/dps:Infinity;
    const burnCollapseSeconds=rawBurnSeconds<=bridge.burningUntil-now?rawBurnSeconds:Infinity;
    const danger=bridge.alive!==false&&hp>0&&(ratio<=.35||burnCollapseSeconds<=12);
    const caution=bridge.alive!==false&&hp>0&&(danger||ratio<=.55||burnCollapseSeconds<=20);
    const squads=new Set();
    if(danger)for(const unit of units??[]){
      if(unit?.team!==0||unit?.alive===false||!(unit?.hp>0)||unit.squadId==null)continue;
      if(standingOnBridge(unit,bridge,definition))squads.add(String(unit.squadId));
    }
    bridges.push({id:String(bridge.id),name:definition?.source?.type==='timber'?'木橋':'石橋',
      hp,maxHp,ratio,burning,danger,caution,collapsed:bridge.alive===false||hp===0,
      burnCollapseSeconds,affectedSquads:[...squads]});
  }
  return bridges;
}
