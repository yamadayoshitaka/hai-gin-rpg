import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {calculateWigFit,PUBLIC_WIG_SOURCES,extractUnskinnedWig,buildReferenceFringe,createRealHeadWireframe,buildFittedScalpCap,measureRealHead,measureWigCrown} from '../src/wig-glb-fit-v1.js';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const html=read('wig-studio.html');
const retired=read('hair-asset-studio.html');
const importer=read('scripts/import-cc0-wigs.py');
const pipeline=read('.github/workflows/publish-pages.yml');

test('the old corrupt helmet-and-fringe studio redirects to an independent wig-only screen',()=>{
 assert.match(retired,/location\.replace\('\.\/wig-studio\.html\?new=1/);
 assert.match(html,/<title>灰銀のレゾナンス｜新・ウィッグ工房<\/title>/);
 assert.match(html,/src\/wig-glb-fit-v1\.js\?v=6/);
 assert.doesNotMatch(html,/head-derived-hair-modular-v11\.js|hair-asset-studio\.html\?hair/);
 assert.doesNotMatch(html,/src\/female-hair|src\/head-derived-hair-sculpt/);
 assert.match(html,/assets\/generated\/neutral-face-v121\.glb/);
 assert.match(html,/ウィッグだけをGLBで保存/);
 assert.match(html,/new GLTFExporter\(\)/);
});
test('the new standalone ES module and geometry fit module both parse',()=>{
 const script=html.match(/<script type="module">([\s\S]*?)<\/script>/);
 assert.ok(script,'missing standalone 3D viewer module');
 const check=spawnSync(process.execPath,['--input-type=module','--check'],
  {input:script[1],encoding:'utf8'});
 assert.equal(check.status,0,check.stderr);
 const moduleCheck=spawnSync(process.execPath,['--check','src/wig-glb-fit-v1.js'],
  {encoding:'utf8'});
 assert.equal(moduleCheck.status,0,moduleCheck.stderr);
});
test('three verified CC0 GLBs are fetched from upstream and not from legacy project meshes',()=>{
 assert.deepEqual(PUBLIC_WIG_SOURCES.map(x=>x.id),['long01','bob01','ponytail01']);
 for(const {file,license} of PUBLIC_WIG_SOURCES){
  assert.equal(license,'CC0');
  assert.match(importer,new RegExp(file.replaceAll('.','\\.')));
 }
 assert.match(importer,/hashlib\.sha1/);
 assert.match(importer,/blob_sha/);
 assert.match(importer,/inspect_glb\(blob\)/);
 assert.match(importer,/githubusercontent\.com\/kblood\/CharacterCreator\/master\/output/);
 assert.doesNotMatch(importer,/yamadayoshitaka.*assets\/characters\/hair/);
 assert.match(pipeline,/scripts\/import-cc0-wigs\.py --out pages-dist\/assets\/wigs\/cc0/);
});
test('source hair GLB fits to head dimensions with no exposed head pixels being rendered',()=>{
 const head={cx:0,cz:0,rx:.095,rz:.101,top:.186};
 const box={min:{x:-.25,y:1.05,z:-.13},max:{x:.25,y:1.83,z:.17}};
 const f=calculateWigFit(box,head,{widthRatio:1.11});
 assert.ok(f.scale>.40&&f.scale<.44);
 assert.ok(Math.abs(f.x)<1e-7);
 assert.ok(Math.abs(f.y-(head.top+.01-box.max.y*f.scale))<1e-7);
 assert.ok(Math.abs(f.expectedWidth-.2109)<.00001);
 const forward=calculateWigFit(box,head,{forward:.014,vertical:-.01});
 assert.ok(Math.abs(forward.z-f.z-.014)<1e-10);
 assert.ok(Math.abs(forward.y-f.y+.01)<1e-10);
 assert.throws(()=>calculateWigFit({min:box.min,max:{x:box.min.x,y:1.83,z:1}},head),
  /GLBに有効な髪/);
});
test('published source assets are verifiably valid glTF binaries when import directory exists',()=>{
 const directory=process.env.WIG_IMPORT_DIR||'pages-dist/assets/wigs/cc0';
 if(!existsSync(directory))return;
 const manifest=JSON.parse(readFileSync(join(directory,'manifest.json'),'utf8'));
 assert.equal(manifest.licence,'CC0-1.0');
 assert.equal(manifest.styles.length,3);
 for(const style of manifest.styles){
  const blob=readFileSync(join(directory,style.file));
  assert.equal(blob.toString('ascii',0,4),'glTF');
  assert.equal(blob.readUInt32LE(4),2);
  assert.equal(blob.readUInt32LE(8),blob.length);
  assert.equal(blob.length,style.bytes);
  assert.ok(style.meshes>=1,style.file);
  assert.equal(style.licence,'CC0-1.0');
 }
});

test('loaded MakeHuman SkinnedMesh becomes real static hair geometry only',async()=>{
 const THREE=await import('three');
 const geometry=new THREE.SphereGeometry(.10,32,24);
 geometry.scale(1,1.25,.6);
 geometry.translate(0,1.53,0);
 geometry.setAttribute('skinIndex',
  new THREE.Uint16BufferAttribute(new Uint16Array(geometry.getAttribute('position').count*4),4));
 geometry.setAttribute('skinWeight',
  new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count*4),4));
 geometry.morphAttributes.position=[geometry.getAttribute('position').clone()];
 const skinned=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x9b7b4e}));
 skinned.name='bad-MakeHuman-full-body-rig-hair';
 skinned.isSkinnedMesh=true; // simulate glTF SkinnedMesh without initializing irrelevant rig
 const source=new THREE.Group();
 source.add(skinned);
 const bone=new THREE.Bone();source.add(bone);
 const {root,bounds,audit}=extractUnskinnedWig(THREE,source);
 assert.equal(audit.sourceSkinnedMeshes,1);
 assert.equal(audit.droppedMorphTargets,1);
 assert.equal(audit.droppedSkeletons,1);
 assert.equal(root.children.length,1);
 const output=root.children[0];
 assert.equal(output.isMesh,true);
 assert.equal(output.isSkinnedMesh,undefined);
 assert.equal(output.geometry.getAttribute('skinIndex'),undefined);
 assert.equal(output.geometry.getAttribute('skinWeight'),undefined);
 assert.deepEqual(output.geometry.morphAttributes,{});
 assert.ok(Math.abs(bounds.getSize(new THREE.Vector3()).x-.2)<.0001);
 assert.ok(Math.abs(bounds.getSize(new THREE.Vector3()).y-.25)<.0001);
 const head={cx:0,cz:0,rx:.095,rz:.10,top:.19};
 const fitted=calculateWigFit(bounds,head);
 assert.ok(fitted.scale>.9&&fitted.scale<1.15,
  'real wig uses native .2m width, not a 0.031 corrupted full-body skeleton scale');
 geometry.dispose();output.geometry.dispose();
});
test('the wig-only viewer drops the old face wireframe and inspects real static hair geometry',()=>{
 assert.match(html,/extractUnskinnedWig\(THREE,gltf\.scene\)/);
 assert.match(html,/rawBox=isolated\.bounds/);
 assert.doesNotMatch(html,/function scalpWire\(/);
 assert.doesNotMatch(html,/headGuide/);
 assert.doesNotMatch(html,/id="guide"/);
 assert.match(html,/src\/wig-glb-fit-v1\.js\?v=6/);
});

test('separate bangs retain physical thickness, UVs, slider effects and optional middle part',async()=>{
 const THREE=await import('three');
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(.095,32,24),
  new THREE.MeshBasicMaterial());
 const head={cx:0,cz:0,rx:.095,rz:.1,top:.18,frontZ:.094,mesh};
 const none=buildReferenceFringe(THREE,head,{style:'none'});
 assert.equal(none.children.length,0);
 const blunt=buildReferenceFringe(THREE,head,{style:'blunt',
  lengthMm:65,widthPct:95,forwardMm:8});
 const center=buildReferenceFringe(THREE,head,{style:'center',
  lengthMm:105,widthPct:120,forwardMm:23});
 for(const group of [blunt,center]){
  assert.equal(group.children.length,1);
  const geo=group.children[0].geometry;
  assert.ok(geo.getAttribute('position').count>5000);
  assert.equal(geo.getAttribute('uv').count,geo.getAttribute('position').count);
  assert.ok(geo.index.count>10000);
  const positions=geo.getAttribute('position').array;
  for(let i=0;i<positions.length;i++)assert.ok(Number.isFinite(positions[i]));
  assert.ok(group.userData.dispose,'independent bang resources');
 }
 assert.ok(center.children[0].geometry.getAttribute('position').count<
  blunt.children[0].geometry.getAttribute('position').count,'parting makes a gap');
 const b=new THREE.Box3().setFromObject(blunt);
 const c=new THREE.Box3().setFromObject(center);
 assert.ok(c.min.y<b.min.y,'longer slider produces longer strands');
 assert.ok(c.max.x>b.max.x,'width slider extends fringe');
 assert.ok(c.max.z>b.max.z,'forward slider moves strands ahead');
 blunt.userData.dispose();center.userData.dispose();
 mesh.geometry.dispose();mesh.material.dispose();
});
test('v121 preview wire is real head topology and never included in wig GLB',async()=>{
 const THREE=await import('three');
 const headMesh=new THREE.Mesh(new THREE.SphereGeometry(.10,16,12),
  new THREE.MeshBasicMaterial());
 headMesh.position.set(0,.12,0);
 headMesh.updateMatrixWorld(true);
 const wire=createRealHeadWireframe(THREE,{mesh:headMesh});
 assert.equal(wire.isLineSegments,true);
 assert.equal(wire.material.transparent,true);
 assert.ok(wire.material.opacity>0&&wire.material.opacity<.5);
 assert.match(wire.name,/not-exported/);
 assert.ok(wire.geometry.getAttribute('position').count>500);
 assert.match(html,/scene\.add\(headWire\)/);
 assert.doesNotMatch(html,/wig\.add\(headWire\)/);
 assert.match(html,/exporter\.parse\(wig,/);
 assert.match(html,/<input id="headWire" type="checkbox">/);
 assert.match(html,/<option value="blunt">/);
 assert.match(html,/<option value="center">/);
 for(const id of ['bangLength','bangWidth','bangForward'])
  assert.match(html,new RegExp('id="'+id+'"'));
 wire.userData.dispose();
 headMesh.geometry.dispose();headMesh.material.dispose();
});

test('actual v121 scalp measurement excludes ears/neck and projects strand paths onto its front surface',async()=>{
 const THREE=await import('three');
 const geo=new THREE.SphereGeometry(.10,80,64);
 geo.scale(.95,1.15,1);
 geo.translate(0,.11,0);
 const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial());
 const root=new THREE.Group();root.add(mesh);
 const head=measureRealHead(THREE,root);
 assert.ok(head.scalpVertices>100);
 assert.ok(head.vertices>5000);
 assert.ok(Math.abs(head.frontAt(0,head.top-.05))>.03);
 const before=head.frontAt(0,head.top-.042);
 const below=head.frontAt(0,head.top-.125);
 assert.ok(Number.isFinite(before)&&Number.isFinite(below));
 const bangs=buildReferenceFringe(THREE,head,{style:'blunt',lengthMm:55,forwardMm:0});
 const coordinates=bangs.children[0].geometry.getAttribute('position');
 const first=coordinates.getZ(0),end=coordinates.getZ(15*8);
 assert.ok(Math.abs(first-end)>.002,'bangs curve around the actual forehead instead of a front-facing slab');
 const wire=createRealHeadWireframe(THREE,head);
 const vertices=wire.geometry.getAttribute('position');
 let minY=Infinity;
 for(let i=0;i<vertices.count;i++)minY=Math.min(minY,vertices.getY(i));
 assert.ok(minY>=head.top-.110-.00001,'the wire must not display neck/chin or lower face');
 assert.equal(wire.material.transparent,true);
 assert.ok(wire.material.opacity<.5);
 bangs.userData.dispose();wire.userData.dispose();
 mesh.geometry.dispose();mesh.material.dispose();
});
test('CC0 crown uses both lateral and depth measurements without deforming imported wig geometry',async()=>{
 const THREE=await import('three');
 const geo=new THREE.SphereGeometry(.11,64,40);
 geo.scale(1,1.35,.85);
 geo.translate(0,.18,0);
 const input=geo.getAttribute('position').array.slice();
 const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial());
 const group=new THREE.Group();group.add(mesh);
 const bbox=new THREE.Box3().setFromObject(group);
 const crown=measureWigCrown(THREE,group,bbox);
 assert.ok(crown?.width>.03&&crown.depth>.02);
 const head={cx:0,cz:0,top:.30,rx:.095,rz:.09};
 const fit=calculateWigFit(bbox,head,{widthRatio:1.04,crown});
 assert.ok(fit.capWidth>=head.rx*2*1.04-.00001);
 assert.ok(fit.capDepth>0&&Number.isFinite(fit.z));
 assert.ok(fit.scale>0&&Number.isFinite(fit.scale));
 assert.deepEqual(geo.getAttribute('position').array.slice(),input,
  'original CC0 geometry must not be modified by fitting');
 assert.match(html,/crown:rawCrown/);
 assert.match(html,/measureWigCrown\(THREE,wigContent,rawBox\)/);
 assert.match(html,/id="bangLength"[^>]+value="70"/);
 assert.match(html,/id="bangForward"[^>]+value="0"/);
 assert.match(html,/wip'\)\.hidden=true/);
 mesh.geometry.dispose();mesh.material.dispose();
});

