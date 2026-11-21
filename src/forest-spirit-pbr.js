/**
 * Consistent, mobile-safe anatomical plant/cloth PBR for the female
 * Forest Spirit. Do not misapply photo linen, floor moss or dark velvet
 * albedo to emerald leaves. Leaves have fine cuticular vein normals,
 * woven outfit panels have silk fibres, bark is coarse matte and fittings
 * are aged brass. All normal/roughness atlases are reused across instances.
 *
 * The photoreal leather boot normals and roughness remain owned by the
 * established CC0 Poly Haven leather loader.
 */
import * as THREE from 'three';

export const FOREST_SPIRIT_PBR_REVISION=
 'forest-leaf-cuticle-woven-fabric-v2-20261122';
const roles=Object.freeze({
 leaf:{kind:'leaf',roughness:.75,metalness:0},
 forestMint:{kind:'leaf',roughness:.73,metalness:0},
 forestDeep:{kind:'leaf',roughness:.78,metalness:0},
 forestSilk:{kind:'silk',roughness:.68,metalness:0,color:0x2e794b},
 forestBrocade:{kind:'brocade',roughness:.75,metalness:0,color:0x5d926b},
 forestBark:{kind:'bark',roughness:.94,metalness:0,color:0x534936},
 forestLeatherTrim:{kind:'leather',roughness:.89,metalness:0,color:0x4d4033},
 forestBrass:{kind:'brass',roughness:.38,metalness:.56,color:0x9b8a5c},
 forestBlossom:{kind:'silk',roughness:.7,metalness:0,color:0xdcd5b3}
});
const cache=new Map();
const clamp=x=>Math.max(0,Math.min(1,x));
const micro=(u,v)=>Math.sin(188*u+5*Math.sin(13*v))*
 Math.cos(160*v+2*Math.sin(11*u));
const relief=(kind,u,v)=>{
 const grain=micro(u,v);
 if(kind==='leaf'){
  // The midrib starts near the stalk and branches towards the edges.
  // Veins are deliberately smaller than the 3D leaf's sculpted ridge.
  const mid=Math.exp(-Math.pow((u-.5)/.038,2))*.50;
  const left=Math.abs(u-.5);
  const secondary=Math.exp(-Math.pow(
   (v-(.18+3.2*left+.075*Math.sin(v*21)))*24,2));
  const branching=.15*Math.pow(Math.sin(12*Math.PI*v+16*left),8)*
   Math.exp(-Math.pow((left-.21)/.23,2));
  return .40+mid*.31+secondary*.14+branching+.025*grain;
 }
 if(kind==='silk'||kind==='brocade'){
  const fibers=Math.cos(u*Math.PI*116)*Math.cos(v*Math.PI*113);
  const embroidery=kind==='brocade'?
   .15*Math.cos(u*23+Math.sin(v*24))*Math.cos(v*27+Math.sin(u*15)):0;
  return .5+.14*fibers+embroidery+.025*grain;
 }
 if(kind==='bark')return .48+
  .19*Math.cos(u*38+2*Math.sin(v*31))+
  .09*Math.cos(u*99+v*12)+.06*grain;
 if(kind==='leather')return .49+.08*grain+
  .045*Math.cos(u*78+Math.sin(v*17)*4);
 return .50+.04*Math.cos(v*Math.PI*140)+.02*grain;
};
function makeMap(size,buf){
 const t=new THREE.DataTexture(buf,size,size,THREE.RGBAFormat);
 t.wrapS=t.wrapT=THREE.RepeatWrapping;
 t.repeat.set(1.25,2.25);t.generateMipmaps=true;
 t.magFilter=THREE.LinearFilter;
 t.minFilter=THREE.LinearMipmapLinearFilter;
 t.anisotropy=2;t.needsUpdate=true;
 return t;
}
function maps(kind,detail){
 const size=detail==='low'?64:detail==='source'?192:128;
 const key=kind+':'+size;
 if(cache.has(key))return cache.get(key);
 const heights=new Float32Array(size*size);
 const norm=new Uint8Array(size*size*4),rough=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)
  heights[y*size+x]=relief(kind,(x+.5)/size,(y+.5)/size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*size+x,k=i*4;
  const dx=(heights[y*size+(x+1)%size]-
   heights[y*size+(x+size-1)%size])*.36;
  const dy=(heights[((y+1)%size)*size+x]-
   heights[((y+size-1)%size)*size+x])*.36;
  const inverse=1/Math.hypot(dx,dy,1);
  norm[k]=Math.round(255*clamp(.5-dx*inverse*.5));
  norm[k+1]=Math.round(255*clamp(.5-dy*inverse*.5));
  norm[k+2]=Math.round(255*clamp(.5+inverse*.5));norm[k+3]=255;
  const base=kind==='leaf'?.78:kind==='silk'?.68:
   kind==='brocade'?.74:kind==='bark'?.92:
   kind==='leather'?.89:.44;
  const value=Math.round(255*clamp(base+(heights[i]-.5)*.12));
  rough[k]=value;rough[k+1]=value;rough[k+2]=value;rough[k+3]=255;
 }
 const entry=Object.freeze({
  normal:makeMap(size,norm),roughness:makeMap(size,rough),kind
 });
 cache.set(key,entry);return entry;
}
export function isForestSpiritMaterialRole(role){
 return Object.hasOwn(roles,role);
}
export function applyForestSpiritPBR(material,{role='',detail='high'}={}){
 if(!material||!isForestSpiritMaterialRole(role))return false;
 const cfg=roles[role],atlas=maps(cfg.kind,detail);
 if(cfg.color!==undefined)material.color.setHex(cfg.color);
 material.map=null;
 material.metalness=cfg.metalness;
 material.roughness=1;
 material.normalMap=atlas.normal;
 material.roughnessMap=atlas.roughness;
 material.normalScale=new THREE.Vector2(
  detail==='low'?.13:cfg.kind==='leaf'?.22:cfg.kind==='bark'?.24:.15,
  detail==='low'?.13:cfg.kind==='leaf'?.22:cfg.kind==='bark'?.24:.15);
 material.userData={...material.userData,
  forestSpiritPBRRevision:FOREST_SPIRIT_PBR_REVISION,
  forestSpeciesMaterial:cfg.kind,
  forestNoBurlapDiffuse:true};
 material.needsUpdate=true;
 return true;
}
export function forestSpiritPBRStats(){
 return Object.freeze({atlasPairs:cache.size,roles:Object.keys(roles).length});
}
