'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const out='qa-screenshots/hero-hair-v43';
fs.mkdirSync(out,{recursive:true});
const hex=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader'
 ]});
 try{
  const page=await browser.newPage({viewport:{width:900,height:900},
   deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:8766/face-mesh-studio.html?gender=female&hero=1&v=43',
   {waitUntil:'domcontentloaded',timeout:65000});
  await page.waitForFunction(()=>window.__faceMasterQA?.().loaded===true,
   null,{timeout:120000});
  // Test the real canvas, not text labels. Each gender must render
  // three independently shaped cuts and keep 3-layer opaque geometry.
  for(const gender of ['female','male']){
   await page.locator('#'+gender).click();
   const prior=await page.evaluate(()=>window.__faceMasterQA());
   const label=gender==='female'?'Female':'Male';
   const hashes=[];
   const ids=[0,10,12];
   for(const index of ids){
    const field=page.locator('#v32'+label+'Hair');
    await field.selectOption(String(index));
    await page.waitForFunction(({gender,index})=>{
     const v=window.__faceMasterQA?.();
     return v?.loaded&&v.gender===gender&&v.v32PartSelection?.hair===index&&
      v.wigReport?.normalLayerCount===3&&v.wigReport?.meshCount===1&&
      v.wigReport?.gender===gender;
    },{gender,index},{timeout:60000});
    await page.locator('#front').click();
    await page.waitForTimeout(120);
    const filename=path.join(out,gender+'-style-'+index+'.png');
    const shot=await page.locator('#faceCanvas').screenshot({path:filename,
     timeout:60000,animations:'disabled'});
    hashes.push(hex(shot));
   }
   if(new Set(hashes).size!==ids.length)
    throw Error('Real rendered hair did not visually change: '+
     gender+' '+hashes.join(' '));
   const after=await page.evaluate(()=>window.__faceMasterQA());
   if(after.gender!==gender||after.wigReport?.hairstyleId!=='buzz-cut')
    throw Error('Final 3D hairstyle differs from UI: '+gender);
   if(gender==='female'){
    if(after.femaleControls.irisDiameter!==prior.femaleControls.irisDiameter)
     throw Error('Changing hair reset the heroine iris');
    await page.locator('#heroineBeautyV43').click();
    const beauty=await page.evaluate(()=>window.__faceMasterQA());
    if(beauty.femaleControls.irisDiameter<1.30||
       beauty.femaleControls.eyeDepth>-.15||
       beauty.femaleControls.lashCurl<1.1)
     throw Error('Heroine v43 optical preset was not applied');
    await page.locator('#front').click();
    await page.locator('#faceCanvas').screenshot({
     path:path.join(out,'female-v43-eyes-after-beauty.png'),
     timeout:60000,animations:'disabled'});
   }
  }
  if(errors.length)throw Error('Browser exceptions: '+errors.join(';'));
  console.log('HERO_HAIR_V43_VISUAL_QA_OK: three visibly distinct styles for each gender');
 }finally{await browser.close();}
})().catch(error=>{console.error('HERO_HAIR_V43_VISUAL_QA_FAIL',error);
 process.exitCode=1;});
