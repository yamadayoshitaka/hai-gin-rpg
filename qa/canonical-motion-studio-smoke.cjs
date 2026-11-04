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
  await page.locator('#outfitPreview').check();
  await page.locator('#outfitFollow').check();
  fs.mkdirSync('qa-screenshots',{recursive:true});
  const fitReports=[];
  for(const sex of ['male','female']){
   await page.selectOption('#sex',sex);
   // The new skinned wardrobe and texture files load asynchronously. Never
   // judge geometry after a fixed short sleep while assets are still loading.
   try{
    await page.waitForFunction(expected=>{
      const report=window.__outfitFitReport||[];
      const status=document.querySelector('#outfitStatus')?.textContent||'';
      return report.some(row=>row.sex===expected)||status.includes('失敗');
    },sex,{timeout:90000});
   }catch(e){throw Error('Timed out loading '+sex+' outfit: '+await page.locator('#outfitStatus').textContent());}
   if(await page.locator('#sex').inputValue()!==sex)throw Error('Sex selector reverted: '+sex);
   const report=await page.evaluate(()=>window.__outfitFitReport||[]);
   await page.locator('#ui').evaluate(el=>el.classList.add('collapsed'));
   await page.screenshot({path:`qa-screenshots/outfit-${sex}-mobile.png`,fullPage:true});
   await page.locator('#ui').evaluate(el=>el.classList.remove('collapsed'));
   console.log('Outfit geometry '+sex+':',JSON.stringify(report));
   if(!report.length)throw Error('Outfit fitting report empty ('+sex+'): '+await page.locator('#outfitStatus').textContent());
   if(report.some(x=>x.verified===false))throw Error('Outfit geometry not verified: '+JSON.stringify(report));
   const broken=report.filter(x=>!Number.isFinite(x.offset)||x.offset>.35||x.oversized||
    (x.rigged&&(Math.abs(x.bodyBindHeight-1.45)>.05||x.bodyHeight<1.2||x.bodyHeight>1.7))||
    (x.partReports?.some(p=>p.outside||p.bodyPoints<4))||
    (x.compared>=5&&(x.narrow/x.compared>.25||x.loose/x.compared>.25||(x.displaced||0)/x.compared>.25)));
   if(broken.length)throw Error('Outfit geometry regression: '+JSON.stringify(broken));
   fitReports.push(...report);
  }
  fs.writeFileSync('qa-screenshots/outfit-fit-report.json',JSON.stringify(fitReports,null,2));
  console.log('Outfit fitting diagnostics:',JSON.stringify(fitReports));
  if(errors.length)throw Error('Canonical studio JS errors: '+errors.join(' | '));
  console.log('Canonical motion studio smoke PASS: mobile controls, both genders, no JS exceptions');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
