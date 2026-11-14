import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MONSTER_CATALOG,MONSTER_BY_ID} from '../src/monster-catalog.js';
import {CHARACTER_PARTS} from '../src/character-assembly-bom.js';
import {MODEL_IDS} from '../src/character-asset-registry.js';
import {CHARACTER_MODEL_REGISTRY} from '../src/character-model-registry.js';
import {
 HUMANOID_MONSTER_COSTUMES,HUMAN_MONSTER_IDS,
 humanoidMonsterCostumeFor,validateHumanoidMonsterCostumes
} from '../src/monster-character-cosplay-manifest.js';

assert.equal(validateHumanoidMonsterCostumes(),true);
assert.equal(HUMAN_MONSTER_IDS.length,16);
assert.equal(new Set(HUMAN_MONSTER_IDS).size,16);
const must=new Set(['m015','m031','m032','m033','m034','m035',
 'm036','m037','m038','m039','m040',
 'm041','m042','m043','m044','m045']);
assert.deepEqual(new Set(HUMAN_MONSTER_IDS),must);
const sexes=new Set(),styles=new Set(),bodies=new Set();
for(const id of HUMAN_MONSTER_IDS){
 const spec=MONSTER_BY_ID[id],outfit=humanoidMonsterCostumeFor(spec);
 assert.ok(['undead','fiend','golem'].includes(spec?.family)||id==='m015');
 assert.equal(outfit.id,id);
 assert.ok(MODEL_IDS.includes(outfit.modelId));
 assert.equal(outfit.modelId,CHARACTER_MODEL_REGISTRY[outfit.sex].id);
 assert.ok(CHARACTER_MODEL_REGISTRY[outfit.sex].url.endsWith('.gltf'));
 assert.ok(CHARACTER_PARTS.bodies[outfit.body]);
 assert.ok(CHARACTER_PARTS.faces[outfit.face]);
 assert.ok(CHARACTER_PARTS.hairs[outfit.hair]);
 assert.ok(CHARACTER_PARTS.outfits[outfit.outfit]);
 assert.ok(CHARACTER_PARTS.equipment[outfit.equipment]);
 for(const role of ['skin','cloth','metal','accent'])
  assert.ok(outfit[role]>0&&outfit[role]<0xffffff);
 sexes.add(outfit.sex);styles.add(outfit.outfit);bodies.add(outfit.body);
 assert.equal(humanoidMonsterCostumeFor(id),outfit);
 assert.equal(Object.isFrozen(outfit),true);
}
assert.ok(sexes.has('male')&&sexes.has('female'),'Succubus needs female canonical rig');
assert.ok(styles.size>=5&&bodies.size>=4,
 'Monster anatomy needs bespoke human character variants, not 11 clones');
assert.ok(HUMANOID_MONSTER_COSTUMES.m034.fangs);
assert.ok(HUMANOID_MONSTER_COSTUMES.m032.wrappings);
assert.ok(HUMANOID_MONSTER_COSTUMES.m031.skull);
assert.ok(HUMANOID_MONSTER_COSTUMES.m033.armor);
assert.ok(HUMANOID_MONSTER_COSTUMES.m043.wings);
assert.ok(HUMANOID_MONSTER_COSTUMES.m044.cape);
assert.ok(['m036','m037','m038','m039','m040'].every(id=>HUMANOID_MONSTER_COSTUMES[id].construct));
for(const spec of MONSTER_CATALOG.filter(s=>!must.has(s.id))){
 assert.equal(humanoidMonsterCostumeFor(spec),null,
  'Nonhumanoid monster must NOT be replaced with human body '+spec.id);
}
const runtime=readFileSync(new URL('../src/monster-character-cosplay.js',import.meta.url),'utf8');
const gallery=readFileSync(new URL('../monster-manager.html',import.meta.url),'utf8');
const old=readFileSync(new URL('../src/monster-geometry.js',import.meta.url),'utf8');
const hero=readFileSync(new URL('../src/cc0-town-npc-visuals.js',import.meta.url),'utf8');
assert.match(runtime,/createHumanBomRig.*from '\.\/human-bom-renderer\.js'/,
 'Use existing character BOM rig contract');
assert.match(runtime,/attachTownOutfitNpc.*from '\.\/cc0-town-npc-visuals\.js'/,
 'Load SAME canonical character fullbody GLBs as existing actor preview');
assert.match(runtime,/createMonsterModel.*disposeMonsterSculpture/,
 'Keep 3D procedural fallback when character GLB is not available');
assert.match(runtime,/node\.material=Array\.isArray\(node\.material\)\?node\.material\.map\(recolor\)/,
 'Color changes must clone per-instance material, never recolor playable characters');
assert.match(runtime,/bone\.add\(frame\)/,
 'Costumes must follow real imported skeleton bones');
assert.match(runtime,/canonicalMotion/,
 'Play same imported character animation clip set');
assert.match(runtime,/disposeCostume\?\.\(\)/,
 'Cosmetic material and geometry must be released when model changes');
assert.match(runtime,/if\(!ok\)throw Error/,
 'Do not hide fallback until valid source GLB loads');
assert.match(runtime,/if\(disposed\)return \{source:'cancelled'\}/,
 'Late asynchronous response must be ignored after selection change');
assert.match(gallery,/createCosplayedHumanoidMonster\(m,\{[\s\S]*?detail,[\s\S]*?genderVariant:/,
 'Viewer must actually select character-base monster models');
assert.match(gallery,/mode==='procedural'\?humanoidMonsterCostumeFor\(m,\{/,
 'User-selected external GLB overrides must retain priority');
assert.match(gallery,/pending\.ready\.then/,
 'Async canonical source must update preview only after load');
assert.match(gallery,/__monsterCosplayQA/,
 'Live visual source should be auditable on user device');
assert.ok(gallery.includes('monster-character-cosplay.js?v=4.5.14'),
 'Viewer must bust cached humanoid costume bundle');
assert.match(runtime,/measureRegalShoulderFit\(joints\.arms\[0\],joints\.arms\[1\]\)/,
 'Monster-only outfits must measure native shoulder pivots, not use generic dress size');
assert.match(runtime,/mesh\.userData\.anatomicalWidthFit/,
 'Measured fit must be applied to the actual instanced garment meshes');
assert.match(runtime,/createCanonicalHeadLocalGroomAnchor\(joints\.head,model\)/,
 'Head-local hair must grow upright even for rotated donor skeleton bones');
assert.match(gallery,/controls\.minPolarAngle=HUMAN_MONSTER_IDS\.includes\(selected\)/,
 'Only humanlike previews should restrict top-down scalp views');
assert.match(gallery,/else camera\.position\.set\(center\.x\+dist\*\.30/,
 'Nonhumanoid camera framing must keep prior behavior');
assert.ok(old.includes('export function createMonsterModel'),
 'Existing nonhumanoid 3D geometry pipeline must stay unchanged');
assert.ok(hero.includes('Superhero_Female_FullBody')&&hero.includes('Superhero_Male_FullBody'),
 'Production hero must retain same canonical model source');

// The Node test pipeline intentionally does not instantiate WebGL/DOM-only
// character loader. A real browser test with downloadable GLBs is required
// to evaluate final face fidelity, bone retargeting and frame rate.
console.log('Humanoid cosplay architecture PASS: 16 IDs, real character GLBs, actor slots, independent materials, native motion, async fallback, nonhuman exclusion');
