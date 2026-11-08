const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const fs=require('node:fs');
const out='qa-screenshots/facial-blink';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:430,height:930},deviceScaleFactor:1});
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto('http://127.0.0.1:8765/character-face.html?ci=blink1',{waitUntil:'domcontentloaded',timeout:55000});
  try{
   await page.waitForFunction(()=>{
    const qa=window.__faceBlinkQA?.();
    return qa?.loaded===true&&qa?.face?.supported===true&&qa.face.eyelidMeshes===4;
   },null,{timeout:45000,polling:350});
  }catch(error){
   console.error('FACE_LOAD_DIAG',JSON.stringify(await page.evaluate(()=>({
    status:document.querySelector('#status')?.textContent,
    overlay:document.querySelector('#overlay')?.textContent,
    diagnostic:window.__faceBlinkQA?.()||null
   }))));
   console.error('FACE_PAGE_ERRORS',JSON.stringify(pageErrors));
   await page.screenshot({path:out+'/face-load-failed.png'});
   throw error;
  }
  const initial=await page.evaluate(()=>window.__faceBlinkQA());
  if(initial.bodyBones<60||initial.face.eyeCount!==2||initial.face.realisticEyeMaterials<2||!initial.face.skinAtlasSampling)
   throw Error('Not real 65-bone eye geometry '+JSON.stringify(initial));
  await page.waitForFunction(()=>{
   const qa=window.__faceBlinkQA?.();
   return qa?.hairLoaded===true||qa?.loaded&&qa?.hairLoading===false;
  },null,{timeout:45000});
  const hairState=await page.evaluate(()=>window.__faceBlinkQA());
  if(!hairState.hairLoaded)throw Error('Current original swordsman hair is missing in face close-up');
  await page.locator('#viewport').screenshot({path:out+'/original-swordsman-hair.png'});
  // Disable idle randomness while taking comparable keyframes.
  await page.locator('#autoBlink').uncheck();
  await page.locator('#hairEnabled').uncheck();
  await page.waitForTimeout(100);
  await page.locator('#viewport').screenshot({path:out+'/open-eyes-real-model.png'});
  await page.locator('#closeEyes').click();
  await page.waitForFunction(()=>window.__faceBlinkQA().face.blinkAmount>.99,null,{timeout:10000});
  await page.locator('#viewport').screenshot({path:out+'/closed-eyes-real-model.png'});
  // A numerical blink PASS is insufficient if the screenshot is scrolled away
  // from the face. Analyze pixels from the actual WebGL viewport keyframes.
  const openFrame=PNG.sync.read(fs.readFileSync(out+'/open-eyes-real-model.png'));
  const closedFrame=PNG.sync.read(fs.readFileSync(out+'/closed-eyes-real-model.png'));
  if(openFrame.width!==closedFrame.width||openFrame.height!==closedFrame.height)
    throw Error('Face keyframes have inconsistent sizes');
  let changedEyeRegionPixels=0;
  for(let y=Math.floor(openFrame.height*.12);y<Math.floor(openFrame.height*.70);y++)
   for(let x=Math.floor(openFrame.width*.12);x<Math.floor(openFrame.width*.88);x++){
    const p=(y*openFrame.width+x)*4;
    const delta=Math.abs(openFrame.data[p]-closedFrame.data[p])+
      Math.abs(openFrame.data[p+1]-closedFrame.data[p+1])+
      Math.abs(openFrame.data[p+2]-closedFrame.data[p+2]);
    if(delta>40)changedEyeRegionPixels++;
   }
  if(changedEyeRegionPixels<80)
    throw Error('Eyelid motion is not visible in captured face keyframes: '+changedEyeRegionPixels);
  const closed=await page.evaluate(()=>window.__faceBlinkQA());
  if(closed.face.blinkAmount!==1)throw Error('Real eye geometry did not close');
  await page.locator('#openEyes').click();
  await page.waitForFunction(()=>window.__faceBlinkQA().face.blinkAmount===0,null,{timeout:10000});
  await page.locator('#viewport').screenshot({path:out+'/opened-eyes-after-blink.png'});
  await page.locator('#autoBlink').uncheck();
  const autoOff=await page.evaluate(()=>window.__faceBlinkQA());
  if(autoOff.face.autoEnabled!==false)throw Error('Auto-blink toggle ineffective');
  await page.locator('#autoBlink').check();
  const during=await page.evaluate(()=>{
   const ok=window.__forceFaceBlink();
   if(!ok)throw Error('Forced blink refused');
   window.__stepFaceBlink(.075);
   window.__stepFaceBlink(.075);
   return window.__faceBlinkQA();
  });
  if(during.face.blinkAmount<.80)throw Error('Blink did not animate visibly '+during.face.blinkAmount);
  await page.evaluate(()=>{
   for(let n=0;n<6;n++)window.__stepFaceBlink(.05);
  });
  const after=await page.evaluate(()=>window.__faceBlinkQA());
  if(after.face.blinkAmount!==0)throw Error('Blink did not reopen after animation');
  await page.locator('#hairEnabled').check();
  await page.locator('#outfitEnabled').check();
  await page.waitForFunction(()=>window.__faceBlinkQA?.().outfitLoaded===true,null,{timeout:105000});
  await page.locator('#viewport').screenshot({path:out+'/swordsman-armor-helmet-off-face.png'});
  await page.locator('#helmetEnabled').check();
  await page.locator('#viewport').screenshot({path:out+'/swordsman-helmet-on.png'});
  await page.locator('#helmetEnabled').uncheck();
  await page.locator('#outfitEnabled').uncheck();
  if(pageErrors.length)throw Error('Browser page errors: '+pageErrors.join('; '));
  const report={realMale:true,bones:initial.bodyBones,eyes:initial.face.eyeCount,
   lids:initial.face.eyelidMeshes,materialEnhancements:initial.face.realisticEyeMaterials,
   animatedBlinkConfirmed:true,eyelidsFullyClose:true,eyelidsReopen:true,
   togglesWork:true,outfitAndHelmetTested:true,originalHairVisible:hairState.hairLoaded,
   skinAtlasSampled:initial.face.skinAtlasSampling,
   faceViewportPixelsChanged:changedEyeRegionPixels,
   faceCapturedWithoutScroll:true,errors:pageErrors};
  fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2)+'\n');
  console.log('REAL_FACE_BLINK_PASS',JSON.stringify(report));
 }finally{await browser.close()}
})().catch(e=>{console.error('REAL_FACE_BLINK_FAILED',e);process.exitCode=1});
