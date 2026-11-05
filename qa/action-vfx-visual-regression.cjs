const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:520,height:850},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto('http://127.0.0.1:8765/motion-external-test.html?qa=vfx-420',{waitUntil:'domcontentloaded'});
  if(!response?.ok())throw Error('Action scene HTTP '+response?.status());
  await page.waitForFunction(()=>window.__actionVfxQA?.()?.ready,{timeout:90000});
  const arrow=await page.evaluate(()=>{window.__previewActionEffect('矢を放つ');return window.__actionVfxQA()});
  if(arrow.arrowsInFlight<1)throw Error('Archer action failed to spawn a 3D arrow '+JSON.stringify(arrow));
  await page.waitForTimeout(130);
  if((await page.evaluate(()=>window.__actionVfxQA())).arrowsInFlight<1)
   throw Error('Arrow disappeared before its ballistic apex');
  await page.waitForTimeout(1200);
  const landed=await page.evaluate(()=>window.__actionVfxQA());
  if(landed.arrowsInFlight!==0)throw Error('Arrow must land and be cleaned up '+JSON.stringify(landed));
  await page.evaluate(()=>{window.__previewActionEffect('剣・通常連撃');window.__previewActionEffect('魔法発射');window.__previewActionEffect('防御被弾')});
  const effects=await page.evaluate(()=>window.__actionVfxQA());
  if(effects.activeEffects<3)throw Error('Missing per-action slash/magic/impact sprites '+JSON.stringify(effects));
  if(errors.length)throw Error('Browser: '+errors.join(' | '));
  console.log('PASS motion studio action VFX, airborne arcing arrow, landing cleanup',JSON.stringify(effects));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
