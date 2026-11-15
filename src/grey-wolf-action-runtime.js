/**
 * Animation bridge for Wolf animated (r-wolf), shared by the adoption viewer,
 * bestiary, standalone summons and the battlefield.  No new geometry.
 *
 * The licensed GLB provides IDLE, RRAR, eating and SLEEP but no confirmed
 * dedicated walk/run/hit/death attack clips.  Missing actions therefore use
 * original clips plus reversible, bounded rig/root articulation.
 */
import * as THREE from 'three';

export const WOLF_ACTION_NAMES=Object.freeze([
 'idle','walk','run','attack','roar','special','hit','defeat',
 'guard','dodge','leap'
]);
const LIMIT=Object.freeze({
 attack:1.1,roar:1.45,special:1.5,hit:.6,guard:.9,dodge:.75,leap:.9,
 idle:Infinity,walk:Infinity,run:Infinity,defeat:Infinity
});
const clean=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const hasClip=(clips,expr)=>clips.some(n=>expr.test(clean(n)));
export function resolveWolfAction(clips,action){
 const names=Array.isArray(clips)?clips:[];
 const known=WOLF_ACTION_NAMES.includes(action)?action:'idle';
 if(known==='defeat')return {action:known,sourceAction:
   hasClip(names,/death|defeat|die|sleep/)?'defeat':'idle',
   procedural:'defeat'};
 if(known==='attack'||known==='roar'||known==='special')
  return {action:known,sourceAction:
   hasClip(names,/rrar|roar|attack|bite|growl/)?'roar':'idle',
   procedural:known};
 if(known==='walk'||known==='run')
  return {action:known,sourceAction:
   hasClip(names,known==='run'?/run|sprint|gallop/:/walk|trot/)?
    known:'idle',procedural:known};
 return {action:known,sourceAction:'idle',procedural:known};
}

