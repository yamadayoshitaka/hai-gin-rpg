import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {REGAL_HUMANOID_WARDROBE}
 from '../src/monster-regal-garments.js';
import {applySummonFootwearPBR,detachSummonFootwearPBR,
 SUMMON_FOOTWEAR_SOURCE,SUMMON_FOOTWEAR_PBR_REVISION,
 summonFootwearPBRStats} from '../src/summon-footwear-pbr.js';

test('humanoid summons keep leaf/armour leggings but use leather boots',()=>{
 for(const id of ['forest_spirit_female','seraph_female',
  'dragonkin_female','dragonkin_male']){
  const plan=REGAL_HUMANOID_WARDROBE[id];
  assert.equal(plan.bootMaterial,'summonBootLeather',id);
  assert.ok(plan.leggings);
 }
 assert.equal(REGAL_HUMANOID_WARDROBE.forest_spirit_female.leggings,'leaf');
 assert.equal(REGAL_HUMANOID_WARDROBE.gargoyle.bootMaterial,undefined,
  'stone creature claws must not become leather boots');
});
test('CC0 source is explicit and browser offline fallback is preserved',()=>{
 assert.equal(SUMMON_FOOTWEAR_SOURCE.license,'CC0');
 assert.match(SUMMON_FOOTWEAR_SOURCE.page,/polyhaven\.com\/a\/fabric_leather_01/);
 assert.match(SUMMON_FOOTWEAR_SOURCE.diffuse,/_diff_1k\.jpg$/);
 assert.match(SUMMON_FOOTWEAR_SOURCE.normal,/_nor_gl_1k\.png$/);
 assert.match(SUMMON_FOOTWEAR_SOURCE.roughness,/_rough_1k\.jpg$/);
 const code=readFileSync(new URL('../src/monster-character-cosplay.js',import.meta.url),'utf8');
 assert.match(code,/summonBootLeather:'leather'/);
 assert.match(code,/applySummonFootwearPBR\(m,\{role,detail\}\)/);
 assert.match(code,/detachSummonFootwearPBR\(material\)/);
 const boots=readFileSync(new URL('../src/monster-regal-garments.js',import.meta.url),'utf8');
 assert.match(boots,/const bootRole=plan\.bootMaterial\|\|legMaterial\(plan\)/);
 assert.match(boots,/plan\.style\+'-full-foot-boot-'/);
 assert.match(boots,/plan\.style\+'-leather-outsole-'/);
});
test('non-boot materials cannot be overwritten; low LOD never loads remote maps',()=>{
 const skin=new THREE.MeshStandardMaterial({color:0xffffff});
 const boot=new THREE.MeshStandardMaterial({color:0xcabbaa});
 assert.equal(applySummonFootwearPBR(skin,{role:'skin'}),false);
 assert.equal(skin.map,null);
 const before=summonFootwearPBRStats().sharedMaps;
 assert.equal(applySummonFootwearPBR(boot,{role:'summonBootLeather',
  detail:'low'}),true);
 assert.equal(boot.userData.summonFootwearPbrRevision,
  SUMMON_FOOTWEAR_PBR_REVISION);
 assert.ok(boot.roughness>.7&&boot.metalness<.1);
 assert.equal(summonFootwearPBRStats().sharedMaps,before);
 detachSummonFootwearPBR(boot);
 skin.dispose();boot.dispose();
});
