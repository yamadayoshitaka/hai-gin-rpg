import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const vfx=readFileSync(new URL('../src/character-system/action-vfx-runtime.js',import.meta.url),'utf8');
const body=readFileSync(new URL('../src/mass-battle-real-army.js',import.meta.url),'utf8');
const worker=readFileSync(new URL('../src/mass-battle-worker-client.js',import.meta.url),'utf8');

assert.match(game,/function openSquadTactics\(id\)/,'まず部隊の3択を提示する');
assert.match(game,/function beginSquadDestination\(id\)/);
const formationPanel=game.split('function openSquadTactics(id){')[1]?.split('function beginSquadDestination')[0];
assert.ok(formationPanel,'部隊編成画面を開ける');
assert.doesNotMatch(formationPanel,/setBattlePaused\(true\)/,
  '部隊編成の表示では進軍を止めず、HP詳細画面のみ任意停止する');
assert.match(game,/positionSquadMenuBelowLabel\(id,true\)/,'隊列ラベルの下に実行可能な号令・行き先・命令一覧を表示する');
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
assert.match(game,/#battleDock\{display:none!important\}/,'常時表示の下部命令欄は廃止する');
assert.match(game,/\$\('topRadarSlot'\)\.appendChild\(\$\('squadMiniMap'\)\)/,
  'レーダーはFPSと戦況表示の隣の同じ上部行に並ぶ');
assert.match(game,/document\.body\.appendChild\(\$\('squadTactics'\)\)/,
  '既存の号令・行き先・命令・HPを隊列ラベル直下のポップアップで表示する');
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
assert.match(game,/if\(focusHumanAt\(e\.clientX,e\.clientY\)\)return/,
  '人物をタップすると召喚獣と同様に人物へズームする');
assert.match(game,/const candidates=massSim\?massSim\.units:actors/,
  '多数のGPUインスタンス兵もタップ対象になる');
assert.match(game,/if\(labelHit\)/,
  '号令・行き先・命令は部隊ラベルから引き続き開ける');
assert.match(game,/if\(issueSquadOrder\('move',position\)\)finishSquadDestination\(true\)/);
assert.doesNotMatch(formationPanel,/setBattlePaused\(/,
  '部隊命令パネルを開閉しても戦闘の一時停止状態を変更しない');
assert.match(worker,/setPaused\(value\)\{paused=Boolean\(value\)/,
  '一時停止中はWorkerへ新しいAI tickを積まない');

assert.match(game,/accentMultiplier:5/);
assert.match(game,/id="squadMissionChoice"/,'第三の命令タブ');
assert.match(game,/id="squadMapCanvas"/,'画面外の行き先も全域マップに残す');
assert.match(game,/id="vitalsSquad"/,'HP/MP一覧の部隊絞り込み');
assert.match(game,/function openVitals\(squadId=null\)/,'HP詳細画面を開く');
assert.match(game,/vitalsPreviousPause=paused;setBattlePaused\(true\)/,'HP詳細を開くと戦闘停止');
assert.match(game,/function hasSquadCommander\(id\)/,'軍師不在では発令不可');
assert.match(game,/if\(leader\.active===false\)return '☠ 軍師戦死：命令不可（自動行動）'/,
  '配属済み軍師が戦死なら明示して指示不可');
assert.match(game,/const unavailable=squadCommanderUnavailableReason\(id\)/,
  '号令・行き先・作戦命令は軍師状態を検証する');
assert.match(game,/if\(unavailable\)\{log\(unavailable\);return false;\}/,
  '軍師が戦死した場合は理由を報告して号令を拒否する');
assert.match(game,/for\(const name of \['squadOrderChoice','squadDestination','squadMissionChoice'\]\)/,
  '三つの選択操作を一括で利用不可にする');
assert.match(game,/SQUAD_TYPE_NAMES\[squadTypeOf\(id\)\].*変更不可/,
  '戦闘中の部隊タイプを固定する');
assert.match(game,/actionVfx\.emitAccents\(kind,p,\{scale:/,
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
assert.match(game,/\$\('topPerformanceSlot'\)\.appendChild\(perf\)/,
  'FPSなどの計測パネルを下部指揮欄の外、統一上部パネルへ移動する');
assert.match(game,/createCharacter\(\{job:appearanceJob,sex/,
  'ゲームは外部モーション検証と同じ共有7頭身人体を生成する');
assert.match(game,/a\.outfit=await buildRiggedJobOutfit/,
  '共有衣装を使い、別のダミー衣装に置き換えない');
console.log('PASS contextual mobile squad popup, page transitions, top performance HUD, 1-/2-finger gestures, 5x VFX and outfit integrity');