const X=new THREE.Vector3(1,0,0);
const ZERO=new THREE.Quaternion();
const PREVIOUS=new THREE.Quaternion();
const DELTA=new THREE.Quaternion();
const IRIS_ACTION_PULSE=Object.freeze({attack:.10,roar:.14,special:.22,hit:.035});
function limbNodes(source){
 const bones=[];
 source.traverse(node=>{
  if(!node.isBone)return;
  const name=clean(node.name);
  if(!/leg|thigh|humerus|frontarm|forearm|calf|hock|shoulder/.test(name)||
    /root|spine|torso|pelvis|control|twist|pole|target|ik|heel|toe|finger/.test(name))return;
  const raw=String(node.name||'').toLowerCase();
  const left=/left|(?:\.|_|-)l(?:$|\.|_|\d)|(?:\d|^)l$/.test(raw);
  const right=/right|(?:\.|_|-)r(?:$|\.|_|\d)|(?:\d|^)r$/.test(raw);
  const hind=/hind|rear|back|thigh|calf|hock|hip/.test(name);
  const lower=/lower|calf|shin|hock|forearm/.test(name);
  const sign=left?-1:right?1:node.position.x<0?-1:1;
  bones.push({bone:node,hind,lower,sign,applied:new THREE.Quaternion()});
 });
 return bones.slice(0,24);
}
function safeRootHeight(root){
 const bbox=new THREE.Box3().setFromObject(root);
 return bbox.isEmpty()?2.4:Math.max(.5,bbox.getSize(new THREE.Vector3()).y);
}
export function installGreyWolfActions(handle){
 if(!handle?.root||handle.root.userData.greyWolfActions)return handle;
 const root=handle.root;
 const nativePlay=handle.play.bind(handle);
 const nativeUpdate=handle.update.bind(handle);
 const nativeDispose=handle.dispose.bind(handle);
 const source=root.children.find(child=>child.isObject3D);
 if(!source)return handle;
 const height=safeRootHeight(root);
 // Root-space pose pivot: the original source gets the exact same world
 // transform when offset=0; its skin, animation tracks and texture UVs remain.
 const pivot=new THREE.Group();
 pivot.name='grey-wolf-pose-pivot';
 const cy=height*.46;
 pivot.position.y=cy;
 source.position.y-=cy;
 root.remove(source);pivot.add(source);root.add(pivot);
 const bones=limbNodes(source);
 const coats=[];
 root.traverse(node=>{
  if(!node.isMesh)return;
  const materials=Array.isArray(node.material)?node.material:[node.material];
  for(const m of materials)if(m?.userData?.greyFangWolfCoat&&
    !coats.includes(m))coats.push(m);
 });
 let current='idle',elapsed=0,phase=0,disposed=false;
 let resolved=resolveWolfAction(handle.clips,'idle');
 const setAction=(action,{restart=false}={})=>{
  if(disposed)return false;
  const next=resolveWolfAction(handle.clips,action);
  if(next.action===current&&!restart)return true;
  current=next.action;resolved=next;elapsed=0;
  // Preserve native source animation where it exists. Never reuse "eating"
  // as locomotion and never freeze an attack forever after its one-shot clip.
  nativePlay(next.sourceAction,{restart:restart||next.action!=='idle'&&
    next.action!=='walk'&&next.action!=='run'});
  root.userData.greyWolfAction=current;
  return true;
 };
 setAction('idle',{restart:true});
 const update=dt=>{
  if(disposed)return;
  const seconds=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
  // Unwind ONLY the previous additive swing before advancing the original
  // animator. Joints without native clips therefore never accumulate drift.
  for(const item of bones){
   if(item.applied.w!==1||item.applied.x||item.applied.y||item.applied.z){
    PREVIOUS.copy(item.applied).invert();
    item.bone.quaternion.multiply(PREVIOUS).normalize();
    item.applied.identity();
   }
  }
  nativeUpdate(seconds);
  elapsed+=seconds;
  if(current!=='defeat'&&elapsed>LIMIT[current]){
   setAction('idle'); // Reset one-shot attack, roar or hit to natural IDLE.
  }
  const a=current,t=elapsed;
  const walking=a==='walk',running=a==='run',moving=walking||running;
  if(moving)phase+=seconds*(running?11.8:7.1);
  const pulse=Math.sin(Math.PI*Math.min(1,t/Math.max(.001,LIMIT[a]||1)));
  const attack=a==='attack'||a==='roar'||a==='special';
  const hit=a==='hit',fall=a==='defeat';
  // Pivot motion is cosmetic. Collision/hitboxes and root world position
  // in the gameplay engine are deliberately unaffected.
  pivot.position.set(0,cy+(moving?Math.abs(Math.sin(phase))*
   height*(running?.024:.011):0)-(fall?height*.045*
   Math.min(1,t/.9):0),0);
  pivot.rotation.set(
   moving?.028*Math.sin(phase)+(running?.018:.006):
    attack?-.095*pulse:hit?.17*pulse:fall?.13*Math.min(1,t/.8):0,
   0,
   moving?.017*Math.sin(phase*.5):
    hit?.10*pulse:fall?.54*Math.min(1,t/.95):0
  );
  if(moving&&resolved.sourceAction==='idle'){
   // Mid/upper limb swing only. Never add skinned meshes, rebind skeletons
   // or rewrite the licensed source's joint weights.
   for(const limb of bones){
    const side=limb.sign>0?Math.PI:0;
    const stagger=limb.hind?Math.PI:0;
    const swing=Math.sin(phase+side+stagger);
    const strength=running?.27:.14;
    const angle=(limb.lower?.38:1)*strength*swing;
    DELTA.setFromAxisAngle(X,angle);
    limb.bone.quaternion.multiply(DELTA).normalize();
    limb.applied.copy(DELTA);
   }
  }
  const boost=IRIS_ACTION_PULSE[a]||0;
  for(const mat of coats){
   const baseline=mat.userData.greyFangWolfBaseGlow||0;
   // Gentle skin light response, not flat emissive white overlays.
   mat.emissiveIntensity=baseline+boost*(attack||hit?pulse:1);
  }
  root.userData.greyWolfRuntimeState={
   action:a,elapsed:t,sourceAction:resolved.sourceAction,
   procedural:resolved.procedural,joints:bones.length,
   meshAdditions:0,playing:!fall||t<1.4
  };
 };
 const dispose=()=>{
  if(disposed)return;
  disposed=true;
  // Restore original joint transforms and stop all native tracks via the
  // original handle.dispose (which owns material/texture disposal).
  for(const item of bones){
   PREVIOUS.copy(item.applied).invert();
   item.bone.quaternion.multiply(PREVIOUS).normalize();
   item.applied.identity();
  }
  nativeDispose();
 };
 handle.play=setAction;
 handle.update=update;
 handle.dispose=dispose;
 root.userData.greyWolfActions=true;
 root.userData.greyWolfRuntimeState={
  action:'idle',elapsed:0,sourceAction:'idle',procedural:'idle',
  joints:bones.length,meshAdditions:0,playing:true
 };
 return handle;
}
