import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
 FACE_PROPORTION_FIELDS,FACE_PROPORTION_DEFAULTS,FACE_XYZ_FIELDS,
 validateFaceProportions,warpFaceThirds,deformFacePoint
} from '../src/master-swordsman-face-proportions.js';
import {prepareYouthfulFace} from '../src/master-swordsman-youthful-face.js';
import {featuredSwordsmanProfile} from '../src/master-swordsman-featured-profiles.js';
import {createSwordsmanAppearance,validateAppearanceOverrides}
 from '../src/master-swordsman-1000-appearance.js';

test('all 55 facial and XYZ sliders have distinct bounded names and stable neutral defaults',()=>{
 assert.equal(FACE_PROPORTION_FIELDS.length,55);
 assert.equal(FACE_XYZ_FIELDS.length,18);
 assert.equal(new Set(FACE_PROPORTION_FIELDS.map(f=>f[0])).size,55);
 const grouped=new Set(FACE_PROPORTION_FIELDS.map(f=>f[5]));
 assert.deepEqual([...grouped],['顔・3等分','目','眼球・虹彩','まぶた・目の下','眉','鼻','口','位置XYZ']);
 const defaults=validateFaceProportions({});
 assert.equal(Object.isFrozen(defaults),true);
 for(const [key,,min,max,neutral] of FACE_PROPORTION_FIELDS){
  assert.ok(min<max&&neutral>=min&&neutral<=max,key);
  assert.equal(defaults[key],neutral);
  assert.equal(validateFaceProportions({[key]:min})[key],min,key+' lower');
  assert.equal(validateFaceProportions({[key]:max})[key],max,key+' upper');
  assert.throws(()=>validateFaceProportions({[key]:min-.001}),/range/);
  assert.throws(()=>validateFaceProportions({[key]:max+.001}),/range/);
  assert.throws(()=>validateFaceProportions({[key]:NaN}),/range/);
 }
 assert.throws(()=>validateFaceProportions({unknownAxis:1}),/Unknown/);
 assert.throws(()=>validateFaceProportions(null),/object/);
});
test('face thirds warp continuously and monotonically while fixing hairline and chin',()=>{
 const a=validateFaceProportions({upperThird:1.19,middleThird:.83,lowerThird:1.15});
 assert.equal(warpFaceThirds(.12,a),.12);
 assert.equal(warpFaceThirds(.93,a),.93);
 assert.ok(Math.abs(warpFaceThirds(.70,a)-.70)>.01,'Brow boundary must move');
 assert.ok(Math.abs(warpFaceThirds(.38,a)-.38)>.01,'Nasal boundary must move');
 let previous=warpFaceThirds(.12,a);
 for(let i=1;i<=810;i++){
  const mapped=warpFaceThirds(.12+i*.001,a);
  assert.ok(mapped>=previous-.000001,'Fold in face-thirds geometry at '+i);
  previous=mapped;
 }
 assert.ok(Math.abs(warpFaceThirds(.70,a)-warpFaceThirds(.70,FACE_PROPORTION_DEFAULTS))>.01);
});
test('real 3D nose, lips and face length deform different source regions',()=>{
 const box={min:{x:-.16,y:-.18,z:-.12},max:{x:.16,y:.20,z:.13}};
 const point=(x,y,z,p)=>deformFacePoint(x,y,z,box,p);
 const nasal={x:.025,y:.045,z:.112},lip={x:.045,y:-.028,z:.117};
 const baseN=point(...Object.values(nasal),FACE_PROPORTION_DEFAULTS);
 const baseL=point(...Object.values(lip),FACE_PROPORTION_DEFAULTS);
 const narrow=validateFaceProportions({noseWidth:.7,noseBridge:1.25,noseTip:.7,noseLength:.80});
 const smallMouth=validateFaceProportions({mouthWidth:.7,mouthVertical:.03,lipFullness:.7});
 const nose=point(...Object.values(nasal),narrow);
 const mouth=point(...Object.values(lip),smallMouth);
 assert.ok(Math.abs(nose.x-baseN.x)>.0001,'Nose X must move');
 assert.ok(Math.abs(nose.z-baseN.z)>.0001,'Nose projection must move');
 assert.ok(Math.abs(mouth.x-baseL.x)>.0001,'Mouth width must move');
 assert.ok(Math.abs(mouth.y-baseL.y)>.0001,'Mouth vertical position must move');
 assert.ok(Math.abs(mouth.z-baseL.z)>.0001,'Lip fullness must move');
 const back={x:0,y:.05,z:-.12};
 const neutralBack=point(...Object.values(back),FACE_PROPORTION_DEFAULTS);
 const alteredBack=point(...Object.values(back),narrow);
 assert.ok(Math.abs(neutralBack.x-alteredBack.x)<1e-9,'Do not distort rear face with nose slider');
});
test('changing and restoring facial ratios does not accumulate changes or edit source GLB',()=>{
 const root=new THREE.Group();
 const original=new THREE.SphereGeometry(.19,64,40);
 const source=original.getAttribute('position').array.slice();
 const head=new THREE.Mesh(original,new THREE.MeshStandardMaterial());head.name='GEO-head_animation_realistic';
 root.add(head);
 const face=prepareYouthfulFace(root);
 const youth=.92;
 const a=face.apply(youth,FACE_PROPORTION_DEFAULTS);
 const baseline=head.geometry.getAttribute('position').array.slice();
 const custom=validateFaceProportions({faceHeight:1.08,middleThird:.82,noseWidth:.70,mouthWidth:.80});
 const b=face.apply(youth,custom);
 assert.notEqual(b.geometryDigest,a.geometryDigest,'Real head geometry digest did not change');
 assert.ok(b.modifiedVertices>a.modifiedVertices*.6);
 const c=face.apply(youth,FACE_PROPORTION_DEFAULTS);
 assert.equal(c.geometryDigest,a.geometryDigest,'Reset does not restore exact source-relative geometry');
 assert.deepEqual(head.geometry.getAttribute('position').array,baseline,'Nondeterministic cumulative deform');
 assert.deepEqual(original.getAttribute('position').array,source,'Source mesh was mutated');
 head.geometry.dispose();original.dispose();head.material.dispose();
});
test('hero-01 preset remains unique, editable and separated from soldiers',()=>{
 const hero=featuredSwordsmanProfile('hero-01');
 const original=structuredClone(hero.proportions);
 assert.ok(hero.proportions.middleThird<1&&hero.proportions.noseWidth<1);
 assert.equal(hero.proportions.mouthWidth<1,true);
 const chosen=validateAppearanceOverrides(hero,{proportions:{noseLength:1.11,mouthWidth:.8}});
 assert.equal(chosen.proportions.noseLength,1.11);
 assert.equal(chosen.proportions.mouthWidth,.8);
 assert.equal(chosen.proportions.eyeWidth,original.eyeWidth,'Other values were overwritten');
 assert.deepEqual(hero.proportions,original,'Featured prototype must stay immutable');
 assert.deepEqual(createSwordsmanAppearance(0).proportions,FACE_PROPORTION_DEFAULTS);
 assert.throws(()=>validateAppearanceOverrides(hero,{proportions:{noseLength:9}}),/range/);
 assert.equal(hero.artGradeCertified,false);
});

