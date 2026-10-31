// Mass-weighted angular dynamics for the preview skeleton.
// Semi-implicit Euler integration with a bounded fixed time step.
export function createWeightedJointDynamics(){
 const specs={
  spine:{mass:32,length:.48,stiffness:17,damping:8,gravity:.38},
  hips:{mass:11,length:.43,stiffness:13,damping:6,gravity:.64},
  knees:{mass:5,length:.42,stiffness:10,damping:4.8,gravity:.32},
  shoulders:{mass:3.4,length:.31,stiffness:9,damping:4,gravity:.8},
  elbows:{mass:1.6,length:.26,stiffness:6,damping:2.8,gravity:.92}
 };
 const states=new Map();
 function advance(name,index,target,dt,phase=1,contactTorque=0){
  const spec=specs[name];if(!spec)return target;
  const key=name+':'+index;
  const state=states.get(key)||{angle:0,velocity:0};
  const inertia=Math.max(.05,spec.mass*spec.length*spec.length/3);
  const step=Math.min(1/30,Math.max(0,dt));
  const count=Math.max(1,Math.ceil(step/(1/120)));
  const h=step/count;
  for(let n=0;n<count;n++){
   const gravitational=-9.81*spec.mass*spec.length*.5*spec.gravity*Math.sin(state.angle+.18)*phase;
   const torque=spec.stiffness*(target-state.angle)-spec.damping*state.velocity+gravitational+Math.max(-60,Math.min(60,contactTorque));
   state.velocity=Math.max(-8,Math.min(8,state.velocity+torque/inertia*h));
   state.angle=Math.max(-2.2,Math.min(2.2,state.angle+state.velocity*h));
  }
  states.set(key,state);
  return state.angle;
 }
 return {advance,reset(){states.clear()},states};
}
