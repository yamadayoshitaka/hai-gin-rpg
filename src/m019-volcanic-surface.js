/**
 * Deterministic, seamless basalt + sparse molten fissure PBR maps.
 * No external network, copyright dependency or per-monster GPU upload.
 * Four cached maps are reused by the entire m019 sculpture, including legs.
 */
import * as THREE from 'three';

const cache=new Map();
const wrap=(n,m)=>((n%m)+m)%m;
function hash(x,y,s=0){
 let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(s|0,2147483647);
 h=Math.imul(h^(h>>>13),1274126177);
 return ((h^(h>>>16))>>>0)/4294967295;
}
function noise(x,y,p,seed){
 const ix=Math.floor(x),iy=Math.floor(y);
 let fx=x-ix,fy=y-iy;
 fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
 const h=(dx,dy)=>hash(wrap(ix+dx,p),wrap(iy+dy,p),seed);
 const a=h(0,0)*(1-fx)+h(1,0)*fx;
 const b=h(0,1)*(1-fx)+h(1,1)*fx;
 return a*(1-fy)+b*fy;
}
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
export function m019VolcanicSurface(detail='high'){
 const level=detail==='low'?'low':'high';
 if(cache.has(level))return cache.get(level);
 const n=level==='low'?96:192,px=n*n,cells=9;
 const albedo=new Uint8Array(px*4),emission=new Uint8Array(px*4);
 const normal=new Uint8Array(px*4),roughness=new Uint8Array(px*4);
 const height=new Float32Array(px),cracks=new Float32Array(px);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const u=x/n,v=y/n,xx=u*cells,yy=v*cells;
  const ix=Math.floor(xx),iy=Math.floor(yy);
  let nearest=Infinity,second=Infinity;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const gx=ix+dx,gy=iy+dy;
   const jitterX=hash(wrap(gx,cells),wrap(gy,cells),17)-.5;
   const jitterY=hash(wrap(gx,cells),wrap(gy,cells),47)-.5;
   const d=Math.hypot(xx-(gx+.5+.54*jitterX),yy-(gy+.5+.54*jitterY));
   if(d<nearest){second=nearest;nearest=d;}
   else if(d<second)second=d;
  }
  const a=noise(u*9,v*9,9,99),b=noise(u*27,v*27,27,101),
   c=noise(u*63,v*63,63,307);
  const fractured=(a-.5)*.52+(b-.5)*.31+(c-.5)*.20;
  const edge=second-nearest;
  const crack=clamp(1-edge/((level==='low'?.073:.054)*(.80+.44*b)));
  const molten=clamp(crack*crack*(3-2*crack)*clamp((a+.3*c-.36)*1.55));
  const shade=clamp(.78+fractured*.58-crack*.22,.34,.98);
  const i=y*n+x,j=i*4;
  albedo[j]=Math.round(238*shade);
  albedo[j+1]=Math.round(236*shade);
  albedo[j+2]=Math.round(232*shade);
  albedo[j+3]=255;
  const glow=Math.pow(molten,1.8);
  emission[j]=Math.round(255*glow);
  emission[j+1]=Math.round(218*glow);
  emission[j+2]=Math.round(160*glow);
  emission[j+3]=255;
  height[i]=fractured*.15-crack*.042;
  cracks[i]=molten;
 }
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const i=y*n+x,j=i*4;
  const sx=(height[y*n+wrap(x+1,n)]-height[y*n+wrap(x-1,n)])*3.3;
  const sy=(height[wrap(y+1,n)*n+x]-height[wrap(y-1,n)*n+x])*3.3;
  const inv=1/Math.hypot(sx,sy,1);
  normal[j]=Math.round(127.5*(1-sx*inv));
  normal[j+1]=Math.round(127.5*(1-sy*inv));
  normal[j+2]=Math.round(127.5*(1+inv));
  normal[j+3]=255;
  const r=Math.round(255*clamp(.96-cracks[i]*.20,.65,1));
  roughness[j]=r;roughness[j+1]=r;roughness[j+2]=r;roughness[j+3]=255;
 }
 const texture=(data,srgb)=>{
  const tex=new THREE.DataTexture(data,n,n,THREE.RGBAFormat);
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.generateMipmaps=true;
  tex.minFilter=THREE.LinearMipmapLinearFilter;
  tex.magFilter=THREE.LinearFilter;
  tex.anisotropy=4;
  if(srgb)tex.colorSpace=THREE.SRGBColorSpace;
  tex.needsUpdate=true;
  return tex;
 };
 const result=Object.freeze({
  albedo:texture(albedo,true),
  normal:texture(normal,false),
  emissive:texture(emission,true),
  roughness:texture(roughness,false),
  resolution:n,
  revision:'m019-volcanic-surface-v19',
 });
 cache.set(level,result);
 return result;
}
export function m019VolcanicTextureStats(){
 return {lodSets:cache.size,textureMaps:cache.size*4};
}
