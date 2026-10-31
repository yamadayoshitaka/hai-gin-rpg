/** Deterministic rigid-body baseline. SI units; no rendering dependencies.
 * Phase P0 only: translational rigid bodies and infinite horizontal ground.
 * Articulated joints, self-collision and ragdoll require later phases.
 */
export const PHYSICS_STEP=1/60;
const vec=(a)=>[Number(a?.[0]||0),Number(a?.[1]||0),Number(a?.[2]||0)];
const finite=(a)=>a.every(Number.isFinite);
export function createDynamicBody({massKg=1,position=[0,1,0],velocity=[0,0,0],radius=.1,restitution=0,friction=.7}={}){
 if(!(Number.isFinite(massKg)&&massKg>0))throw new RangeError('Dynamic mass must be positive');
 if(!(Number.isFinite(radius)&&radius>0))throw new RangeError('Collision radius must be positive');
 if(!finite(position)||!finite(velocity))throw new RangeError('Position and velocity must be finite');
 return {massKg,invMass:1/massKg,position:vec(position),velocity:vec(velocity),radius,
 restitution:Math.max(0,Math.min(1,restitution)),friction:Math.max(0,Math.min(1,friction)),
 contacts:0,maxPenetration:0};
}
export function stepDynamicBody(body,dt=PHYSICS_STEP,{gravity=[0,-9.81,0],groundY=0}={}){
 if(!Number.isFinite(dt)||dt<=0||dt>PHYSICS_STEP+.000001)throw new RangeError('Use fixed physics step <= 1/60s');
 if(!finite(gravity)||!Number.isFinite(groundY))throw new RangeError('Invalid world physics');
 for(let i=0;i<3;i++){
  body.velocity[i]+=gravity[i]*dt;
  body.position[i]+=body.velocity[i]*dt;
 }
 const bottom=body.position[1]-body.radius;
 const penetration=Math.max(0,groundY-bottom);
 if(penetration>0){
  body.position[1]+=penetration;
  if(body.velocity[1]<0)body.velocity[1]=-body.velocity[1]*body.restitution;
  const deceleration=body.friction*Math.abs(gravity[1])*dt;
  for(const i of [0,2]){
   const v=body.velocity[i];
   body.velocity[i]=Math.sign(v)*Math.max(0,Math.abs(v)-deceleration);
  }
  body.contacts++;
  body.maxPenetration=Math.max(body.maxPenetration,penetration);
 }
 if(!finite(body.position)||!finite(body.velocity))throw new Error('Nonfinite physics state');
 return {grounded:penetration>0,penetration,weightN:body.massKg*Math.abs(gravity[1])};
}
export function createFixedStepWorld({fixedStep=PHYSICS_STEP,maxCatchUpSteps=6,gravity=[0,-9.81,0],groundY=0}={}){
 if(!(fixedStep>0&&fixedStep<=PHYSICS_STEP))throw new RangeError('Invalid fixed step');
 const bodies=new Set();
 let accumulator=0,steps=0;
 return {
  bodies,add(body){bodies.add(body);return body;},remove(body){bodies.delete(body);},
  advance(elapsedSeconds){
   if(!Number.isFinite(elapsedSeconds)||elapsedSeconds<0)throw new RangeError('Invalid elapsed time');
   accumulator+=Math.min(elapsedSeconds,fixedStep*maxCatchUpSteps);
   let count=0;
   while(accumulator+1e-10>=fixedStep&&count<maxCatchUpSteps){
    for(const body of bodies)stepDynamicBody(body,fixedStep,{gravity,groundY});
    accumulator-=fixedStep;count++;steps++;
   }
   return {steps:count,totalSteps:steps,alpha:Math.max(0,accumulator/fixedStep)};
  }
 };
}
