import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {crowdProjectedHeight,useCrowdImpostor,crowdCardinalView} from '../src/crowd-lod-policy.js';

assert.ok(crowdProjectedHeight(1.78,900,48,8)>180,'近距離では元の高精細人物を使う');
assert.ok(crowdProjectedHeight(1.78,900,48,150)<14,'遠距離の小さな人物は低描画密度にできる');
assert.equal(useCrowdImpostor(26,false),true);
assert.equal(useCrowdImpostor(32,false),false,'高精細→遠距離の遷移に余裕を設ける');
assert.equal(useCrowdImpostor(32,true),true,'遠距離→高精細の遷移にヒステリシスがある');
assert.equal(useCrowdImpostor(36,true),false);
assert.equal(crowdCardinalView(0,1,0,5),0,'正面は正面の実人物画像');
assert.equal(crowdCardinalView(0,1,5,0),1,'右側は横顔の実人物画像');
assert.equal(crowdCardinalView(0,1,0,-5),2,'背面の画像を使う');
assert.equal(crowdCardinalView(0,1,-5,0),3,'左側の画像を使う');
assert.equal(crowdCardinalView(1,0,5,0),0,'兵士の向きが変わっても正面の画像を維持');

const army=readFileSync(new URL('../src/mass-battle-real-army.js',import.meta.url),'utf8');
const atlas=readFileSync(new URL('../src/crowd-impostor-atlas.js',import.meta.url),'utf8');
const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(atlas,/source\.getAttribute\(POSES\[row\]\)/,
  '遠景画像は実際の人体・衣装・武器と職業モーションから撮影する');
assert.match(atlas,/const POSES=\['position','crowdWalkA','crowdWalkB','crowdAttack'\]/);
assert.match(atlas,/const VIEWS=\[\[0,1\],\[1,0\],\[0,-1\],\[-1,0\]\]/);
assert.match(army,/captureCrowdImpostorAtlas\(renderer,materialMeshes\)/);
assert.match(army,/if\(!bodyLayers\.length\)throw Error/,'遠景に切り替えても実人体の近景レイヤーは必須');
assert.match(army,/visibleSoldiers\+=visible\+farVisible/,'近景＋遠景の全員を表示する');
assert.match(army,/bodyVisibleSoldiers\+=visible\+farVisible/,'衣装だけの表示は許さない');
assert.match(game,/massRenderer\.update\(massAlpha,massEndElapsed\);/,
  '1/30秒制限を廃止し表示フレームごとに全員の移動を補間する');
assert.doesNotMatch(game,/massVisualAccumulator>=1\/30/);
assert.match(game,/renderer\.info\.autoReset=false/, 'FXAAパスを含む正しいDraw Call数を測る');
console.log('Real-model 4-view/4-motion far LOD, near-body retention, camera-relative direction and per-frame motion PASS');
