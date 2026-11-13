import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {HUMANOID_MONSTER_COSTUMES} from '../src/monster-character-cosplay-manifest.js';
import {DEMON_MAKEUP_PRESETS,DEMON_COLOR_THEMES,hasDemonCosmetics,
 withDemonColorTheme,addDemonicFaceCosmetics}
 from '../src/monster-demon-cosmetics.js';
import {FEMALE_SUMMON_FORMS,FEMALE_SUMMON_FORM_IDS,
 femaleSummonCosplayFor,validateFemaleSummonForms}
 from '../src/female-summon-forms.js';
import {createFemaleSummonFeather,createFemaleSummonLeaf,
 addFemaleSummonCostume,isFemaleSummonCostume}
 from '../src/female-summon-costumes.js';
import {COMBAT_OBJECT_SPECS} from '../src/combat-action-spec.js';

const gallery=readFileSync(new URL('../summon-showcase.html',import.meta.url),'utf8');
const manager=readFileSync(new URL('../monster-manager.html',import.meta.url),'utf8');
const runtime=readFileSync(new URL('../src/monster-character-cosplay.js',import.meta.url),'utf8');
const specs=Object.keys(DEMON_MAKEUP_PRESETS);
assert.equal(specs.length,6);
assert.deepEqual(Object.keys(DEMON_COLOR_THEMES),
 ['species','infernal','abyss','necrotic']);
for(const id of specs){
 const original=HUMANOID_MONSTER_COSTUMES[id];
 assert.ok(hasDemonCosmetics(original));
 assert.equal(withDemonColorTheme(original,'species'),original);
 for(const theme of ['infernal','abyss','necrotic']){
  const changed=withDemonColorTheme(original,theme);
  assert.equal(changed.id,original.id);
  assert.equal(changed.modelId,original.modelId);
  assert.ok(changed.skin!==original.skin,'Did not change species skin '+id);
  assert.ok(changed.makeup>0&&changed.lip>0);
  assert.equal(Object.isFrozen(changed),true);
 }
}
assert.equal(hasDemonCosmetics(HUMANOID_MONSTER_COSTUMES.m032),false);
assert.throws(()=>withDemonColorTheme(HUMANOID_MONSTER_COSTUMES.m043,'unknown'),/Unknown/);

assert.equal(validateFemaleSummonForms(),true);
assert.deepEqual(FEMALE_SUMMON_FORM_IDS,['forest_archer','seraph_guardian','dragon_lord']);
for(const id of FEMALE_SUMMON_FORM_IDS){
 const p=femaleSummonCosplayFor(id);
 assert.equal(p.sex,'female');
 assert.equal(p.modelId,'Superhero_Female_FullBody');
 assert.equal(p.sourceSpecies,id);
 assert.ok(COMBAT_OBJECT_SPECS[id],'Not an existing summon '+id);
 assert.ok(isFemaleSummonCostume(p));
 assert.equal(Object.isFrozen(p),true);
}
assert.equal(femaleSummonCosplayFor('wolf'),null);
assert.equal(femaleSummonCosplayFor('dragon'),null);
assert.ok(!isFemaleSummonCostume(HUMANOID_MONSTER_COSTUMES.m043));
assert.ok(!runtime.includes('import {femaleSummonCosplayFor'),
 'Do not conflate monster ID lookup and optional summon form binding');
assert.match(runtime,/profileOverride\|\|humanoidMonsterCostumeFor/,
 'Canonical GLB adapter must accept an optional summon recipe');
assert.match(runtime,/withoutFallback\?null:createMonsterModel/,
 'Female summon must use current battle instancing as load-time fallback');
assert.match(runtime,/if\(fallback\?\.parent\)/,
 'Null optional fallback must be safe during animation/dispose');

