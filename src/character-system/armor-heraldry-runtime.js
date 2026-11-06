// Job heraldry sits on the *actual* segmented cuirass, not under it on the
// costume body. The 65-bone plate mesh and its current fitting remain intact.
import * as THREE from 'three';
import {normalizeOutfitRarity,outfitRarityFinish} from './outfit-rarity-policy.js';

export function attachArmorHeraldry({root,armor,job,textures,quality='preview',rarity='N'}){
  if(!armor?.objects?.length)return null;
  const plate=armor.objects.find(o=>/faceted_breastplate_reinforcement/i.test(o.name)) ||
    armor.objects.find(o=>o.userData.equipmentSlot==='chest');
  if(!plate?.parent?.isBone)return null;
  root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(plate);
  if(bounds.isEmpty())return null;
  const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const radius=Math.max(.027,Math.min(.086,size.x*.17));
  // Face, visor and chest all point +Z on the canonical 65-bone character.
  const frontZ=bounds.max.z+.008;
  const isShield=job==='job05',battle=quality==='battle';
  const rank=normalizeOutfitRarity(rarity),finish=outfitRarityFinish(rank);
  const gold=new THREE.MeshStandardMaterial({map:textures.steel,bumpMap:textures['steel-grain']||textures.steel,
    bumpScale:.0008,color:finish.ornaments?finish.trim:isShield?0xd9e1e9:0xe6cda2,
    roughness:rank==='UR'?.26:.38,metalness:.58,side:THREE.DoubleSide});
  const steel=new THREE.MeshStandardMaterial({map:textures.steel,bumpMap:textures.steel,
    bumpScale:.0008,color:rank==='UR'?0xe3cadc:rank==='R'?0xa7c9df:0xc0cbd6,
    roughness:.33,metalness:.56,side:THREE.DoubleSide});
  const objects=[];
  const attach=(name,geometry,material,x,y,z,rotation=0)=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;
    mesh.position.set(x,y,z);mesh.rotation.z=rotation;
    mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.userData={equipmentClass:'armor',equipmentSlot:'chest-heraldry',equipmentMaterial:'photo-metal-engraving'};
    root.add(mesh);root.updateMatrixWorld(true);plate.parent.attach(mesh);
    objects.push(mesh);return mesh;
  };
  const crest=new THREE.Shape();
  if(isShield){
    crest.moveTo(-radius*.77,radius*.72);crest.lineTo(radius*.77,radius*.72);
    crest.lineTo(radius*.70,-radius*.12);crest.lineTo(0,-radius);
    crest.lineTo(-radius*.70,-radius*.12);crest.closePath();
  }else{
    crest.moveTo(-radius*.83,radius*.65);crest.lineTo(radius*.83,radius*.65);
    crest.lineTo(radius*.72,-radius*.75);crest.lineTo(-radius*.72,-radius*.75);crest.closePath();
  }
  attach(`${job}-engraved-heraldic-plate`,new THREE.ExtrudeGeometry(crest,{
    depth:battle?.002:.004,bevelEnabled:!battle,bevelThickness:.002,bevelSize:.002,bevelSegments:1,
    steps:1,curveSegments:battle?2:6}),gold,center.x,center.y,frontZ);
  const line=(id,x1,y1,x2,y2)=>{
    const dx=(x2-x1)*radius,dy=(y2-y1)*radius;
    const length=Math.hypot(dx,dy);
    attach(`${job}-${id}`,new THREE.CylinderGeometry(radius*.057,radius*.057,length,
      battle?5:10,battle?1:3),steel,center.x+(x1+x2)*radius*.5,
      center.y+(y1+y2)*radius*.5,frontZ+.004,Math.atan2(-dx,dy));
  };
  if(isShield){line('guard-vertical',0,-.65,0,.52);line('guard-cross',-.39,.12,.39,.12)}
  else {line('sword-engraving-left',-.43,-.60,.35,.50);line('sword-engraving-right',.43,-.60,-.35,.50)}
  armor.objects.push(...objects);armor.materials.push(gold,steel);
  // The former 3D brow cylinder and forehead crest used the MAX Z of the
  // *entire* plate-head bounds, including its nose guard. This placed giant
  // bands in front of the eye/nose in side views. Preserve the rank through
  // fitted helmet metal finishes (segmented-armor-runtime), not floating
  // objects whose position is inferred from an unrelated maximum.
  // Mirror the newly added helmet ornaments into the asset's ownership list.
  for(const piece of objects)if(!armor.objects.includes(piece))armor.objects.push(piece);
  armor.diagnostics.armorPieces=armor.objects.length;
  armor.diagnostics.heraldry=job;
  armor.diagnostics.rarity=rank;
  return {objects,materialCount:2,job,rarity:rank};
}
