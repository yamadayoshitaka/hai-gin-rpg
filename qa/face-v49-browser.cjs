'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs');
const out='qa-screenshots/face-v49';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:840,height:970},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8766/face-mesh-studio.html?gender=female&hero=1&v=49',
   {waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.__faceMasterQA?.()?.loaded===true,
   null,{timeout:120000});
  for(const gender of ['female','male']){
   await page.locator('#'+gender).click();
   await page.waitForFunction(g=>window.__faceMasterQA().gender===g,
    gender,{timeout:20000});
   await page.locator('#v47AgeBand').selectOption('eightyPlus');
   await page.waitForFunction(g=>{
    const v=window.__faceMasterQA();
    return v.gender===g&&v.v32PartSelection.ageBand==='eightyPlus'&&
     v[g]?.v49AgeCreases?.count>10;
   },gender,{timeout:95000});
   await page.locator('#front').click();
   await page.screenshot({path:out+'/'+gender+'-80years.png',animations:'disabled',timeout:90000});
   await page.locator('#v47AgeBand').selectOption('twenties');
   await page.waitForFunction(g=>{
    const v=window.__faceMasterQA();
    return v.gender===g&&v.v32PartSelection.ageBand==='twenties'&&
     (v[g]?.v49AgeCreases?.count??-1)===0;
   },gender,{timeout:95000});
   await page.screenshot({path:out+'/'+gender+'-20years.png',animations:'disabled',timeout:90000});
   await page.locator('#v47BodyType').selectOption('normal');
   await page.locator('#faceExpression').selectOption('shout');
   await page.waitForFunction(()=>window.__faceMasterQA().expression?.mouthOpen>.94,
    null,{timeout:15000});
   await page.screenshot({path:out+'/'+gender+'-shout.png',animations:'disabled',timeout:90000});
   await page.locator('#faceExpression').selectOption('neutral');
   await page.waitForFunction(()=>window.__faceMasterQA().expression?.mouthOpen===0,
    null,{timeout:15000});
   await page.locator('#faceExpression').selectOption('smile');
   await page.waitForFunction(()=>window.__faceMasterQA().expression?.expression==='smile');
   await page.screenshot({path:out+'/'+gender+'-smile.png',animations:'disabled',timeout:90000});
   await page.locator('#faceExpression').selectOption('neutral');
   if(gender==='female'){
    for(const [style,kind] of [
     ['female-low-bun','coiled-low-bun'],
     ['female-twin-braids','two-interwoven-plaits'],
     ['female-side-ponytail','side-ponytail']
    ]){
     // The old #wigStyle is intentionally HIDDEN in modern v32 mode.
     // Operate the real, user-visible 24-cut part selector instead.
     const index={
      'female-low-bun':20,'female-twin-braids':19,
      'female-side-ponytail':23
     }[style];
     await page.locator('#v32FemaleHair').selectOption(String(index));
     await page.waitForFunction(([style,kind])=>{
      const r=window.__faceMasterQA().wigReport;
      return r?.hairstyleId===style&&r.v49StyledHairType===kind&&
       r.v49StyledHairTriangles>150;
     },[style,kind],{timeout:95000});
     for(const view of ['front','side','back']){
      await page.locator('#'+view).click();
      await page.screenshot({
       path:out+'/'+style+'-'+view+'.png',animations:'disabled',timeout:90000});
     }
    }
   }
  }
  if(errors.length)throw Error('Browser JS errors: '+errors.slice(0,4).join('; '));
  console.log('FACE_V49_BROWSER_QA_OK: age, expression, hair 3D, gender states');
 }finally{await browser.close();}
})().catch(e=>{console.error('FACE_V49_BROWSER_QA_FAIL',e);process.exitCode=1;});
