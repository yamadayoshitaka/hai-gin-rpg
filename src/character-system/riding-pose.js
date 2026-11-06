// A mounted soldier is still a complete humanoid rig. Bend the existing
// thighs/knees around the saddle; never scale, merge or replace the rider.
// The controller saves the *current animation frame*, not the T-pose. That
// lets sword/guard/hit clips play while the legs remain seated.
const X={x:1,y:0,z:0};
const Z={x:0,y:0,z:1};
export const RIDING_JOINTS=Object.freeze({
  thigh_l:Object.freeze({pitch:-1.27,splay:-.22}),
  thigh_r:Object.freeze({pitch:-1.27,splay:.22}),
  calf_l:Object.freeze({pitch:1.39,splay:0}),
  calf_r:Object.freeze({pitch:1.39,splay:0}),
  foot_l:Object.freeze({pitch:-.13,splay:0}),
  foot_r:Object.freeze({pitch:-.13,splay:0}),
});

// Dragons are broad-backed aerial thrones: keep the knees close and the
// lower legs forward. Horses and wolves instead require a true straddle.
export const DRAGON_SEATED_JOINTS=Object.freeze({
  thigh_l:Object.freeze({pitch:-1.02,splay:-.055}),
  thigh_r:Object.freeze({pitch:-1.02,splay:.055}),
  calf_l:Object.freeze({pitch:1.54,splay:0}),
  calf_r:Object.freeze({pitch:1.54,splay:0}),
  foot_l:Object.freeze({pitch:-.27,splay:0}),
  foot_r:Object.freeze({pitch:-.27,splay:0}),
});
export const ridingStyleForCreature=type=>
  ['wyvern','dragon','elder_dragon'].includes(type)?'throne':'straddle';

export function createRidingPoseController(model){
  const bones=[];
  model?.traverse(node=>{
    if(!node.isBone)return;
    const name=node.name.toLowerCase().replace(/[^a-z0-9_]/g,'');
    const joint=RIDING_JOINTS[name];
    if(joint)bones.push({node,name,joint,before:node.quaternion.clone()});
  });
  let applied=false;
  function restore(){
    if(!applied)return;
    for(const entry of bones)entry.node.quaternion.copy(entry.before);
    applied=false;
  }
  function apply(style='straddle'){
    // Restoring first prevents cumulative bending if a clip omits a bone.
    restore();
    for(const entry of bones){
      const {node,before}=entry;
      const joint=style==='throne'?DRAGON_SEATED_JOINTS[entry.name]:entry.joint;
      before.copy(node.quaternion);
      const pitch=node.quaternion.clone().setFromAxisAngle(X,joint.pitch);
      node.quaternion.multiply(pitch);
      if(joint.splay)node.quaternion.multiply(pitch.setFromAxisAngle(Z,joint.splay));
    }
    applied=bones.length>0;
  }
  return {apply,restore,get jointCount(){return bones.length},get applied(){return applied}};
}
