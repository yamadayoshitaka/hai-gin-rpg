import test from 'node:test';
import assert from 'node:assert/strict';
import {v121MakeupMasks,v121VermilionBorders,V121_MAKEUP_PRESETS}
  from '../face-v121-makeup-presets.js';

test('v121 pigments stay on real upper and lower vermilion, not chin or jaw',()=>{
  const upper=v121MakeupMasks(0,.2375,.150);
  const lower=v121MakeupMasks(0,.228,.150);
  const chin=v121MakeupMasks(0,.140,.155);
  const jaw=v121MakeupMasks(.080,.157,.128);
  const neck=v121MakeupMasks(.045,.045,.060);
  const nose=v121MakeupMasks(0,.252,.153);
  assert.ok(upper.lip>.65,'upper vermilion must accept pigment');
  assert.ok(lower.lip>.65,'smaller lower vermilion must accept pigment');
  for(const [name,mask] of Object.entries({chin,jaw,neck,nose})){
    assert.ok(mask.lip<.0001,name+' must not receive lipstick');
  }
  assert.ok(v121MakeupMasks(0,.225,.090).lip===0,
    'lip pigment must not seep through underlying back-facing skin');
});

test('all four lipsticks have an absolute exclusion mask at chin, jaw and neck',()=>{
  const excluded=[
    [0,.130,.156], [.026,.160,.154], [.075,.154,.128],
    [.043,.045,.060], [0,.170,.150], [.054,.190,.155],
    [0,.197,.110], [0,.208,.153]
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

test('v20 smaller Cupid M and curved bottom edge make a bounded tapered lip mask',()=>{
  const center=v121VermilionBorders(0);
  const left=v121VermilionBorders(-.0115);
  const right=v121VermilionBorders(.0115);
  const corner=v121VermilionBorders(.048);
  assert.ok(left.upper>center.upper+.002,'left Cupid peak');
  assert.ok(right.upper>center.upper+.002,'right Cupid peak');
  assert.ok(Math.abs(left.upper-right.upper)<1.e-10,'symmetric M peaks');
  assert.ok(corner.upper<center.upper-.010,'upper vermilion must converge to corner');
  assert.ok(corner.lower>center.lower+.008,'lower rim converges to corner');
  assert.ok(v121MakeupMasks(.048,.231,.150).lip<
            v121MakeupMasks(0,.231,.150).lip*.5,'lip pigment tapers');
  assert.ok(v121MakeupMasks(.011,.2425,.150).lip>.09,
            'lifted Cupid peaks must not render as unpigmented skin');
  assert.ok(v121MakeupMasks(0,.2375,.150).lip>.75,
            'upper vermilion is visibly within the pigment mask');
  assert.ok(center.upper-center.lower<.020,'neutral lips must shrink from v19 max height');
  for(const coord of [[0,.254,.150],[0,.209,.150],
                       [.060,.230,.150],[.038,.253,.150],
                       [0,.208,.153]]){
    assert.equal(v121MakeupMasks(...coord).lip,0,
      'no painted second lip or skin spill at '+coord.join(','));
  }
});

test('v26 smaller upper lip excludes old oversized border',()=>{assert.equal(v121MakeupMasks(0,.246,.150).lip,0);assert.ok(v121VermilionBorders(0).upper<.243);});
