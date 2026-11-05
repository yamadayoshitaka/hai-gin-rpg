import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const vfx=readFileSync(new URL('../src/character-system/action-vfx-runtime.js',import.meta.url),'utf8');
const body=readFileSync(new URL('../src/mass-battle-real-army.js',import.meta.url),'utf8');
const worker=readFileSync(new URL('../src/mass-battle-worker-client.js',import.meta.url),'utf8');

assert.match(game,/function beginSquadDestination\(id\)/);
assert.match(game,/setBattlePaused\(true\);followCamera=false/,
  '部隊を選択すると必ず進軍を止めて俯瞰視点にする');
assert.match(game,/setBattleCamera\(focus,new THREE\.Vector3\(\.02,Math\.max\(36/,
  '目的地を指定する間は部隊を上空から見下ろす');
assert.match(game,/raycaster\.intersectObjects\(\[\.\.\.squadMarkers\.values\(\)\]/,
  '部隊ラベル自体をタップできる');
assert.match(game,/if\(found\.team===0\)beginSquadDestination/,
  '兵士をタップしても所属部隊を選択できる');
assert.match(game,/if\(issueSquadOrder\('move',position\)\)finishSquadDestination\(true\)/);
assert.match(game,/setBattlePaused\(previous\.wasPaused\)/,
  'もともと手動停止中だった場合は指定後も停止を維持する');
assert.match(worker,/setPaused\(value\)\{paused=Boolean\(value\)/,
  '一時停止中はWorkerへ新しいAI tickを積まない');

assert.match(game,/accentMultiplier:5/);
assert.match(game,/actionVfx\.emitAccents\(kind,p,\{scale:\.95,life:\.38\}\)/,
  '詳細モデルだけでなく実GPU人物の戦闘にも光粒を配る');
assert.match(vfx,/this\.maxAccents=this\.maxEffects\*\(this\.accentMultiplier-1\)/);
assert.match(vfx,/new THREE\.InstancedMesh\(new THREE\.PlaneGeometry\(1,1\)/,
  '追加の4粒×全エフェクトをGPUで一括描画する');
assert.match(vfx,/this\.emitAccents\(kind,p/,
  '剣技、魔法、回復、爆発で同一の粒子強化を使用する');
assert.match(game,/sun\.shadow\.autoUpdate=false/,
  '大軍戦は静的な建造物のシャドーマップを毎フレーム描き直さない');

assert.match(body,/node\.levels\.forEach\(\(level,i\)=>\{level\.object\.visible=i===0/,
  'GPU焼き込み前に頭皮・髪LODが消えていないことを保証');
assert.match(body,/if\(!pose\)coherent=false/);
assert.match(body,/coherent\?pose:base\.slice\(\)/,
  '破損した外部ポーズは人体・衣装をセットで待機姿勢に戻す');
assert.match(game,/createCharacter\(\{job:appearanceJob,sex/,
  'ゲームは外部モーション検証と同じ共有7頭身人体を生成する');
assert.match(game,/a\.outfit=await buildRiggedJobOutfit/,
  '共有衣装を使い、別のダミー衣装に置き換えない');
console.log('PASS tactical squad tap/pause/overhead/destination, 5x batched VFX, hair and outfit motion integrity');
