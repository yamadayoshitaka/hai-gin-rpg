/** Pure collision volume for a staircase. Interior coordinates only. */
export function stairCollision(stair,position,radius=.53){
 if(!stair||!position)return {inside:false,onApproach:false,blocked:false};
 const dx=Math.abs(position.x-stair.x),dz=position.z-stair.z;
 const halfWidth=stair.width/2;
 const halfRun=stair.run/2;
 const onFlight=dx<=Math.max(0,halfWidth-radius)&&Math.abs(dz)<=halfRun+radius;
 const onApproach=dx<=halfWidth+.85+radius&&Math.abs(dz)<=halfRun+2.0;
 // Stair treads are walkable. Stringers/rails are solid outside the tread width.
 const onRail=dx>halfWidth-radius&&dx<=halfWidth+.45+radius&&Math.abs(dz)<=halfRun+.5;
 return {inside:onFlight,onApproach,blocked:onRail&&!onFlight};
}
export function stairContactReady(stair,position,radius=.53){
 const hit=stairCollision(stair,position,radius);
 return hit.inside||hit.onApproach;
}
