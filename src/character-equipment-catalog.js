/** Occupation equipment resolved from assets actually present in the repository.
 * Every prop is validated at runtime by GLTFLoader before attachment.
 */
const AXE=/axe|berserker|woodcutter|miner|blacksmith|hammer/;
const SWORD=/sword|knight|samurai|paladin|guard|soldier|warrior|assassin|thief|ranger|hunter/;
const SHIELD=/knight|paladin|guard/;
export function resolveOccupationEquipment(id){
 const weapon=AXE.test(id)?'axe':SWORD.test(id)?'sword':'none';
 return Object.freeze({weapon,shield:SHIELD.test(id)?'shield':'none',asset:weapon==='axe'?'Axe_Bronze':weapon==='sword'?'Sword_Bronze':null});
}
export function inspectEquipmentAsset({scene,THREE,id}){
 const box=new THREE.Box3().setFromObject(scene),dimensions=box.getSize(new THREE.Vector3());
 let meshes=0,triangles=0;
 scene.traverse(n=>{if(n.isMesh){meshes++;const g=n.geometry;if(g?.index)triangles+=g.index.count/3;else if(g?.attributes?.position)triangles+=g.attributes.position.count/3;}});
 return {id,meshes,triangles:Math.floor(triangles),bounds:dimensions.toArray(),valid:meshes>0&&!box.isEmpty()};
}
