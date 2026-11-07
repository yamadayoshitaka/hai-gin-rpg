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
   return qa?.loaded&&qa.photoFinish===true&&qa.finishSummary?.applied>0;
  },null,{timeout:65000});
  const finished=await page.evaluate(()=>window.__swordsmanAICompareQA());
  console.log('PHOTO_STEEL_APPLIED',JSON.stringify(finished));
  await page.locator('#preview').screenshot({path:path.join(folder,'free-knight-photo-steel.png')});
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
   sourceTriangles:finished.stats.triangles,comparisonToggleWorks:true,errors};
  fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify(summary,null,2)+'\n');
  console.log('PHOTO_STEEL_TEST_PASS',JSON.stringify(summary));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
