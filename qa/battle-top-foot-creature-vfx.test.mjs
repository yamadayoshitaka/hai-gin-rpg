import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COMBAT_OBJECT_SPECS,COMBAT_RULES} from '../src/combat-action-spec.js';

const load=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const game=load('../tactics-wireframe.html');
const feet=load('../src/character-system/shared-character-runtime.js');
const combat=load('../src/combat-action-runtime.js');
const vfx=load('../src/character-system/action-vfx-runtime.js');

assert.match(feet,/inverseCharacterWorld\.copy\(object3D\.matrixWorld\)\.invert\(\)/,
  '足接地は地形の高さを除いたモデルローカル空間で測る');
assert.match(feet,/footPoint\.applyMatrix4\(inverseCharacterWorld\)/,
  '各足の骨座標も同じローカル空間に変換する');
assert.match(feet,/groundedModelY\(model\.position\.y,baselineY,restFootY,lowestFoot\(\),height\)/,
  '足接地補正は最新のモデル位置に加算し、埋没を半分残さない');
assert.match(game,/id="battleTopDock"/,'上部のまとめパネル');
assert.match(game,/id="allyCasualties"/,'味方の戦闘不能数');
assert.match(game,/id="enemyCasualties"/,'敵の戦闘不能数');
assert.match(game,/initialCounts\[0\]-aliveCounts\[0\]/,
  '負傷や蘇生で変化する現在の戦闘不能人数を数える');
assert.match(game,/\$\('topQuickActions'\)\.appendChild\(\$\('battleMenuToggle'\)\)/,
 'Gear menu moved away from the radar to the right-side quick actions');
assert.match(game,/\$\('topTeamsSlot'\)\.appendChild\(\$\('teamLegend'\)\)/);
assert.match(game,/\$\('topStructureSlot'\)\.appendChild\(structureHealth\)/);

for(const species of ['wolf','wyvern','dragon','elder_dragon','horse']){
  assert.ok(COMBAT_OBJECT_SPECS[species].speed>=5.8,`${species}の高速移動`);
}
assert.ok(COMBAT_RULES.mountedSpeedMultiplier>=3,'騎兵は通常歩行の3倍以上の移動力');
assert.ok(COMBAT_RULES.summonLeashTiles>=20,'召喚獣は遠方の敵も追撃する');
assert.match(combat,/for\(let step=0;step<3&&o\.moveAccum>=1;step\+\+\)/,
  '高速でも中間マスの当たり判定を省略しない');

assert.match(vfx,/for\(const kind of Object\.keys\(ACTION_EFFECT_TEXTURES\)\)/,
  '取り込み済み高品質PNGを戦闘開始前に先読みする');
assert.match(vfx,/map:this\.accentTexture\|\|null/,
  '素材読み込み中も真四角のスプライトを出さない');
assert.match(vfx,/emitSlashArc\(point,target/,'斬撃が剣先に沿った曲線を描く');
assert.match(vfx,/SPRITE_ASPECT\[kind\]/,'横長の斬撃画像を正しい縦横比で描く');
assert.match(vfx,/this\.effects\.length>=this\.maxEffects/,'描画エフェクト数は上限内');
console.log('Battle top dock, local-space foot grounding, fast mounts/summons and layered VFX PASS');
