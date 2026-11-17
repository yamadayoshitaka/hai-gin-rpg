/**
 * Lightweight overview-only squad badge placement. Source positions remain the
 * real 3D projected centroids; badges may slide to avoid a touch collision,
 * with the caller drawing a fine leader back to the source point.
 * This is independent of the soldier's draw budget/LOD.
 */
export function overviewPinLabel({team,squadIndex,group,division}){
 if(team===1)return '敵'+(squadIndex+1);
 return String(group)+'-'+String(division);
}
export function placeOverviewSquadPins(points,bounds,{width=42,height=40}={}){
 const result=new Map(),taken=[];
 if(!Number.isFinite(bounds.left)||!Number.isFinite(bounds.top))return result;
 const minX=bounds.left+width/2,maxX=bounds.right-width/2;
 const minY=bounds.top+height/2,maxY=bounds.bottom-height/2;
 if(maxX<minX||maxY<minY)return result;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 // Use a stable order across frames, preventing labels from swapping sides.
 for(const p of [...points].sort((a,b)=>a.team-b.team||
  a.squadIndex-b.squadIndex||String(a.key).localeCompare(String(b.key)))){
  if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
  const ax=clamp(p.x,minX,maxX),ay=clamp(p.y,minY,maxY);
  const intersects=(x,y)=>taken.some(t=>Math.abs(t.x-x)<width+2&&Math.abs(t.y-y)<height+2);
  let best={x:ax,y:ay},found=false;
  // Deterministic small spiral; never run a costly physics layout at 60fps.
  for(let ring=0;ring<=5&&!found;ring++){
   const steps=ring?8:1;
   for(let n=0;n<steps;n++){
    const angle=n*Math.PI/4,dist=ring*16;
    const x=clamp(ax+Math.cos(angle)*dist,minX,maxX);
    const y=clamp(ay+Math.sin(angle)*dist,minY,maxY);
    if(!intersects(x,y)){best={x,y};found=true;break}
   }
  }
  taken.push(best);
  result.set(p.key,{...best,anchorX:p.x,anchorY:p.y,
   displaced:Math.hypot(best.x-p.x,best.y-p.y)>8});
 }
 return result;
}

/** Rank existing (free or story) plans from the REAL live group composition.
 * The score represents suitability 0-100, never fabricated win probability.
 * No AI API calls, game-stat mutations, or per-frame work.
 */
export function recommendOverviewGroupPlans(plans,methods,{
 jobs=[],stageKind='explore',terrain='plains',woundedRatio=0
}={}){
 const counts=new Map();
 for(const job of jobs)counts.set(String(job),(counts.get(String(job))||0)+1);
 const population=jobs.length,pressure=Math.max(0,Math.min(1,woundedRatio));
 return plans.map(plan=>{
  const method=methods[plan.methodId],roles=method?.jobs||[];
  const capable=roles.length?roles.reduce((n,job)=>n+(counts.get(job)||0),0):population;
  const roleFit=population?capable/population:0;
  const objectiveFit=plan.kind===stageKind?23:plan.kind==='defend'&&pressure>.4?10:0;
  const terrainFit=(plan.terrain||[]).includes(terrain)?16:0;
  const support=plan.id==='support'&&pressure>.25?15:0;
  const withdrawal=plan.id==='retreat'&&pressure>.55?18:0;
  const assault=plan.id==='assault'&&pressure>.55?-12:0;
  const score=Math.max(0,Math.min(100,Math.round(
   14+roleFit*32+objectiveFit+terrainFit+(capable>0?12:0)+support+withdrawal+assault
  )));
  return {...plan,score,eligible:capable>0,
   reason:(capable>0?capable+'人が実行可能':'対応職なし')+'・'+
    (objectiveFit?'目的一致':'目的は標準')+'・'+
    (terrainFit?'地形適性あり':'地形は標準')+
    (support||withdrawal?'・損耗を考慮':'')};
 }).sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.score-a.score||
  String(a.id).localeCompare(String(b.id)));
}
