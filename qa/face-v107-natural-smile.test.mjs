import test from 'node:test';
import assert from 'node:assert/strict';
import {
 v107NeutralCheekDepth,v107SmileSkinDelta,v107LaughPulse
} from '../src/face-v107-natural-smile.js';
import {naturalLaughLipDelta} from '../src/face-v96-smile-cosmetics.js';
import {normalizeFemaleFaceControls,normalizeMaleFaceControls}
 from '../src/face-v7-controls.js';

test('v107 neutral female cheeks receive real forward relief; nose, lips, eyes, ear and rear remain unchanged',()=>{
 const cheek=(xn,yn,zn=1,ageStrength=0)=>
  v107NeutralCheekDepth({xn,yn,zn,depth:.20,ageStrength});
 const mid=cheek(.50,.515,.97);
 const left=cheek(-.50,.515,.97);
 const low=cheek(.50,.46,.97);
 assert.ok(mid>.002&&mid<.006,'Meaningful but bounded malar padding');
 assert.equal(mid,left,'Both real cheeks are symmetrical');
 assert.ok(low>0,'Lower cheek trough gets volume too');
 for(const [x,y,z] of [[0,.515,.97],[.27,.515,.97],
  [.81,.515,.97],[.5,.8,.97],[.5,.515,.20],[.5,.40,.97]]){
  assert.equal(cheek(x,y,z),0,'The protected face region must never shift');
 }
 assert.ok(cheek(.50,.515,.97,1)<mid,'Old-age fold remains legible');
});

test('v107 smile spreads mouth corners while raising cheek pad and lower eyelid, without resting-face deformation',()=>{
 const delta=(ax,ny,smile=.83,cheek=.70)=>
  v107SmileSkinDelta({ax,ny,front:1,mouthY:.509,smile,cheek});
 const neutral=delta(.12,.52,0,0);
 assert.deepEqual(neutral,{dxOut:0,dy:0,dz:0,
  cornerWeight:0,cheekWeight:0,lowerLidWeight:0});
 const corner=delta(.09,.516);
 assert.ok(corner.dxOut>.002&&corner.dy>0&&corner.dz>0,
  'Actual mouth-adjacent skin must move sideways, up, and forwards');
 const pad=delta(.205,.59);
 assert.ok(pad.dy>.004&&pad.dz>.004,'Malar cheek moves with smile');
 const lid=delta(.175,.656);
 assert.ok(lid.lowerLidWeight>.4,'Lower eyelid follows cheek uplift');
 const opposite=delta(-.09,.516);
 assert.deepEqual(opposite,corner,'Muscle field mirrors both sides');
 assert.deepEqual(v107SmileSkinDelta({ax:.09,ny:.51,front:0,smile:.8}),neutral);
});

test('v107 true native lip rim widens under grin without narrowing closed lips or producing V corners',()=>{
 const params={width:.052,height:.29,depth:.21,smile:.8,open:.88,cheek:.7};
 const old=naturalLaughLipDelta({...params,t:.9,sign:1});
 const wider=naturalLaughLipDelta({...params,t:.9,sign:1,
  smileWidthScale:1.48,cornerLiftScale:1.20});
 assert.ok(wider.dx>old.dx*1.35,'Lip corners spread on the real oral boundary');
 assert.ok(wider.cornerLift>old.cornerLift,'Corners lift with the cheeks');
 assert.equal(wider.opening,old.opening,'Retain the elliptical jaw aperture');
 const end=naturalLaughLipDelta({...params,t:1,sign:1,
  smileWidthScale:1.48,cornerLiftScale:1.2});
 assert.equal(end.opening,0,'The commissure cannot open into a pointed V');
 const closed=naturalLaughLipDelta({...params,t:.9,sign:1,smile:0,open:0,cheek:0,
  smileWidthScale:1.48,cornerLiftScale:1.2});
 assert.equal(closed.dx,0);assert.equal(closed.dy,0);
 const male=naturalLaughLipDelta({...params,t:.9,sign:1});
 assert.deepEqual(male,old,'Default v96/male remains exactly unchanged');
});

test('v107 calm rhythmic laugh has bounded moving jaw/cheek intensity',()=>{
 const samples=Array.from({length:30},(_,i)=>v107LaughPulse(i*.04));
 assert.ok(Math.max(...samples.map(x=>x.mouth))-
  Math.min(...samples.map(x=>x.mouth))>.06);
 for(const s of samples){
  assert.ok(s.mouth>=.92&&s.mouth<=1);
  assert.ok(s.smile>=.975&&s.smile<=1);
  assert.ok(s.cheek>=.96&&s.cheek<=1);
 }
});
test('v107 female neutral mouth defaults to 0.78, without rewriting the male or selected widths',()=>{
 assert.equal(normalizeFemaleFaceControls({}).mouthWidth,.78);
 assert.equal(normalizeFemaleFaceControls({mouthWidth:.93}).mouthWidth,.93);
 assert.equal(normalizeMaleFaceControls({}).mouthWidth,.65);
});
