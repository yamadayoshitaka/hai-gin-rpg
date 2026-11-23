import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {
 INDEPENDENT_HAIR_CATALOG,ALL_INDEPENDENT_HAIR,HAIR_SECTIONS,
 normalizeHeadSize,independentHairFit,independentHairFitFromRoot,
 bodyCollisionProxies,resolveHairBodyContact,createHairSpring,classifyHairTriangle
} from '../src/independent-hair-library-v1.js';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('male and female hair are detached, attributed GLB files',()=>{
 assert.equal(INDEPENDENT_HAIR_CATALOG.female.length,12);
 assert.equal(INDEPENDENT_HAIR_CATALOG.male.length,14);
 assert.equal(new Set(ALL_INDEPENDENT_HAIR.map(x=>x.id)).size,26);
 for(const style of ALL_INDEPENDENT_HAIR){
  assert.ok(style.separateFromFace);
  assert.ok(existsSync(new URL(style.path.replace(/^\.\//,''),root)),style.path);
 }
 assert.match(read('assets/characters/hair-fitted-v1/ATTRIBUTION.md'),/CC BY 4.0/);
});
test('legacy head bounding fit remains stable for existing consumers',()=>{
 const box={min:{x:-.14,y:-.58,z:-.19},max:{x:.14,y:.025,z:.17}};
 const a=independentHairFit(box,{width:.19,height:.22,depth:.18});
 const b=independentHairFit(box,{width:.25,height:.29,depth:.25});
 assert.ok(b.scale[0]>a.scale[0]&&b.scale[2]>a.scale[2]);
 assert.ok(b.crownY>a.crownY);
 assert.throws(()=>independentHairFit({min:box.max,max:box.min}));
 assert.equal(normalizeHeadSize({width:100}).width,.34);
});
test('root-band fitting ignores long free ends and aligns the actual crown',()=>{
 const rootBox={min:{x:-.102,y:-.145,z:-.1},max:{x:.103,y:.023,z:.112}};
 const long={min:{x:-.11,y:-.7,z:-.12},max:{x:.11,y:.023,z:.12}};
 const short={min:{x:-.11,y:-.21,z:-.12},max:{x:.11,y:.023,z:.12}};
 const scalp={top:.128,centerX:0,centerZ:0,frontZ:.081,width:.205,depth:.20};
 const a=independentHairFitFromRoot(rootBox,long,{width:.205,height:.235,depth:.20},scalp);
 const b=independentHairFitFromRoot(rootBox,short,{width:.205,height:.235,depth:.20},scalp);
 assert.deepEqual(a.scale,b.scale);
 assert.deepEqual(a.position,b.position);
 assert.equal(a.fitMethod,'root-band-real-scalp');
 assert.ok(Math.abs(a.position[1]+rootBox.max.y*a.scale[1]-a.crownY)<1e-10);
 assert.ok(a.scale[0]>.8&&a.scale[0]<1.3);
 assert.throws(()=>independentHairFitFromRoot({min:rootBox.max,max:rootBox.min},long));
});
test('body collision proxy pushes hair ends outside ellipsoids without changing the incoming point',()=>{
 const colliders=bodyCollisionProxies({width:.205,height:.235,depth:.205});
 assert.deepEqual(colliders.map(x=>x.name),
  ['neck','left-shoulder','right-shoulder','chest','upper-back']);
 const sample=[-.144,-.235,-.008];
 const out=resolveHairBodyContact(sample,[colliders[1]]);
 assert.ok(out.hits>=1);
 assert.ok(Math.hypot(...out.position.map((v,i)=>(v-colliders[1].center[i])/colliders[1].radius[i]))>1);
 assert.deepEqual(sample,[-.144,-.235,-.008]);
 assert.equal(resolveHairBodyContact([2,2,2],colliders).hits,0);
});
test('stable spring motion settles when the body stops turning',()=>{
 const spring=createHairSpring();
 assert.equal(spring.step().x,0);
 let at=0;
 for(let i=0;i<80;i++)at=spring.step({dt:1/60,velocityX:3,turnSpeed:2}).x;
 assert.ok(at<0&&at>=-.075);
 let last=0;
 for(let i=0;i<250;i++)last=spring.step({dt:1/60}).x;
 assert.ok(Math.abs(last)<.0004);
 spring.reset();assert.equal(spring.step().x,0);
});
test('five diagnostic groups are separate from the continuous normal hairstyle',()=>{
 assert.deepEqual(HAIR_SECTIONS.map(p=>p.id),['crown','fringe','left','right','back']);
 const box={min:{x:-.14,y:-.59,z:-.15},max:{x:.14,y:.025,z:.15}};
 assert.equal(classifyHairTriangle(0,.015,0,box,.2),'crown');
 assert.equal(classifyHairTriangle(0,-.1,.13,box,.2),'fringe');
 assert.equal(classifyHairTriangle(-.13,-.2,0,box,.2),'left');
 assert.equal(classifyHairTriangle(.13,-.2,0,box,.2),'right');
 assert.equal(classifyHairTriangle(0,-.25,-.13,box,.2),'back');
 const mesh=read('src/independent-hair-mesh-v1.js');
 assert.match(mesh,/normalRoot\.add\(mesh\)/);
 assert.match(mesh,/breakdownRoot\.visible=false/);
 assert.match(mesh,/const normalRoot=new THREE\.Group\(\)/);
 assert.match(mesh,/source\.geometry\.clone\(\)/);
 assert.match(mesh,/geometry\.applyMatrix4\(source\.matrixWorld\)/);
 assert.match(mesh,/setSectionColors\(true\)/);
 assert.match(mesh,/resolveHairBodyContact\(real,colliders/);
 assert.doesNotMatch(mesh,/face\.geometry\s*=/);
});
test('catalog uses the v121 real hairless head with eyebrows left intact',()=>{
 const html=read('hair-asset-studio.html');
 const mesh=read('src/independent-hair-mesh-v1.js');
 assert.match(html,/neutral-face-v121\.glb/);
 assert.match(html,/async function loadRealBaldHead\(file=null\)/);
 assert.match(html,/measureBaldHeadSurface/);
 assert.doesNotMatch(html,/new THREE\.SphereGeometry\(1,48,32\)/);
 assert.match(html,/headModel\.add\(gltf\.scene\)/);
 assert.match(html,/setExploded\(false\);next\.setSectionColors\(false\)/);
 assert.match(html,/OrbitControls/);
 assert.match(html,/createHairSpring/);
 assert.match(html,/face-neutral-v121\.html/);
 assert.match(mesh,/eyebrow\|brow\|lash\|eye/);
});

test('3D studio inline module compiles (prevents blank mobile canvas)',()=>{
 const html=read('hair-asset-studio.html');
 const match=html.match(/<script type="module">([\s\S]*?)<\/script>/);
 assert.ok(match,'studio has a JavaScript module');
 const result=spawnSync(process.execPath,['--input-type=module','--check'],
  {encoding:'utf8',input:match[1]});
 assert.equal(result.status,0,result.stderr);
});

test('user-provided adjusted GLB metadata matches the default portrait preset',async()=>{
 const audit=JSON.parse(read('data/v121-adjusted-head-audit.json'));
 const {V121_REFERENCE_PRESET}=await import('../face-v121-parametric-sliders.js');
 assert.equal(audit.bytes,2657228);
 assert.equal(audit.faceVertices,13455);
 assert.equal(audit.meshes,8);
 assert.deepEqual(audit.faceReferencePreset,V121_REFERENCE_PRESET);
 assert.match(audit.eyebrowNode,/EYEBROW/);
 assert.ok(audit.worldBoundsMeters.min[1]<-.18);
 assert.ok(audit.worldBoundsMeters.max[1]>.18);
});
test('actual scalp underlay derives from skin triangles and never changes source face',()=>{
 const hair=read('src/v121-anatomical-hair-cap.js');
 const viewer=read('hair-asset-studio.html');
 const mesh=read('src/independent-hair-mesh-v1.js');
 assert.match(hair,/skinFace\.geometry/);
 assert.match(hair,/const geom=source\.clone\(\)/);
 assert.match(hair,/const kept=\[\]/);
 assert.match(hair,/skinFace\.add\(overlay\)/);
 assert.match(hair,/skinFace\?\.isMesh/);
 assert.match(mesh,/const w=right-left,d=front-back,h=Math\.min\(/);
 assert.match(viewer,/createV121AnatomicalHairCap/);
 assert.match(viewer,/bodyView\.visible=false/);
 assert.match(viewer,/v121FaceFile/);
 assert.match(viewer,/attachV121FaceSliders/);
 assert.match(viewer,/if\(!file\)attachV121FaceSliders/);
 assert.match(viewer,/headModel\.clear\(\)/);
 assert.match(viewer,/current\?\.cap\?\.setColor/);
 assert.match(viewer,/neutral-face-v121\.glb/);
});

test('uploaded v121 eyebrow fibers are kept outside the derived scalp cap',async()=>{
 const {scalpHairlineIncludesLocal}=await import('../src/v121-anatomical-hair-cap.js');
 // Exactly measured user GLB local face mesh bounds (before 0.9 node transform).
 const faceBox={min:{x:-.15187104,y:.02417238,z:-.11054239},
  max:{x:.15213621,y:.43627301,z:.15627682}};
 assert.equal(scalpHairlineIncludesLocal(.04,.350,.12,faceBox),false,
  'Face eyebrow strands may not be painted with crown hair');
 assert.equal(scalpHairlineIncludesLocal(-.04,.356,.13,faceBox),false);
 assert.equal(scalpHairlineIncludesLocal(0,.420,.04,faceBox),true);
 assert.equal(scalpHairlineIncludesLocal(.02,.315,-.04,faceBox),true);
});
