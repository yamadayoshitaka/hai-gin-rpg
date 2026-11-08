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
    // Display-only gait phase, not the authoritative AI tile count.
    // One 2.2m game tile contains approximately TWO running footfalls.
    pose={x:raw.x,y:raw.y,z:raw.z,yaw,phase:2*Math.PI*(unit.completedSteps||0),
      frame,gaitHold:0,lastFrameTravel:0};
    unit._visualMotion=pose;
  }else if(pose.frame!==frame){
    const priorX=pose.x,priorY=pose.y,priorZ=pose.z;
    const dx=raw.x-pose.x,dy=raw.y-pose.y,dz=raw.z-pose.z;
    const gap=Math.hypot(dx,dy,dz);
    // Do not count teleport/respawn corrections as running strides.
    const teleported=gap>Math.max(3,cellSize*3);
    if(teleported){
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
    // The previous renderer advanced phase by ONE cardinal tile for EVERY
    // grid step, even diagonal tiles (sqrt(2) longer) and late Worker easing.
    // This made a moving body travel farther than the planted boot animation.
    // Instead advance all detail/GPU/impostor skeletons by the distance that
    // the ACTUALLY DISPLAYED root travelled on this exact render frame.
    const travelled=teleported?0:Math.hypot(
      pose.x-priorX,pose.z-priorZ,
      unit.highGroundPhase===1?pose.y-priorY:0);
    pose.lastFrameTravel=travelled;
    if(travelled>cellSize*.001){
      pose.phase+=2*Math.PI*travelled/Math.max(.01,cellSize);
      pose.gaitHold=.10; // cover final easing after a Worker footfall tick
    }else pose.gaitHold=Math.max(0,(pose.gaitHold||0)-Math.max(0,dt||0));
    pose.frame=frame;
  }
  unit._visualMotionAlive=unit.alive;
  return pose;
}

// Motion must remain in the same run clip at terminal tile contact.
// Otherwise the 50v50 rig cross-switches run->idle->run every grid step.
export function massGaitActive(unit){
 return !!unit?.alive&&(unit.highGroundPhase===1||(unit.moveDuration>0&&(
   unit.moveElapsed<unit.moveDuration||unit.action==='walk'))||
   // A Worker tick may report 'attack/idle' while its displayed root is
   // still moving for the final few frames. Keep those feet running.
   (unit.action!=='blocked'&&(unit._visualMotion?.gaitHold||0)>0));
}
