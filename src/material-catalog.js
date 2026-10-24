/** Material BOM catalog: one semantic key drives both color and surface detail. */
export const MATERIAL_CATALOG=Object.freeze({
 oak:{color:0x856346,pattern:'wood',roughness:.84,bump:.035,metalness:0},
 walnut:{color:0x4d3427,pattern:'wood',roughness:.82,bump:.03,metalness:0},
 stone:{color:0xb2a99c,pattern:'stone',roughness:.94,bump:.07,metalness:0},
 plaster:{color:0xd9c9ad,pattern:'plaster',roughness:.96,bump:.035,metalness:0},
 iron:{color:0x89929d,pattern:'metal',roughness:.44,bump:.018,metalness:.72},
 brass:{color:0xc7a35c,pattern:'metal',roughness:.39,bump:.012,metalness:.68},
 linen:{color:0xb5a895,pattern:'cloth',roughness:.96,bump:.035,metalness:0},
 royal:{color:0x842f4a,pattern:'cloth',roughness:.92,bump:.04,metalness:0},
 glass:{color:0x9fc6d4,pattern:'glass',roughness:.16,bump:0,metalness:0,opacity:.7},
 tile:{color:0x75534c,pattern:'slate',roughness:.88,bump:.035,metalness:0},
 'royal-roof':{color:0x52637b,pattern:'slate',roughness:.84,bump:.04,metalness:0},
 lamp:{color:0xffdda0,pattern:'glass',roughness:.22,bump:0,metalness:0,emissive:0xffaa55,emissiveIntensity:.7},
 charcoal:{color:0x302c30,pattern:'stone',roughness:.99,bump:.05,metalness:0}
});
export function validateMaterialReferences(parts,catalog=MATERIAL_CATALOG){
 const errors=[];
 for(const [id,part] of Object.entries(parts))if(!catalog[part.material])errors.push(id+': '+part.material);
 return errors;
}
export function makeMaterialFactory(THREE){
 const cache=new Map();
 return (id)=>{
  if(cache.has(id))return cache.get(id);
  const spec=MATERIAL_CATALOG[id];if(!spec)throw Error('Unknown material: '+id);
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d'),hex='#'+spec.color.toString(16).padStart(6,'0');
  ctx.fillStyle=hex;ctx.fillRect(0,0,256,256);
  let seed=Array.from(id).reduce((s,ch)=>s*31+ch.charCodeAt(0),7)>>>0;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const wood=spec.pattern==='wood',cloth=spec.pattern==='cloth',metal=spec.pattern==='metal',slate=spec.pattern==='slate';
  for(let i=0;i<260;i++){
   const x=rand()*256,y=rand()*256;
   const shade=rand()>.53?'rgba(255,255,255,.10)':'rgba(16,10,7,.13)';
   ctx.fillStyle=shade;
   if(wood)ctx.fillRect(0,y,256,.4+rand()*2);
   else if(cloth)ctx.fillRect(x,0,.5+rand(),256);
   else if(metal)ctx.fillRect(0,y,256,.3+rand());
   else if(slate)ctx.fillRect(x,y,32+rand()*50,.7+rand()*2);
   else ctx.fillRect(x,y,2+rand()*9,2+rand()*5);
  }
  if(slate||spec.pattern==='stone'){
   ctx.strokeStyle='rgba(30,24,19,.26)';ctx.lineWidth=3;
   const step=spec.pattern==='stone'?64:42;
   for(let y=0;y<256;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();}
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=4;
  const material=new THREE.MeshStandardMaterial({map,roughness:spec.roughness,metalness:spec.metalness,
   bumpMap:spec.bump?map:null,bumpScale:spec.bump,transparent:!!spec.opacity,opacity:spec.opacity??1,
   emissive:spec.emissive??0,emissiveIntensity:spec.emissiveIntensity??0,side:THREE.DoubleSide});
  cache.set(id,material);return material;
 };
}
