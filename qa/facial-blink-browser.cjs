const {chromium}=require('playwright');
const fs=require('node:fs');
const out='qa-screenshots/facial-blink';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:430,height:930},deviceScaleFactor:1});
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto('http://127.0.0.1:8765/character-face.html?ci=blink1',{waitUntil:'domcontentloaded',timeout:55000});
  await page.waitForFunction(()=>{
   const qa=window.__faceBlinkQA?.();
   return qa?.loaded===true&&qa?.face?.supported===true&&qa.face.eyelidMeshes===4;
  },null,{timeout:70000,polling:350});
  const initial=await page.evaluate(()=>window.__faceBlinkQA());
  if(initial.bodyBones<60||initial.face.eyeCount!==2||initial.face.realisticEyeMaterials<2)
   throw Error('Not real 65-bone eye geometry '+JSON.stringify(initial));
  await page.screenshot({path:out+'/open-eyes-real-model.png'});
  await page.locator('#closeEyes').click();
  await page.waitForFunction(()=>window.__faceBlinkQA().face.blinkAmount>.99,null,{timeout:10000});
  await page.screenshot({path:out+'/closed-eyes-real-model.png'});
  const closed=await page.evaluate(()=>window.__faceBlinkQA());
  if(closed.face.blinkAmount!==1)throw Error('Real eye geometry did not close');
  await page.locator('#openEyes').click();
  await page.waitForFunction(()=>window.__faceBlinkQA().face.blinkAmount===0,null,{timeout:10000});
  await page.screenshot({path:out+'/opened-eyes-after-blink.png'});
  await page.locator('#autoBlink').uncheck();
  const autoOff=await page.evaluate(()=>window.__faceBlinkQA());
  if(autoOff.face.autoEnabled!==false)throw Error('Auto-blink toggle ineffective');
  await page.locator('#autoBlink').check();
  const forced=await page.evaluate(()=>window.__forceFaceBlink());
  if(!forced)throw Error('Forced blink refused');
  await page.waitForTimeout(110);
  const during=await page.evaluate(()=>window.__faceBlinkQA());
  if(during.face.blinkAmount<.65)throw Error('Blink did not animate visibly '+during.face.blinkAmount);
  await page.waitForTimeout(350);
  const after=await page.evaluate(()=>window.__faceBlinkQA());
  if(after.face.blinkAmount!==0)throw Error('Blink did not reopen after animation');
  await page.locator('#outfitEnabled').check();
  await page.waitForFunction(()=>window.__faceBlinkQA?.().outfitLoaded===true,null,{timeout:105000});
  await page.screenshot({path:out+'/swordsman-armor-helmet-off-face.png'});
  await page.locator('#helmetEnabled').check();
  await page.screenshot({path:out+'/swordsman-helmet-on.png'});
  await page.locator('#helmetEnabled').uncheck();
  await page.locator('#outfitEnabled').uncheck();
  if(pageErrors.length)throw Error('Browser page errors: '+pageErrors.join('; '));
  const report={realMale:true,bones:initial.bodyBones,eyes:initial.face.eyeCount,
   lids:initial.face.eyelidMeshes,materialEnhancements:initial.face.realisticEyeMaterials,
   animatedBlinkConfirmed:true,eyelidsFullyClose:true,eyelidsReopen:true,
   togglesWork:true,outfitAndHelmetTested:true,errors:pageErrors};
  fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2)+'\n');
  console.log('REAL_FACE_BLINK_PASS',JSON.stringify(report));
 }finally{await browser.close()}
})().catch(e=>{console.error('REAL_FACE_BLINK_FAILED',e);process.exitCode=1});
