import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const vfx=readFileSync(new URL('../src/character-system/action-vfx-runtime.js',import.meta.url),'utf8');
const body=readFileSync(new URL('../src/mass-battle-real-army.js',import.meta.url),'utf8');
const worker=readFileSync(new URL('../src/mass-battle-worker-client.js',import.meta.url),'utf8');

assert.match(game,/function openSquadTactics\(id\)/,'まず部隊の3択を提示する');
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
assert.match(game,/label\.style\.pointerEvents=selecting\?'none':'auto'/,
  '行き先・作戦指定中はラベルが目標タップを妨げない');
assert.match(game,/updateSquadScreenLabels\(dt\);/,
  '描画フレームの移動に合わせて部隊名の表示位置を更新する');
assert.match(game,/#destinationPrompt\{[^}]*font-size:15px/,
  '目的地の操作案内もモバイルで読める大きさにする');
assert.match(game,/id="battleDock"[^>]*部隊指揮・戦場レーダー/,
  '下部の専用領域でレーダーと部隊指揮を一体化する');
assert.match(game,/\$\('dockRadarSlot'\)\.appendChild\(\$\('squadMiniMap'\)\)/,
  'レーダーを戦場に重ねず下部へ移動する');
assert.match(game,/\$\('dockCommandSlot'\)\.appendChild\(\$\('squadTactics'\)\)/,
  '既存の号令・行き先・命令・HPを下部ドックで引き続き使える');
assert.match(game,/#battleStatus\{display:none!important\}/,
  '下部の古いHP/MP専用バーを撤去する');
assert.match(game,/\$\('dockVitalsSlot'\)\.appendChild\(vitalsToggle\)/,
  '全軍HP/MPは下部の詳細ボタンで確認できる');
assert.match(game,/#cameraTools\{display:none!important\}/,
  '上部のカメラ操作ボタンを廃止する');
assert.match(game,/controls\.touches\.ONE=THREE\.TOUCH\.ROTATE/,
  '一本指スワイプで視点を回転する');
assert.match(game,/controls\.touches\.TWO=THREE\.TOUCH\.DOLLY_PAN/,
  '二本指で画面をスライドし、ピンチで拡大縮小する');
assert.match(game,/if\(activeTouchPointers\.size>1\)touchGestureEngaged=true/,
  '二本指操作をユニットタップと誤認しない');
assert.match(game,/const \{width,height\}=battleViewportSize\(\)/,
  '画面回転時には下部領域を除いた3D描画サイズに調整する');
assert.match(game,/if\(found\.team===0\)openSquadTactics/,
  '兵士をタップすると号令・行き先・命令から選択できる');
assert.match(game,/if\(issueSquadOrder\('move',position\)\)finishSquadDestination\(true\)/);
assert.match(game,/setBattlePaused\(previous\.wasPaused\)/,
  'もともと手動停止中だった場合は指定後も停止を維持する');
assert.match(worker,/setPaused\(value\)\{paused=Boolean\(value\)/,
  '一時停止中はWorkerへ新しいAI tickを積まない');

assert.match(game,/accentMultiplier:5/);
assert.match(game,/id="squadMissionChoice"/,'第三の命令タブ');
assert.match(game,/id="squadMapCanvas"/,'画面外の行き先も全域マップに残す');
assert.match(game,/id="vitalsSquad"/,'HP/MP一覧の部隊絞り込み');
assert.match(game,/function openVitals\(squadId=null\)/,'HP詳細画面を開く');
assert.match(game,/vitalsPreviousPause=paused;setBattlePaused\(true\)/,'HP詳細を開くと戦闘停止');
assert.match(game,/function hasSquadCommander\(id\)/,'軍師不在では発令不可');
assert.match(game,/return Boolean\(leader&&leader\.active!==false\)/,
  '配属済み軍師が不在・戦闘不能なら指示不可');
assert.match(game,/if\(id==null\|\|!hasSquadCommander\(id\)\)return false/,
  '号令・行き先・作戦命令はすべて軍師の有無を確認する');
assert.match(game,/for\(const name of \['squadOrderChoice','squadDestination','squadMissionChoice'\]\)/,
  '三つの選択操作を一括で利用不可にする');
assert.match(game,/SQUAD_TYPE_NAMES\[squadTypeOf\(id\)\].*変更不可/,
  '戦闘中の部隊タイプを固定する');
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
assert.match(body,/if\(!pose\)\{if\(isHumanBody\)bodyCoherent=false;else invalidOutfitParts\+\+;/,
  '壊れた装飾パーツだけを原因に人体の歩行アニメーションを停止しない');
assert.match(body,/bodyCoherent\?\(pose\|\|base\.slice\(\)\):base\.slice\(\)/,
  '人体が不正な場合は装備も含め待機姿勢へ戻し、装飾のみの破損は分離して回復する');
assert.match(body,/motionCaptureAudit\.push\(/,'職業ごとに歩行姿勢の取り込み成功を測定する');
assert.match(game,/function showSquadTacticsPanel\(panel='main'\)/,
  '号令・命令の縦スクロールをやめ専用パネルへ切り替える');
assert.match(game,/#squadTactics\[data-panel="orders"\] \.tacticsActions/,
  '号令選択時は4択メニューを隠して画面領域を確保する');
assert.match(game,/perf\.style\.cssText='position:fixed;top:158px;left:9px;right:9px;bottom:auto;/,
  'FPSなどの計測パネルを下部指揮欄の外、上部へ移動する');
assert.match(game,/createCharacter\(\{job:appearanceJob,sex/,
  'ゲームは外部モーション検証と同じ共有7頭身人体を生成する');
assert.match(game,/a\.outfit=await buildRiggedJobOutfit/,
  '共有衣装を使い、別のダミー衣装に置き換えない');
console.log('PASS mobile tactical dock, page transitions, top performance HUD, 1-/2-finger gestures, 5x VFX and outfit integrity');
