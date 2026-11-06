import assert from 'node:assert/strict';
import * as THREE from 'three';
import {JOBS,createDetailedOutfit} from '../src/outfit-maintenance-model.js';
import {OUTFIT_RARITY,normalizeOutfitRarity,outfitRarityFinish} from '../src/character-system/outfit-rarity-policy.js';

assert.deepEqual(Object.keys(OUTFIT_RARITY),['N','R','UR']);
assert.equal(normalizeOutfitRarity('ur'),'UR');
assert.equal(normalizeOutfitRarity('unknown'),'N');
assert.ok(OUTFIT_RARITY.UR.fabricMix>OUTFIT_RARITY.R.fabricMix);
assert.ok(outfitRarityFinish('R').ornaments>outfitRarityFinish('N').ornaments);

function makeAnatomy(){
  const root=new THREE.Group();
  const joints={pelvis:[0,.87,0],spine_03:[0,1.37,0],neck_01:[0,1.55,0],head:[0,1.67,0],
    clavicle_l:[-.17,1.43,0],clavicle_r:[.17,1.43,0],
    thigh_l:[-.13,.75,0],thigh_r:[.13,.75,0],foot_l:[-.13,.08,0],foot_r:[.13,.08,0]};
  for(const [name,xyz] of Object.entries(joints)){
    const b=new THREE.Bone();b.name=name;b.position.set(...xyz);root.add(b);
  }
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.24,.95,4,8));
  body.position.y=.95;root.add(body);root.updateMatrixWorld(true);
  return root;
}
const textures=Object.fromEntries(['linen','leather','steel','velvet','damask','gold-brocade']
  .map(kind=>[kind,new THREE.Texture()]));
const anatomy=makeAnatomy();
for(const job of ['job01','job03','job06','strategist']){
  const rows=[];
  for(const rarity of ['N','R','UR']){
    const outfit=createDetailedOutfit(job,'male',anatomy,textures,{quality:'battle',rarity});
    assert.equal(outfit.userData.rarity,rarity,`${job} lost the selected rarity`);
    assert.equal(outfit.userData.rarityOrnaments,rarity==='N'?0:rarity==='R'?3:14);
    const inlays=outfit.children.filter(o=>/rarity-(?:R|UR)-enamel-and-metal-inlays/.test(o.name));
    assert.equal(inlays.length,rarity==='N'?0:1,`${job} rarity should batch its gems into one mesh`);
    if(inlays.length){
      const count=inlays[0].geometry.getAttribute('position').count;
      assert.equal(count,outfit.userData.rarityOrnaments*6,`${job} gems are incomplete`);
      assert.equal(inlays[0].material.vertexColors,true);
    }
    rows.push({rarity,triangles:outfit.userData.triangles});
    outfit.traverse(node=>{if(node.isMesh)node.geometry.dispose()});
    for(const mat of outfit.userData.materials)mat.dispose();
  }
  assert.ok(rows[2].triangles>rows[1].triangles&&rows[1].triangles>rows[0].triangles,
    `${job}: rarity decoration density did not increase`);
  console.log(`PASS ${job}: N/R/UR have distinct finishes, 0/3/14 gemstone settings and one batched inlay`);
}
assert.equal(JOBS.length,17,'rarity must support all 17 occupations');
anatomy.traverse(node=>{if(node.isMesh)node.geometry.dispose()});
for(const texture of Object.values(textures))texture.dispose();
