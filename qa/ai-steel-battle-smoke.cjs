const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const out='qa-screenshots/ai-steel-finish';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage({viewport:{width:440,height:930},deviceScaleFactor:1});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://127.0.0.1:8765/tactics-wireframe.html?army=100&aiSteelTrial=1',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>{
    const error=document.querySelector('#runtimeError');
    const state=window.__aiSteelBattleQA?.();
    const started=window.getBattleStartupStats?.();
    return (started?.ready&&state?.actorId)||error?.style.display==='block';
  },null,{timeout:180000,polling:1000});
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
