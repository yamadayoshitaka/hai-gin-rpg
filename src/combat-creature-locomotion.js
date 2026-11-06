/**
 * Render-only quadruped movement. The tactical simulation owns integer tiles;
 * this critically damped follower gives those tile updates continuous velocity.
 * In particular, a new tile never resets the creature's velocity to zero.
 * No Three.js dependency, so the same motion can be regression-tested at 30,
 * 60 and 120 display frames per second.
 */
const clamp=(value,minimum,maximum)=>Math.max(minimum,Math.min(maximum,value));

// Blend a distance-driven diagonal trot into an anatomically paired gallop.
export function creatureLegSwing(type,front,side,phase,activity,{flying=false}={}){
  if(flying)return Math.sin(phase+(front?0:Math.PI)+side*.3)*(.045+activity*.15);
  const power=clamp(activity,0,1);
  if(power===0)return 0;
  const trot=Math.sin(phase+(front?(side<0?0:Math.PI):(side<0?Math.PI:0)))*.48;
  if(type!=='horse')return trot*power;
  const gallop=Math.sin(phase+(front?0:Math.PI*.86)+(side<0?-.16:.19))*.73;
  const blend=clamp((power-.44)/.42,0,1);
  return (trot*(1-blend)+gallop*blend)*power;
}

export function createCreatureLocomotion(x,z,time=0,facing=0){
  return {x,z,targetX:x,targetZ:z,velocityX:0,velocityZ:0,
    lastTime:time,activity:0,gaitPhase:0,facing};
}

function dampAxis(position,velocity,target,delta,omega){
  const difference=position-target;
  const impulse=(velocity+omega*difference)*delta;
  const decay=Math.exp(-omega*delta);
  return [target+(difference+impulse)*decay,(velocity-omega*impulse)*decay];
}

/** Target can change at any AI tick without a velocity discontinuity. */
export function advanceCreatureLocomotion(state,x,z,time,{speed=3,flying=false,type='wolf',facing=null}={}){
  if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(time))return state;
  const delta=clamp(time-state.lastTime,0,.12);
  state.lastTime=time;
  state.targetX=x;state.targetZ=z;
  if(delta===0)return state;

  // A tile takes ~1/speed seconds in the simulation. The soft follower stays
  // slightly behind the authoritative cell without stopping at each boundary.
  const smoothTime=clamp(.56/Math.max(.5,speed),.12,.28);
  const omega=2/smoothTime;
  const previousX=state.x,previousZ=state.z;
  [state.x,state.velocityX]=dampAxis(state.x,state.velocityX,x,delta,omega);
  [state.z,state.velocityZ]=dampAxis(state.z,state.velocityZ,z,delta,omega);
  // Catch-up movement still obeys a quadruped's physical top speed.
  const maximumSpeed=Math.max(.5,speed)*1.15;
  const stepX=state.x-previousX,stepZ=state.z-previousZ;
  const proposedDistance=Math.hypot(stepX,stepZ);
  if(proposedDistance>maximumSpeed*delta){
    const fraction=maximumSpeed*delta/proposedDistance;
    state.x=previousX+stepX*fraction;
    state.z=previousZ+stepZ*fraction;
  }
  const velocityLength=Math.hypot(state.velocityX,state.velocityZ);
  if(velocityLength>maximumSpeed){
    state.velocityX*=maximumSpeed/velocityLength;
    state.velocityZ*=maximumSpeed/velocityLength;
  }
  const travelled=Math.hypot(state.x-previousX,state.z-previousZ);
  const actualSpeed=travelled/delta;
  const walkTarget=clamp(actualSpeed/(Math.max(.5,speed)*.65),0,1);
  const activityRate=walkTarget>state.activity?13:7;
  state.activity+=(walkTarget-state.activity)*(1-Math.exp(-activityRate*delta));

  // Leg phase follows actual distance, not AI ticks or wall-clock oscillation.
  // When blocked, hoof/paw motion naturally fades to an idle stance.
  if(!flying)state.gaitPhase+=travelled*(type==='horse'?7.6:7.4);

  const moving=actualSpeed>.06;
  const desiredFace=Number.isFinite(facing)?facing:
    moving?Math.atan2(state.velocityX,state.velocityZ):state.facing;
  const angularDelta=Math.atan2(Math.sin(desiredFace-state.facing),Math.cos(desiredFace-state.facing));
  // An animal turns its body; it cannot snap 90 degrees on a single AI tick.
  const turn=angularDelta*(1-Math.exp(-10*delta));
  state.facing+=clamp(turn,-Math.PI*1.25*delta,Math.PI*1.25*delta);
  return state;
}
