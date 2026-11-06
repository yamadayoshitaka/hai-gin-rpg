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
assert.match(game,/#squadScreenLabels\{position:fixed;inset:0/,
  '部隊名はカメラ高度に依存しない画面上の固定サイズで表示する');
assert.match(game,/\.squadScreenLabel\{[^}]*font:bold 14px/,
  '遠景でも文字を14px以上に維持する');
assert.match(game,/\.squadScreenLabel\.enemy\{[^}]*border-color:#ff8b93/,
  '敵の部隊名は赤色で区別する');
assert.match(game,/\.squadScreenLabel\.selected\{[^}]*font-size:17px/,
  '選択中の部隊名を強調して表示する');
assert.match(game,/function updateSquadScreenLabels\(dt\)/);
assert.match(game,/squadScreenPoint\.copy\(marker\.position\)\.project\(camera\)/,
  'ワールド座標を画面上へ射影してラベルを追従させる');
assert.match(game,/if\(occupied\.some\(p=>/,
  '付近の部隊名が重なり合うことを防ぐ');
assert.match(game,/label\.style\.pointerEvents=pickingSquadDestination\?'none':'auto'/,
  '行き先指定中はラベルが目的地タップを妨げない');
assert.match(game,/updateSquadScreenLabels\(dt\);/,
  '描画フレームの移動に合わせて部隊名の表示位置を更新する');
assert.match(game,/#destinationPrompt\{[^}]*font-size:15px/,
  '目的地の操作案内もモバイルで読める大きさにする');
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
console.log('PASS legible on-screen squad names and tactical selection, 5x batched VFX, hair and outfit motion integrity');