test('all six anatomical XYZ groups support independent reversible axes with millimetre precision',()=>{
 const names=['eye','iris','pupil','upperLid','lowerLid','brow'];
 for(const part of names){
  const fields=['X','Y','Z'].map(axis=>part+'Offset'+axis);
  for(const key of fields){
   const def=FACE_XYZ_FIELDS.find(row=>row[0]===key);
   assert.ok(def,'Missing XYZ axis '+key);
   assert.equal(def[4],0,'Offsets should not accumulate');
   const v=def[3]/2;
   const edited=validateFaceProportions({[key]:v});
   assert.equal(edited[key],Number(v.toFixed(4)));
   assert.equal(validateFaceProportions({[key]:0},edited)[key],0);
  }
 }
 assert.deepEqual(
  validateFaceProportions(Object.fromEntries(FACE_XYZ_FIELDS.map(([key])=>[key,0]))),
  FACE_PROPORTION_DEFAULTS);
});
import {polishHeroineFacePoint,HEROINE_FACE_POLISH_VERSION}
 from '../src/master-heroine-facial-refinement.js';

test('heroine 3D cheek sculpt gently narrows lower cheeks without tapering chin to a point',()=>{
 const box={min:{x:-.16,y:-.18,z:-.12},max:{x:.16,y:.20,z:.13}};
 const v=(x,y,z)=>polishHeroineFacePoint(x,y,z,box);
 const cheek=v(.105,-.012,.11),original={x:.105,y:-.012,z:.11};
 const negative=v(-.105,-.012,.11);
 assert.ok(cheek.x<original.x-.001,'Lower cheek must lose lateral bulge');
 assert.ok(cheek.z<original.z,'Lower cheek must not protrude from front view');
 assert.ok(Math.abs(cheek.x+negative.x)<1e-10,'Cheek outline must remain bilateral');
 assert.ok(Math.abs(cheek.z-negative.z)<1e-10,'Cheek depth should stay symmetric');
 assert.ok(Math.abs(cheek.x-original.x)<.016,'Do not create overwide jaw');
 const chin=v(0,-.12,.11);
 assert.equal(chin.x,0,'Do not pinch or shift the centre of the chin');
 assert.deepEqual(v(.105,-.012,-.12),{x:.105,y:-.012,z:-.12},
  'No changes to rear skull');
 assert.equal(typeof HEROINE_FACE_POLISH_VERSION,'string');
});
test('heroine 3D nose and mouth use subtle separate anatomical surface changes',()=>{
 const box={min:{x:-.16,y:-.18,z:-.12},max:{x:.16,y:.20,z:.13}};
 const v=(x,y,z)=>polishHeroineFacePoint(x,y,z,box);
 const nose=v(.015,.033,.11),lip=v(.025,.014,.11);
 assert.ok(nose.z>.1104,'Nose tip should be real 3D surface detail');
 assert.ok(lip.z>.1104,'Lips should be real 3D surface detail');
 assert.ok(nose.z<.12&&lip.z<.12,'No artificial protruding nose/lip plates');
 const noOp=polishHeroineFacePoint(.025,.014,.11,box,{strength:0});
 assert.deepEqual(noOp,{x:.025,y:.014,z:.11},
  'Refinement must support exact restoration');
});

