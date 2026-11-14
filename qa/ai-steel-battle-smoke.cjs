const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const {launchBattleViaThreeStepWizard}=require('./opening-three-stage.cjs');
const out='qa-screenshots/ai-steel-finish';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage({viewport:{width:440,height:930},deviceScaleFactor:1});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://127.0.0.1:8765/tactics-wireframe.html?army=100&aiSteelTrial=1',{waitUntil:'domcontentloaded',timeout:60000});
  // This game intentionally requires a *user click* after assets finish loading.
  // Waiting for battleReady without pressing 開戦 always times out, even if
  // every shader, model and armor is fully prepared.
  try{
   // Three-stage UI is intentional. Visit 編成 → 初期号令 → 開戦
   // through user-visible controls, then use the real audio fallback.
   await launchBattleViaThreeStepWizard(page,{timeout:120000});
   await page.waitForFunction(()=>{
    const error=document.querySelector('#runtimeError');
    const state=window.__aiSteelBattleQA?.();
    return state?.actorId||state?.error||error?.style.display==='block';
   },null,{timeout:60000,polling:500});
  }catch(error){
   const diagnostic=await page.evaluate(()=>({
    boot:window.getBattleStartupStats?.(),
    steel:window.__aiSteelBattleQA?.(),
    stage:document.querySelector('#loadingStage')?.textContent,
    runtimeError:document.querySelector('#runtimeError')?.textContent,
    loadingStartHidden:document.querySelector('#loadingStart')?.hidden,
    silentHidden:document.querySelector('#loadingSkipAudio')?.hidden
   })).catch(e=>({evaluationError:String(e)}));
   await page.screenshot({path:path.join(out,'battle-startup-failed.png')}).catch(()=>{});
   throw Error('Battle start or armor trial failed: '+error+' DIAGNOSTICS '+JSON.stringify(diagnostic));
  }
  const a=await page.evaluate(()=>({
   state:window.__aiSteelBattleQA?.(),boot:window.getBattleStartupStats?.(),
   error:document.querySelector('#runtimeError')?.textContent,
   shown:document.querySelector('#runtimeError')?.style.display==='block'
  }));
  if(a.shown)throw Error('Battle boot failed: '+a.error);
  if(!a.boot?.ready||!a.state?.active||a.state.finish.applied<=0)
   throw Error('One-swordsman PBR trial did not activate: '+JSON.stringify(a.state));
  await page.screenshot({path:path.join(out,'battle-photo-steel-one-swordsman.png')});
  const btn=page.locator('#aiSteelTrialToggle');
  await btn.click();
  await page.waitForFunction(()=>window.__aiSteelBattleQA?.().active===false,null,{timeout:15000});
  await btn.click();
  await page.waitForFunction(()=>window.__aiSteelBattleQA?.().active===true,null,{timeout:20000});
  const result=await page.evaluate(()=>window.__aiSteelBattleQA());
  if(errs.length)throw Error('JS errors: '+errs.join('; '));
  const manifest={sample:'current, fully rigged swordsman, NOT AI-generated mesh',
   actorId:result.actorId,applied:result.finish.applied,rollbackVerified:true,errors:errs};
  fs.writeFileSync(path.join(out,'battle-photo-steel-qa.json'),JSON.stringify(manifest,null,2));
  console.log('BATTLE_STEEL_TRIAL_PASS',JSON.stringify(manifest));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
