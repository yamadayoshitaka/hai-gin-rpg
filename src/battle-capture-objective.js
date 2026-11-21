/** A fixed, visible enemy-base goal for capture battles.
 * World coordinates are taken from the actual starting enemy squad locations,
 * not from a hard-coded screen position. The marker and victory test share
 * this exact anchor. */
export function createBattleCaptureObjective({
 worldSize=232,isWalkable=()=>true,radius=11,holdSeconds=8
}={}){
 let point=null,heldSeconds=0,lastElapsed=null,allies=0,enemies=0,complete=false;
 const live=u=>Number(u?.hp)>0&&u.alive!==false&&u.defeated!==true;
 const position=u=>({x:Number(u?.x??u?.cell?.x),z:Number(u?.z??u?.cell?.z)});
 function ensure(enemyCenters=[]){
  if(point)return snapshot();
  const centers=enemyCenters.filter(p=>Number.isFinite(Number(p?.x))&&Number.isFinite(Number(p?.z)));
  if(!centers.length)return null;
  const x=Math.round(centers.reduce((n,p)=>n+Number(p.x),0)/centers.length);
  const z=Math.round(centers.reduce((n,p)=>n+Number(p.z),0)/centers.length);
  for(let distance=0;distance<=24;distance++){
   for(let dz=-distance;dz<=distance;dz++)for(let dx=-distance;dx<=distance;dx++){
    if(Math.max(Math.abs(dx),Math.abs(dz))!==distance)continue;
    const px=x+dx,pz=z+dz;
    if(px<0||pz<0||px>=worldSize||pz>=worldSize||!isWalkable(px,pz))continue;
    point={x:px,z:pz};return snapshot();
   }
  }
  return null;
 }
 function snapshot(){
  return point?{kind:'capture',label:'敵本陣の制圧地点',x:point.x,z:point.z,
   radius,holdSeconds,heldSeconds,progress:Math.min(100,Math.round(heldSeconds/holdSeconds*100)),
   allies,enemies,complete}:null;
 }
 function tick(units=[],elapsed=0){
  if(!point||complete)return snapshot();
  const time=Number(elapsed);
  const dt=Number.isFinite(time)&&lastElapsed!=null?Math.max(0,Math.min(2,time-lastElapsed)):0;
  if(Number.isFinite(time))lastElapsed=time;
  allies=0;enemies=0;
  for(const unit of units){
   if(!live(unit))continue;
   const p=position(unit);
   if(!Number.isFinite(p.x)||!Number.isFinite(p.z)||
      Math.hypot(p.x-point.x,p.z-point.z)>radius)continue;
   if(Number(unit.team)===0)allies++;
   else if(Number(unit.team)===1)enemies++;
  }
  if(allies>0&&enemies===0)heldSeconds=Math.min(holdSeconds,heldSeconds+dt);
  else heldSeconds=Math.max(0,heldSeconds-dt);
  if(heldSeconds>=holdSeconds)complete=true;
  return snapshot();
 }
 return {ensure,tick,snapshot};
}
