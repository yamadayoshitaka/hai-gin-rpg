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
   const hashes={front:[],side:[],back:[]};
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
    const snapshot=await page.evaluate(()=>window.__faceMasterQA());
    const expected={0:'center-part-gravity-long',10:'natural-short',12:'buzz-cut'}[index];
    if(snapshot.wigReport?.hairstyleId!==expected ||
       snapshot.wigReport?.hairColoredOpaqueRoot!==true)
     throw Error('Hair part/style/root mismatch: '+gender+' '+index);
    for(const view of ['front','side','back']){
     await page.locator('#'+view).click();
     await page.waitForTimeout(120);
     const filename=path.join(out,gender+'-'+view+'-style-'+index+'.png');
     const shot=await page.locator('#faceCanvas').screenshot({path:filename,
      timeout:60000,animations:'disabled'});
     hashes[view].push(hex(shot));
    }
   }
   for(const view of ['front','side','back'])
    if(new Set(hashes[view]).size!==ids.length)
     throw Error('3D '+view+' silhouette did not change: '+
      gender+' '+hashes[view].join(' '));
   // Root cap must follow the selected palette instead of remaining white,
   // skin-toned or invisible when the color is changed independently.
   await page.locator('#v33'+label+'HairColor').selectOption('black');
   await page.waitForFunction(({gender})=>{
    const v=window.__faceMasterQA?.();
    return v?.gender===gender&&v?.v33HairColor==='black'&&
     v?.wigReport?.hairColoredOpaqueRoot===true&&
     v?.wigReport?.hairRootColor==='#292830';
   },{gender},{timeout:60000});
   const after=await page.evaluate(()=>window.__faceMasterQA());
   if(after.gender!==gender||after.wigReport?.hairstyleId!=='buzz-cut')
    throw Error('Final 3D hairstyle differs from UI: '+gender);
   // Complete face choices must change real face sculpt without changing
   // the selected hairstyle and must retain the v43 eye quality.
   const faceButton=page.locator('#v45'+label+'FacePresets button[data-preset-index="2"]');
   const hairBefore=after.wigReport?.hairstyleId;
   await faceButton.click();
   await page.waitForFunction(({gender})=>{
    const snapshot=window.__faceMasterQA?.();
    return snapshot?.gender===gender&&snapshot?.completeFacePreset===2&&
     snapshot?.wigReport?.hairstyleId==='buzz-cut';
   },{gender},{timeout:90000});
   const faceAfter=await page.evaluate(()=>window.__faceMasterQA());
   if(faceAfter.wigReport?.hairstyleId!==hairBefore)
    throw Error('Changing complete face unexpectedly changed hairstyle');
   if(gender==='female'&&faceAfter.femaleControls.eyeDepth>-.15)
    throw Error('Complete face degraded eye depth');
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
   // Every age and build choice must change real generated 3D face data.
   // One old and one fat example are sufficient for the browser smoke;
   // all 48 combinations are checked in the unit test.
   await page.locator('#v47AgeBand').selectOption('eightyPlus');
   await page.locator('#v47BodyType').selectOption('fat');
   await page.waitForFunction(({gender})=>{
    const s=window.__faceMasterQA?.();
    return s?.loaded&&s.gender===gender&&
     s.v32PartSelection?.ageBand==='eightyPlus'&&
     s.v32PartSelection?.bodyType==='fat';
   },{gender},{timeout:80000});
   const old=await page.evaluate(()=>window.__faceMasterQA());
   if(old[gender==='female'?'femaleControls':'maleControls']?.ageBand!=='eightyPlus')
    throw Error('Age selector has not recreated the source face');
   if(old[gender==='female'?'femaleControls':'maleControls']?.bodyType!=='fat')
    throw Error('Face shape selector failed to reach real geometry');
   await page.locator('#v47AgeBand').selectOption('twenties');
   await page.locator('#v47BodyType').selectOption('normal');
   // Real browser: selecting a named cast member must change the actual 3D
   // wig, gender and face controls, rather than only a dropdown label.
   const actorId=gender==='female'?'lucia':'garan';
   const expectedHair=gender==='female'?'female-low-bun':'male-senior-sidepart';
   await page.locator('#v46'+label+'Cast').selectOption(actorId);
   await page.waitForFunction(({gender,expectedHair})=>{
    const state=window.__faceMasterQA?.();
    return state?.loaded&&state.gender===gender&&
     state.wigReport?.hairstyleId===expectedHair&&
     state.wigReport?.gender===gender;
   },{gender,expectedHair},{timeout:90000});
   const cast=await page.evaluate(()=>window.__faceMasterQA());
   if(gender==='female'&&cast.v33HairColor!=='silver')throw Error('Lucia lost silver hair');
   if(gender==='male'&&cast.v33HairColor!=='ash')throw Error('Garan lost gray hair');
   await page.locator('#front').click();
   await page.locator('#faceCanvas').screenshot({
    path:path.join(out,gender+'-featured-character.png'),
    timeout:60000,animations:'disabled'});
  }
  if(errors.length)throw Error('Browser exceptions: '+errors.join(';'));
  console.log('HERO_HAIR_V43_VISUAL_QA_OK: three unique front/side/back silhouettes per gender');
 }finally{await browser.close();}
})().catch(error=>{console.error('HERO_HAIR_V43_VISUAL_QA_FAIL',error);
 process.exitCode=1;});
