import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {crowdProjectedHeight,useCrowdImpostor,crowdCardinalView} from '../src/crowd-lod-policy.js';

assert.ok(crowdProjectedHeight(1.78,900,48,8)>180,'近距離では元の高精細人物を使う');
assert.ok(crowdProjectedHeight(1.78,900,48,150)<14,'遠距離の小さな人物は低描画密度にできる');
assert.equal(useCrowdImpostor(51,false),true);
assert.equal(useCrowdImpostor(55,false),false,'高精細→遠距離の遷移に余裕を設ける');
assert.equal(useCrowdImpostor(55,true),true,'遠距離→高精細の遷移にヒステリシスがある');
assert.equal(useCrowdImpostor(65,true),false);
assert.equal(crowdCardinalView(0,1,0,5),0,'正面は正面の実人物画像');
assert.equal(crowdCardinalView(0,1,5,0),1,'右側は横顔の実人物画像');
assert.equal(crowdCardinalView(0,1,0,-5),2,'背面の画像を使う');
assert.equal(crowdCardinalView(0,1,-5,0),3,'左側の画像を使う');
assert.equal(crowdCardinalView(1,0,5,0),0,'兵士の向きが変わっても正面の画像を維持');

const army=readFileSync(new URL('../src/mass-battle-real-army.js',import.meta.url),'utf8');
const atlas=readFileSync(new URL('../src/crowd-impostor-atlas.js',import.meta.url),'utf8');
const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(atlas,/preview\.add\(person\)/,
  '遠景画像は近景と同じ、着衣済みの生きた実モデルから撮影する');
assert.match(atlas,/actor\.character\.play\(state\)/,'実際のリターゲット済みモーションを撮影する');
assert.match(atlas,/actor\.outfit\.sync\(\)/,'衣装を人体に合わせた後でGPU撮影する');
assert.match(atlas,/readRenderTargetPixels/,'生成した画像が空でないことをGPUから検査する');
assert.match(atlas,/const TILE=192/,'遠景では実体を高解像度で撮影して縮小する');
assert.match(atlas,/mix\(firstFrame,nextFrame,crowdWalkBlend\)/,'遠景の歩行2姿勢をGPU上で連続補間する');
assert.match(atlas,/const VIEWS=\[\[0,1\],\[1,0\],\[0,-1\],\[-1,0\]\]/);
assert.match(army,/await captureCrowdImpostorAtlas\(renderer,representative\)/);
assert.match(army,/visualMaterialKey\(original\)/,'同じ写真素材とPBR設定はUUIDが違っても一括描画する');
assert.match(army,/isInactiveHairLevel\(object,person\)/,'未選択の髪LODを重ねて焼き込まない');
assert.match(army,/if\(!bodyLayers\.length\)throw Error/,'遠景に切り替えても実人体の近景レイヤーは必須');
assert.match(army,/attribute vec4 crowdMotion/,'歩行位相・攻撃・被弾・転倒はGPU属性1スロットに集約');
assert.doesNotMatch(army,/attribute float crowdPhase/,'4個のfloat属性によるモバイルGPU上限超過を防ぐ');
assert.match(army,/MAX_VERTEX_ATTRIBS/,'GPUの頂点属性数を実機から取得する');
assert.match(army,/function stripUnusedVertexChannels/,'GLTFの未使用UV・頂点色を省いて実際の衣装・人体描画属性を削減する');
assert.match(army,/const channel=texture\.channel\?\?0/,'各写真テクスチャが利用するUVチャンネルは維持する');
assert.match(army,/u\.action==='blocked'\?visualTime\*1\.4/,'渋滞で足踏みしている兵士も表示フレームに合わせて自然に重心移動する');
assert.match(army,/visibleSoldiers\+=visible\+farVisible/,'近景＋遠景の全員を表示する');
assert.match(army,/bodyVisibleSoldiers\+=visible\+farVisible/,'衣装だけの表示は許さない');
assert.match(game,/massRenderer\.update\(massAlpha,massEndElapsed,creatureVisualTime\);/,
  '1/30秒制限を廃止し表示フレームごとに全員の移動を補間する');
assert.doesNotMatch(game,/massVisualAccumulator>=1\/30/);
assert.match(game,/renderer\.info\.autoReset=false/, 'FXAAパスを含む正しいDraw Call数を測る');
assert.match(game,/#massGamePerf::before\{content:\"v4\.4\.20 \| /,'戦闘中のFPS欄に最新版番号を常時表示する');
console.log('Live 50v50-rig 4-view/4-motion far LOD, silhouette audit, PBR material batching and per-frame motion PASS');
