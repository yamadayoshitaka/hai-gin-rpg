/**
 * Species-specific, deterministic offline PBR skin for the two physical
 * derivatives of m019: m016 swamp salamander and m017 steel basilisk.
 * They share m019's authoring fidelity, NOT its black lava material.
 * One cached high/low texture set per species, shared by all body and
 * articulated limb meshes (no runtime network, no individual draw calls).
 */
import * as THREE from 'three';
const cache=new Map();
const mod=(x,p)=>((x%p)+p)%p;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
function hash(x,y,s){
 let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(s,2147483647);
 h=Math.imul(h^(h>>>13),1274126177);
 return ((h^(h>>>16))>>>0)/4294967295;
}
function noise(x,y,period,seed){
 const ix=Math.floor(x),iy=Math.floor(y);
 let fx=x-ix,fy=y-iy;
 fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
 const h=(dx,dy)=>hash(mod(ix+dx,period),mod(iy+dy,period),seed);
 return (h(0,0)*(1-fx)+h(1,0)*fx)*(1-fy)+
   (h(0,1)*(1-fx)+h(1,1)*fx)*fy;
}
function makeTexture(data,n,isColor){
 const map=new THREE.DataTexture(data,n,n,THREE.RGBAFormat);
 map.wrapS=map.wrapT=THREE.RepeatWrapping;
 map.minFilter=THREE.LinearMipmapLinearFilter;
 map.magFilter=THREE.LinearFilter;
 map.generateMipmaps=true;
 map.anisotropy=4;
 if(isColor)map.colorSpace=THREE.SRGBColorSpace;
 map.needsUpdate=true;
 return map;
}
export function salamanderLineageSurface(id,detail='high'){
 if(id!=='m016'&&id!=='m017')throw Error('No generic lava skin substitution');
 const low=detail==='low',key=id+':'+(low?'low':'high');
 if(cache.has(key))return cache.get(key);
 const n=low?96:192,steel=id==='m017',cells=steel?14:10;
 const albedo=new Uint8Array(n*n*4);
 const normal=new Uint8Array(n*n*4);
 const roughness=new Uint8Array(n*n*4);
 const heights=new Float32Array(n*n),surface=new Float32Array(n*n);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const u=x/n,v=y/n,xx=u*cells,yy=v*cells;
  let nearest=Infinity,second=Infinity;
  const cx=Math.floor(xx),cy=Math.floor(yy);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const gx=cx+dx,gy=cy+dy;
   const jitterX=(hash(mod(gx,cells),mod(gy,cells),73)-.5)*.42;
   const jitterY=(hash(mod(gx,cells),mod(gy,cells),131)-.5)*.42;
   const d=Math.hypot(xx-gx-.5-jitterX,yy-gy-.5-jitterY);
   if(d<nearest){second=nearest;nearest=d;}
   else if(d<second)second=d;
  }
  const large=noise(u*8,v*8,8,17),fine=noise(u*32,v*32,32,37),
   grit=noise(u*64,v*64,64,83);
  const edge=second-nearest;
  const ridge=clamp(1-edge/(steel?.092:.110));
  const cellsLight=hash(mod(cx,cells),mod(cy,cells),209);
  const speckles=(fine-.5)*.25+(grit-.5)*.12;
  const base=steel?
    clamp(.70+.23*cellsLight+.22*(large-.5)-.15*ridge+speckles,.39,.99):
    clamp(.74+.21*(large-.5)+.31*(fine-.5)-.095*ridge,.39,.98);
  const index=y*n+x,i=index*4;
  // Greyscale albedo is tinted ONCE by the species' individual base colour.
  // The m016 olive hide / m017 steel armour palette must stay distinct.
  albedo[i]=Math.round(base*244);
  albedo[i+1]=Math.round(base*(steel?244:248));
  albedo[i+2]=Math.round(base*(steel?250:242));
  albedo[i+3]=255;
  heights[index]=steel?
    (cellsLight-.5)*.18-ridge*.055+speckles*.13:
    (large-.5)*.14+(fine-.5)*.07-ridge*.025;
  surface[index]=ridge;
 }
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const index=y*n+x,i=index*4;
  const dx=(heights[y*n+mod(x+1,n)]-heights[y*n+mod(x-1,n)])*
    (steel?4.3:3.2);
  const dy=(heights[mod(y+1,n)*n+x]-heights[mod(y-1,n)*n+x])*
    (steel?4.3:3.2);
  const inv=1/Math.hypot(dx,dy,1);
  normal[i]=Math.round(127.5*(1-dx*inv));
  normal[i+1]=Math.round(127.5*(1-dy*inv));
  normal[i+2]=Math.round(127.5*(1+inv));
  normal[i+3]=255;
  const rough=steel?.72+.18*surface[index]:.78+.12*surface[index];
  const value=Math.round(255*clamp(rough));
  roughness[i]=roughness[i+1]=roughness[i+2]=value;
  roughness[i+3]=255;
 }
 const maps=Object.freeze({
  albedo:makeTexture(albedo,n,true),
  normal:makeTexture(normal,n,false),
  roughness:makeTexture(roughness,n,false),
  resolution:n,
  variant:steel?'layered-mineral-steel-scutes':'mottled-humid-swamp-scales'
 });
 cache.set(key,maps);
 return maps;
}
export const salamanderLineageSurfaceStats=()=>({
 cachedSpeciesLods:cache.size,textureMaps:cache.size*3
});
