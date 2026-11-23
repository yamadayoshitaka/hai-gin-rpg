/**
 * Real mobile Chromium + actual Three OrbitControls regression:
 * two stationary-spaced fingers drag the CAMERA TARGET (pan) without zoom,
 * pinching changes distance, and one finger keeps rotating the model.
 * The old UI had orbit.enablePan=false; dragging two fingers did nothing.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--use-gl=angle','--use-angle=swiftshader',
 '--enable-webgl','--enable-unsafe-swiftshader'
]});
try{
 const context=await browser.newContext({
  viewport:{width:430,height:920},deviceScaleFactor:1,
  isMobile:true,hasTouch:true
 });
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/face-mesh-studio.html?qa=expression',
  {waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>document.documentElement.dataset.faceMeshReady==='v115'&&
  typeof window.__faceExpressionQA?.gestureProbe==='function',
  null,{timeout:90000});
 await page.locator('#faceCanvas').scrollIntoViewIfNeeded();
 const before=await page.evaluate(()=>window.__faceExpressionQA.gestureProbe());
 assert.equal(before.panEnabled,true,'Two-finger pan must be enabled');
 assert.equal(before.screenSpacePanning,true,'Pan must follow screen XY');
 assert.equal(before.oneFinger,before.expectedOneFinger,'One touch still rotates');
 assert.equal(before.twoFingers,before.expectedTwoFingers,
  'Two touches must use native DOLLY_PAN');
 assert.equal(before.canvasTouchAction,'none');
 assert.match(await page.locator('#faceTouchHint').innerText(),/2本指スライド/);
 const rect=await page.locator('#faceCanvas').boundingBox();
 assert.ok(rect&&rect.width>150&&rect.height>180);
 const cx=rect.x+rect.width*.5,cy=rect.y+rect.height*.49;
 const cdp=await context.newCDPSession(page);
 const dispatch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{
  type,touchPoints:points.map(([id,x,y])=>({
   id,x:Math.round(x),y:Math.round(y),radiusX:3,radiusY:3,force:.75
  })),modifiers:0
 });
 const p=(id,x,y)=>[id,x,y];
 const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 const probe=()=>page.evaluate(()=>window.__faceExpressionQA.gestureProbe());
 const originalScroll=await page.evaluate(()=>window.scrollY);
 // Same distance between fingertips -> pan, not pinch/zoom.
 await dispatch('touchStart',[p(1,cx-42,cy),p(2,cx+42,cy)]);
 for(let i=1;i<=8;i++){
  await dispatch('touchMove',[
   p(1,cx-42+58*i/8,cy+37*i/8),
   p(2,cx+42+58*i/8,cy+37*i/8)
  ]);
  await page.waitForTimeout(23);
 }
 await dispatch('touchEnd',[]);
 await page.waitForTimeout(300);
 const afterPan=await probe();
 const panDistance=dist(afterPan.target,before.target);
 console.log('V116_TOUCH_PAN',JSON.stringify({before,afterPan,panDistance}));
 assert.ok(panDistance>.006,
  'Two-finger slide MUST move OrbitControls.target, not rotate or do nothing');
 assert.ok(Math.abs(afterPan.distance-before.distance)/before.distance<.035,
  'Two fingers moving together should not zoom');
 assert.equal(await page.evaluate(()=>window.scrollY),originalScroll,
  'Gesture must not scroll the surrounding face editor');
 // Pinch apart -> zoom, native two-finger gesture retained.
 await dispatch('touchStart',[p(3,cx-36,cy),p(4,cx+36,cy)]);
 for(let i=1;i<=6;i++){
  await dispatch('touchMove',[
   p(3,cx-36-35*i/6,cy),
   p(4,cx+36+35*i/6,cy)
  ]);
  await page.waitForTimeout(25);
 }
 await dispatch('touchEnd',[]);
 await page.waitForTimeout(280);
 const afterZoom=await probe();
 assert.ok(Math.abs(afterZoom.distance-afterPan.distance)/afterPan.distance>.03,
  'Two-finger pinch MUST change camera distance');
 // One finger rotates without accidentally translating the target.
 await dispatch('touchStart',[p(5,cx-15,cy)]);
 for(let i=1;i<=6;i++){
  await dispatch('touchMove',[p(5,cx-15+55*i/6,cy)]);
  await page.waitForTimeout(26);
 }
 await dispatch('touchEnd',[]);
 await page.waitForTimeout(240);
 const afterRotate=await probe();
 assert.ok(dist(afterRotate.cameraPosition,afterZoom.cameraPosition)>.006,
  'Single-finger rotation still works');
 const lastTarget=afterRotate.target;
 assert.ok(dist(lastTarget,afterZoom.target)<.008,
  'Single-finger gesture should orbit without translating camera target');
 // View button intentionally recenters after custom camera pan.
 await page.locator('#front').click();
 await page.waitForTimeout(250);
 const reset=await probe();
 assert.ok(dist(reset.target,before.target)<.02,
  'Pressing the Front button should reframe the original face');
 assert.deepEqual(errors,[],'WebGL should not throw during touch gesture cycle');
 console.log('FACE_V116_PASS: two-finger pan, pinch, single rotate and reset on real mobile Chromium');
}finally{await browser.close();}
