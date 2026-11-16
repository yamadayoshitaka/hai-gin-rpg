/**
 * Find the real living soldier that the zoom camera is inspecting, regardless
 * of team. Keep this separate from the squad centroid (which may be far away
 * while a swordsman chases across a bridge). O(n) at 4 Hz, never per frame.
 */
export function zoomedSquadMember(units,focus,{preferredId=null,cellSize=1,offset=0,maxDistance=17}={}){
 if(!focus||!Number.isFinite(focus.x)||!Number.isFinite(focus.z))return null;
 let nearest=null,best=maxDistance*maxDistance;
 for(const unit of units||[]){
  if(!unit||unit.hp<=0||unit.alive===false||unit.defeated)continue;
  const x=unit.root?.position?.x??((unit.x-offset)*cellSize);
  const z=unit.root?.position?.z??((unit.z-offset)*cellSize);
  if(!Number.isFinite(x)||!Number.isFinite(z))continue;
  const dx=x-focus.x,dz=z-focus.z,d2=dx*dx+dz*dz;
  if(preferredId!=null&&String(unit.id)===String(preferredId)&&d2<=best*2.25)
   return unit;
  if(d2<best){nearest=unit;best=d2;}
 }
 return nearest;
}
