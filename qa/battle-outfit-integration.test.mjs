import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EQUIPMENT_TYPES,equipmentForJob,assertEquipmentCatalog} from '../src/character-system/equipment-catalog.js';
import {randomJobRoster} from '../src/tactical-roster.js';

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const outfit=readFileSync(new URL('../src/character-system/rigged-outfit-runtime.js',import.meta.url),'utf8');
const cloth=readFileSync(new URL('../src/character-system/fitted-cloth-runtime.js',import.meta.url),'utf8');
const army=readFileSync(new URL('../src/mass-battle-real-army.js',import.meta.url),'utf8');

assertEquipmentCatalog();
assert.equal(equipmentForJob('job01').armor,'plate');
assert.equal(equipmentForJob('job05').armor,'plate');
assert.equal(equipmentForJob('job04').main,'bow');
assert.equal(equipmentForJob('job07').offhand,'dagger');
assert.equal(EQUIPMENT_TYPES.spear.kind,'weapon');

// A dressed motion tester is insufficient: every tactical actor must invoke
// the shared wardrobe after its animated character has been constructed.
assert.match(game,/import \{buildRiggedJobOutfit\} from '.\/src\/character-system\/rigged-outfit-runtime\.js\?v=\d+\.\d+\.\d+'/);
assert.match(game,/a\.outfit=await buildRiggedJobOutfit\(/);
assert.match(game,/characterModel:character\.model,parent:character\.object3D/);
assert.match(game,/quality:'battle'/);
assert.match(game,/preserveBody:true/,'battle characters must keep complete bodies beneath outfits');
assert.match(game,/weaponOverride:a\.job\.name==='槍兵'\?'spear'/);
assert.match(game,/a\.outfit\?\.sync\(\)/);
assert.match(game,/if\(a\.outfitError\)/);

// 通常の100体は引き続き衣装付き。大軍時は各軍12体の近景モデルに限定する。
assert.match(outfit,/const lowDetail=quality==='battle'/);
assert.match(outfit,/const detail=createDetailedOutfit\(jobId,sex,dressed,textures,\{quality\}\)/,
  'battle source must retain optimized job-specific photo couture');
assert.match(outfit,/radialSegments:lowDetail\?16:96/);
assert.match(cloth,/radialSegments=96,heightSegments=32/);
assert.match(game,/const TEAM_SIZE=MASS_SIZE\?12:50,BATTLE_SIZE=TEAM_SIZE\*2/);
assert.match(game,/const MASS_SIZE=\[100,200,500,1000\]\.includes\(requestedArmy\)/);
assert.match(game,/createMassBattleRealArmy\(scene,massSim/);
assert.match(game,/new MassBattleGridSimulation\(MASS_SIZE,20261104/,'大軍モードが実マップの通行判定を使用する');
assert.match(game,/walkable:worldPassableMap\(\)/,'水面・建物・橋の通行マップを参照する');
assert.match(game,/massSim\.updateWalkable\(worldPassableMap\(\)\)/,'橋の崩落時に経路を再計算する');
assert.doesNotMatch(game,/createMassBattleGameLOD/,'本編に簡易兵士を描画しない');
assert.match(army,/source\.applyBoneTransform\(i,scratch\)/,'衣装付き実物モデルのスキン姿勢を焼き込む');
assert.match(army,/new THREE\.InstancedMesh\(part\.geometry,part\.material/,'実物メッシュを共通描画する');
assert.match(army,/mergeGeometries\(group\.geometries,false\)/,'同一素材の実メッシュを統合する');
assert.match(army,/Bake the complete underlying seven-head body/,'GPU instances must contain intact bodies beneath costumes');
assert.doesNotMatch(army,/CylinderGeometry|BoxGeometry|SphereGeometry/,'箱型・円柱型の代用人体を作らない');
assert.match(game,/randomRosters=\[randomJobRoster\(JOBS,TEAM_SIZE\),randomJobRoster\(JOBS,TEAM_SIZE\)\]/);
assert.match(game,/for\(let team=0;team<2;team\+\+\)for\(let i=0;i<TEAM_SIZE;i\+\+\)/);
assert.match(game,/ランダム職業リアルタイム自動戦闘を開始/);
const jobs=['剣士','格闘家','魔法使い','弓使い','盾戦士','盗賊','忍者','槍兵','僧侶','召喚士'];
for(const seed of [.1,.37,.82]){
 const roster=randomJobRoster(jobs,50,()=>seed);
 assert.equal(roster.length,50);
 assert.equal(new Set(roster).size,10,'all ten playable jobs should appear');
 for(const job of jobs)assert.equal(roster.filter(x=>x===job).length,5,'each side needs five of every job');
 assert.ok(roster.every(job=>jobs.includes(job)));
}
console.log('PASS battle wardrobe: 50v50 random-job actors, armor, weapon slots, animation sync and battle LOD');
