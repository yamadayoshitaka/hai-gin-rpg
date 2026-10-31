/** Real Quaternius modular clothing: replace skinned garment meshes, never overlay them. */
const cache=new Map();
const PARTS={male:{Peasant:['Arms','Body','Feet','Legs'],Ranger:['Acc_Pauldron','Arms','Body','Feet_Boots','Head_Hood','Legs']},female:{Peasant:['Arms','Body','Feet','Legs'],Ranger:['Acc_Pauldrons','Arms','Body','Feet','Head_Hood','Legs']}};
const category=name=>/Acc_|Head_Hood/.test(name)?'accessory':/Arms/.test(name)?'arms':/Body/.test(name)?'body':/Feet/.test(name)?'feet':/Legs/.test(name)?'legs':null;
export async function applyModularOutfit({model,preset,loader,THREE}){
 const sex=preset.sex==='female'?'female':'male';
 const family=/ranger|archer|hunter|rogue|thief|assassin|bandit|traveler|woodcutter|fisher/.test(preset.occupationId||preset.jobId||'')?'Ranger':'Peasant';
 const outfitFamily=/armor|knight|guard|paladin|samurai/.test(preset.outfit||'')?'Ranger':family;
 const sourcePrefix=(sex==='female'?'Female_':'Male_')+outfitFamily;
 const currentPrefix=preset.modelId;
 if(sourcePrefix===currentPrefix)return {changed:false,reason:'source already matches'};
 const targetBones=new Map();
 model.traverse(n=>{if(n.isBone&&!targetBones.has(n.name))targetBones.set(n.name,n)});
 const parts=PARTS[sex][outfitFamily];
 const swaps=[];
 for(const part of parts){
  if(category(part)==='accessory')continue;
  const key=sourcePrefix+'_'+part;
  const url='./assets/characters/quaternius-modular/parts/'+key+'.gltf';
  if(!cache.has(url))cache.set(url,loader.loadAsync(url).catch(e=>{cache.delete(url);throw e}));
  const scene=(await cache.get(url)).scene;
  const meshes=[];scene.traverse(n=>{if(n.isSkinnedMesh)meshes.push(n)});
  for(const mesh of meshes){
   const boneList=mesh.skeleton.bones.map(b=>targetBones.get(b.name));
   if(boneList.some(b=>!b))throw Error('Missing shared skeleton bones for '+key);
   const copy=mesh.clone(false);
   copy.geometry=mesh.geometry;
   copy.material=Array.isArray(mesh.material)?mesh.material.map(m=>m.clone()):mesh.material.clone();
   copy.bind(new THREE.Skeleton(boneList,mesh.skeleton.boneInverses.map(m=>m.clone())),mesh.bindMatrix.clone());
   copy.name='modular-'+mesh.name;
   copy.castShadow=true;copy.receiveShadow=true;
   swaps.push({category:category(part),mesh:copy});
  }
 }
 if(!swaps.length)return {changed:false,reason:'no skinned clothing parts'};
 // Atomic swap: remove the original garment category only after all replacements loaded.
 const replaced=new Set(swaps.map(s=>s.category));
 const remove=[];
 model.traverse(n=>{
  if(!n.isSkinnedMesh||n.name.startsWith('modular-'))return;
  const cat=category(n.name);
  if(cat&&replaced.has(cat))remove.push(n);
 });
 for(const mesh of remove)mesh.parent?.remove(mesh);
 for(const swap of swaps)model.add(swap.mesh);
 return {changed:true,source:sourcePrefix,parts:swaps.length,removed:remove.length};
}
