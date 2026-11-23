import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,readFileSync} from 'node:fs';

test('Android-size v120 face renders and downloads an actual binary neutral GLB',async()=>{
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
  await page.goto('http://127.0.0.1:8765/face-neutral-v120.html?v=120',{
   waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForFunction(()=>document.documentElement.dataset.neutralFaceReady==='v120',
   null,{timeout:50000});
  assert.deepEqual(errors,[],'No runtime errors in new model preview');
  assert.match(await page.locator('#status').text(),/顔 v120/);
  assert.ok(Number((await page.locator('#vertexCount').text()).replace(/,/g,''))>16000);
  await page.locator('[data-camera="side"]').click();
  assert.equal(await page.locator('[data-camera="side"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-camera="front"]').click();
  await page.locator('#eyes').click();
  assert.equal(await page.locator('#eyes').getAttribute('aria-pressed'),'false');
  await page.locator('#eyes').click();
  await page.locator('#wire').click();
  assert.equal(await page.locator('#wire').getAttribute('aria-pressed'),'true');
  await page.locator('#wire').click();
  mkdirSync('qa/screenshots/face-v120',{recursive:true});
  await page.screenshot({path:'qa/screenshots/face-v120/neutral-face-front.png'});
  await page.locator('[data-camera="side"]').click();
  await page.screenshot({path:'qa/screenshots/face-v120/neutral-face-side.png'});
  await page.locator('[data-camera="front"]').click();
  const dl=page.waitForEvent('download',{timeout:50000});
  await page.locator('#export').click();
  const item=await dl;
  assert.equal(item.suggestedFilename(),'hai-gin-neutral-face-v120.glb');
  const buf=readFileSync(await item.path());
  assert.equal(buf.toString('ascii',0,4),'glTF');
  assert.ok(buf.length>200_000,'GLB must contain real indexed 3D geometry');
  const jsonOffset=20,jsonSize=buf.readUInt32LE(12);
  const gltf=JSON.parse(buf.toString('utf8',jsonOffset,jsonOffset+jsonSize).trim());
  assert.ok(gltf.meshes.length>=1&&gltf.accessors.length>=3);
  assert.ok(gltf.meshes.some(m=>m.name==='V120_SKIN_CONNECTED_NEUTRAL'));
  assert.ok(gltf.nodes.some(n=>n.name==='V120_ORIGINAL_NEUTRAL_FACE_MASTER'));
  console.log('PASS v120 WebGL and export',JSON.stringify({
   vertexText:await page.locator('#vertexCount').text(),
   binaryBytes:buf.length,accessors:gltf.accessors.length,meshes:gltf.meshes.length
  }));
 }finally{await browser.close();}
});
