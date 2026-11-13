'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs');
const out='qa-screenshots/face-expression-v48';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,
  args:['--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:840,height:900},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:8766/face-mesh-studio.html?gender=female&hero=1&v=48&qa=expression',
   {waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.__faceMasterQA?.()?.loaded===true,
   null,{timeout:120000});
  for(const gender of ['female','male']){
   await page.locator('#'+gender).click();
   await page.waitForFunction(sex=>window.__faceMasterQA?.()?.gender===sex,
    gender,{timeout:10000});
   let state=await page.evaluate(()=>window.__faceMasterQA());
   if(!state.expression||state.expression.blinkEyes!==2||
       !state.expression.mouthIs3D||!state.expression.autoBlink)
    throw Error(gender+': no two-eye blink/real mouth animation attached');
   await page.locator('#autoBlink').click();
   await page.waitForFunction(()=>window.__faceMasterQA?.()?.expression?.autoBlink===false);
   await page.locator('#talkDemo').click();
   await page.waitForFunction(()=>window.__faceMasterQA?.()?.expression?.speaking===true);
   await page.waitForFunction(()=>window.__faceMasterQA?.()?.expression?.mouthOpen>.15,
    null,{timeout:10000});
   await page.locator('#faceCanvas').screenshot({path:out+'/'+gender+'-talking.png',timeout:60000});
   await page.locator('#talkDemo').click();
   await page.waitForFunction(()=>window.__faceMasterQA?.()?.expression?.mouthOpen===0);
   await page.locator('#autoBlink').click();
   await page.waitForFunction(()=>window.__faceMasterQA?.()?.expression?.autoBlink===true);
   // Force a single known pose for screenshots; SwiftShader can render too
   // slowly for a 300ms real-time blink to be sampled reliably by Playwright.
   // The autonomous periodic envelope is unit-tested separately.
   await page.evaluate(()=>window.__faceExpressionQA.setBlink(1));
   await page.waitForFunction(()=>window.__faceMasterQA?.()?.expression?.blink>=.99,
    null,{timeout:15000});
   await page.locator('#faceCanvas').screenshot({path:out+'/'+gender+'-blink.png',timeout:60000});
   state=await page.evaluate(()=>window.__faceMasterQA());
   if(state.expression.blinkEyes!==2)
    throw Error(gender+': eye joint lost during expression');
   await page.evaluate(()=>window.__faceExpressionQA.setBlink(null));
  }
  if(errors.length)throw Error('Uncaught browser exception: '+errors.join('; '));
  console.log('FACE_EXPRESSION_V48_QA_OK: male/female real blink and mouth toggles');
 }finally{await browser.close();}
})().catch(err=>{console.error('FACE_EXPRESSION_V48_QA_FAIL',err);process.exitCode=1;});
