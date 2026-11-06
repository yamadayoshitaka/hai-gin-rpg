import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 STAGE_WORLD_SIZE,STAGE_PRESETS,STAGE_ACTIVE_KEY,DEFAULT_STAGE_ID,
 allStages,activeStage,selectStage,duplicateStage,upsertCustomStage,deleteCustomStage,
 normalizeCustomStage,stageBounds,insideStage,applyStageTerrain,
 selectStageBuildings,selectStageObjects,stageForTerrain,stageIdentity,stageLandmarks,
} from '../src/stage-library.js';

class MemoryStorage {
 map=new Map();
 getItem(key){return this.map.get(key)??null}
 setItem(key,value){this.map.set(key,String(value))}
 removeItem(key){this.map.delete(key)}
}
const storage=new MemoryStorage();
assert.equal(STAGE_WORLD_SIZE,232);
assert.equal(STAGE_PRESETS.length,9,'九種類のステージを管理');
assert.equal(new Set(STAGE_PRESETS.map(s=>s.id)).size,9,'ステージIDは重複しない');
assert.equal(activeStage(storage).id,DEFAULT_STAGE_ID);
assert.equal(STAGE_PRESETS.find(s=>s.id===DEFAULT_STAGE_ID).size,232,'現行王城が最大');
for(const s of STAGE_PRESETS.filter(s=>s.id!==DEFAULT_STAGE_ID)){
 assert.ok(s.size<232,'王城より小さい '+s.name);
 assert.ok(s.size>=184,'橋を含む出撃範囲 '+s.name);
 assert.ok(!s.custom);
}
assert.equal(stageForTerrain('森林'),'deep-forest');
assert.equal(stageForTerrain('市街'),'fallen-ruins');
assert.equal(stageForTerrain('城塞'),'border-fort');
assert.equal(stageForTerrain('未知'),DEFAULT_STAGE_ID);
const forest=STAGE_PRESETS.find(s=>s.id==='deep-forest');
assert.deepEqual(stageBounds(forest),{minX:16,minZ:16,maxX:215,maxZ:215,size:200});
assert.equal(insideStage(forest,55,177),true);
assert.equal(insideStage(forest,10,10),false);
const castle=STAGE_PRESETS[0];
const fresh=()=>({
 width:232,height:232,season:'summer',tiles:Array(232*232).fill('grass'),
 heights:Array(232*232).fill(3),
});
const original=fresh(),riverIndex=116*232+116;original.tiles[riverIndex]='river';
applyStageTerrain(original,castle);
assert.equal(original.tiles[0],'grass','既存の城地形を変えない');
assert.equal(original.season,'summer');
const changed=fresh();changed.tiles[riverIndex]='river';
applyStageTerrain(changed,forest);
assert.equal(changed.tiles[0],'cliff','範囲外を崖として閉鎖');
assert.equal(changed.tiles[riverIndex],'river','河川と橋の基準を維持');
assert.equal(changed.tiles[100*232+100]!=='grass',true,'森林の地形材質');
assert.ok(changed.tiles.includes('moss')&&changed.tiles.includes('leaf'));
const snow=STAGE_PRESETS.find(s=>s.biome==='snow');const winter=fresh();
applyStageTerrain(winter,snow);assert.equal(winter.season,'winter');
assert.ok(winter.tiles.includes('snow')&&winter.tiles.includes('ice'));
assert.throws(()=>applyStageTerrain({width:1,height:1,tiles:[],heights:[]},forest),/地形サイズ/);

