/** Play CC0 Universal Animation Library clips directly on the visible Quaternius rig. */
let libraryPromise;
const actions={jump:/jump|leap/i,jumpAttack:/jump.*attack|air.*attack|aerial/i,cast:/cast|spell|magic/i,ranged:/bow|shoot|throw|fire/i,item:/use.*item|drink|interact/i,idle:/^(?:idle(?:[_ -]loop)?|breath(?:ing)?(?:[_ -]loop)?|stand(?:ing)?(?:[_ -]idle)?)$/i,walk:/walk.*loop|walk/i,run:/jog.*loop|run.*loop|jog|run/i,attack:/sword.*attack|attack|slash|punch/i,guard:/block|guard|defend/i,hit:/hit|hurt|damage|impact/i,dead:/death|die|dead|fall/i,getup:/get.?up|stand.?up|recover/i};
export async function createLibraryActionPlayer({THREE,GLTFLoader,model,profile}){
 libraryPromise??=new GLTFLoader().loadAsync('./assets/characters/quaternius-base/animations.glb').catch(e=>{libraryPromise=null;throw e});
 const library=await libraryPromise;
 const normalize=name=>String(name).split('/').pop().replace(/^.*:/,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
 const bones=new Map();
 model.traverse(node=>{if(node.isBone&&!bones.has(normalize(node.name)))bones.set(normalize(node.name),node)});
 const mixer=new THREE.AnimationMixer(model),clips=new Map(),available=[];
 for(const clip of library.animations||[]){
  const tracks=[];
  for(const track of clip.tracks){
   const dot=track.name.lastIndexOf('.');
   if(dot<0)continue;
   const path=track.name.slice(0,dot).split('/').pop().replace(/^.*:/,'');
   const bone=bones.get(normalize(path));
   if(!bone)continue;
   const prop=track.name.slice(dot+1);
   if(prop!=='quaternion'&&prop!=='position'&&prop!=='scale')continue;
   // Never apply source root translations to the preview actor's world position.
   if(prop==='position'&&/hips|pelvis|root/i.test(bone.name))continue;
   // Preserve source keyframes and attach them to the target's actual node name.
   const copy=track.clone();copy.name=bone.name+'.'+prop;tracks.push(copy);
  }
  if(tracks.some(t=>t.name.endsWith('.quaternion'))){clips.set(clip.name,new THREE.AnimationClip(clip.name,clip.duration,tracks));available.push(clip.name)}
 }
 if(!available.length)throw Error('No compatible animated bone tracks in Universal Animation Library');
 // Binary-derived inventory: inspect the decoded GLB tracks, not filename guesses.
 const inventory=(library.animations||[]).map(clip=>({
  name:clip.name,duration:Number(clip.duration.toFixed(3)),
  tracks:clip.tracks.length,
  rotationTracks:clip.tracks.filter(t=>t.name.endsWith('.quaternion')).length,
  targetBones:[...new Set(clip.tracks.map(t=>t.name.slice(0,t.name.lastIndexOf('.'))))],
  compatible:clips.has(clip.name)
 }));
 const selected={};
 for(const [state,pattern] of Object.entries(actions)){
  const preferred=profile?.animation?.[state]||[];
  const exact=preferred.map(k=>available.find(n=>n.toLowerCase()===k.toLowerCase())).find(Boolean);
  const partial=state==='idle'?null:preferred.map(k=>available.find(n=>n.toLowerCase().includes(k.toLowerCase()))).find(Boolean);
  selected[state]=exact||partial||available.find(n=>pattern.test(n))||null;
 }
 // Never substitute a jumping, landing or recovery clip for standing still.
 if(selected.idle&&/jump|leap|land|get.?up|fall|attack|run|walk/i.test(selected.idle))selected.idle=null;
 // Supply a small rig-native keyframed motion when the imported library
 // lacks a corresponding clip. These are explicit fallback animations, not
 // mislabeled idle/jump clips.
 const fallbackStates=['guard','hit','jump','jumpAttack','attack','ranged','cast','item','getup'];
 const fallbackDuration={guard:1,hit:.5,jump:.85,jumpAttack:.85,attack:.7,ranged:.85,cast:1.2,item:1.1,getup:1.1};
 const boneFor=(...terms)=>[...bones.values()].find(b=>terms.some(t=>normalize(b.name)===t));
 const torso=boneFor('spine','spine1','chest','upperchest');
 const left=boneFor('upperarml','leftupperarm','leftarm');
 const right=boneFor('upperarmr','rightupperarm','rightarm');
 const hips=boneFor('hips','pelvis');
 const fallbackAngles={
  guard:[[left,-.6,0,.5],[right,-.6,0,-.5]],
  hit:[[torso,-.25,0,0],[left,.2,0,.3],[right,.2,0,-.3]],
  jump:[[hips,-.12,0,0],[left,-.35,0,.3],[right,-.35,0,-.3]],
  jumpAttack:[[torso,-.2,0,0],[right,-1.1,0,-.2]],
  attack:[[torso,0,.25,0],[right,1.2,0,-.2]],
  ranged:[[left,-1.2,0,.2],[right,-1.2,0,-.2]],
  cast:[[left,1.3,0,.4],[right,1.3,0,-.4]],
  item:[[right,1.2,0,-.2]],
  getup:[[torso,.5,0,0],[left,-.4,0,.2],[right,-.4,0,-.2]]
 };
 const generated=[];
 for(const state of fallbackStates){
  // The source clips for these actions use the opposite shoulder pitch on this rig.
  // Prefer a corrected local clip until proper axis retargeting is implemented.
  if(selected[state]&&!['attack','cast','item'].includes(state))continue;
  const duration=fallbackDuration[state],tracks=[];
  for(const [bone,x,y,z] of fallbackAngles[state]){
   if(!bone)continue;
   const rest=bone.quaternion.clone();
   const active=rest.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z)));
   const values=[...rest.toArray(),...active.toArray(),...rest.toArray()];
   tracks.push(new THREE.QuaternionKeyframeTrack(bone.name+'.quaternion',[0,duration*.4,duration],values));
  }
  if(!tracks.length)continue;
  const name='generated_'+state;
  clips.set(name,new THREE.AnimationClip(name,duration,tracks));
  selected[state]=name;generated.push(state);
 }
 let current=null,currentName=null;
 return {
  available,selected,generated,inventory,diagnose(){return {inventory,selected:{...selected},generated:[...generated],compatibleBones:bones.size}} ,
  setAction(state){
   const name=selected[state];
   if(!name)return false;
   if(name===currentName)return true;
   const next=mixer.clipAction(clips.get(name));
   next.reset();next.setLoop(['dead','getup','attack','hit','jump','jumpAttack','cast','ranged','item'].includes(state)?THREE.LoopOnce:THREE.LoopRepeat,Infinity);next.clampWhenFinished=['dead','getup'].includes(state);
   next.enabled=true;next.play();
   if(current)current.fadeOut(.16);
   next.fadeIn(.16);current=next;currentName=name;return true;
  },
  update(dt){mixer.update(Math.max(0,Math.min(dt,.08)))},
  stop(){mixer.stopAllAction();mixer.uncacheRoot(model)}
 };
}
