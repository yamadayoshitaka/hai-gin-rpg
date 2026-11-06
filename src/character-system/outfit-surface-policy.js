// Keep the skin atlas separate from the photographed garment. A Ranger arm
// contains BOTH MI_Ranger cloth and MI_Regular_* skin primitives; replacing
// every material on that mesh paints a woven pattern across bare fingers.
export function outfitSurfaceRole(meshName='',materialName=''){
  const part=String(meshName).toLowerCase();
  const material=String(materialName).toLowerCase();
  if(/mi_regular|skin/.test(material))return 'skin';
  if(!/mi_(ranger|peasant)/.test(material))return 'other';
  if(/(?:ranger|peasant)_arms(?:_|$)/.test(part))return 'arms';
  if(/(?:ranger|peasant)_legs(?:_|$)/.test(part))return 'legs';
  if(/(?:ranger|peasant)_body(?:_|$)/.test(part))return 'body';
  return 'other';
}

export function cleanOutfitPhotoKind({role,partName='',style,jobId}){
  if(role==='skin'||role==='other')return null;
  // Only Ranger arms have a separately addressable skin material. Peasant
  // sleeves share their entire texture atlas with the hands; retexturing
  // those primitives would paint gloves over bare fingers.
  const peasantArms=role==='arms'&&/peasant_arms/i.test(partName);
  if(peasantArms)return null;
  if(role==='body'&&!style.armor&&jobId!=='strategist')return null;
  if(role==='arms'||role==='legs'||role==='body'){
    if(jobId==='strategist')return 'damask';
    if(style.armor)return 'linen-fine';
    return style.fabric==='linen'?'linen-fine':style.fabric;
  }
  return null;
}
