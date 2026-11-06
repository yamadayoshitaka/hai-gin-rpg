import assert from 'node:assert/strict';
import {CREATURE_PERFORMANCE,FLYING_CREATURE_ATTACK_RATE,creatureAttackProgress,creatureFlightHeight,creatureSize,mountableCreature,riderSeatHeight} from '../src/combat-creature-performance.js';
import {createCreatureSoundRuntime,synthesizeCreatureVoice} from '../src/combat-creature-sounds.js';

const species=['wolf','wyvern','dragon','elder_dragon','horse'];
const fingerprints=new Set();
for(const type of species){
  const profile=CREATURE_PERFORMANCE[type];
  assert.ok(profile?.attack&&profile.duration>profile.windup&&profile.windup>0,type+' の専用攻撃時間');
  assert.ok(profile.seat>0&&profile.scaleWhenMounted>0,type+' の騎乗位置');
  for(const kind of ['spawn','attack','hit']){
    const pcm=synthesizeCreatureVoice(type,{kind,sampleRate:12000});
    assert.ok(pcm.length>1000&&pcm instanceof Float32Array,type+' / '+kind+' の音声');
    let peak=0,sum=0;
    for(const sample of pcm){assert.ok(Number.isFinite(sample));peak=Math.max(peak,Math.abs(sample));sum+=sample*sample;}
    assert.ok(peak>.1&&peak<1&&sum>10,type+' / '+kind+' の可聴振幅');
    if(kind==='spawn')fingerprints.add(pcm.slice(0,300).reduce((x,n)=>x+n*n,0).toFixed(7));
  }
  const object={id:type,type,category:type==='horse'?'mount':'summon',alive:true,flying:['wyvern','dragon','elder_dragon'].includes(type),attackStartedAt:3};
  assert.equal(mountableCreature(object),true,type+' は独立オブジェクトとして騎乗可能');
  assert.equal(creatureAttackProgress(object,2),0);
  const rate=object.flying?FLYING_CREATURE_ATTACK_RATE:1;
  assert.ok(creatureAttackProgress(object,3+profile.windup/rate)>0);
  assert.equal(creatureAttackProgress(object,5),0);
  assert.ok(riderSeatHeight(object,1)>0);
  assert.ok(creatureSize(type,true)>=1);
  if(object.flying)assert.ok(creatureFlightHeight(object,1)>2,'飛行時も騎手が浮遊位置を追従する');
  object.alive=false;
  assert.equal(mountableCreature(object),false,'戦闘不能の乗り物には乗れない');
}
assert.equal(FLYING_CREATURE_ATTACK_RATE,5,'飛空召喚獣の攻撃アニメーション頻度は5倍');
assert.equal(fingerprints.size,species.length,'鳴き声は獣種ごとに異なる波形');
const sound=createCreatureSoundRuntime();
assert.equal(sound.unlock(),false,'ブラウザー外では AudioContext を要求しない');
assert.equal(sound.play('wolf','attack'),false,'未解放の音声は安全に無音でスキップ');
sound.dispose();
console.log('5種の騎乗高さ / 種類別攻撃の命中時間 / 5種×3の鳴き声波形 OK');