// Stage identity must change the traversable topology and landmark placement,
// not merely assign a different color to the existing castle map.
const fingerprints=new Set();
for(const stage of STAGE_PRESETS.filter(s=>s.id!==DEFAULT_STAGE_ID)){
 const terrain=fresh();terrain.tiles[riverIndex]='river';applyStageTerrain(terrain,stage);
 const identity=stageIdentity(stage),landmarks=stageLandmarks(stage);
 assert.ok(identity.feature&&identity.tactics&&identity.sky,'ステージ演出がある');
 assert.ok(landmarks.length>=3,'固有ランドマークがある '+stage.name);
 for(const [id,x,z] of landmarks){
  assert.ok(insideStage(stage,x,z,8),'ランドマークがマップ内 '+id);
  assert.ok(/^(stone_|town_|haystack_|wooden_)/.test(id));
 }
 assert.equal(terrain.tiles[riverIndex],'river','橋の川筋を保存 '+stage.name);
 assert.ok(terrain.tiles.some((t,i)=>(t==='cliff'||t==='water'||terrain.heights[i]!==3)&&
  insideStage(stage,i%232,Math.floor(i/232))),
  'ステージ内に固有の地形起伏・障害 '+stage.name);
 fingerprints.add(terrain.tiles.filter((_,i)=>i%29===0).join('|').slice(0,15000));
}
assert.ok(fingerprints.size>=7,'地形が一様でない');
for(const biome of ['marsh','desert','coast']){
 const terrain=fresh();applyStageTerrain(terrain,STAGE_PRESETS.find(s=>s.biome===biome));
 assert.ok(terrain.tiles.includes('water'),'沼地・オアシス・入り江 '+biome);
}

const buildings=[{kind:'castle',x:56,z:56,w:100,d:100},
 {kind:'house',x:70,z:130,w:10,d:10},{kind:'house',x:180,z:170,w:10,d:10},
 {kind:'house',x:4,z:4,w:10,d:10}];
assert.equal(selectStageBuildings(buildings,castle).length,4);
assert.equal(selectStageBuildings(buildings,forest).length,0);
const fort=STAGE_PRESETS.find(s=>s.id==='border-fort'),outpost=selectStageBuildings(buildings,fort);
assert.equal(outpost.some(b=>b.kind==='castle'),false,'小型ステージに巨大な王城を持ち込まない');
assert.ok(outpost.some(b=>b.kind==='manor_noble'),'守備拠点は小型建物で表現する');
const objects=[{id:'tree_deciduous_001',x:2,z:2},{id:'rock_prop',x:100,z:100}];
const forestObjects=selectStageObjects(objects,forest);
assert.deepEqual(forestObjects.slice(0,1),[{id:'rock_prop',x:100,z:100}]);
assert.ok(forestObjects.length<120,'樹林追加はバッチ処理可能な数に制限する');

selectStage(storage,forest.id);assert.equal(storage.getItem(STAGE_ACTIVE_KEY),forest.id);
assert.equal(activeStage(storage).id,forest.id);
assert.equal(activeStage(storage,'white-pass').id,'white-pass','URL指定でステージを上書き');
assert.throws(()=>selectStage(storage,'missing'),/見つかりません/);
const clone=duplicateStage(storage,DEFAULT_STAGE_ID);
assert.equal(clone.custom,true);assert.equal(clone.size,216);
assert.equal(clone.buildingMode,'town','最大城をコピーしても王城の唯一性を維持');
assert.equal(activeStage(storage).id,clone.id);
assert.equal(allStages(storage).length,10);
const updated=upsertCustomStage(storage,{...clone,name:'私の森林',biome:'forest',size:196,buildingLimit:8});
assert.equal(updated.name,'私の森林');assert.equal(activeStage(storage).name,'私の森林');
assert.throws(()=>normalizeCustomStage({id:'x',name:'不正'}),/ID/);
assert.throws(()=>normalizeCustomStage({id:'custom-x',name:'  '}),/ステージ名/);
deleteCustomStage(storage,clone.id);
assert.equal(allStages(storage).length,9);
assert.equal(activeStage(storage).id,DEFAULT_STAGE_ID,'削除された選択ステージは王城に戻る');
assert.throws(()=>deleteCustomStage(storage,DEFAULT_STAGE_ID),/削除できません/);

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const manager=readFileSync(new URL('../stage-manager.html',import.meta.url),'utf8');
const menu=readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(game,/applyStageTerrain\(stageData,selectedStage\)/);
assert.match(game,/selectStageBuildings\(townBuildings,selectedStage\)/);
assert.match(game,/selectStageObjects\(stageData.objects,selectedStage\)/);
assert.match(game,/insideStage\(selectedStage,x,z\)/);
assert.match(game,/stage-manager\.html/);
assert.match(manager,/id="stageList"/);
assert.match(manager,/id="stageForm"/);
assert.match(menu,/stage-manager\.html/);
console.log('Stage catalog / size hierarchy / biomes / CRUD / 3D linkage: OK');
