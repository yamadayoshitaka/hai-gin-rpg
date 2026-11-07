import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyArmorMesh,replacedPlateBaseLegMesh,isPlateSourceTrouserLeg} from '../src/character-system/armor-mesh-classification.js';

// Parse original checked-in GLBs, not a fabricated screenshot or an assumed
// mesh naming convention. The full trouser cylinders duplicate the actual
// two animated legs and are replaced by the joint-sized fitted-cloth pieces.
function namesFromGLB(part,sex){
 const path=new URL(`../assets/characters/seven-head-equipment-candidates/plate_${part}-${sex}.glb`,import.meta.url);
 const bytes=readFileSync(path);
 assert.equal(bytes.toString('utf8',0,4),'glTF','Original equipment asset must be a GLB');
 assert.equal(bytes.readUInt32LE(16),0x4e4f534a,'First GLB chunk is JSON');
 const jsonLength=bytes.readUInt32LE(12);
 const gltf=JSON.parse(bytes.toString('utf8',20,20+jsonLength));
 return gltf.nodes.filter(node=>node.mesh!==undefined).map(node=>node.name);
}
for(const sex of ['male','female']){
 const names=namesFromGLB('legs',sex);
 const selected=names.map(name=>({name,slot:classifyArmorMesh('legs',name)}));
 const longTrousers=selected.filter(({name})=>/\btrouser[\s_-]*leg\b/i.test(name));
 assert.equal(longTrousers.length,2,`${sex}: source has two long rigid trouser legs`);
 assert.ok(longTrousers.every(x=>x.slot==='skip'),
  `${sex}: rigid trouser legs MUST NOT attach to pelvis: ${JSON.stringify(longTrousers)}`);
 assert.equal(selected.filter(x=>x.slot==='thigh').length,4,
  `${sex}: two thigh plates and two ridge pieces must remain`);
 assert.equal(selected.filter(x=>x.slot==='knee').length,2,
  `${sex}: retain one articulated knee plate for each leg`);
 assert.equal(selected.filter(x=>x.slot==='shin').length,2,
  `${sex}: retain one rigid shin plate for each real calf`);
 assert.equal(selected.filter(x=>x.slot==='hip').length,2,
  `${sex}: retain the actual waist and pelvic yoke, but no long leg pipes`);
 assert.equal(selected.filter(x=>x.slot==='skip').length,2,
  `${sex}: only the original duplicated trouser-leg meshes are removed`);
 const boots=namesFromGLB('feet',sex).map(name=>classifyArmorMesh('feet',name));
 assert.equal(boots.filter(x=>x==='boot-foot').length,6,
  `${sex}: both actual feet, soles and welt trim survive`);
 assert.equal(boots.filter(x=>x==='boot-upper').length,6,
  `${sex}: boot cuffs and upper-leg details survive`);
}
for(const name of ['plate trouser leg -1','plate trouser leg 1',
                   'plate_trouser_leg_-1','plate-trouser-leg-1']){
 assert.equal(classifyArmorMesh('legs',name),'skip',name);
}
// Check sanitized Three.js GLTFLoader names, not only raw Blender node labels.
for(const name of ['plate trouser leg -1','plate_trouser_leg_-1','plate_trouser_leg_1','plate_trouser-leg 1']){
 assert.equal(isPlateSourceTrouserLeg(name),true,'Original or sanitized trouser mesh '+name);
 assert.equal(classifyArmorMesh('legs',name),'skip',
  'No full-length trouser source mesh may become a pelvic attachment');
}
assert.equal(classifyArmorMesh('legs','plate trouser pelvis yoke'),'hip');
assert.equal(classifyArmorMesh('legs','Unknown extra full-length cloth leg'),'skip',
 'Unrecognized lower-body mesh must not fall back to the pelvis joint');

// The embedded Quaternius Ranger garment is a SECOND independent skinned
// pair of trouser legs + boots. Plate gear must replace it, not overlay it.
// Validate actual original meshes on both imported full outfit GLTF files.
for(const sex of ['Male','Female']){
 const outfit=JSON.parse(readFileSync(new URL(
  `../assets/characters/quaternius-outfits/${sex}_Ranger.gltf`,import.meta.url),'utf8'));
 const originalMeshes=outfit.nodes.filter(node=>node.mesh!==undefined).map(node=>node.name);
 const replaced=originalMeshes.filter(name=>replacedPlateBaseLegMesh(name));
 assert.equal(replaced.length,2,
  `${sex}: expect actual original Ranger legs AND boots, got ${JSON.stringify(replaced)}`);
 assert.ok(replaced.some(name=>/_Legs$/i.test(name)),`${sex}: base pants found`);
 assert.ok(replaced.some(name=>/_Feet(?:_Boots)?$/i.test(name)),`${sex}: base boots found`);
 assert.equal(replacedPlateBaseLegMesh(`${sex}_Ranger_Body`),false,
  'Chest must stay visible with fitted plate armor');
 assert.equal(replacedPlateBaseLegMesh(`${sex}_Ranger_Arms`),false,
  'Arms must stay visible');
}

const runtime=readFileSync(new URL('../src/character-system/segmented-armor-runtime.js',import.meta.url),'utf8');
assert.match(runtime,/classifyArmorMesh\(part,o\.name\)/,
 'Game runtime must use the same classifier as this real-asset regression');
assert.match(runtime,/isPlateSourceTrouserLeg\(o\.name\)/,
 'Runtime must detect GLTFLoader-normalized trouser mesh names');
assert.match(runtime,/sourceTrouserLegMeshesSkipped/,
 'Outfit diagnostics count rejected duplicate trouser legs');
const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const wardrobe=readFileSync(new URL('../src/character-system/rigged-outfit-runtime.js',import.meta.url),'utf8');
assert.match(wardrobe,/part\.isMesh&&replacedPlateBaseLegMesh\(part\.name\)/,
 'Source shoes can be Mesh or SkinnedMesh and must always be suppressed');
assert.match(wardrobe,/part\.visible=false;part\.userData\.replacedByPlateArmor=true/,
 'Replace imported Ranger leg and boot renderers ONLY after plate equipment loads');
assert.match(wardrobe,/suppressedBaseLegMeshes/,
 'Expose leg replacement count to battle inspection diagnostics');
assert.match(wardrobe,/if\(armor\)\{/,
 'Non-plate job outfits must retain their imported lower-body garments');

assert.match(game,/preserveBody:false/,'Gameplay keeps clothing-first anatomy fitting');
assert.match(wardrobe,/attachFittedCloth\(\{dressed,style:dressedStyle,textures,adaptiveFit:true/,
 'The discarded rigid legs are replaced by moving thigh and calf garments');
assert.match(wardrobe,/extendBoundsWithEquippedPieces\(/,
 'Fit checks must include actual plate shins, helmets and boots after replacement');
assert.match(wardrobe,/measureOutfitFit\(bodyFitBox,dressed,jobId,sex,bodyMeshStats,/,
 'Studio must still verify the dressed warrior with replacement lower-body parts');
console.log('PASS male/female: one actual two-legged body, no original Ranger pants/boots or rigid duplicates after plate replacement');
