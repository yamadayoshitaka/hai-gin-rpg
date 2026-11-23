/**
 * Directional bridge crossing controller shared by both banks.
 * Geometry only: actual collision/reservations remain authoritative at each step.
 * The destination must never flip back to the entrance after entering a bridge.
 */
export const BRIDGE_NEAR_OFFSET=12;
export const BRIDGE_LANDING_OFFSET=16;
export const BRIDGE_REVERSAL_LOCK_SECONDS=8;

/**
 * fromSide: -1 for the west bank, +1 for the east bank.
 * The lane is fixed on entry. A lateral detour on the opposite bank must
 * not change the crossing destination back to the original entrance.
 */
export function bridgeCrossingWaypoint(current,{
 center,row,fromSide,laneOffset=0,
 nearOffset=BRIDGE_NEAR_OFFSET,landingOffset=BRIDGE_LANDING_OFFSET
}={}){
 if(!current||!Number.isFinite(center)||!Number.isFinite(row)||
   ![-1,1].includes(fromSide))return null;
 const laneZ=row+laneOffset;
 const signed=(current.x-center)*fromSide;
 const nearX=center+fromSide*nearOffset;
 const farX=center-fromSide*landingOffset;
 // Only soldiers genuinely BEFORE the near entrance may stage at it.
 // In particular never send a soldier who is halfway across, or already
 // on the far bank but off its nominal row, back to the near entrance.
 const staging=signed>nearOffset||
   (signed===nearOffset&&current.z!==laneZ);
 const landed=signed<=-landingOffset&&Math.abs(current.z-laneZ)<=2;
 return {x:staging?nearX:farX,z:laneZ,phase:landed?'landed':staging?'approach':'crossing',
  landed,forward:-fromSide};
}

/**
 * Stabilize a target that changes sides as the nearest enemy changes.
 * Prevent an immediate automatic reverse crossing. Explicit orders retain
 * their existing route and can change direction after the lock expires.
 */
export function bridgeReverseOnCooldown(currentSide,targetSide,fromSide,landingAt,now,
 seconds=BRIDGE_REVERSAL_LOCK_SECONDS){
 return Number.isFinite(landingAt)&&Number.isFinite(now)&&
   currentSide===-fromSide&&targetSide===fromSide&&
   now-landingAt>=0&&now-landingAt<seconds;
}
