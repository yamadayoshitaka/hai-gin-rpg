/** Play CC0 Universal Animation Library clips directly on the visible Quaternius rig. */
let libraryPromise;
const actions={idle:/idle|breath|stand/i,walk:/walk.*loop|walk/i,run:/jog.*loop|run.*loop|jog|run/i,attack:/sword.*attack|attack|slash|punch/i,guard:/block|guard|defend/i,hit:/hit|hurt|damage|impact/i,dead:/death|die|dead|fall/i,getup:/get.?up|stand.?up|recover/i};
export async function createLibraryActionPlayer({THREE,GLTFLoader,model}){
 libraryPromise??=new GLTFLoader().loadAsync('./assets/characters/quaternius-base/animations.glb').catch(e=>{libraryPromise=null;throw e});
 const library=await libraryPromise;
 const bones=new Map();
 model.traverse(node=>{if(node.isBone&&!bones.has(node.name.toLowerCase()))bones.set(node.name.toLowerCase(),node)});
 const mixer=new THREE.AnimationMixer(model),clips=new Map(),available=[];
 for(const clip of library.animations||[]){
  const tracks=[];
  for(const track of clip.tracks){
   const dot=track.name.lastIndexOf('.');
   if(dot<0)continue;
   const path=track.name.slice(0,dot).split('/').pop().replace(/^.*:/,'');
   const bone=bones.get(path.toLowerCase());
   if(!bone)continue;
   const prop=track.name.slice(dot+1);
   if(prop!=='quaternion'&&prop!=='position'&&prop!=='scale')continue;
   // Preserve source keyframes and attach them to the target's actual node name.
   const copy=track.clone();copy.name=bone.name+'.'+prop;tracks.push(copy);
  }
  if(tracks.length){clips.set(clip.name,new THREE.AnimationClip(clip.name,clip.duration,tracks));available.push(clip.name)}
 }
 if(!available.length)throw Error('No compatible animated bone tracks in Universal Animation Library');
 const selected={};
 for(const [state,pattern] of Object.entries(actions))selected[state]=available.find(n=>pattern.test(n))||null;
 let current=null,currentName=null;
 return {
  available,selected,
  setAction(state){
   const name=selected[state]||selected.idle;
   if(!name)return false;
   if(name===currentName)return true;
   const next=mixer.clipAction(clips.get(name));
   next.reset();next.setLoop(state==='dead'?THREE.LoopOnce:THREE.LoopRepeat,Infinity);next.clampWhenFinished=state==='dead';
   next.enabled=true;next.play();
   if(current)current.fadeOut(.16);
   next.fadeIn(.16);current=next;currentName=name;return true;
  },
  update(dt){mixer.update(Math.max(0,Math.min(dt,.08)))},
  stop(){mixer.stopAllAction();mixer.uncacheRoot(model)}
 };
}
