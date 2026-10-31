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
 const selected={};
 for(const [state,pattern] of Object.entries(actions)){
  const preferred=profile?.animation?.[state]||[];
  const exact=preferred.map(k=>available.find(n=>n.toLowerCase()===k.toLowerCase())).find(Boolean);
  const partial=state==='idle'?null:preferred.map(k=>available.find(n=>n.toLowerCase().includes(k.toLowerCase()))).find(Boolean);
  selected[state]=exact||partial||available.find(n=>pattern.test(n))||null;
 }
 // Never substitute a jumping, landing or recovery clip for standing still.
 if(selected.idle&&/jump|leap|land|get.?up|fall|attack|run|walk/i.test(selected.idle))selected.idle=null;
 let current=null,currentName=null;
 return {
  available,selected,
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
