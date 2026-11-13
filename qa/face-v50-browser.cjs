'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs');
const out='qa-screenshots/face-v50';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader'
 ]});
 try{
  const page=await browser.newPage({viewport:{width:600,height:900},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8766/face-mesh-studio.html?gender=male&hero=1&v=50',
   {waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.__faceMasterQA?.()?.loaded===true,
   null,{timeout:120000});
  await page.locator('#male').click();
  const male=await page.evaluate(()=>window.__faceMasterQA());
  if(male.maleControls.eyeHeight<1.14||male.maleControls.beardDensity>.01||
    male.v32PartSelection.ageBand!=='twenties')
   throw Error('Male 20s face did not receive v50 hero youth fitting '+JSON.stringify(male.maleControls));
  await page.locator('#front').click();
  await page.screenshot({path:out+'/male-20s.png',timeout:90000,animations:'disabled'});
  // Verify that each REAL 3D style has its own geometry and the face
  // remains twenty-something after a hair-only replacement.
  const requested=['male-natural-mash','male-two-block','male-comma',
   'male-slick-back','male-wave-perm'];
  const cuts=await page.locator('#v32MaleHair option').evaluateAll(nodes=>
   nodes.map(n=>({value:n.value,label:n.textContent})));
  for(const id of requested){
   const index=await page.evaluate(style=>{
    const list=window.__faceMasterQA().wigStyles;
    return list.findIndex(row=>row.id===style);
   },id);
   const hairOption=await page.locator('#v32MaleHair').evaluate((node,style)=>{
    const map=window.__faceMasterQA().v32PartSelection;
    return {value:node.value};
   },id);
   // Browser catalog indices are stable by database display text, not
   // the global WIG_STYLES array containing both genders.
   const v=await page.locator('#v32MaleHair option').evaluateAll((options,style)=>{
    const ids={
     'male-natural-mash':'ナチュラルマッシュ','male-two-block':'ツーブロック',
     'male-comma':'韓国風コンマヘア','male-slick-back':'オールバック',
     'male-wave-perm':'ニュアンスパーマ'
    };
    return options.find(o=>o.textContent.includes(ids[style]))?.value??null;
   },id);
   if(v===null)throw Error('Catalog option absent '+id);
   await page.locator('#v32MaleHair').selectOption(v);
   await page.waitForFunction(style=>{
    const data=window.__faceMasterQA();
    return data.wigReport?.hairstyleId===style&&
     data.wigReport?.v50CatalogGroom!=='classic-layered';
   },id,{timeout:90000});
   await page.screenshot({path:out+'/'+id+'.png',
    timeout:90000,animations:'disabled'});
   const next=await page.evaluate(()=>window.__faceMasterQA());
   if(next.maleControls.ageBand!=='twenties'||next.maleControls.beardDensity>.01)
    throw Error('Hair edit restored aged face '+id);
  }
  await page.locator('#v47AgeBand').selectOption('eightyPlus');
  await page.waitForFunction(()=>window.__faceMasterQA().male?.v49AgeCreases?.count>10,
   null,{timeout:90000});
  await page.screenshot({path:out+'/male-80s.png',
   timeout:90000,animations:'disabled'});
  await page.locator('#v47AgeBand').selectOption('twenties');
  await page.waitForFunction(()=>window.__faceMasterQA().male?.v49AgeCreases?.count===0,
   null,{timeout:90000});
  await page.screenshot({path:out+'/male-restored20s.png',
   timeout:90000,animations:'disabled'});
  if(errors.length)throw Error('browser JS '+errors.slice(0,4).join(';'));
  console.log('FACE_V50_BROWSER_OK: male 20s, 80s, five named 3D cuts, reset');
 }finally{await browser.close();}
})().catch(e=>{console.error('FACE_V50_BROWSER_FAIL',e);process.exitCode=1;});
