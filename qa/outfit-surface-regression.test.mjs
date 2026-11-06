import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {outfitSurfaceRole,cleanOutfitPhotoKind} from '../src/character-system/outfit-surface-policy.js';

const armor={armor:true,fabric:'leather'};
const ranger={armor:false,fabric:'leather'};
const peasant={armor:false,fabric:'linen'};
let checked=0;
for(const sex of ['Male','Female'])for(const base of ['Ranger','Peasant']){
 const source=JSON.parse(readFileSync(new URL(`../assets/characters/quaternius-outfits/${sex}_${base}.gltf`,import.meta.url),'utf8'));
 for(const mesh of source.meshes.filter(m=>/(Arms|Legs)/.test(m.name))){
  for(const primitive of mesh.primitives){
   const material=source.materials[primitive.material].name;
   const role=outfitSurfaceRole(mesh.name,material);
   const style=base==='Ranger'?armor:peasant;
   const kind=cleanOutfitPhotoKind({role,partName:mesh.name,style,jobId:'job01'});
   if(/MI_Regular/.test(material)){
    assert.equal(role,'skin',`${sex}/${base}/${mesh.name}: exposed hands are skin`);
    assert.equal(kind,null,'never paint photographic cloth onto hands');
   }else if(base==='Ranger'){
    assert.ok(['arms','legs'].includes(role),`${mesh.name}: original green cloth not identified`);
    assert.equal(kind,'linen-fine',`${mesh.name}: imported black-green accents survive`);
   }else if(/Arms/.test(mesh.name)){
    assert.equal(kind,null,`${mesh.name}: shared peasant hand atlas must be preserved`);
   }else assert.equal(kind,'linen-fine',`${mesh.name}: peasant leg fabric must be continuous`);
   checked++;
  }
 }
}
assert.ok(checked>=12,`Only ${checked} source-material coverage checks`);
assert.equal(cleanOutfitPhotoKind({role:'legs',partName:'Male_Ranger_Legs',style:ranger,jobId:'job04'}),'leather');
assert.equal(cleanOutfitPhotoKind({role:'body',partName:'Female_Ranger_Body',style:ranger,jobId:'job04'}),null);
assert.equal(cleanOutfitPhotoKind({role:'arms',partName:'Female_Ranger_Arms',style:ranger,jobId:'strategist'}),'damask');
console.log(`PASS garment/skin material separation: ${checked} real GLTF primitives + helmet/limb policy`);
