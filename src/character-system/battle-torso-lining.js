// Close exposed imported Ranger/Peasant torso skin with a photographed cloth
// lining IN THE EXISTING source material slot. No new mesh, draw call, rig
// or repeated CPU work. Hands, face and neck meshes remain untouched.
export function shouldClothLineBattleTorso({quality='',meshName='',materialName='',role=''}={}){
 return quality==='battle'&&role==='skin'&&
  /(?:^|_)(?:ranger|peasant)_body(?:_|$)/i.test(String(meshName))&&
  /(?:mi_regular|skin|flesh|nude)/i.test(String(materialName));
}
export function applyBattleTorsoLining(material,{texture,tint,side}={}){
 if(!material||!texture||!Number.isFinite(tint))throw Error('Battle torso lining requires real cloth texture and color');
 material.map=texture;
 material.bumpMap=texture;
 material.bumpScale=.00048;
 material.normalMap=null;
 material.alphaMap=null;
 material.aoMap=null;
 material.transparent=false;
 material.opacity=1;
 material.alphaTest=0;
 material.depthWrite=true;
 material.depthTest=true;
 material.colorWrite=true;
 material.vertexColors=false;
 material.metalness=0;
 material.roughness=.86;
 if('transmission' in material)material.transmission=0;
 if('clearcoat' in material)material.clearcoat=0;
 if(side!==undefined)material.side=side;
 material.color?.setHex(tint);
 material.userData={...material.userData,battleOpaqueTorsoLining:true};
 material.name=(material.name||'torso')+'-linen-battle-opaque-lining';
 material.needsUpdate=true;
 return material;
}
