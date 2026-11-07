const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const folder='qa-screenshots/ai-steel-finish';
fs.mkdirSync(folder,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:960,height:850},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/swordsman-ai-test.html?photoSteelSmoke=1',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('#candidate').setInputFiles('assets/characters/free-knight/knight_full_plate_armor.glb');
  await page.waitForFunction(()=>{
   const qa=window.__swordsmanAICompareQA?.();
   return qa?.loaded&&qa.realHumanLoaded&&qa.bodyBones>=30&&qa.fit?.armorParts>0&&qa.photoFinish===true&&qa.finishSummary?.applied>0&&qa.idlePoseReady===true&&qa.gauntletMoved>=6;
  },null,{timeout:65000});
  const finished=await page.evaluate(()=>window.__swordsmanAICompareQA());
  console.log('PHOTO_STEEL_APPLIED',JSON.stringify(finished));
  if(finished.fit.floorError>.14)throw Error('Imported armor floats off the real body feet: '+finished.fit.floorError);
  if(finished.fit.centerError>.6)throw Error('Armor displaced from game human: '+finished.fit.centerError);
  if(finished.fit.rigReady!==false)throw Error('Unrigged sample must not be represented as animated');
  await page.locator('#preview').screenshot({path:path.join(folder,'free-knight-photo-steel.png')});
  await page.locator('[data-visual="body"]').click();
  await page.waitForFunction(()=>window.__swordsmanAICompareQA?.().visibleMode==='body');
  await page.locator('#preview').screenshot({path:path.join(folder,'game-male-real-rig.png')});
  await page.locator('[data-visual="armor"]').click();
  await page.waitForFunction(()=>window.__swordsmanAICompareQA?.().visibleMode==='armor');
  await page.locator('#preview').screenshot({path:path.join(folder,'armor-only-photo-steel.png')});
  await page.locator('[data-visual="both"]').click();
  await page.waitForFunction(()=>window.__swordsmanAICompareQA?.().visibleMode==='both');
  for(const angle of ['side','back']){
   await page.locator('[data-angle="'+angle+'"]').click();
   await page.locator('#preview').screenshot({path:path.join(folder,'human-armor-'+angle+'.png')});
  }
  await page.locator('[data-angle="front"]').click();
  await page.locator('#fitAdjustments summary').click();
  await page.locator('#fitZ').evaluate(el=>{el.value='0.05';el.dispatchEvent(new Event('input',{bubbles:true}))});
  const adjusted=await page.locator('#fitZValue').textContent();
  if(adjusted!=='0.05')throw Error('Depth control did not update');
  await page.locator('#resetFit').click();
  if((await page.locator('#fitZValue').textContent())!=='0.00')throw Error('Reset fit failed');

  await page.locator('#steelFinish').uncheck();
  await page.waitForFunction(()=>window.__swordsmanAICompareQA?.().photoFinish===false,null,{timeout:12000});
  await page.locator('#preview').screenshot({path:path.join(folder,'free-knight-original.png')});
  await page.locator('#steelFinish').check();
  await page.waitForFunction(()=>window.__swordsmanAICompareQA?.().photoFinish===true,null,{timeout:30000});
  await page.locator('#preview').screenshot({path:path.join(folder,'free-knight-photo-steel-restored.png')});
  const after=await page.evaluate(()=>window.__swordsmanAICompareQA());
  if(after.stats.meshes!==finished.stats.meshes||after.stats.triangles!==finished.stats.triangles)
   throw Error('Geometry counts drifted across reversible test');
  if(errors.length)throw Error('Client JavaScript errors: '+errors.join('; '));
  const summary={label:'existing GLB used ONLY to test finish, NOT AI-generated',
   applied:finished.finishSummary?.applied,uvGenerated:finished.finishSummary?.uvGenerated,
   sourceTriangles:finished.stats.triangles,comparisonToggleWorks:true,realMaleLoaded:finished.realHumanLoaded,bodyBones:finished.bodyBones,
   fit:finished.fit,frontSideBackCaptured:true,armorBodyVisibilityToggle:true,depthAdjustmentReset:true,idlePoseReady:finished.idlePoseReady,alignedGauntlets:finished.gauntletMoved,errors};
  fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify(summary,null,2)+'\n');
  console.log('PHOTO_STEEL_TEST_PASS',JSON.stringify(summary));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