test('three real CC0 source size profiles fit the same v121 scalp X/Z coordinates',()=>{
 const head={cx:.004,cz:-.005,rx:.092,rz:.103,top:.202};
 const profiles=[
  ['long01',.261249,.728558,.246588],
  ['bob01',.212840,.239823,.257404],
  ['ponytail01',.150202,.366004,.260254]
 ];
 for(const [name,w,h,d] of profiles){
  const box={min:{x:-w/2,y:0,z:-d/2},max:{x:w/2,y:h,z:d/2}};
  const crown={width:w,depth:d,cx:0,cz:0};
  const fit=calculateWigFit(box,head,{widthRatio:1.20,crown});
  assert.ok(fit.coverageX>=1.20,'insufficient scalp width: '+name);
  assert.ok(fit.coverageZ>=1.20,'insufficient scalp depth: '+name);
  assert.ok(Math.abs(fit.x-head.cx)<1e-10,'misaligned X '+name);
  assert.ok(Math.abs(fit.z-head.cz)<1e-10,'misaligned Z '+name);
  assert.ok(calculateWigFit(box,head,{widthRatio:1.35,crown}).scale>fit.scale,
   'slider must enlarge consistently '+name);
 }
});
test('v121-derived tinted hair cap covers crown independently of source wig and wire',async()=>{
 const THREE=await import('three');
 const geometry=new THREE.SphereGeometry(.1,64,48);
 geometry.translate(0,.11,0);
 const face=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 const root=new THREE.Group();root.add(face);
 const head=measureRealHead(THREE,root);
 const cap=buildFittedScalpCap(THREE,head,{color:'#cbaa72'});
 assert.ok(cap.userData.triangleCount>100);
 assert.equal(cap.children.length,1);
 const material=cap.children[0].material;
 assert.equal(material.color.getHexString(),'cbaa72');
 const mesh=cap.children[0],p=mesh.geometry.getAttribute('position');
 assert.equal(mesh.geometry.getAttribute('uv').count,p.count);
 assert.equal(mesh.geometry.getAttribute('color').count,p.count);
 for(let i=0;i<p.count;i++)
  assert.ok(Number.isFinite(p.getX(i))&&Number.isFinite(p.getY(i))&&Number.isFinite(p.getZ(i)));
 assert.match(html,/buildFittedScalpCap\(THREE,head/);
 assert.match(html,/wig\.add\(scalpCap\)/);
 assert.match(html,/wig\.add\(wigContent\)/);
 assert.doesNotMatch(html,/wig\.add\(headWire\)/);
 assert.match(html,/exporter\.parse\(wig,/);
 cap.userData.dispose();geometry.dispose();face.material.dispose();
});
test('layered high-quality bangs produce many thin textured locks on v121 forehead',async()=>{
 const THREE=await import('three');
 const geometry=new THREE.SphereGeometry(.095,72,50);
 geometry.translate(0,.11,0);
 const face=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 const root=new THREE.Group();root.add(face);
 const head=measureRealHead(THREE,root);
 const blunt=buildReferenceFringe(THREE,head,{style:'blunt',lengthMm:70});
 const center=buildReferenceFringe(THREE,head,{style:'center',lengthMm:70});
 const mesh=blunt.children[0];
 assert.ok(mesh.geometry.getAttribute('position').count>15000);
 assert.ok(center.children[0].geometry.getAttribute('position').count>12000);
 assert.ok(center.children[0].geometry.getAttribute('position').count<
  mesh.geometry.getAttribute('position').count);
 assert.equal(mesh.geometry.getAttribute('color').count,
  mesh.geometry.getAttribute('position').count);
 assert.match(html,/scalpCap\.traverse/);
 blunt.userData.dispose();center.userData.dispose();
 geometry.dispose();face.material.dispose();
});
