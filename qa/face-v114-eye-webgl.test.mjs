/**
 * Pixel-sized Chrome WebGL: actual eyes must be real connected 3D geometry
 * with correctly paired lid/sclera profiles, not only a preset value change.
 */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const out='qa/screenshots/face-v114';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--use-gl=angle','--use-angle=swiftshader',
 '--enable-webgl','--enable-unsafe-swiftshader'
]});
try{
 const context=await browser.newContext({viewport:{width:430,height:920},deviceScaleFactor:1});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/face-mesh-studio.html?qa=expression&eyeTest=v114',
  {waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>document.documentElement.dataset.faceMeshReady==='v114'&&
  window.__faceMasterQA?.()?.loaded===true&&typeof window.__faceExpressionQA?.eyeQualityProbe==='function',
  null,{timeout:90000});
 const state=()=>page.evaluate(()=>window.__faceExpressionQA.eyeQualityProbe());
 const initial=await state();
 console.log('FACE_V114_INITIAL_REAL_EYE_GEOMETRY',JSON.stringify(initial));
 assert.equal(initial.gender,'female');
 assert.equal(initial.style,0);
 assert.equal(initial.bodyType,'normal');
 assert.equal(initial.irisColor,'#514139','Brown eye default must remain natural');
 assert.equal(initial.originalGLBVertices,3490,'Do not restore the damaged v106 facial retopology');
 assert.equal(initial.geometryReport?.v114NaturalAlmondAperture,true);
 assert.equal(initial.geometryReport?.v114LowerEyelidRollOnRealMesh,true);
 assert.ok(initial.geometryReport?.v114UpperLidOpeningFactor<.9);
 assert.ok(initial.geometryReport?.v114EyeSocketCarveAlignedToLids);
 for(const side of [initial.left,initial.right]){
  assert.ok(side,'Both anatomical eyes must be present');
  assert.equal(side.v114SharedRim,true);
  assert.equal(side.upperFoldPresent,true);
  assert.ok(side.lidCenterGap>0,'Blinking eyelids may not invert');
  assert.ok(Math.abs(side.leftCanthusGap)<.000001&&Math.abs(side.rightCanthusGap)<.000001,
   'Upper and lower eyelid corners must join without black triangular holes');
  assert.ok(side.irisRadius>0&&side.pupilRadius>0);
  assert.ok(side.pupilToIris>.25&&side.pupilToIris<=.50);
  assert.ok(side.irisOpening>.80&&side.irisOpening<=.94,
   'Iris should occupy most of the natural eyelid opening');
  assert.ok(side.scleraSegments>1500&&side.irisSegments>1000);
 }
 assert.ok(Math.abs(initial.left.lidCenterGap-initial.right.lidCenterGap)<1e-5,
  'Eyes must have matched left-right aperture widths');
 const screenshot=async name=>{
  await page.evaluate(()=>window.__faceExpressionQA.setBlink(0));
  const frame=await page.evaluate(()=>window.__faceExpressionQA.captureWebGLFrame());
  assert.match(frame,/^data:image\/png;base64,/);
  writeFileSync(out+'/'+name+'.png',Buffer.from(frame.split(',')[1],'base64'));
 };
 await page.locator('#front').click();
 await screenshot('female-neutral-front');
 await page.locator('#threeQuarter').click();
 await screenshot('female-neutral-45deg');
 await page.locator('#side').click();
 await screenshot('female-neutral-profile');
 await page.locator('#front').click();
 for(const emotion of ['softSmile','laugh','surprised']){
  await page.locator('#faceExpression').selectOption(emotion);
  await page.waitForFunction(expected=>
   window.__faceMasterQA?.()?.expression?.expression===expected,
   emotion,{timeout:20000});
  assert.ok((await state()).left?.pupilToIris<.51);
  await screenshot('female-'+emotion);
 }
 await page.locator('#faceExpression').selectOption('neutral');
 await page.locator('#v47BodyType').selectOption('thin');
 await page.waitForFunction(()=>window.__faceMasterQA?.()?.female?.v47Demographics?.bodyType==='thin',
  null,{timeout:30000});
 assert.equal((await state()).geometryReport?.v114NaturalAlmondAperture,true);
 await page.locator('#v47BodyType').selectOption('normal');
 await page.waitForFunction(()=>window.__faceMasterQA?.()?.female?.v47Demographics?.bodyType==='normal',
  null,{timeout:30000});
 const restored=await state();
 assert.equal(restored.geometryReport?.v114NaturalAlmondAperture,true);
 assert.ok(Math.abs(restored.left.pupilToIris-initial.left.pupilToIris)<1e-7);
 await screenshot('female-after-thin-normal');
 await page.locator('#male').click();
 await page.waitForFunction(()=>window.__faceExpressionQA.eyeQualityProbe()?.gender==='male',
  null,{timeout:30000});
 const male=await state();
 assert.equal(male.geometryReport?.v114NaturalAlmondAperture,false);
 assert.equal(male.geometryReport?.v114UpperLidOpeningFactor,1);
 assert.equal(male.geometryReport?.v114LowerLidOpeningFactor,1);
 await screenshot('male-unchanged-reference');
 assert.deepEqual(errors,[],'No runtime WebGL errors during actual eye expression and gender changes');
 console.log('FACE_V114_EYES_PASS: natural 3D eye contour, iris, blink, expressions, body, male');
}finally{await browser.close();}
