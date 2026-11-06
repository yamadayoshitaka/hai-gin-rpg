import assert from 'node:assert/strict';
import fs from 'node:fs';
import {combatEffectDirective} from '../src/combat-effect-directives.js';

const directive=e=>combatEffectDirective(e);
assert.deepEqual(directive({type:'objectAttack',objectType:'dragon'}),
  {kind:'breath',element:'fire',radius:.9},'古竜は口から炎ブレス');
assert.equal(directive({type:'objectAttack',objectType:'elder_dragon'}).element,'arcane',
  '天竜は専用の魔力ブレス');
assert.deepEqual(directive({type:'objectAttack',objectType:'dragon_lord'}),
  {kind:'breath',element:'fire',radius:1.65},'竜王は通常の古竜より大規模な炎ブレス');
assert.deepEqual(directive({type:'skill',jobId:'mage',skillKind:'damage',radius:4,effect:'fire'}),
  {kind:'area',element:'fire',radius:4},'魔法の実際の攻撃範囲をVFXに使う');
assert.deepEqual(directive({type:'skill',jobId:'priest',skillKind:'heal',radius:3,effect:'heal'}),
  {kind:'healArea',element:'nature',radius:3},'範囲回復も専用のVFX');
assert.equal(directive({type:'skill',jobId:'priest',skillKind:'revive'}).kind,'healArea');
assert.equal(directive({type:'skill',skillId:'grappling_hook'}).kind,'tether');
assert.equal(directive({type:'skill',jobId:'thief',skillId:'shadow_veil'}).kind,'stealth');
assert.equal(directive({type:'skill',skillId:'plant_c4'}).kind,'fuse');
assert.equal(directive({type:'spawn',objectType:'dynamite'}).kind,'fuse');
assert.deepEqual(directive({type:'explode',objectType:'c4',radius:3}),
  {kind:'explosion',element:'fire',radius:3},'C4の爆発半径は戦闘判定と同じ');

const families=['fire','earth','arcane','nature'];
for(const family of families)for(let i=1;i<=7;i++){
  const name=i===1?`${family}.png`:`${family}-${String(i).padStart(2,'0')}.png`;
  const path=`assets/vfx/user-imported/${name}`;
  const image=fs.readFileSync(path);
  assert.ok(image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
    `${family} library image frame ${i} missing`);
}
console.log('PASS 4 original 7-frame Library VFX animations / dragon breath / mage priest / C4 dynamite / ninja thief');
