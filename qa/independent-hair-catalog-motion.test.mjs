import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {
 INDEPENDENT_HAIR_CATALOG,ALL_INDEPENDENT_HAIR,HAIR_SECTIONS,
 normalizeHeadSize,independentHairFit,createHairSpring,classifyHairTriangle
} from '../src/independent-hair-library-v1.js';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('female / male hairstyles are detached assets with complete source files',()=>{
 assert.equal(INDEPENDENT_HAIR_CATALOG.female.length,12);
 assert.equal(INDEPENDENT_HAIR_CATALOG.male.length,14);
 assert.equal(new Set(ALL_INDEPENDENT_HAIR.map(x=>x.id)).size,26);
 for(const style of ALL_INDEPENDENT_HAIR){
  assert.ok(style.separateFromFace);
  assert.ok(existsSync(new URL(style.path.replace(/^\.\//,''),root)),style.path);
 }
 assert.ok(read('assets/characters/hair-fitted-v1/ATTRIBUTION.md').includes('CC BY 4.0'));
});
test('fitting responds to head geometry without stretching the full haircut length',()=>{
 const box={min:{x:-.14,y:-.58,z:-.19},max:{x:.14,y:.025,z:.17}};
 const a=independentHairFit(box,{width:.19,height:.22,depth:.18});
 const b=independentHairFit(box,{width:.25,height:.29,depth:.25});
 assert.ok(b.scale[0]>a.scale[0]);
 assert.ok(b.scale[1]>a.scale[1]);
 assert.ok(b.scale[2]>a.scale[2]);
 assert.ok(b.crownY>a.crownY);
 assert.ok(Math.abs(a.position[1]+box.max.y*a.scale[1]-a.crownY)<1e-9);
 assert.equal(normalizeHeadSize({width:100}).width,.34);
 assert.throws(()=>independentHairFit({min:box.max,max:box.min}));
});
test('sway springs are bounded, return to neutral, and preserve the no-motion rest state',()=>{
 const spring=createHairSpring();
 assert.equal(spring.step({dt:1/60}).x,0);
 let at=0;
 for(let i=0;i<80;i++)at=spring.step({dt:1/60,velocityX:3,turnSpeed:2}).x;
 assert.ok(at<0 && at>=-.075,'hair tips trail movement');
 let last=0;
 for(let i=0;i<250;i++)last=spring.step({dt:1/60}).x;
 assert.ok(Math.abs(last)<.0004);
 spring.reset();assert.equal(spring.step().x,0);
});
test('parts are split in five independently selectable spatial sections',()=>{
 assert.deepEqual(HAIR_SECTIONS.map(p=>p.id),['crown','fringe','left','right','back']);
 const box={min:{x:-.14,y:-.59,z:-.15},max:{x:.14,y:.025,z:.15}};
 assert.equal(classifyHairTriangle(0,.015,0,box,.2),'crown');
 assert.equal(classifyHairTriangle(0,-.1,.13,box,.2),'fringe');
 assert.equal(classifyHairTriangle(-.13,-.2,0,box,.2),'left');
 assert.equal(classifyHairTriangle(.13,-.2,0,box,.2),'right');
 assert.equal(classifyHairTriangle(0,-.25,-.13,box,.2),'back');
});
test('standalone studio includes GLB preview, head fit, moving tips and isolated face navigation',()=>{
 const html=read('hair-asset-studio.html');
 const mesh=read('src/independent-hair-mesh-v1.js');
 assert.match(html,/OrbitControls/);
 assert.match(html,/createHairSpring/);
 assert.match(html,/face-neutral-v121\.html/);
 assert.match(html,/setExploded/);
 assert.match(html,/setSectionColors/);
 assert.match(html,/setColor/);
 assert.match(mesh,/geometryPart\.setIndex\(buckets\[id\]\)/);
 assert.match(mesh,/free=clamp/);
 assert.doesNotMatch(mesh,/face\.geometry\s*=/);
});
