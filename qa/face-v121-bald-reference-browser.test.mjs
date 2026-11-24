import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,readFileSync,copyFileSync} from 'node:fs';

test('Android v121 neutral GLB front/quarter/side, makeup and disabled expression controls',async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-gpu-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  const context=await browser.newContext({viewport:{width:412,height:915},
   deviceScaleFactor:2,acceptDownloads:true,isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push('pageerror '+error.message));
  page.on('console',message=>{
   if(message.type()==='error')errors.push('console '+message.text());
  });
  await page.goto('http://127.0.0.1:8765/face-neutral-v121.html?v=121-natural-lips-v20',
   {waitUntil:'domcontentloaded',timeout:25000});
  try{
   await page.waitForFunction(
    ()=>document.documentElement.dataset.neutralFaceReady==='v121',
    null,{timeout:50000});
  }catch(error){
   throw Error('v121 WebGL failed: '+error.message+'; status='+
    await page.locator('#status').textContent()+'; '+errors.join(' | '));
  }
  assert.match(await page.locator('#status').textContent(),/女性v121/);
  assert.ok(Number((await page.locator('#vertexCount').textContent()).replaceAll(',',''))>13000);
  assert.match(await page.locator('#expressionCount').textContent(),/オフ/);
  assert.equal(await page.locator('[data-expression]').count(),0);
  assert.equal(await page.locator('input[data-part]').count(),0);
  assert.equal(await page.locator('[data-wig]').count(),4);
  assert.equal(await page.locator('[data-wig="none"]').getAttribute('aria-pressed'),'true');
  mkdirSync('qa/screenshots/face-v121',{recursive:true});
  for(const angle of ['front','threeQuarter','side']){
   await page.locator('[data-camera="'+angle+'"]').click();
   assert.equal(await page.locator('[data-camera="'+angle+'"]').getAttribute('aria-pressed'),'true');
   await page.locator('#viewport').screenshot({
    path:'qa/screenshots/face-v121/neutral-face-'+angle+'-v20.png'});
  }
  for(const preset of ['brown','glamorous','natural','pink','bare']){
   await page.locator('[data-makeup="'+preset+'"]').click();
   assert.equal(await page.locator('[data-makeup="'+preset+'"]').getAttribute('aria-pressed'),'true');
  }
  await page.locator('[data-wig="none"]').click();
  const download=page.waitForEvent('download',{timeout:50000});
  await page.locator('#export').click();
  const item=await download;
  assert.equal(item.suggestedFilename(),'hai-gin-face-v121-bald-skin-pbr.glb');
  const file=await item.path();
  const bytes=readFileSync(file);
  assert.equal(bytes.toString('ascii',0,4),'glTF');
  assert.ok(bytes.length>800000,'actual 3D PBR face must be present');
  const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)).trim());
  assert.equal(json.meshes[0].extras.version,121);
  assert.equal(json.meshes[0].extras.hairIncluded,false);
  assert.equal(json.meshes[0].extras.mouthChinRebuild.version,
   'female-v121-realspace-neutral-lower-face-v16');
  assert.equal(json.meshes[0].extras.mouthChinRebuild.noseAndUpperFaceHardLocked,true);
  assert.ok(json.accessors.some(a=>a.count===13455));
  assert.equal(json.images.length,4);
  copyFileSync(file,'qa/screenshots/face-v121/neutral-face-v121-v20.glb');
  assert.deepEqual(errors,[],'No runtime WebGL errors');
 }finally{await browser.close();}
});
