import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const root=process.cwd(),threeRoot=resolve(root,'node_modules/three');
const base='http://127.0.0.1:8766/';
const donorDir=resolve(root,'assets/character-review');
const adult='HM08_adult_female_R36_review.glb';
const output='qa/screenshots/character-r42';
test('R42 browser compatibility, six donors, action and GLB roundtrip', {timeout:720000},async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:412,height:915},deviceScaleFactor:1,isMobile:true,hasTouch:true,acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://cdn.jsdelivr.net/npm/three@0.160.1/**',async r=>{
   const suffix=new URL(r.request().url()).pathname.split('/three@0.160.1/')[1],file=resolve(threeRoot,suffix||'');
   if(!file.startsWith(threeRoot+sep))return r.abort();
   try{await r.fulfill({path:file,contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'}})}catch{await r.abort()}
  });
  await page.route('https://raw.githubusercontent.com/yamadayoshitaka/hai-gin-rpg/**',async r=>{
   const name=new URL(r.request().url()).pathname.split('/').at(-1);
   if(/^HM08_[a-zA-Z0-9_-]+\.glb$/.test(name)){try{await r.fulfill({path:resolve(donorDir,name),contentType:'model/gltf-binary',headers:{'Access-Control-Allow-Origin':'*'}})}catch{await r.abort()}}
   else await r.fulfill({status:404,body:'Fixture is loaded through the file picker'});
  });
  await page.goto(base+'face-precision-r18.html?v=3.27',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('canvas')&&document.getElementById('hairAudit').onclick,undefined,{timeout:60000});
  // A compatibility fixture, not an R20 artistic model: the skin is extracted
  // from the same adult anatomical donor and has the required 11 morph slots.
  const fixture=process.env.CHARACTER_FACE_FIXTURE?readFileSync(process.env.CHARACTER_FACE_FIXTURE):Buffer.from(await page.evaluate(async(base)=>{
   const T=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');
   const d=await new GLTFLoader().loadAsync(base+'assets/character-review/HM08_adult_female_R36_review.glb');
   let src;d.scene.traverse(o=>{if(o.isSkinnedMesh&&!src)src=o.geometry});if(!src)throw Error('donor missing');
   const pos=src.attributes.position,normal=src.attributes.normal,ids=src.index.array,map=new Map(),positions=[],normals=[],indices=[];
   function vertex(i){if(!map.has(i)){map.set(i,map.size);positions.push(pos.getX(i),pos.getY(i)-1.479,pos.getZ(i)-.043);normals.push(normal.getX(i),normal.getY(i),normal.getZ(i))}return map.get(i)}
   for(let k=0;k<ids.length;k+=3){const a=ids[k],b=ids[k+1],c=ids[k+2];if(Math.min(pos.getY(a),pos.getY(b),pos.getY(c))<1.35)continue;indices.push(vertex(a),vertex(b),vertex(c))}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setIndex(indices);g.morphTargetsRelative=true;
   const names=['viseme_A','viseme_I','viseme_U','viseme_E','viseme_O','jawOpen','smile','blink_L','blink_R','browRaise','browFrown'];
   g.morphAttributes.position=names.map((n,k)=>{const a=new Float32Array(positions.length);for(let i=0;i<positions.length;i+=3)if(positions[i+1]>.03&&positions[i+2]>.06)a[i+1]=.0001*(k+1);const attr=new T.Float32BufferAttribute(a,3);attr.name=n;return attr});
   const group=new T.Group(),skin=new T.Mesh(g,new T.MeshStandardMaterial({color:0xc7a895}));skin.name='R8_SKIN';skin.updateMorphTargets();group.add(skin);
   for(let i=0;i<6;i++){const m=new T.Mesh(new T.BoxGeometry(.001,.001,.001),new T.MeshStandardMaterial({color:0xc7a895}));m.name='fixture_part_'+i;m.position.set(0,.07,0);group.add(m)}
   const exporter=new GLTFExporter();
   // Three r160 exports node names, but R18 also requires named mesh definitions.
   exporter.register(()=>({writeMesh(mesh,def){def.name=mesh.name;}}));
   const bin=await exporter.parseAsync(group,{binary:true});let str='',bytes=new Uint8Array(bin);for(let i=0;i<bytes.length;i+=16384)str+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(str);
  },base),'base64');
  mkdirSync(output,{recursive:true});
  const fixtureJson=JSON.parse(fixture.subarray(20,20+fixture.readUInt32LE(12)).toString());
  assert.equal(fixtureJson.meshes.length,7,'fixture must contain seven mesh definitions');
  assert.equal(fixtureJson.meshes.find(m=>m.name==='R8_SKIN')?.primitives[0].targets?.length,11,'fixture must include named skin and eleven morph slots');
  await page.locator('#file').setInputFiles({name:'R42-compatibility-fixture.glb',mimeType:'model/gltf-binary',buffer:fixture});
  try{await page.waitForFunction(()=>!document.getElementById('goAction').disabled,undefined,{timeout:60000});}catch(e){const status=await page.locator('#status').textContent();await page.screenshot({path:output+'/face-load-failure.png'});throw new Error('Face fixture load failed: '+status+'; page errors: '+errors.join('; '),{cause:e});}
  // Old revisions are removed only when a newer version of that style exists.
  await page.evaluate(async()=>{
   const db=await new Promise((ok,no)=>{const q=indexedDB.open('hai-gin-wig-library-v1',1);q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});
   await new Promise((ok,no)=>{const tx=db.transaction('wigs','readwrite'),st=tx.objectStore('wigs');for(const id of ['ボブ R23','R35 ボブ・連続毛並みテクスチャ','ショート R23','R38 ショート（比較試作）','ロング R23','独自髪型'])st.put({id,savedAt:1});tx.oncomplete=ok;tx.onerror=()=>no(tx.error)});db.close();
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Array.from(document.getElementById('hairStyle').options).some(o=>o.value==='wig:R38 ショート（比較試作）'));
  const kept=await page.locator('#hairStyle option').evaluateAll(os=>os.map(o=>o.value));
  assert.ok(kept.includes('wig:R35 ボブ・連続毛並みテクスチャ')&&kept.includes('wig:ロング R23')&&kept.includes('wig:独自髪型'));
  assert.ok(!kept.includes('wig:ボブ R23')&&!kept.includes('wig:ショート R23')&&!kept.includes('bob'));
  await page.locator('#file').setInputFiles({name:'R45-compatibility-fixture.glb',mimeType:'model/gltf-binary',buffer:fixture});
  await page.waitForFunction(()=>!document.getElementById('goAction').disabled,undefined,{timeout:60000});
  // Register actual loaded compatible GLB once, then twenty reproducible settings.
  await page.locator('#modelName').fill('R39_jaw_lateral_review');
  await page.locator('#registerModel').click();
  await page.waitForFunction(()=>document.getElementById('storeStatus').textContent.includes('登録しました'));
  // Reproduce R45 user state: only a generic R39 registration, no R20/female string.
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Array.from(document.getElementById('modelList').options).filter(o=>o.value.startsWith('標準ベース ')).length===20,{},{timeout:60000});
  assert.ok(await page.locator('#modelList option').evaluateAll(os=>os.some(o=>o.value==='R39_jaw_lateral_review')));
  await page.locator('#modelList').selectOption('R39_jaw_lateral_review');
  await page.waitForFunction(()=>!document.getElementById('goAction').disabled&&document.getElementById('storeStatus').textContent.includes('読み込みました'),undefined,{timeout:60000});
  assert.equal(await page.locator('#modelList option').evaluateAll(os=>os.filter(o=>o.value.startsWith('標準ベース 女性')).length),10);
  assert.equal(await page.locator('#modelList option').evaluateAll(os=>os.filter(o=>o.value.startsWith('標準ベース 男性')).length),10);
  assert.equal(await page.locator('#modelList option').evaluateAll(os=>os.filter(o=>o.value.startsWith('__r45_base_')).length),0);
  await page.locator('#seedBases').click();
  await page.waitForFunction(()=>document.getElementById('baseSeedStatus').textContent.includes('新規・更新 0 件'));
  const ids=await page.locator('#modelList option').evaluateAll(os=>os.map(o=>o.value).filter(v=>v.startsWith('標準ベース ')));
  // Compare a representative pair per sex on the actual displayed geometry.
  for(const [label,key] of [['女性02','female:1'],['女性03','female:2'],['男性02','male:1'],['男性03','male:2']]){
   await page.locator('#modelList').selectOption('標準ベース '+label);
   await page.waitForFunction(key=>document.getElementById('profileStatus').dataset.identity===key,key,{timeout:60000});
   const d=await page.locator('#profileStatus').evaluate(e=>({rms:+e.dataset.identityRmsMm,max:+e.dataset.identityMaxMm}));
   assert.ok(d.rms>2&&d.max>5,'identity geometry must differ: '+JSON.stringify(d));
   for(const [name,view] of [['正面','front'],['側面','side']]){await page.locator('#angles').getByRole('button',{name,exact:true}).click();await page.waitForTimeout(150);await page.locator('#stage').screenshot({path:output+'/r47-'+key.replace(':','-')+'-'+view+'.png'});}
  }
  assert.equal(ids.length,20);
  await page.locator('#modelList').selectOption('R39_jaw_lateral_review');
  await page.waitForFunction(()=>document.getElementById('profileStatus').dataset.identity==='',undefined,{timeout:60000});
  await page.locator('#angles').getByRole('button',{name:'正面',exact:true}).click();
  // R48: full-range facial width must not move the neck attachment band.
  await page.locator('#motionAge').selectOption('20');
  for(const value of [-100,100,0]){
   await page.locator('#s-faceWidth').evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}))},value);
   await page.waitForTimeout(180);
   const neck=await page.locator('#profileStatus').evaluate(e=>({count:+e.dataset.neckAnchorCount,mm:+e.dataset.neckAnchorMm}));
   assert.ok(neck.count>0&&neck.mm<.001,'face width must not alter neck anchor: '+JSON.stringify(neck));
  }
  // Use a minimal valid GLB rather than the metadata-only cleanup records.
  const wig=await page.evaluate(async()=>{const T=await import('three'),{GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');const g=new T.SphereGeometry(.083,16,12,0,Math.PI*2,0,Math.PI*.68);g.translate(0,.065,0);const m=new T.Mesh(g,new T.MeshStandardMaterial({color:0x684336}));m.name='qa_wig';const b=new Uint8Array(await new GLTFExporter().parseAsync(m,{binary:true}));let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(s)});
  await page.locator('#wigFile').setInputFiles({name:'R99 ボブ.glb',mimeType:'model/gltf-binary',buffer:Buffer.from(wig,'base64')});
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('ウィッグ装着完了'),undefined,{timeout:60000});
  for(const label of ['女性02','男性02']){
   await page.locator('#modelList').selectOption('標準ベース '+label);
   await page.waitForFunction(label=>document.getElementById('storeStatus').textContent.includes('標準ベース '+label+'」を読み込みました'),label,{timeout:60000});
   await page.locator('#hairStyle').selectOption('wig:R99 ボブ');
   await page.waitForFunction(()=>document.getElementById('status').textContent.includes('ウィッグ装着完了'),undefined,{timeout:60000});
   await page.locator('#stage').screenshot({path:output+'/r48-bob-'+label+'.png'});
  }
  await page.locator('#modelList').selectOption('R39_jaw_lateral_review');
  await page.waitForFunction(()=>document.getElementById('profileStatus').dataset.identity===''&&!document.getElementById('hairStyle').disabled,undefined,{timeout:60000});
  await page.locator('#hairStyle').selectOption('none');
  // Face aging must affect real skin vertices in face-only mode, and be reversible.
  const ageStats=()=>page.locator('#profileStatus').evaluate(e=>({age:e.dataset.faceAge,count:+e.dataset.ageVertexCount,max:+e.dataset.ageMaxMm}));
  await page.locator('#motionAge').selectOption('20');
  await page.waitForFunction(()=>document.getElementById('profileStatus').dataset.faceAge==='20');
  assert.equal((await ageStats()).count,0);
  await page.locator('#stage').screenshot({path:output+'/age20-face.png'});
  await page.locator('#motionAge').selectOption('80');
  await page.waitForFunction(()=>document.getElementById('profileStatus').dataset.faceAge==='80');
  const age80=await ageStats();assert.ok(age80.count>20&&age80.max>2,'80s face geometry must change: '+JSON.stringify(age80));
  await page.locator('#stage').screenshot({path:output+'/age80-face.png'});
  await page.locator('#staticBody').check();
  await page.waitForFunction(()=>!document.getElementById('bodyExport').disabled&&document.getElementById('bodyStatus').textContent.includes('高齢女性'),undefined,{timeout:60000});
  await page.locator('#stage').screenshot({path:output+'/age80-body.png'});
  await page.locator('#motionAge').selectOption('20');
  await page.waitForFunction(()=>!document.getElementById('bodyExport').disabled&&document.getElementById('bodyStatus').textContent.includes('成人女性'),undefined,{timeout:60000});
  assert.equal((await ageStats()).count,0);
  await page.locator('#stage').screenshot({path:output+'/age20-body.png'});
  await page.waitForFunction(()=>!document.getElementById('bodyExport').disabled,undefined,{timeout:60000});
  assert.equal(await page.locator('#bodyAdvanced').evaluate(e=>e.open),false,'donor override must start collapsed');
  await page.locator('#bodyAdvanced > summary').click();
  const evidence=[];
  for(const key of ['female-adult','male-adult','female-senior','male-senior','female-child','male-child']){
   await page.locator('#bodySource').selectOption(key);
   await page.waitForFunction(()=>!document.getElementById('bodyExport').disabled&&document.getElementById('bodyMode').checked,undefined,{timeout:60000});
   const status=await page.locator('#bodyStatus').textContent();
   assert.ok(!status.includes('失敗'),status);
   const file=output+'/'+key+'.png';await page.locator('#stage').screenshot({path:file});evidence.push({key,status,file});
  }
  await page.locator('#bodySource').selectOption('auto');
  for(const sex of ['female','male']){
   await page.locator('#motionSex').selectOption(sex);
   for(const age of ['child','teen','20','30','40','50','60','70','80']){
    await page.locator('#motionAge').selectOption(age);
    await page.waitForFunction(([sex,age])=>{const key=sex==='female'?(age==='child'?'女児':+age>=60?'高齢女性':'成人女性'):(age==='child'?'男児':+age>=60?'高齢男性':'成人男性');return !document.getElementById('bodyExport').disabled&&document.getElementById('bodyStatus').textContent.includes(key)&&document.getElementById('profileStatus').dataset.faceAge===age},[sex,age],{timeout:60000});
    for(const build of ['normal','slim','full','verySlim']){await page.locator('#bodyBuild').selectOption(build);await page.waitForTimeout(150);assert.ok(await page.locator('#bodyMode').isChecked());}
    await page.locator('#bodyBuild').selectOption('normal');
    if(['20','40','60','80'].includes(age)){
     await page.waitForTimeout(250);
     const seam=await page.locator('#bodyStatus').evaluate(e=>({n:+e.dataset.seamSamples,dot:+e.dataset.seamNormalDot,center:+e.dataset.neckCenterErrorMm}));
     assert.ok(seam.n>=96&&seam.dot>.99&&seam.center<1,'seam boundary normals must match: '+JSON.stringify(seam));
     for(const [label,view] of [['正面','front'],['45°','diagonal'],['側面','side'],['背面','back']]){
       await page.locator('#angles').getByRole('button',{name:label,exact:true}).click();await page.waitForTimeout(150);
       await page.locator('#stage').screenshot({path:output+'/r44-'+sex+'-'+age+'-'+view+'.png'});
     }
     await page.locator('#angles').getByRole('button',{name:'正面',exact:true}).click();
    }
   }
  }
  await page.locator('#motionSex').selectOption('female');
  await page.locator('#motionAge').selectOption('20');
  await page.locator('#bodySource').selectOption('female-adult');
  await page.waitForFunction(()=>!document.getElementById('bodyExport').disabled,undefined,{timeout:60000});
  await page.locator('#goAction').click();
  await page.waitForURL('**/*screen=action');
  await page.waitForFunction(()=>!document.getElementById('bodyExport').disabled,undefined,{timeout:60000});
  for(const motion of ['idle','walk','run','wave','jump','crouch','turn','attack']){
   await page.locator('#bodyMotion').selectOption(motion);
   await page.waitForTimeout(400);
  }
  const dl=page.waitForEvent('download',{timeout:120000});
  const failure=page.waitForFunction(()=>document.getElementById('bodyStatus').textContent.includes('出力失敗'),undefined,{timeout:120000}).then(async()=>{throw Error(await page.locator('#bodyStatus').textContent())});
  let downloaded;try{await page.locator('#bodyExport').click();downloaded=await Promise.race([dl,failure]);}catch(e){await page.screenshot({path:output+'/export-failure.png'});throw new Error('Animated GLB export: '+await page.locator('#bodyStatus').textContent()+'; '+e.message,{cause:e});}
  const path=output+'/roundtrip.glb';await downloaded.saveAs(path);
  const bytes=readFileSync(path);assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());assert.equal(json.animations.length,8);assert.ok(json.skins.length);for(const clip of json.animations){assert.ok(clip.channels.some(c=>c.target.path==='weights'),clip.name+' must contain expression weight channels');assert.ok(clip.channels.some(c=>c.target.path==='rotation'),clip.name+' must contain skeletal rotation channels');}
  const reload=await page.evaluate(async b64=>{const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const gltf=await new GLTFLoader().parseAsync(bytes.buffer,'');let skinned=0,morphs=0;gltf.scene.traverse(m=>{if(m.isSkinnedMesh)skinned++;if(m.morphTargetInfluences)morphs+=m.morphTargetInfluences.length});return {animations:gltf.animations.length,skinned,morphs}},bytes.toString('base64'));
  assert.equal(reload.animations,8);assert.ok(reload.skinned>0);assert.ok(reload.morphs>=11);
  assert.deepEqual(errors,[]);
  writeFileSync(output+'/evidence.json',JSON.stringify({fixture:process.env.CHARACTER_FACE_FIXTURE?'provided face':'anatomical compatibility fixture, not R20',evidence,reload,age80,visualQualityApproved:false},null,2));
 }finally{await browser.close()}
});
