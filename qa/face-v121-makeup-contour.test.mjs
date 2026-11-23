import test from 'node:test';
import assert from 'node:assert/strict';
import {v121MakeupMasks,V121_MAKEUP_PRESETS}
  from '../face-v121-makeup-presets.js';

test('v121 pigments stay on real upper and lower vermilion, not chin or jaw',()=>{
  const upper=v121MakeupMasks(0,.208,.150);
  const lower=v121MakeupMasks(0,.185,.150);
  const chin=v121MakeupMasks(0,.140,.155);
  const jaw=v121MakeupMasks(.080,.157,.128);
  const neck=v121MakeupMasks(.045,.045,.060);
  const nose=v121MakeupMasks(0,.252,.153);
  assert.ok(upper.lip>.65,'upper vermilion must accept pigment');
  assert.ok(lower.lip>.85,'lower vermilion must accept pigment');
  for(const [name,mask] of Object.entries({chin,jaw,neck,nose})){
    assert.ok(mask.lip<.0001,name+' must not receive lipstick');
  }
  assert.ok(v121MakeupMasks(0,.185,.090).lip===0,
    'lip pigment must not seep through underlying back-facing skin');
});

test('all four lipsticks have an absolute exclusion mask at chin, jaw and neck',()=>{
  const excluded=[
    [0,.130,.156], [.026,.160,.154], [.075,.154,.128],
    [.043,.045,.060], [0,.170,.150], [.054,.190,.155],
    [0,.197,.110], [0,.224,.153]
  ];
  for(const [x,y,z] of excluded){
    const mask=v121MakeupMasks(x,y,z);
    assert.equal(mask.lip,0,'lipstick leaked at '+[x,y,z].join(','));
    for(const id of ['natural','pink','brown','glamorous']){
      assert.equal(mask.lip*V121_MAKEUP_PRESETS[id].lip,0,
        id+' lipstick must not tint chin/jaw/neck');
    }
  }
  assert.equal(v121MakeupMasks(0,.130,.155).blush,0);
  assert.equal(v121MakeupMasks(.076,.160,.135).blush,0);
});

test('v121 blush is cheek-localized and all preset lipstick stays natural',()=>{
  const cheek=v121MakeupMasks(.076,.257,.135);
  const chin=v121MakeupMasks(0,.130,.147);
  assert.ok(cheek.blush>.5,'blush should still be visible');
  assert.ok(chin.blush<.0001,'blush must not fall on the chin');
  assert.ok(V121_MAKEUP_PRESETS.natural.lip<V121_MAKEUP_PRESETS.glamorous.lip);
  assert.ok(V121_MAKEUP_PRESETS.glamorous.lip<.8,
    'dramatic preset must not produce clown-red lipstick');
  assert.equal(V121_MAKEUP_PRESETS.bare.lip,0);
});
