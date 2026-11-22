/**
 * V115 Mobile WebGL visual regression: every eyelash root must follow its
 * actual moving eyeliner, and the visible sclera/iris rim must sit below
 * that SAME eyelid. Includes neutral and partially/full closed eyelids.
 */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';

const out='qa/screenshots/face-v115';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--use-gl=angle','--use-angle=swiftshader',
 '--enable-webgl','--enable-unsafe-swiftshader'
]});
try{
 const context=await browser.newContext({viewport:{width:430,height:920},deviceScaleFactor:1});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/face-mesh-studio.html?qa=expression&eyeTest=v115',
  {waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>document.documentElement.dataset.faceMeshReady==='v115'&&
  window.__faceMasterQA?.()?.loaded===true&&
  typeof window.__faceExpressionQA?.eyeQualityProbe==='function',
  null,{timeout:90000});
 const probe=()=>page.evaluate(()=>window.__faceExpressionQA.eyeQualityProbe());
 const capture=async name=>{
  const raw=await page.evaluate(()=>window.__faceExpressionQA.captureWebGLFrame());
  assert.ok(raw.startsWith('data:image/png;base64,'),'Renderer screenshot required');
  writeFileSync(out+'/'+name+'.png',Buffer.from(raw.split(',')[1],'base64'));
 };
 const assess=async stage=>{
  const p=await probe();
  assert.equal(p.gender,'female',stage);
  assert.equal(p.originalGLBVertices,3490,'Preserve approved v113 smooth face');
  for(const eye of [p.left,p.right]){
   assert.ok(eye.v115OpticsFitToActualLids,stage+' optical rim');
   assert.ok(eye.v115UpperLashCount>=40,stage+' upper lashes');
   assert.ok(eye.v115LowerLashCount>=12,stage+' lower lashes');
   assert.ok(eye.v115UpperLashCount>eye.v115LowerLashCount*1.5,
    stage+' realistic upper/lower density');
   assert.ok(eye.v115UpperLashSyncCount>0,stage+' upper roots resynced');
   assert.ok(eye.v115LowerLashSyncCount>0,stage+' lower roots resynced');
   assert.ok(Number.isFinite(eye.v115UpperLashRootError)&&
    eye.v115UpperLashRootError<.006,stage+' upper roots not floating');
   assert.ok(Number.isFinite(eye.v115LowerLashRootError)&&
    eye.v115LowerLashRootError<.006,stage+' lower roots not floating');
   assert.ok(eye.irisRadius>eye.pupilRadius,'Preserve colored iris');
  }
  return p;
 };
 await page.evaluate(()=>window.__faceExpressionQA.setBlink(0));
 await assess('neutral front');
 await page.locator('#front').click();
 await capture('v115-neutral-front');
 await page.locator('#threeQuarter').click();
 await capture('v115-neutral-45');
 await page.locator('#side').click();
 await capture('v115-neutral-side');
 await page.locator('#front').click();
 for(const value of [.34,.72,1,0]){
  await page.evaluate(v=>window.__faceExpressionQA.setBlink(v),value);
  await assess('blink '+value);
  await capture('v115-blink-'+String(value).replace('.','_'));
 }
 for(const emotion of ['softSmile','laugh','surprised']){
  await page.evaluate(e=>window.__faceExpressionQA.forceExpression(e),emotion);
  await page.evaluate(()=>window.__faceExpressionQA.setBlink(0));
  await assess(emotion);
  await capture('v115-'+emotion);
 }
 await page.evaluate(()=>window.__faceExpressionQA.forceExpression('neutral'));
 await page.locator('#v47BodyType').selectOption('thin');
 await page.waitForFunction(()=>window.__faceMasterQA()?.female?.v47Demographics?.bodyType==='thin',
  null,{timeout:30000});
 await assess('thin');
 await page.locator('#v47BodyType').selectOption('normal');
 await page.waitForFunction(()=>window.__faceMasterQA()?.female?.v47Demographics?.bodyType==='normal',
  null,{timeout:30000});
 await assess('normal restored');
 await capture('v115-after-reselect');
 // Male is not given female eyeliner or eyelashes.
 await page.locator('#male').click();
 await page.waitForFunction(()=>window.__faceExpressionQA.eyeQualityProbe()?.gender==='male',
  null,{timeout:30000});
 const male=await probe();
 assert.equal(male.geometryReport?.v114NaturalAlmondAperture,false);
 assert.ok(!male.left.v115OpticsFitToActualLids);
 assert.equal(male.left.v115UpperLashCount,0);
 assert.deepEqual(errors,[],'No runtime WebGL error or leaked geometry');
 console.log('FACE_V115_PASS: optic rim, liner and 3D lash roots aligned across blink, expression, camera and body type');
}finally{await browser.close();}
