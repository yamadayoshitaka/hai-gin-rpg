const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:412,height:915},isMobile:true,hasTouch:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto('http://127.0.0.1:8765/motion-external-test.html?qa=canonical',{waitUntil:'domcontentloaded',timeout:30000});
  if(!response?.ok())throw Error('Canonical studio HTTP '+response?.status());
  for(const id of ['body','sex','job','action','status','rigdiag']){
   if(await page.locator('#'+id).count()!==1)throw Error('Missing canonical studio control: '+id);
  }
  await page.locator('#ui').evaluate(el=>el.classList.remove('collapsed'));
  await page.selectOption('#body','soldier');
  for(const sex of ['male','female']){
   await page.selectOption('#sex',sex);
   await page.waitForTimeout(1500);
   const state=await page.locator('#sex').inputValue();
   if(state!==sex)throw Error('Sex selector reverted: '+sex);
  }
  // Capture the actual mobile rendering and record per-garment geometry.
  await page.locator('#outfitPreview').check();
  await page.locator('#outfitFollow').check();
  await page.waitForTimeout(3500);
  fs.mkdirSync('qa-screenshots',{recursive:true});
  await page.locator('#ui').evaluate(el=>el.classList.add('collapsed'));
  await page.screenshot({path:'qa-screenshots/outfit-mobile.png',fullPage:true});
  const report=await page.evaluate(()=>window.__outfitFitReport||[]);
  fs.writeFileSync('qa-screenshots/outfit-fit-report.json',JSON.stringify(report,null,2));
  console.log('Outfit fitting diagnostics:',JSON.stringify(report));
  if(report.length){
   const broken=report.filter(x=>!Number.isFinite(x.offset)||x.offset>.35||x.oversized);
   if(broken.length)throw Error('Outfit geometry regression: '+JSON.stringify(broken));
  }else console.warn('Outfit fitting report empty; no geometric fit verified');
  if(errors.length)throw Error('Canonical studio JS errors: '+errors.join(' | '));
  console.log('Canonical motion studio smoke PASS: mobile controls, both genders, no JS exceptions');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
