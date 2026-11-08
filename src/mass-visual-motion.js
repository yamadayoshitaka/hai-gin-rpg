/**
 * Presentation-only mass-battle smoothing. Physics, occupied tiles, damage and
 * authoritative Worker snapshots are NEVER modified.
 *
 * Sample once per display frame for each unit, then reuse the same coordinate
 * and distance-driven foot phase in detailed rigs, GPU geometry and impostors.
 * A short exponential filter absorbs worker snapshot bursts without delaying
 * the soldier by more than a fraction of one tile.
 */
export function sampleMassVisualMotion(unit, raw, frame, dt, cellSize=1){
  if(!unit||![raw?.x,raw?.y,raw?.z].every(Number.isFinite))
    throw Error('Invalid mass visual position');
  const yaw=Math.atan2(unit.facingX||0,unit.facingZ||1);
  let pose=unit._visualMotion;
  const newUnit=!pose||!unit.alive||unit._visualMotionAlive===false;
  if(newUnit){
    pose={x:raw.x,y:raw.y,z:raw.z,yaw,phase:Math.PI*(unit.completedSteps||0),frame};
    unit._visualMotion=pose;
  }else if(pose.frame!==frame){
    const dx=raw.x-pose.x,dy=raw.y-pose.y,dz=raw.z-pose.z;
    const gap=Math.hypot(dx,dy,dz);
    // Death, revival, roof travel or forced relocations must never tween
    // across half a village. Ordinary gait may lag at most 0.24 of one tile.
    if(gap>Math.max(3,cellSize*3)){
      pose.x=raw.x;pose.y=raw.y;pose.z=raw.z;pose.yaw=yaw;
    }else{
      const factor=1-Math.exp(-Math.max(0,Math.min(.2,dt||0))*24);
      pose.x+=dx*factor;pose.y+=dy*factor;pose.z+=dz*factor;
      const remainingX=raw.x-pose.x,remainingZ=raw.z-pose.z;
      const lag=Math.hypot(remainingX,remainingZ),limit=cellSize*.22;
      if(lag>limit){pose.x=raw.x-remainingX/lag*limit;pose.z=raw.z-remainingZ/lag*limit;}
      const angle=Math.atan2(Math.sin(yaw-pose.yaw),Math.cos(yaw-pose.yaw));
      pose.yaw+=angle*factor;
    }
    pose.frame=frame;
  }
  unit._visualMotionAlive=unit.alive;
  const sx=(unit.x-unit.fromX)*cellSize,sz=(unit.z-unit.fromZ)*cellSize;
  if(unit.moveDuration>0&&sx*sx+sz*sz>0){
    const startX=(unit.fromX-6)*cellSize,startZ=(unit.fromZ-6)*cellSize;
    const progress=Math.max(0,Math.min(1,((pose.x-startX)*sx+(pose.z-startZ)*sz)/(sx*sx+sz*sz)));
    // completedSteps increments at touchdown, one simulation tick BEFORE
    // the next movement begins. Keep the previous gait at its contact phase.
    const completed=unit.moveElapsed>=unit.moveDuration;
    const firstStep=Math.max(0,(unit.completedSteps||0)-(completed?1:0));
    pose.phase=Math.PI*(firstStep+progress);
  }else{
    pose.phase=Math.PI*(unit.completedSteps||0);
  }
  return pose;
}

// Motion must remain in the same run clip at terminal tile contact.
// Otherwise the 50v50 rig cross-switches run->idle->run every grid step.
export function massGaitActive(unit){
 return !!unit?.alive&&(unit.highGroundPhase===1||(unit.moveDuration>0&&(
   unit.moveElapsed<unit.moveDuration||unit.action==='walk')));
}
