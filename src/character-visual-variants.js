/** Data-driven visible differentiation of every occupation.
 * Original rigged garments are retained; only their material instances change.
 */
import {JOB_CATALOG} from './job-catalog.js';
const PALETTES=[
 ['#567b89','#b49a76'],['#718653','#ad835e'],['#a27b49','#d0b67c'],
 ['#795b8b','#b7a2c8'],['#995f50','#d0a481'],['#507c78','#a5c6b5'],
 ['#7b6953','#c2ae86'],['#4f648a','#a4b4cc'],['#7f5562','#c59eaa'],
 ['#567088','#b4c2d4'],['#6f7148','#c1bd86'],['#8b5154','#d3a6a5']
];
export const CHARACTER_VISUAL_VARIANTS=Object.freeze(Object.fromEntries(
 Object.keys(JOB_CATALOG).map((id,i)=>[id,Object.freeze({
  id,primary:PALETTES[i%PALETTES.length][0],
  secondary:PALETTES[i%PALETTES.length][1],
  variant:i,
  family:/ranger|archer|hunter|sniper|thief|assassin|rogue|scout|fisher|woodcutter|bandit/.test(id)?'Ranger':'Peasant'
 })])
));
export function applyCharacterVisualVariant({THREE,model,occupationId}){
 const data=CHARACTER_VISUAL_VARIANTS[occupationId]||CHARACTER_VISUAL_VARIANTS.civilian;
 let changed=0;
 model.traverse(node=>{
  if(!node.isMesh||node.isBone||!node.material)return;
  // Never tint the anatomical face, hair, eyes, weapons or skinned donor.
  if(/face|head|hair|eye|skin|weapon|sword|blade|hand/i.test(node.name))return;
  const materials=Array.isArray(node.material)?node.material:[node.material];
  const mapped=materials.map((original,i)=>{
   const mat=original.clone();
   if(mat.color){
    const color=new THREE.Color((changed+i)%3===0?data.secondary:data.primary);
    mat.color.multiply(color);
   }
   return mat;
  });
  node.material=Array.isArray(node.material)?mapped:mapped[0];
  changed++;
 });
 model.userData.visualVariant={...data,materialMeshes:changed};
 return model.userData.visualVariant;
}
