// Data-driven muscle torque controller for the preview skeleton.
// Angles: rad; angular velocity: rad/s; torque: N*m. Values are game-tuned,
// not clinical measurements. The controller cannot replace 3D rigid-body joints.
export const HUMAN_JOINT_BOM=Object.freeze({
 spine:{massKg:32,leverM:.48,limit:[-.55,.55],maxTorqueNm:115,stiffness:95,damping:17},
 neck:{massKg:5,leverM:.13,limit:[-.45,.45],maxTorqueNm:18,stiffness:30,damping:5},
 shoulders:{massKg:3.4,leverM:.31,limit:[-2.5,1.6],maxTorqueNm:65,stiffness:75,damping:9},
 elbows:{massKg:1.6,leverM:.26,limit:[-2.45,.15],maxTorqueNm:48,stiffness:75,damping:8},
 wrists:{massKg:.5,leverM:.12,limit:[-.85,.85],maxTorqueNm:12,stiffness:25,damping:3},
 hips:{massKg:7,leverM:.43,limit:[-1.5,1.25],maxTorqueNm:120,stiffness:110,damping:16},
 knees:{massKg:3.5,leverM:.42,limit:[-.12,2.45],maxTorqueNm:95,stiffness:105,damping:13},
 ankles:{massKg:1,leverM:.16,limit:[-.75,.65],maxTorqueNm:38,stiffness:55,damping:6}
});
export const ACTION_MUSCLE_BOM=Object.freeze({
 idle:{activation:.55},walk:{activation:.85},run:{activation:1},
 attack:{activation:1},guard:{activation:.9},hit:{activation:.35},dead:{activation:0}
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function createHumanMuscleController(jointBom=HUMAN_JOINT_BOM){
 const state=new Map();
 function advance(name,index,target,dt,action='idle',loadKg=0){
  const spec=jointBom[name];if(!spec)return target;
  const key=name+':'+index;
  const s=state.get(key)||{angle:clamp(target,...spec.limit),velocity:0};
  const activation=ACTION_MUSCLE_BOM[action]?.activation??.55;
  const inertia=Math.max(.025,(spec.massKg+Math.max(0,loadKg))*spec.leverM**2/3);
  const count=Math.max(1,Math.ceil(clamp(dt,0,.05)/(1/120))),h=clamp(dt,0,.05)/count;
  for(let i=0;i<count;i++){
   const error=clamp(target,...spec.limit)-s.angle;
   const requested=spec.stiffness*error-spec.damping*s.velocity;
   const torque=clamp(requested,-spec.maxTorqueNm*activation,spec.maxTorqueNm*activation);
   const gravity=-9.81*(spec.massKg+loadKg)*spec.leverM*.5*Math.sin(s.angle);
   s.velocity=clamp(s.velocity+(torque+gravity)/inertia*h,-12,12);
   s.angle+=s.velocity*h;
   if(s.angle<spec.limit[0]||s.angle>spec.limit[1]){s.angle=clamp(s.angle,...spec.limit);s.velocity=0;}
  }
  state.set(key,s);
  return s.angle;
 }
 return {advance,state,reset(){state.clear();}};
}
