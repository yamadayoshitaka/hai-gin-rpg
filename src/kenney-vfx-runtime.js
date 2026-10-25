/** Kenney CC0 sprite rendering, configured exclusively by the visual BOM. */
import {VFX_RECIPES,resolveVisualAssembly} from './visual-asset-catalog.js?v=107.0';
const ROOT='./assets/vfx/kenney/';
const cache=new Map();
export function getKenneyTexture(THREE,id){
 if(!cache.has(id))cache.set(id,new THREE.TextureLoader().loadAsync(ROOT+id+'.png').then(tex=>{
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;
  tex.needsUpdate=true;
  return tex;
 }).catch(err=>{cache.delete(id);throw err;}));
 return cache.get(id);
}
export function installSlashVfx({THREE,player,camera,legacyArc}){
 const material=new THREE.MeshBasicMaterial({
  color:0xffffff,transparent:true,opacity:0,depthWrite:false,depthTest:false,
  blending:THREE.AdditiveBlending,side:THREE.DoubleSide
 });
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2.25,1.20),material);
 mesh.position.copy(legacyArc.position);
 mesh.renderOrder=92;
 mesh.visible=false;
 player.add(mesh);
 let loadedTexture='',requestedTexture='',ready=false;
 // A missing texture keeps the old procedural arc visible rather than losing combat feedback.
 const ensure=(name)=>{
  if(name===requestedTexture)return;
  requestedTexture=name;ready=false;
  getKenneyTexture(THREE,name).then(tex=>{
   if(requestedTexture!==name)return;
   material.map=tex;material.needsUpdate=true;
   loadedTexture=name;ready=true;
  }).catch(err=>{player.userData.kenneyVfxError=String(err);});
 };
 return {
  update(job,style='mid',finisher=false){
   const appearance=resolveVisualAssembly(job),recipe=VFX_RECIPES[appearance.attack]||VFX_RECIPES.slash;
   const variant=finisher?{texture:'slash_03',size:1.75,tint:'#ffeaa0'}:style==='low'?{texture:'slash_02',size:.80,tint:'#ffb486'}:style==='special'?{texture:'slash_03',size:1.45,tint:'#dbaaff'}:{texture:recipe.texture||'slash_02',size:1,tint:appearance.accent};
   ensure(variant.texture);
   const opacity=legacyArc.material.opacity||0;
   mesh.visible=ready&&opacity>.003;
   legacyArc.visible=!ready;
   if(mesh.visible){
    mesh.position.copy(legacyArc.position);
    mesh.quaternion.copy(camera.quaternion);
    mesh.rotateZ(legacyArc.rotation.z);
    mesh.scale.set(recipe.width*1.15*variant.size,recipe.width*1.15*variant.size,1);
    material.color.set(variant.tint);
    material.opacity=Math.min(.90,opacity);
   }
  },
  get state(){return {ready,texture:loadedTexture};}
 };
}
export function createKenneyMagicMote({THREE,color,name='magic_04'}){
 const mat=new THREE.SpriteMaterial({color,transparent:true,opacity:.86,depthWrite:false,blending:THREE.AdditiveBlending});
 const sprite=new THREE.Sprite(mat);
 sprite.scale.set(.18,.18,1);
 getKenneyTexture(THREE,name).then(map=>{
  if(sprite.parent){mat.map=map;mat.needsUpdate=true;}
 }).catch(()=>{});
 return sprite;
}
