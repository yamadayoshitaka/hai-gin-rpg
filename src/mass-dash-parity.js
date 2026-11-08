import {massGaitActive} from './mass-visual-motion.js?v=4.6.35';

/**
 * Shared 50/1000 battle locomotion contract. The combat grid calls moving
 * units "walk" for historical reasons: that is an AI state, NOT a request
 * to play a slow Walking_A clip. Everyone on ordinary tactical grid tiles
 * uses a real Running_* clip; only physical stair-tread travel walks.
 */
export function massLocomotionKind(unit){
 if(!unit?.alive)return 'dead';
 if(unit.mountId)return 'mounted';
 if(unit.highGroundPhase===1)return 'walk';
 return massGaitActive(unit)?'run':'idle';
}

/** The GPU code 1.25 reuses the already-uploaded run pose attributes with
 * reduced stride during stairs, without adding a new vertex attribute/mesh.
 * 1.0 is the full-speed dash for ground/indoors/bridges/diagonals.
 */
export function massGpuMotionCode(unit,{striking=false}={}){
 const kind=massLocomotionKind(unit);
 if(kind==='dead')return 4;
 if(kind==='mounted')return striking?5.5:5;
 if(kind==='run')return 1;
 if(kind==='walk')return 1.25;
 return unit?.hitFlash>0?3:striking?2:unit?.action==='blocked'?1.25:0;
}

/** Render-stage metrics, counted from visible GPU objects rather than from
 * issued AI goals. They let a live Android battle expose dash/walk ratios. */
export function massDashCoverage(visibleUnits=[]){
 let dash=0,stairs=0,other=0;
 for(const u of visibleUnits){
  const mode=massLocomotionKind(u);
  if(mode==='run')dash++;
  else if(mode==='walk')stairs++;
  else other++;
 }
 const locomoting=dash+stairs;
 return {dash,stairs,other,locomoting,
  dashPercent:locomoting?Math.round(dash*100/locomoting):0};
}
