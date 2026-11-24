import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

test('v27 WebGL fixed-camera visual evidence (manual quality approval required)',async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/face-neutral-v121.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.neutralFaceReady==='v121',{timeout:60000});
  mkdirSync('qa/screenshots/face-v121/v27',{recursive:true});
  const evidence=[];
  for(const angle of ['front','threeQuarter','side','mouthClose']){
   await page.locator('[data-camera="'+angle+'"]').click();
   await page.waitForTimeout(500);
   const file='qa/screenshots/face-v121/v27/'+angle+'.png';
   const bytes=await page.locator('#viewport').screenshot({path:file});
   assert.ok(bytes.length>5000,'blank or broken WebGL screenshot');
   evidence.push({angle,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});
  }
  await page.locator('[data-camera="front"]').click();
  for(const preset of ['natural','pink','brown','glamorous']){
   await page.locator('[data-makeup="'+preset+'"]').click();
   await page.waitForTimeout(250);
   const file='qa/screenshots/face-v121/v27/makeup-'+preset+'.png';
   const bytes=await page.locator('#viewport').screenshot({path:file});
   assert.ok(bytes.length>5000);
   evidence.push({preset,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  await page.route('**/assets/generated/neutral-face-v121.glb?*',route=>route.fulfill({path:'qa/baselines/face-v121-v26.glb',contentType:'model/gltf-binary'}));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.neutralFaceReady==='v121',{timeout:60000});
  for(const angle of ['front','threeQuarter','side','mouthClose']){
   await page.locator('[data-camera="'+angle+'"]').click();
   await page.waitForTimeout(500);
   const bytes=await page.locator('#viewport').screenshot({path:'qa/screenshots/face-v121/v27/baseline-v26-'+angle+'.png'});
   assert.ok(bytes.length>5000);
   evidence.push({baseline:'v26',angle,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  assert.deepEqual(errors,[]);
  writeFileSync('qa/screenshots/face-v121/v27/evidence.json',JSON.stringify({qualityApproved:false,requiresHumanReferenceComparison:true,evidence},null,2));
 }finally{await browser.close();}
});
