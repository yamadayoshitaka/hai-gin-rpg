import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 STAGE_WORLD_SIZE,STAGE_PRESETS,STAGE_ACTIVE_KEY,DEFAULT_STAGE_ID,TERRITORY_STAGE_IDS,
 allStages,activeStage,selectStage,duplicateStage,upsertCustomStage,deleteCustomStage,
 normalizeCustomStage,stageBounds,insideStage,applyStageTerrain,
 selectStageBuildings,selectStageObjects,stageForTerrain,stageForTerritory,stageIdentity,stageLandmarks,stageWaterway,stageBridgeRows,
} from '../src/stage-library.js';

class MemoryStorage {
 map=new Map();
 getItem(key){return this.map.get(key)??null}
 setItem(key,value){this.map.set(key,String(value))}
 removeItem(key){this.map.delete(key)}
}
const storage=new MemoryStorage();
assert.equal(STAGE_WORLD_SIZE,232);
assert.equal(STAGE_PRESETS.length,20,'十二領地を含む二十種類のステージを管理');
assert.equal(new Set(STAGE_PRESETS.map(s=>s.id)).size,20,'ステージIDは重複しない');
const territories=['western-pass','pine-forest','flame-fort','northern-cliff','silver-capital','central-plains','border-town','green-watch','river-port','lakeshore','green-capital','southern-woods'];
assert.equal(Object.keys(TERRITORY_STAGE_IDS).length,12,'ストーリー地図の十二領地に対応');
for(const id of territories){
 const stageId=stageForTerritory(id,'不明');
 assert.ok(STAGE_PRESETS.some(s=>s.id===stageId),'地図上の領地に専用ステージ '+id);
 assert.equal(stageForTerritory(id,'森林'),stageId,'地形タイプより領地IDを優先 '+id);
}
assert.equal(stageForTerritory('silver-capital'),'royal-castle','最大の王城は既存ステージを使用');
assert.equal(activeStage(storage).id,DEFAULT_STAGE_ID);
assert.equal(STAGE_PRESETS.find(s=>s.id===DEFAULT_STAGE_ID).size,232,'現行王城が最大');
for(const s of STAGE_PRESETS.filter(s=>s.id!==DEFAULT_STAGE_ID)){
 assert.ok(s.size<232,'王城より小さい '+s.name);
 assert.ok(s.size>=184,'出撃範囲 '+s.name);
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
assert.notEqual(changed.tiles[riverIndex],'river','森に不要な王城の大河を引き継がない');
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
 assert.equal(terrain.tiles[riverIndex]==='river',stageWaterway(stage)==='river','河川の有無を反映 '+stage.name);
 assert.ok(terrain.tiles.some((t,i)=>(t==='cliff'||t==='water'||terrain.heights[i]!==3)&&
  insideStage(stage,i%232,Math.floor(i/232))),
  'ステージ内に固有の地形起伏・障害 '+stage.name);
 fingerprints.add(terrain.tiles.filter((_,i)=>i%29===0).join('|').slice(0,15000));
}
assert.ok(fingerprints.size>=17,'二十ステージの地形が一様でない');
for(const biome of ['marsh','desert','coast']){
 const terrain=fresh();applyStageTerrain(terrain,STAGE_PRESETS.find(s=>s.biome===biome));
 assert.ok(terrain.tiles.includes('water'),'沼地・オアシス・入り江 '+biome);
}
assert.deepEqual(stageBridgeRows(castle),[116,177],'王城に二つの大橋');
const village=STAGE_PRESETS.find(s=>s.id==='river-village');
assert.deepEqual(stageBridgeRows(village),[116],'農村の橋は一本');
const port=STAGE_PRESETS.find(s=>s.id==='river-port');
assert.deepEqual(stageBridgeRows(port),[116],'港の大河は一本橋');
for(const stage of STAGE_PRESETS.filter(s=>![castle.id,village.id,port.id].includes(s.id))){
 assert.equal(stageWaterway(stage),'none','河川のない地形 '+stage.name);
 assert.deepEqual(stageBridgeRows(stage),[],'橋を必須にしない '+stage.name);
 const noRiver=fresh();for(let z=0;z<232;z++)for(let dx=-2;dx<=2;dx++)noRiver.tiles[z*232+116+Math.round(5*Math.sin(z*.055))+dx]='river';
 applyStageTerrain(noRiver,stage);
 assert.equal(noRiver.tiles.filter(t=>t==='river').length,0,'中央の大河を削除 '+stage.name);
 assert.notEqual(noRiver.tiles[riverIndex],'water','旧河川を埋めた地形は通行可能 '+stage.name);
 for(let x=100;x<=132;x++)assert.ok(!['river','water','cliff'].includes(noRiver.tiles[116*232+x]),'橋のない中央出撃路を横断できる '+stage.name);
}
const riverCustom=normalizeCustomStage({id:'custom-river',name:'橋あり',biome:'forest',waterway:'river',bridgeCount:1});
assert.equal(stageWaterway(riverCustom),'river');
assert.deepEqual(stageBridgeRows(riverCustom),[116]);
const dryCustom=normalizeCustomStage({...riverCustom,id:'custom-dry',name:'橋なし',waterway:'none',bridgeCount:2});
assert.deepEqual(stageBridgeRows(dryCustom),[],'川を消した際は橋を自動でゼロに');

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
assert.equal(allStages(storage).length,21);
const updated=upsertCustomStage(storage,{...clone,name:'私の森林',biome:'forest',size:196,buildingLimit:8});
assert.equal(updated.name,'私の森林');assert.equal(activeStage(storage).name,'私の森林');
assert.throws(()=>normalizeCustomStage({id:'x',name:'不正'}),/ID/);
assert.throws(()=>normalizeCustomStage({id:'custom-x',name:'  '}),/ステージ名/);
deleteCustomStage(storage,clone.id);
assert.equal(allStages(storage).length,20);
assert.equal(activeStage(storage).id,DEFAULT_STAGE_ID,'削除された選択ステージは王城に戻る');
assert.throws(()=>deleteCustomStage(storage,DEFAULT_STAGE_ID),/削除できません/);

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const manager=readFileSync(new URL('../stage-manager.html',import.meta.url),'utf8');
const menu=readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(game,/applyStageTerrain\(stageData,selectedStage\)/);
assert.match(game,/stageForTerritory\(storyRequest.territoryId,storyRequest.terrain\)/,'実戦は領地専用地形へ移行する');
assert.match(game,/selectStageBuildings\(townBuildings,selectedStage\)/);
assert.match(game,/selectStageObjects\(stageData.objects,selectedStage,stageData\)/);
assert.match(game,/for\(const \[index,row\] of stageCrossingRows.entries\(\)\)/,'橋の生成をステージ定義で制御');
assert.match(manager,/id="bridgeCount"/,'橋数をステージ管理画面で編集可能');
assert.match(game,/insideStage\(selectedStage,x,z\)/);
assert.match(game,/stage-manager\.html/);
assert.match(manager,/id="stageList"/);
assert.match(manager,/id="stageForm"/);
assert.match(manager,/id="stageFilter"/,'二十ステージを種類で絞り込める');
assert.match(menu,/stage-manager\.html/);
console.log('20 stages / 12 story territories / terrain individuality / CRUD / 3D linkage: OK');
