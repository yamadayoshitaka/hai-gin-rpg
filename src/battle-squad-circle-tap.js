// Separate single tap (inspect) from a genuine double tap on the SAME squad.
// Pure helpers make mobile pointer and commander/infantry fallback deterministic.
export const SQUAD_CIRCLE_DOUBLE_TAP_MS=420;

export function registerSquadCircleTap(previous,{key,x=0,y=0,at,windowMs=SQUAD_CIRCLE_DOUBLE_TAP_MS,maxDistance=38}){
  const next={key:String(key),x,y,at};
  const doubleTap=Boolean(previous&&previous.key===next.key&&
    at>=previous.at&&at-previous.at<=windowMs&&
    Math.hypot(x-previous.x,y-previous.y)<=maxDistance);
  return {doubleTap,pending:doubleTap?null:next};
}

// On successive double taps alternate strategist -> soldier. A lost or
// unassigned strategist falls back to the living soldiers of the same team.
export function chooseSquadZoomTarget(members,preferred='strategist'){
  const living=members.filter(u=>u&&u.hp>0&&u.alive!==false&&!u.defeated);
  const strategist=living.find(u=>u.isStrategist);
  const soldiers=living.filter(u=>!u.isStrategist);
  const soldier=soldiers.length?(()=>{
    const center={x:soldiers.reduce((n,u)=>n+(u.x??u.cell?.x??0),0)/soldiers.length,
      z:soldiers.reduce((n,u)=>n+(u.z??u.cell?.z??0),0)/soldiers.length};
    return soldiers.reduce((a,u)=>{
      const p=u.x??u.cell?.x??0,q=u.z??u.cell?.z??0;
      const r=a.x??a.cell?.x??0,t=a.z??a.cell?.z??0;
      return (p-center.x)**2+(q-center.z)**2<(r-center.x)**2+(t-center.z)**2?u:a;
    });
  })():null;
  const role=preferred==='soldier'&&soldier?'soldier':
    strategist?'strategist':soldier?'soldier':null;
  const unit=role==='strategist'?strategist:role==='soldier'?soldier:null;
  return {unit:unit??null,role,nextPreferred:role==='strategist'?'soldier':'strategist'};
}
