// Shared 7-head character animation controller used by both action test and game.
export function createCharacterMotionController(THREE,model,clips=[]){
 const bones=new Set();model.traverse(o=>{if(o.isBone)bones.add(o.name)});
 const compatible=clips.filter(clip=>{const names=clip.tracks.filter(t=>/\.(?:quaternion|position|scale)$/.test(t.name)).map(t=>t.name.split('.')[0]);return names.length>0&&names.filter(n=>bones.has(n)).length>=Math.max(4,Math.ceil(names.length*.35))});
 const mixer=new THREE.AnimationMixer(model);
 const patterns={idle:[/idle/i],walk:[/walk/i],run:[/sprint/i,/run/i,/jog/i],attack:[/sword.*attack/i,/attack/i,/slash/i,/strike/i],guard:[/block/i,/guard/i],hit:[/hit/i,/hurt/i]};
 let current=null;
 function play(kind){const clip=(patterns[kind]||[]).map(re=>compatible.find(c=>re.test(c.name))).find(Boolean);if(!clip)return false;if(current===kind)return true;mixer.stopAllAction();mixer.clipAction(clip).reset().play();current=kind;return true}
 return {mixer,play,compatibleCount:compatible.length,get current(){return current}};
}
