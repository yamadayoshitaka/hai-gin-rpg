import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 MONSTER_CATALOG,MONSTER_BY_ID,MONSTER_EDITOR_STORAGE_KEY,
 resolveMonsterGameSpec,validateMonsterCatalog
} from '../src/monster-catalog.js';
import {MONSTER_SUMMON_ENTRIES} from '../src/monster-summon-registry.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const battle=read('src/battle-registered-monster-model.js');
const page=read('tactics-wireframe.html');
const manager=read('monster-manager.html');
const summons=read('src/monster-summon-renderer.js');
const manifest=read('src/monster-character-cosplay-manifest.js');
assert.equal(validateMonsterCatalog(),true);
assert.equal(MONSTER_CATALOG.length,50);
assert.equal(new Set(MONSTER_CATALOG.map(m=>m.id)).size,50);
assert.equal(MONSTER_SUMMON_ENTRIES.length,50);
for(const monster of MONSTER_CATALOG){
 assert.equal(MONSTER_BY_ID[monster.id],monster);
 assert.equal(resolveMonsterGameSpec(monster.id),monster);
 const summon=MONSTER_SUMMON_ENTRIES.find(s=>s.monsterId===monster.id);
 assert.ok(summon,'No summon mapping for '+monster.id);
 assert.equal(summon.id,'summon_'+monster.id);
 assert.equal(summon.name,monster.name);
}
assert.equal(MONSTER_BY_ID.m031.name,'骸骨剣士');
assert.match(manifest,/m031:define\('m031'.*'skeleton'/);
assert.match(manager,/createCosplayedHumanoidMonster\(m,/);
assert.match(summons,/createCosplayedHumanoidMonster\(spec,/);
assert.match(battle,/createCosplayedHumanoidMonster\(spec,/);
assert.match(battle,/withoutFallback:true/);
assert.match(battle,/canonical-humanoid-ready/);
assert.match(battle,/cosplayHandle\.start\(next,time\)/);
assert.match(battle,/cosplayHandle\.update\(time\)/);
assert.match(battle,/cosplayHandle\.dispose\(\)/);
assert.match(battle,/native=createMonsterModel\(spec,\{detail\}\)/);
assert.match(page,/resolveMonsterGameSpec\(monsterId\)/);
assert.match(page,/createRegisteredBattleMonster\(a\.monsterSpec,/);

const saved={m031:{
 name:'強化骸骨剣士',level:52,stats:{hp:900,attack:98,defense:18,speed:24},
 colors:{base:'#aabbcc',highlight:'#bbccdd',accent:'#ccddee'}
}};
const storage={getItem:key=>key===MONSTER_EDITOR_STORAGE_KEY?JSON.stringify(saved):null};
const edited=resolveMonsterGameSpec('m031',{storage});
assert.equal(edited.name,'強化骸骨剣士');
assert.equal(edited.level,52);
assert.equal(edited.stats.hp,900);
assert.equal(edited.stats.attack,98);
assert.equal(edited.colors.base,'#aabbcc');
assert.equal(edited.family,'undead');
assert.equal(edited.id,'m031');
assert.equal(MONSTER_BY_ID.m031.name,'骸骨剣士','Canonical catalog remains untouched');
assert.equal(resolveMonsterGameSpec('m032',{storage}),MONSTER_BY_ID.m032);
assert.equal(resolveMonsterGameSpec('missing',{storage}),null);
assert.equal(resolveMonsterGameSpec('m031',{storage:{getItem:()=>'{invalid'}}),MONSTER_BY_ID.m031);
const hostile={getItem:()=>JSON.stringify({m031:{
 name:'x'.repeat(100),level:9999,stats:{hp:-500,attack:Infinity,defense:-1,speed:-4},
 colors:{base:'javascript:bad',highlight:'#112233',accent:'#000000'}}})};
const checked=resolveMonsterGameSpec('m031',{storage:hostile});
assert.equal(checked.name.length,40);
assert.equal(checked.level,100);
assert.equal(checked.stats.hp,1);
assert.equal(checked.stats.defense,0);
assert.equal(checked.colors.base,MONSTER_BY_ID.m031.colors.base);
assert.equal(checked.colors.highlight,'#112233');
console.log('PASS: 50 catalog monsters, 50 summon mappings and 16 humanoid battle model routing are shared');
