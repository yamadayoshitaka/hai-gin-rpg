// Preview-only skin finishing for externally generated, untextured AI humans.
// A neutral skin PBR color is NOT a substitute for real face, hair or PBR maps.
// Never apply metal/steel to bare human anatomy; never alter source GLB files.
import * as THREE from 'three';
const modified=new WeakMap();
export function applyHumanSkinPreview(root){
 if(!root)return {applied:0,reason:'No human model'};
 if(modified.has(root))return modified.get(root).summary;
 const edits=[];
 root.traverse(obj=>{
  if(!obj.isMesh||!obj.material)return;
  const mats=Array.isArray(obj.material)?obj.material:[obj.material];
  const replacements=mats.map(material=>{
   if(material?.map||material?.normalMap||material?.isShaderMaterial)return material;
   const part=(obj.name+' '+(material?.name||'')).toLowerCase();
   const hair=/hair|beard|eyebrow|lash/.test(part);
   const eyes=/eyeball|eye(_| |$)/.test(part);
   const nail=/nail/.test(part);
   const pbr=new THREE.MeshPhysicalMaterial({
    name:hair?'AI_Hair_Preview':eyes?'AI_Eye_Preview':'AI_Skin_Preview',
    color:hair?0x30241d:eyes?0xd9d5ca:nail?0xe0bba8:0xcaa184,
    metalness:0,roughness:hair?.79:eyes?.36:.72,
    clearcoat:eyes?.12:.025,clearcoatRoughness:eyes?.25:.63,
    side:THREE.DoubleSide
   });
   edits.push({object:obj,source:material,replacement:pbr});
   return pbr;
  });
  obj.material=Array.isArray(obj.material)?replacements:replacements[0];
 });
 const summary={applied:edits.length,
  detail:'白メッシュ人体の仮肌PBRを '+edits.length+' 材質に適用。肌の色だけで、顔や髪の形は生成できません。'};
 modified.set(root,{edits,summary});
 return summary;
}
export function restoreHumanSkinPreview(root){
 const entry=modified.get(root);if(!entry)return {restored:0};
 root.traverse(obj=>{
  if(!obj.isMesh)return;
  const materials=Array.isArray(obj.material)?obj.material:[obj.material];
  const restored=materials.map(m=>entry.edits.find(x=>x.object===obj&&x.replacement===m)?.source||m);
  obj.material=Array.isArray(obj.material)?restored:restored[0];
 });
 for(const item of entry.edits)item.replacement.dispose();
 modified.delete(root);
 return {restored:entry.edits.length};
}
