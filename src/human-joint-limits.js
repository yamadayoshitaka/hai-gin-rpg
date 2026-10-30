// Bind-relative anatomical joint limits in radians. Shared by all humanoid rigs.
export const LIMITS={
 upperarm_l:[-2.3,2.3,-1.7,1.7,-2.1,2.1],upperarm_r:[-2.3,2.3,-1.7,1.7,-2.1,2.1],
 lowerarm_l:[-.15,2.65,-.45,.45,-.45,.45],lowerarm_r:[-.15,2.65,-.45,.45,-.45,.45],
 thigh_l:[-1.5,1.8,-.65,.65,-.65,.65],thigh_r:[-1.5,1.8,-.65,.65,-.65,.65],
 shin_l:[-.15,2.6,-.35,.35,-.35,.35],shin_r:[-.15,2.6,-.35,.35,-.35,.35],
 hand_l:[-1,1,-.65,.65,-.65,.65],hand_r:[-1,1,-.65,.65,-.65,.65],
 foot_l:[-.85,.85,-.4,.4,-.35,.35],foot_r:[-.85,.85,-.4,.4,-.35,.35],
 neck_01:[-.65,.65,-.9,.9,-.6,.6],spine_01:[-.65,.65,-.75,.75,-.55,.55]
};
export function createJointLimiter(THREE,bones){
 const rest=new Map([...bones].filter(([name])=>LIMITS[name]).map(([name,bone])=>[name,bone.quaternion.clone()]));
 const q=new THREE.Quaternion(),e=new THREE.Euler();
 return ()=>{
  let corrections=0;
  for(const [name,base] of rest){
   const bone=bones.get(name),l=LIMITS[name];
   if(!bone)continue;
   q.copy(base).invert().multiply(bone.quaternion).normalize();
   e.setFromQuaternion(q,'XYZ');
   const values=[e.x,e.y,e.z].map((v,i)=>Math.max(l[i*2],Math.min(l[i*2+1],v)));
   if(values.some((v,i)=>Math.abs(v-[e.x,e.y,e.z][i])>1e-5)){
    bone.quaternion.copy(base).multiply(q.setFromEuler(new THREE.Euler(...values,'XYZ')));
    corrections++;
   }
  }
  return corrections;
 };
}
