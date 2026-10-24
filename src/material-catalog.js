/** Material BOM catalog: one semantic key drives both color and surface detail. */
export const MATERIAL_CATALOG=Object.freeze({
 cobblestone:{color:0x928c81,pattern:'stone',roughness:0.96,bump:0.075,metalness:0},
 granite:{color:0x817e79,pattern:'stone',roughness:0.92,bump:0.065,metalness:0},
 marble:{color:0xc9c4b7,pattern:'stone',roughness:0.41,bump:0.015,metalness:0},
 limestone:{color:0xd3c8a6,pattern:'stone',roughness:0.94,bump:0.06,metalness:0},
 brick:{color:0x9c6150,pattern:'brick',roughness:0.92,bump:0.058,metalness:0},
 slate:{color:0x565d67,pattern:'slate',roughness:0.89,bump:0.045,metalness:0},
 terracotta:{color:0xa0654d,pattern:'tile',roughness:0.86,bump:0.04,metalness:0},
 thatch:{color:0x9b8651,pattern:'hair',roughness:0.98,bump:0.065,metalness:0},
 pine:{color:0xa27f52,pattern:'wood',roughness:0.86,bump:0.04,metalness:0},
 birch:{color:0xb9a58a,pattern:'wood',roughness:0.82,bump:0.03,metalness:0},
 darkOak:{color:0x4b3125,pattern:'wood',roughness:0.8,bump:0.04,metalness:0},
 copper:{color:0x9c5b39,pattern:'metal',roughness:0.4,bump:0.02,metalness:0.8},
 bronze:{color:0x957547,pattern:'metal',roughness:0.48,bump:0.025,metalness:0.7},
 silver:{color:0xb2bac1,pattern:'metal',roughness:0.28,bump:0.012,metalness:0.9},
 gold:{color:0xe1b55c,pattern:'metal',roughness:0.27,bump:0.012,metalness:0.86},
 steel:{color:0xa0a7ad,pattern:'metal',roughness:0.32,bump:0.014,metalness:0.82},
 chainmail:{color:0x888b8e,pattern:'woven-metal',roughness:0.5,bump:0.04,metalness:0.7},
 parchment:{color:0xd9c4a0,pattern:'paper',roughness:0.95,bump:0.012,metalness:0},
 rope:{color:0xa48a63,pattern:'cloth',roughness:1,bump:0.05,metalness:0},
 canvas:{color:0xb3a27d,pattern:'cloth',roughness:0.98,bump:0.045,metalness:0},
 velvet:{color:0x74394e,pattern:'cloth',roughness:1,bump:0.055,metalness:0},
 cotton:{color:0xd2c6b2,pattern:'cloth',roughness:1,bump:0.025,metalness:0},
 silk:{color:0x8b708b,pattern:'cloth',roughness:0.66,bump:0.016,metalness:0},
 grass:{color:0x536744,pattern:'grass',roughness:1,bump:0.05,metalness:0},
 dirt:{color:0x75624b,pattern:'soil',roughness:1,bump:0.07,metalness:0},
 sand:{color:0xc2aa7b,pattern:'soil',roughness:1,bump:0.045,metalness:0},
 bark:{color:0x5f4832,pattern:'wood',roughness:0.97,bump:0.055,metalness:0},
 water:{color:0x5d9cb4,pattern:'water',roughness:0.2,bump:0.01,metalness:0},
 porcelain:{color:0xd9d4c7,pattern:'stone',roughness:0.3,bump:0.01,metalness:0},
 wool:{color:0xa9a29a,pattern:'cloth',roughness:0.98,bump:0.04,metalness:0},
 bone:{color:0xd1c5a8,pattern:'stone',roughness:0.83,bump:0.015,metalness:0},
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
 charcoal:{color:0x302c30,pattern:'stone',roughness:.99,bump:.05,metalness:0},
 skin:{color:0xc99777,pattern:'skin',roughness:.87,bump:.009,metalness:0},
 hair:{color:0x403127,pattern:'hair',roughness:.77,bump:.016,metalness:0},
 leather:{color:0x6c5d48,pattern:'leather',roughness:.91,bump:.038,metalness:0},
 lip:{color:0x925b50,pattern:'skin',roughness:.83,bump:.003,metalness:0}
});
export function validateMaterialReferences(parts,catalog=MATERIAL_CATALOG){
 const errors=[];
 for(const [id,part] of Object.entries(parts))if(!catalog[part.material])errors.push(id+': '+part.material);
 return errors;
}
const SHARED_MATERIALS=new WeakMap();
export function makeMaterialFactory(THREE){
 if(!SHARED_MATERIALS.has(THREE))SHARED_MATERIALS.set(THREE,new Map());
 const cache=SHARED_MATERIALS.get(THREE);
 return (id)=>{
  if(cache.has(id))return cache.get(id);
  const spec=MATERIAL_CATALOG[id];if(!spec)throw Error('Unknown material: '+id);
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d'),hex='#'+spec.color.toString(16).padStart(6,'0');
  ctx.fillStyle=hex;ctx.fillRect(0,0,256,256);
  let seed=Array.from(id).reduce((s,ch)=>s*31+ch.charCodeAt(0),7)>>>0;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const wood=spec.pattern==='wood',cloth=spec.pattern==='cloth',metal=spec.pattern==='metal',slate=spec.pattern==='slate',skin=spec.pattern==='skin',hair=spec.pattern==='hair';
  // Pattern-aware procedural microdetail, deterministic and shared per material ID.
  const line=(x,y,xx,yy,stroke,width=1)=>{ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.stroke();};
  for(let i=0;i<1250;i++){
   const x=rand()*256,y=rand()*256;
   const light=rand()>.56;
   ctx.fillStyle=light?'rgba(255,245,221,.075)':'rgba(22,15,13,.09)';
   if(wood){line(0,y,256,y+Math.sin(x*.1)*2,light?'#ffffff13':'#1d120e24',.35+rand()*1.2);}
   else if(hair){line(x,y,x+rand()*3-1.5,y+7+rand()*25,light?'#ffffff25':'#00000029',.4+rand()*.6);}
   else if(cloth||spec.pattern==='woven-metal'){
    line(x,y,x,y+6,light?'#ffffff17':'#00000018',.65);
    if(i%2===0)line(x-4,y,x+4,y,light?'#ffffff14':'#00000018',.6);
   }else if(metal){line(x,y,x+2+rand()*18,y+rand()*1.6,light?'#ffffff25':'#00000020',.3);}
   else if(skin){ctx.fillRect(x,y,.3+rand(),.3+rand());}
   else{ctx.fillRect(x,y,1+rand()*4,1+rand()*4);}
  }
  if(wood){
   for(let i=0;i<25;i++){
    const y=rand()*256;line(0,y,256,y+Math.sin(y*.2)*3,'#2b140f29',.65+rand()*1.5);
   }
  }
  if(['stone','brick','slate','tile'].includes(spec.pattern)){
   const step=spec.pattern==='stone'?64:spec.pattern==='brick'?32:48;
   for(let y=0;y<256;y+=step){
    line(0,y,256,y,'#251b1744',1.5);
    for(let x=(Math.floor(y/step)%2)*step/2;x<256;x+=step*2)line(x,y,x,y+step,'#251b1738',1.3);
   }
  }
  if(skin){
   const cheeks=ctx.createRadialGradient(65,146,4,65,146,60);
   cheeks.addColorStop(0,'#d9714828');cheeks.addColorStop(1,'#00000000');
   ctx.fillStyle=cheeks;ctx.fillRect(0,70,140,145);
  }
  if(spec.pattern==='leather'){
   for(let i=0;i<500;i++){const x=rand()*256,y=rand()*256;ctx.fillStyle=rand()>.5?'#ffffff19':'#08040223';ctx.fillRect(x,y,1+rand()*2,.7+rand());}
   for(let i=0;i<14;i++){const y=rand()*256;line(0,y,256,y+rand()*6-3,'#25130c19',.6);}
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=2;
  const material=new THREE.MeshStandardMaterial({map,roughness:spec.roughness,metalness:spec.metalness,
   bumpMap:spec.bump?map:null,bumpScale:spec.bump,transparent:!!spec.opacity,opacity:spec.opacity??1,
   emissive:spec.emissive??0,emissiveIntensity:spec.emissiveIntensity??0,side:THREE.DoubleSide});
  cache.set(id,material);return material;
 };
}