const check=(geometry,name)=>{
 const positions=geometry.getAttribute('position'),uv=geometry.getAttribute('uv'),
  normal=geometry.getAttribute('normal');
 assert.ok(geometry.index.count>24,name+' not triangulated');
 assert.ok(positions.count>15&&uv.count===positions.count&&normal.count===positions.count);
 assert.ok(positions.array.every(Number.isFinite));
 assert.ok(normal.array.every(Number.isFinite));
 assert.ok(uv.array.every(Number.isFinite));
};
for(const factory of [createFemaleSummonFeather,createFemaleSummonLeaf]){
 const hi=factory({detail:'high'}),lo=factory({detail:'low'});
 check(hi,'high feather/leaf');check(lo,'low feather/leaf');
 assert.ok(hi.getAttribute('position').count>
   lo.getAttribute('position').count*2,
  'High/low summon geometry must reduce mobile triangles');
 hi.dispose();lo.dispose();
}
const fixture=(detail)=>{
 const frames={head:new THREE.Group(),chest:new THREE.Group(),
  arms:[new THREE.Group(),new THREE.Group()],
  forearms:[new THREE.Group(),new THREE.Group()],
  legs:[new THREE.Group(),new THREE.Group()],
  calves:[new THREE.Group(),new THREE.Group()]};
 const owned=[];
 const attach=(parent,geometry,role,name,pos=[0,0,0],rot=[0,0,0])=>{
  const m=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());
  m.position.set(...pos);m.rotation.set(...rot);m.name=name;
  parent.add(m);owned.push(m);return m;
 };
 const tube=(parent,role,name,points,radius)=>{
  const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
   points.map(p=>new THREE.Vector3(...p))),detail==='high'?12:5,
   radius,detail==='high'?7:5,false);
  return attach(parent,g,role,name);
 };
 return {frames,owned,attach,tube};
};
for(const id of specs){
 const p=HUMANOID_MONSTER_COSTUMES[id],hi=fixture('high');
 assert.equal(addDemonicFaceCosmetics({profile:p,detail:'high',...hi}),true);
 assert.ok(hi.owned.length>=10,'No brows/lip sigils on '+id);
 assert.equal(hi.owned.filter(n=>n.name.includes('upper-eyeliner')).length,2);
 assert.equal(hi.owned.filter(n=>n.name.includes('under-eye-shade')).length,2);
 if(DEMON_MAKEUP_PRESETS[id].horns!=='none'&&
    DEMON_MAKEUP_PRESETS[id].horns!=='existing')
  assert.equal(hi.owned.filter(n=>n.name.includes('swept-horn')).length,2);
 if(DEMON_MAKEUP_PRESETS[id].tail)
  assert.ok(hi.owned.some(n=>n.name.includes('flexible-demon-tail')));
 for(const n of hi.owned){
  check(n.geometry,id+'/'+n.name);
  assert.ok(n.parent===hi.frames.head||n.parent===hi.frames.chest||
    hi.frames.forearms.includes(n.parent),'Cosmetic not attached to an animated parent');
  n.geometry.dispose();n.material.dispose();
 }
}
for(const id of FEMALE_SUMMON_FORM_IDS){
 const profile=femaleSummonCosplayFor(id),high=fixture('high'),low=fixture('low');
 assert.equal(addFemaleSummonCostume({profile,detail:'high',...high}),true);
 assert.equal(addFemaleSummonCostume({profile,detail:'low',...low}),true);
 assert.ok(high.owned.length>=8,'Missing sculpted costume '+id);
 const count=owned=>owned.reduce((sum,n)=>sum+n.geometry.getAttribute('position').count,0);
 assert.ok(count(high.owned)>count(low.owned)*1.5,'LOD not cheaper for '+id);
 assert.ok(count(high.owned)<45000,'Female costume GPU detail too expensive '+id);
 if(id==='seraph_guardian')
  assert.ok(high.owned.filter(n=>n.geometry.userData.kind==='female-summon-feather-vane').length>=10);
 if(id==='forest_archer')
  assert.ok(high.owned.filter(n=>n.geometry.userData.kind==='forest-spirit-leaf').length>=8);
 if(id==='dragon_lord')
  assert.equal(high.owned.filter(n=>n.geometry.userData.kind==='scalloped-bat-wing-membrane').length,2);
 for(const n of [...high.owned,...low.owned]){
  check(n.geometry,id+'/'+n.name);
  assert.ok(n.parent?.isGroup);
  n.geometry.dispose();n.material.dispose();
 }
}
assert.match(gallery,/id="humanoidForm"/);
assert.match(gallery,/FEMALE_SUMMON_FORM_IDS.includes\(selected\)/);
assert.match(gallery,/createCosplayedHumanoidMonster\(spec,\{/);
assert.match(gallery,/withoutFallback:true/);
assert.match(gallery,/femaleSummonHandle\?\.update\(t\)/);
assert.match(gallery,/objects.sync\(externalPreview\|\|isFemaleReady\?\[\]:\[previewObject\],t\)/);
assert.match(gallery,/disposeFemaleSummon\(\)/);
assert.match(manager,/id="toggleCatalog"/);
assert.match(manager,/id="zoomIn"/);
assert.match(manager,/id="zoomOut"/);
assert.match(manager,/id="resetCamera"/);
assert.match(manager,/id="toggleTools"/);
assert.match(manager,/main.catalogOpen>aside/);
assert.match(manager,/\.tools\[hidden\]\{display:none!important\}/);
assert.match(manager,/setCatalogOpen\(!isPhone\(\)\)/);
assert.match(manager,/__monsterViewerLayoutQA/);
assert.match(manager,/id="demonTone"/);
assert.match(manager,/withDemonColorTheme\(cosplay,byId\('demonTone'\).value\)/);
console.log('Demon makeup + 3 female summon forms + 3D-first mobile gallery PASS');
