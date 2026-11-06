import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BattleCorpsePolicy,corpseOpacity,DEFAULT_CORPSE_LIFETIME,MAX_RENDERED_CORPSES} from '../src/battle-corpse-policy.js';

assert.equal(DEFAULT_CORPSE_LIFETIME,60);
assert.equal(MAX_RENDERED_CORPSES,100);
assert.equal(corpseOpacity(0),1);
assert.equal(corpseOpacity(51),1,'倒れたままの姿を一定時間残す');
assert.ok(corpseOpacity(56)>0&&corpseOpacity(56)<1,'消える直前の8秒はフェードする');
assert.equal(corpseOpacity(60),0);
assert.equal(corpseOpacity(100,Infinity),1);

const policy=new BattleCorpsePolicy();
const units=Array.from({length:130},(_,id)=>({id,alive:false,deathAt:id*.1}));
const displayed=policy.visibleIds(units,20,7);
assert.equal(displayed.size,100,'大軍でも描画する死体は上限100体');
assert.equal(displayed.has(0),false,'古い死体から消す');
assert.equal(displayed.has(129),true,'新しい死体を優先する');
assert.equal(policy.opacity(units[0],20,displayed),0);
assert.equal(policy.opacity(units[129],20,displayed),1);
units[129].alive=true;
assert.equal(policy.opacity(units[129],20,displayed),1,'復活したキャラはそのまま可視');
const afterRevival=policy.visibleIds(units,20,8);
assert.equal(afterRevival.has(129),false,'復活したキャラは死体枠に数えない');

policy.setLifetime(30);
assert.equal(policy.visibleIds(units,42,8).size,8,'設定変更後は同じAI tickでも再選定');
policy.setLifetime(Infinity);
assert.equal(policy.visibleIds(units,10000,9).size,100,'消滅しない設定でも描画上限は維持する');
assert.throws(()=>policy.setLifetime(0),RangeError);

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const army=readFileSync(new URL('../src/mass-battle-real-army.js',import.meta.url),'utf8');
assert.match(game,/id="corpseLifetime"/,'ゲームメニューで死体時間を選べる');
assert.match(game,/controls\.enableDamping=false/,'スライド・ピンチ後のカメラ慣性移動を無効化');
assert.match(game,/corpsePolicy\.opacity\(massUnit,corpseTime,visibleCorpseIds\)/,'詳細人体の死体も上限対象');
assert.match(army,/corpsePolicy\.opacity\(u,corpseTime,visibleCorpseIds\)/,'GPU人体の死体も上限対象');
assert.match(army,/crowdCorpseOpacity/,'人体と衣装を同一シェーダでフェード');
assert.match(army,/u\.alive&&useCrowdImpostor/,'倒れた人体を立ち姿の写真LODに戻さない');
console.log('Battle corpse lifetime, bounded GPU rendering, revival and mobile camera gesture PASS');
