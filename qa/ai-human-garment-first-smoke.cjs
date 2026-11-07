const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const out='qa-screenshots/ai-human-garment-first';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:470,height:920},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/swordsman-ai-test.html?baselineSmoke=1',{waitUntil:'domcontentloaded',timeout:50000});
  await page.waitForFunction(()=>{
   const qa=window.__swordsmanAICompareQA?.();
   return qa?.baseline===true&&qa?.loaded===true&&qa?.bodyBones>=60
     &&qa?.skinMaskEnabled===true;
  },null,{timeout:115000,polling:600});
  const baseline=await page.evaluate(()=>window.__swordsmanAICompareQA());
  if(!baseline.label.includes('現行'))throw Error('Inferior free sample is being used by default');
  if((await page.locator('#candidateOrigin').innerText()).includes('現在表示中：既存の低精細'))
   throw Error('Legacy low-poly sample auto-selected');
  console.log('ORIGINAL_SWORDSMAN_BASELINE',JSON.stringify(baseline));
  await page.locator('#preview').screenshot({path:path.join(out,'original-swordsman-with-native-garment-mask.png')});
  await page.locator('#hideCoveredSkin').uncheck();
  await page.waitForFunction(()=>window.__swordsmanAICompareQA?.().skinMaskEnabled===false);
  await page.locator('#preview').screenshot({path:path.join(out,'unmasked-original-for-qa.png')});
  await page.locator('#hideCoveredSkin').check();
  await page.waitForFunction(()=>window.__swordsmanAICompareQA?.().skinMaskEnabled===true);
  const skinText=await page.locator('#skinMaskStatus').innerText();
  if(!skinText.includes('現行ゲームの衣装表面'))throw Error('Not using native wardrobe skin masking: '+skinText);
  for(const angle of ['side','back']){
   await page.locator('[data-angle="'+angle+'"]').click();
   await page.locator('#preview').screenshot({path:path.join(out,'original-swordsman-'+angle+'.png')});
  }
  // Test separate human import with a declared NON-AI sample; the new human
  // must scale to the outfit, never resize the existing rigged outfit.
  await page.locator('#bodyCandidate').setInputFiles('assets/characters/free-knight/knight_male_body.glb');
  await page.waitForFunction(()=>window.__swordsmanAICompareQA?.().bodySource==='ai-human-candidate',null,{timeout:55000});
  const imported=await page.evaluate(()=>window.__swordsmanAICompareQA());
  if(!imported.baseline||!imported.bodyCandidate?.fit)
   throw Error('Garment body candidate not fitted using actual outfit');
  if(imported.bodyCandidate.gameApproved!==false)
   throw Error('Imported human was incorrectly approved for production combat');
  if(typeof imported.bodyCandidate.fit.fullLength!=='boolean')
   throw Error('Garment-first fit fullLength must be a boolean');
  console.log('BODY_CANDIDATE_FITTED',JSON.stringify(imported.bodyCandidate));
  await page.locator('#preview').screenshot({path:path.join(out,'nonai-body-import-proof.png')});
  await page.locator('#restoreHuman').click();
  await page.waitForFunction(()=>window.__swordsmanAICompareQA?.().bodySource==='existing-game-human');
  if(errors.length)throw Error('Browser JavaScript errors: '+JSON.stringify(errors));
  const report={existingBaseline:true,bodyBones:baseline.bodyBones,
   nativeMaskDefaultOn:true,maskToggleWorks:true,
   aiBodyLoaderWorks:true,clothingRemainsAuthoritative:true,
   candidateSampleActuallyAI:false,returnedToOriginalHuman:true,
   newAIGenerated:false,errors};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('AI_HUMAN_GARMENT_FIRST_TEST_PASS',JSON.stringify(report));
 }finally{await browser.close()}
})().catch(e=>{console.error('AI_HUMAN_GARMENT_FIRST_TEST_FAILED',e);process.exitCode=1});
