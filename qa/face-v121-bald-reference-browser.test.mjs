import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,readFileSync,copyFileSync} from 'node:fs';

test('Android-size v121 face renders and downloads an actual binary neutral GLB',async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-gpu-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  const context=await browser.newContext({viewport:{width:412,height:915},
   deviceScaleFactor:2,acceptDownloads:true,isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror '+e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('console '+m.text())});
  await page.goto('http://127.0.0.1:8765/face-neutral-v121.html?v=120',{
   waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForFunction(()=>document.documentElement.dataset.neutralFaceReady==='v121',
   null,{timeout:50000});
  assert.deepEqual(errors,[],'No runtime errors in new model preview');
  assert.match(await page.locator('#status').textContent(),/顔 v121/);
  assert.ok(Number((await page.locator('#vertexCount').textContent()).replace(/,/g,''))>13000);
  await page.locator('[data-camera="side"]').click();
  assert.equal(await page.locator('[data-camera="side"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-camera="front"]').click();
  await page.locator('#eyes').click();
  assert.equal(await page.locator('#eyes').getAttribute('aria-pressed'),'false');
  await page.locator('#eyes').click();
  await page.locator('#wire').click();
  assert.equal(await page.locator('#wire').getAttribute('aria-pressed'),'true');
  await page.locator('#wire').click();
  mkdirSync('qa/screenshots/face-v121',{recursive:true});
  await page.screenshot({path:'qa/screenshots/face-v121/neutral-face-front.png'});
  await page.locator('[data-camera="threeQuarter"]').click();
  await page.screenshot({path:'qa/screenshots/face-v121/neutral-face-three-quarter.png'});
  await page.locator('[data-camera="side"]').click();
  await page.screenshot({path:'qa/screenshots/face-v121/neutral-face-side.png'});
  await page.locator('[data-camera="front"]').click();
  const dl=page.waitForEvent('download',{timeout:50000});
  await page.locator('#export').click();
  const item=await dl;
  assert.equal(item.suggestedFilename(),'hai-gin-face-v121-bald-skin-pbr.glb');
  const localGLB=await item.path();
  const buf=readFileSync(localGLB);
  copyFileSync(localGLB,'qa/screenshots/face-v121/neutral-face-v121.glb');
  assert.equal(buf.toString('ascii',0,4),'glTF');
  assert.ok(buf.length>800_000,'GLB must contain real indexed 3D geometry');
  const jsonOffset=20,jsonSize=buf.readUInt32LE(12);
  const gltf=JSON.parse(buf.toString('utf8',jsonOffset,jsonOffset+jsonSize).trim());
  assert.ok(gltf.meshes.length>=1&&gltf.accessors.length>=3);
  assert.ok(gltf.meshes.some(m=>m.primitives?.some(p=>
   gltf.accessors[p.attributes.POSITION]?.count>13000)),
   'The exported GLB must retain the high-resolution anatomical head skin');
  assert.equal(gltf.meshes[0].extras.topology.vertices,13455);
  assert.equal(gltf.meshes[0].extras.futureExpressionsImplemented,false);
  assert.equal(gltf.meshes[0].extras.version,121);
  assert.equal(gltf.meshes[0].extras.hairIncluded,false);
  assert.equal(gltf.images.length,4,'PBR skin and eye atlas must be embedded');
  assert.equal(gltf.meshes.length,8,'One skin, two eye globes and five native cosmetic geometry meshes');
  for(const part of ['V121_UPPER_EYELINER','V121_TAPERED_UPPER_EYELASHES','V121_FINE_LOWER_EYELASHES','V121_INDIVIDUAL_EYEBROW_FIBERS']){
   assert.ok(gltf.meshes.some(m=>m.name===part),part+' must be actual GLB mesh');
  }
  assert.equal(gltf.meshes[0].extras.eyeConstruction.irisAndPupilSeparateMeshes,false);
  assert.equal(gltf.meshes[0].extras.naturalFoldCleanup.removedLegacyBrowLidBand,true);
  assert.ok(gltf.meshes[0].extras.naturalFoldCleanup.nasolabialLeftVertexIds.length>10);
  assert.ok(gltf.meshes[0].extras.naturalFoldCleanup.nasolabialRightVertexIds.length>10);
  assert.equal(gltf.meshes[0].extras.eyelidFiberUpgrade.lowerLashPlacementVersion,'v121-anatomical-rim-20261123');
  assert.ok(gltf.meshes[0].extras.referenceFeatureSculpt.nostrilWingVerticesAdjusted.length>20);
  assert.ok(gltf.meshes[0].extras.referenceFeatureSculpt.lipVermilionVerticesAdjusted.length>30);
  assert.ok(gltf.meshes[0].primitives[0].attributes.COLOR_0!==undefined);
  assert.equal(gltf.materials[0].name,'V121_ANATOMICAL_SKIN_PBR_2048');
  assert.ok(gltf.meshes[0].extras.futureRigZones.mouth.length>10);
  console.log('PASS v121 WebGL and export',JSON.stringify({
   vertexText:await page.locator('#vertexCount').textContent(),
   binaryBytes:buf.length,accessors:gltf.accessors.length,meshes:gltf.meshes.length
  }));
 }finally{await browser.close();}
});