test('heroine lower cheek is continuously round, while nostrils and mouth corners retain fine 3D detail',()=>{
 const box={min:{x:-.16,y:-.18,z:-.12},max:{x:.16,y:.20,z:.13}};
 const fit=(x,y,z=.11)=>polishHeroineFacePoint(x,y,z,box);
 const upper=fit(.102,-.007),lower=fit(.104,-.055);
 assert.ok(upper.x<.102,'Upper cheek must stop bulging sideways');
 assert.ok(lower.x<.104,'Lower cheek transitions inward to the jaw');
 assert.ok(upper.x>.087&&lower.x>.085,'Narrow cheeks must retain a smooth natural contour');
 const noseWing=fit(.037,.016);
 assert.ok(noseWing.x<.037,'Nose wing must be slightly narrower, not widened by cheek shaping');
 const mouthCorner=fit(.062,.013);
 assert.ok(mouthCorner.y>.013,'Mouth corner is lifted on the actual lip region');
 const reverse=fit(-.104,-.055);
 assert.ok(Math.abs(reverse.x+lower.x)<1e-10,'Left and right cheeks mirror exactly');
 assert.deepEqual(fit(.104,-.055,-.12),{x:.104,y:-.055,z:-.12},
  'Back-of-head geometry must remain identical');
});

test('slim Pages can display original CC0 heroine masters, not a missing archive URL',async()=>{
 const {readFile}=await import('node:fs/promises');
 const html=await readFile(new URL('../master-swordsman-prototype.html',import.meta.url),'utf8');
 assert.match(html,/location\.hostname\.endsWith\('\.github\.io'\)/);
 assert.match(html,/raw\.githubusercontent\.com\/yamadayoshitaka\/hai-gin-rpg\/main\/assets\/master-sources\/blender/);
 assert.match(html,/qs\.get\('view'\)==='face'/);
 assert.match(html,/qs\.get\('featured'\)/);
});

test('boy and girl presets use different measured facial proportions, with original masters unapproved',()=>{
 const boy=featuredSwordsmanProfile('hero-01');
 const girl=featuredSwordsmanProfile('hero-girl-01');
 assert.equal(boy.gender,'male');
 assert.equal(girl.gender,'female');
 assert.equal(girl.headSource,'realistic-head-sculpt');
 assert.ok(girl.proportions.cheekRoundness>boy.proportions.cheekRoundness);
 assert.ok(girl.proportions.cheekRoundness<=1.25,
  'Girl silhouette is guarded against an oversized cartoon jaw');
 assert.ok(girl.proportions.jawTaper>=.88&&girl.proportions.jawTaper<=1.05,
  'Jaw sculpt must stay close to the real source');
 assert.ok(girl.proportions.noseWidth>=.78&&girl.proportions.noseWidth<=.88,
  'Nose should remain natural after emergency rollback');
 assert.notEqual(girl.hairStyle,boy.hairStyle);
 assert.equal(boy.facialArtistApproval,false);
 assert.equal(girl.facialArtistApproval,false);
 assert.equal(girl.artGradeCertified,false);
 assert.ok(girl.id>=1000);
 const changed=validateAppearanceOverrides(girl,{proportions:{irisOffsetY:.002,browOffsetZ:-.003}});
 assert.equal(changed.proportions.irisOffsetY,.002);
 assert.equal(changed.proportions.browOffsetZ,-.003);
 assert.equal(girl.proportions.irisOffsetY,0,'Featured preset was mutated');
 const bare=validateAppearanceOverrides(girl,{makeup:{strength:0}});
 assert.equal(bare.makeup.strength,0);
 assert.equal(girl.makeup.strength,.83,'Makeup toggle must not mutate authored default');
 const on=validateAppearanceOverrides(bare,{makeup:{strength:.93}});
 assert.equal(on.makeup.strength,.93);
 assert.throws(()=>validateAppearanceOverrides(boy,{makeup:{strength:1}}),/only available/);
 assert.throws(()=>validateAppearanceOverrides(girl,{makeup:{strength:2}}),/out of range/);
});
