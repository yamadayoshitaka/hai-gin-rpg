/** Data-driven occupation weapon slots. Only assets known to exist are exposed as loadable. */
const JOB_EQUIPMENT=Object.freeze({
 swordsman:{weapon:'sword',asset:'Sword_Bronze'},fighter:{weapon:'fist'},mage:{weapon:'staff'},
 archer:{weapon:'bow',offhand:'quiver'},shieldwarrior:{weapon:'sword',shield:'shield',asset:'Sword_Bronze'},
 thief:{weapon:'dagger'},ninja:{weapon:'short_blade'},farmer:{weapon:'tool'},
 priest:{weapon:'healing_staff'},summoner:{weapon:'focus'},
 '剣士':{weapon:'sword',asset:'Sword_Bronze'},'格闘家':{weapon:'fist'},
 '魔法使い':{weapon:'staff'},'弓使い':{weapon:'bow',offhand:'quiver'},
 '盾戦士':{weapon:'sword',shield:'shield',asset:'Sword_Bronze'},
 '盗賊':{weapon:'dagger'},'忍者':{weapon:'short_blade'},
 '農民・職人':{weapon:'tool'},'僧侶':{weapon:'healing_staff'},'召喚士':{weapon:'focus'}
});
const AXE=/axe|berserker|woodcutter|miner|blacksmith|hammer/;
const SHIELD=/knight|paladin|guard/;
const BOW=/archer|bow|hunter|sniper/;
const DAGGER=/thief|rogue|assassin/;
const SWORD=/sword|knight|samurai|paladin|guard|soldier|warrior/;
export function resolveOccupationEquipment(id){
 const key=String(id||'').toLowerCase();
 const explicit=JOB_EQUIPMENT[id]||JOB_EQUIPMENT[key];
 if(explicit)return Object.freeze({weapon:explicit.weapon,shield:explicit.shield||'none',offhand:explicit.offhand||'none',asset:explicit.asset||null,assetStatus:explicit.asset?'candidate-requires-runtime-validation':'asset-pending'});
 const weapon=AXE.test(key)?'axe':BOW.test(key)?'bow':DAGGER.test(key)?'dagger':SWORD.test(key)?'sword':'none';
 return Object.freeze({weapon,shield:SHIELD.test(key)?'shield':'none',offhand:weapon==='bow'?'quiver':'none',asset:weapon==='axe'?'Axe_Bronze':weapon==='sword'?'Sword_Bronze':null,assetStatus:weapon==='axe'||weapon==='sword'?'candidate-requires-runtime-validation':'asset-pending'});
}
export function inspectEquipmentAsset({scene,THREE,id}){
 const box=new THREE.Box3().setFromObject(scene),dimensions=box.getSize(new THREE.Vector3());
 let meshes=0,triangles=0;
 scene.traverse(n=>{if(n.isMesh){meshes++;const g=n.geometry;if(g?.index)triangles+=g.index.count/3;else if(g?.attributes?.position)triangles+=g.attributes.position.count/3;}});
 return {id,meshes,triangles:Math.floor(triangles),bounds:dimensions.toArray(),valid:meshes>0&&!box.isEmpty()};
}
