// A mounted soldier is still a complete humanoid rig. Bend the existing
// thighs/knees around the saddle; never scale, merge or replace the rider.
// The controller saves the *current animation frame*, not the T-pose. That
// lets sword/guard/hit clips play while the legs remain seated.
const X={x:1,y:0,z:0};
const Z={x:0,y:0,z:1};
export const RIDING_JOINTS=Object.freeze({
  thigh_l:Object.freeze({pitch:-1.33,splay:-.32}),
  thigh_r:Object.freeze({pitch:-1.33,splay:.32}),
  calf_l:Object.freeze({pitch:1.50,splay:0}),
  calf_r:Object.freeze({pitch:1.50,splay:0}),
  foot_l:Object.freeze({pitch:-.22,splay:0}),
  foot_r:Object.freeze({pitch:-.22,splay:0}),
});

// Dragons are broad-backed aerial thrones: keep the knees close and the
// lower legs forward. Horses and wolves instead require a true straddle.
export const DRAGON_SEATED_JOINTS=Object.freeze({
  thigh_l:Object.freeze({pitch:-1.16,splay:-.13}),
  thigh_r:Object.freeze({pitch:-1.16,splay:.13}),
  calf_l:Object.freeze({pitch:1.58,splay:0}),
  calf_r:Object.freeze({pitch:1.58,splay:0}),
  foot_l:Object.freeze({pitch:-.26,splay:0}),
  foot_r:Object.freeze({pitch:-.26,splay:0}),
});
// A rider needs an anatomical seat, not just bent knees while the torso
// remains in an upright run pose. These small opposite pelvis/chest rotations
// preserve attack and guard animations without moving the grid-authoritative
// body root. They use EXISTING bones and no additional meshes/draw calls.
export const RIDING_TORSO_JOINTS=Object.freeze({
 pelvis:Object.freeze({pitch:-.17,splay:0}),
 spine_01:Object.freeze({pitch:.11,splay:0}),
 spine_02:Object.freeze({pitch:.055,splay:0}),
});
export const DRAGON_SEATED_TORSO_JOINTS=Object.freeze({
 pelvis:Object.freeze({pitch:-.11,splay:0}),
 spine_01:Object.freeze({pitch:.075,splay:0}),
 spine_02:Object.freeze({pitch:.04,splay:0}),
});
// Wolves are low/narrow living saddles, and must not inherit the broad
// horse or winged-dragon posture.
export const WOLF_SEATED_JOINTS=Object.freeze({
 thigh_l:Object.freeze({pitch:-1.12,splay:-.18}),
 thigh_r:Object.freeze({pitch:-1.12,splay:.18}),
 calf_l:Object.freeze({pitch:1.66,splay:0}),
 calf_r:Object.freeze({pitch:1.66,splay:0}),
 foot_l:Object.freeze({pitch:-.32,splay:0}),
 foot_r:Object.freeze({pitch:-.32,splay:0}),
});
export const WOLF_SEATED_TORSO_JOINTS=Object.freeze({
 pelvis:Object.freeze({pitch:-.24,splay:0}),
 spine_01:Object.freeze({pitch:.14,splay:0}),
 spine_02:Object.freeze({pitch:.07,splay:0}),
});
export const ridingStyleForCreature=type=>
  ['wyvern','dragon','elder_dragon'].includes(type)?'throne':
   type==='wolf'?'low-straddle':'straddle';

/**
 * External humanoid GLBs are not guaranteed to use the internal thigh_l
 * naming scheme. Resolve Mixamo, Rigify, CC, Blender and J_Bip leg names
 * before creating the seated pose. Keep this pure for fast regression tests.
 */
export function resolveRidingJointName(value){
  let name=String(value??'').toLowerCase().replace(/[^a-z0-9]/g,'');
  name=name.replace(/^(mixamorig|bip001|jbip|ccbase|def|org|mch)/,'');
  // Quaternius 65-bone rigs call the seat pelvis and the back spine_01/02.
  // Mixamo rigs use Hips/Spine/Spine1/Spine2; match them before leg aliases.
  if(name==='pelvis'||name==='hips'||name==='hip')return 'pelvis';
  if(name==='spine'||name==='spine1'||name==='spine01')return 'spine_01';
  if(name==='spine2'||name==='spine02'||name==='chest')return 'spine_02';
  const terms='thigh|upleg|upperleg|calf|shin|lowerleg|leg|foot|ankle';
  const sideFirst=name.match(new RegExp('(left|right|l|r)('+terms+')$'));
  const sideLast=name.match(new RegExp('('+terms+')(left|right|l|r)$'));
  if(!sideFirst&&!sideLast)return null;
  const side=sideFirst?sideFirst[1]:sideLast[2];
  const segment=sideFirst?sideFirst[2]:sideLast[1];
  const lr=side==='left'||side==='l'?'l':'r';
  const kind=['thigh','upleg','upperleg'].includes(segment)?'thigh':
    ['calf','shin','lowerleg','leg'].includes(segment)?'calf':'foot';
  return kind+'_'+lr;
}

export function createRidingPoseController(model){
  const bones=[],seen=new Set();
  model?.traverse(node=>{
    if(!node.isBone)return;
    const name=resolveRidingJointName(node.name);
    if(!name||seen.has(name))return;
    const joint=RIDING_JOINTS[name]||RIDING_TORSO_JOINTS[name];
    if(!joint)return;
    seen.add(name);
    bones.push({node,name,joint,before:node.quaternion.clone(),
      // Reuse the same quaternion during every riding animation update.
      delta:node.quaternion.clone()});
  });
  let applied=false;
  function restore(){
    if(!applied)return;
    for(const entry of bones)entry.node.quaternion.copy(entry.before);
    applied=false;
  }
  function apply(style='straddle'){
    restore();
    for(const entry of bones){
      const {node,before,delta}=entry;
      const joint=style==='throne'?
       (DRAGON_SEATED_JOINTS[entry.name]||DRAGON_SEATED_TORSO_JOINTS[entry.name]):
       style==='low-straddle'?
       (WOLF_SEATED_JOINTS[entry.name]||WOLF_SEATED_TORSO_JOINTS[entry.name]):entry.joint;
      before.copy(node.quaternion);
      node.quaternion.multiply(delta.setFromAxisAngle(X,joint.pitch));
      if(joint.splay)node.quaternion.multiply(delta.setFromAxisAngle(Z,joint.splay));
    }
    applied=bones.length>0;
  }
  return {apply,restore,
    get jointCount(){return bones.filter(b=>!!RIDING_JOINTS[b.name]).length},
    get torsoJointCount(){return bones.filter(b=>!!RIDING_TORSO_JOINTS[b.name]).length},
    get applied(){return applied}};
}
