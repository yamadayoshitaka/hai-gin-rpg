/**
 * Character material BOM v46.
 * Data is the input; drawing is a reusable output-only factory.
 * Deterministic original textures, shared by role + material ID.
 */
export const CHARACTER_SURFACES=Object.freeze({
 skin:{base:'#ddb294',shade:'#a96e5c',highlight:'#ffe1c0',roughness:.78,metalness:0,bump:.007,pattern:'skin'},
 linen:{base:'#48617e',shade:'#20364b',highlight:'#b2c0c8',roughness:.91,metalness:0,bump:.016,pattern:'weave'},
 leather:{base:'#695144',shade:'#34271f',highlight:'#b58c62',roughness:.77,metalness:0,bump:.02,pattern:'leather'},
 walnut:{base:'#49372b',shade:'#1b1717',highlight:'#977254',roughness:.68,metalness:0,bump:.015,pattern:'leather'},
 hair:{base:'#49382f',shade:'#1d1a21',highlight:'#aa805c',roughness:.68,metalness:0,bump:.011,pattern:'hair'},
 royal:{base:'#682f52',shade:'#2b203d',highlight:'#b7779c',roughness:.88,metalness:0,bump:.018,pattern:'weave'},
 steel:{base:'#a2aeb7',shade:'#53616f',highlight:'#eaf4f5',roughness:.36,metalness:.62,bump:.008,pattern:'metal'},
 brass:{base:'#c3a16b',shade:'#5a4128',highlight:'#fff0bb',roughness:.38,metalness:.62,bump:.008,pattern:'metal'},
 iron:{base:'#808c94',shade:'#333f49',highlight:'#e1e8ee',roughness:.46,metalness:.56,bump:.01,pattern:'metal'},
 lip:{base:'#bd7d74',shade:'#8f4c4a',highlight:'#eeb3a6',roughness:.75,metalness:0,bump:.003,pattern:'skin'}
});
export const CHARACTER_ROLE_PALETTES=Object.freeze({
 hero:{linen:'#283f6b',leather:'#58453c',royal:'#87384f',hair:'#48382b'},
 civilian:{linen:'#69786e',leather:'#6a5841',hair:'#534235'},
 guard:{linen:'#67707a',leather:'#4e4b4b',steel:'#b7c3d0',hair:'#3f3431'},
 royal:{linen:'#793c5c',royal:'#74324c',brass:'#ddba79',hair:'#50382d'}
});
const CACHE=new WeakMap();
const hash=s=>Array.from(s).reduce((a,c)=>(Math.imul(a,31)+c.charCodeAt(0))>>>0,2166136261);
const rgb=hex=>{const s=hex.replace('#','');return [0,2,4].map(i=>parseInt(s.slice(i,i+2),16));};
const lerp=(a,b,t)=>a+(b-a)*t;
function paint(canvas,spec,seed){
 const ctx=canvas.getContext('2d',{willReadFrequently:true}),w=canvas.width,h=canvas.height;
 if(!ctx)return;
 const base=rgb(spec.base),shade=rgb(spec.shade),high=rgb(spec.highlight);
 // Graded hand-painted albedo, directional illumination and fine grain.
 const img=ctx.createImageData(w,h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const n=Math.sin(x*.043+seed*.00001)*Math.sin(y*.057-seed*.00003);
  const micro=Math.sin(x*.71+y*.29)*Math.sin(y*.82-x*.17);
  const lighting=.46+.18*Math.cos((x/w-.3)*Math.PI)+.085*n+.025*micro;
  const t=Math.max(0,Math.min(1,lighting)),p=(y*w+x)*4;
  for(let k=0;k<3;k++)img.data[p+k]=Math.round(lerp(lerp(shade[k],base[k],Math.min(1,t*1.5)),high[k],Math.max(0,t-.68)*.46));
  img.data[p+3]=255;
 }
 ctx.putImageData(img,0,0);
 let state=seed>>>0;const rand=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
 const line=(x,y,xx,yy,color,width)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.stroke();};
 if(spec.pattern==='weave'){
  for(let x=0;x<w;x+=3)line(x,0,x,h,'#f6ebe314',.65);
  for(let y=0;y<h;y+=3)line(0,y,w,y,'#1b10241e',.65);
  for(let i=0;i<500;i++){const x=rand()*w,y=rand()*h;line(x,y,x+rand()*9,y+rand()*3,'#f7eee01a',.5);}
  // Stitch paths and folds taper along a garment's UV.
  for(let k=0;k<9;k++){const x=(k+.45)*w/9;for(let y=0;y<h;y+=3)line(x+Math.sin(y*.019+k)*4,y,x+Math.sin((y+2)*.019+k)*4,y+2,'#101c2a22',1.3);}
 }else if(spec.pattern==='hair'){
  for(let i=0;i<1800;i++){const x=rand()*w,y=rand()*h,len=12+rand()*100,dx=3*Math.sin(x*.035+seed);
   line(x,y,x+dx,y+len,rand()>.67?'#f7d8a531':'#090d1b35',.45+rand()*.85);}
  for(let i=0;i<85;i++){const x=rand()*w;line(x,0,x+9,h,'#f2d09a18',1.8);}
 }else if(spec.pattern==='leather'){
  for(let i=0;i<2500;i++){const x=rand()*w,y=rand()*h;ctx.fillStyle=rand()>.5?'#fff2ce1c':'#0906012b';ctx.fillRect(x,y,1+rand()*2,1+rand()*2);}
  for(let y=18;y<h;y+=110){line(0,y,w,y+2,'#100a073e',2);for(let x=7;x<w;x+=10)line(x,y-3,x+2,y+3,'#edd3a451',.8);}
 }else if(spec.pattern==='metal'){
  for(let i=0;i<650;i++){const x=rand()*w,y=rand()*h;line(x,y,x+rand()*45,y+rand()*2,rand()>.6?'#fffdf64b':'#090c182e',.4);}
  for(let y=40;y<h;y+=110){line(0,y,w,y,'#ffffff3b',1);line(0,y+2,w,y+2,'#070c192f',1);}
 }else if(spec.pattern==='skin'){
  for(let i=0;i<1200;i++){const x=rand()*w,y=rand()*h;ctx.fillStyle=rand()>.4?'#fff0db13':'#7a33351c';ctx.fillRect(x,y,1.1,1.1);}
  // Warm facial/subsurface tones (repeat-safe: no fake face features).
  const glow=ctx.createRadialGradient(w*.5,h*.52,0,w*.5,h*.52,w*.53);
  glow.addColorStop(0,'#f6b09724');glow.addColorStop(1,'#f6b09700');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
 }
}
export function makeCharacterMaterialFactory(T,{role='hero',variant=0,quality='high'}={}){
 let all=CACHE.get(T);if(!all){all=new Map();CACHE.set(T,all);}
 return id=>{
  const surface=CHARACTER_SURFACES[id];if(!surface)throw Error('Missing character material BOM '+id);
  const key=[role,variant%4,quality,id].join(':');if(all.has(key))return all.get(key);
  const palette=CHARACTER_ROLE_PALETTES[role]||CHARACTER_ROLE_PALETTES.civilian;
  const spec={...surface,base:palette[id]||surface.base};
  if(role==='civilian'&&id==='linen'){
   spec.base=['#69786e','#886c58','#687e96','#946f75'][variant%4];
  }
  const canvas=document.createElement('canvas'),size=quality==='low'?128:512;
  canvas.width=canvas.height=size;paint(canvas,spec,hash(key));
  // Prefer independent, editable image texture assets for each material BOM slot.
  // Keep the painted canvas as a lossless fallback if an asset cannot be loaded.
  const fallback=new T.CanvasTexture(canvas);
  fallback.colorSpace=T.SRGBColorSpace;
  const imageId=['skin','linen','leather','walnut','hair','royal','steel'].includes(id)?id:null;
  const url=imageId?'./assets/textures/characters/'+imageId+'.svg?v=51.0':null;
  const map=url?new T.TextureLoader().load(url,texture=>{
   texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;
   texture.anisotropy=4;texture.needsUpdate=true;
  },undefined,()=>{const mat=all.get(key);if(mat){mat.map=fallback;mat.bumpMap=fallback;mat.needsUpdate=true;}}):fallback;
  map.colorSpace=T.SRGBColorSpace;
  map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=quality==='low'?1:4;
  const mat=new T.MeshStandardMaterial({map,color:0xffffff,metalness:spec.metalness,roughness:spec.roughness,
   bumpMap:map,bumpScale:spec.bump,side:T.DoubleSide});
  mat.name='character-image-bom-v51:'+key;mat.userData.textureImage=url;all.set(key,mat);return mat;
 };
}
