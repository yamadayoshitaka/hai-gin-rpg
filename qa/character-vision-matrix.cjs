// Capture deterministic references for every job/sex/action for optional Vision AI review.
// Failure to load an actual model is a hard failure; screenshots are evidence, not proof of naturalness.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const out='qa-screenshots/vision-matrix';
fs.mkdirSync(out,{recursive:true});
const actions=['idle','walk','run','attack','guard','hit','dead'];
const shots=[];
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:412,height:915},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/action-test.html?qa=matrix',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__actionTestQA?.().visibleModels?.length===1,null,{timeout:45000});
  const jobs=await page.locator('#job option').evaluateAll(nodes=>nodes.map(x=>x.value));
  const selected=process.env.QA_JOB?jobs.filter(x=>x===process.env.QA_JOB):jobs;
  for(const job of selected)for(const sex of ['male','female']){
   await page.selectOption('#job',job);await page.selectOption('#sex',sex);
   await page.waitForFunction(args=>{const q=window.__actionTestQA?.();return q?.job===args.job&&q?.visibleModels?.length===1}, {job,sex},{timeout:45000});
   for(let i=0;i<actions.length;i++){
    await page.locator('#actions button').nth(i).click();
    await page.waitForTimeout(actions[i]==='dead'?750:actions[i]==='guard'?500:350);
    const qa=await page.evaluate(()=>window.__actionTestQA?.());
    const filename=job+'-'+sex+'-'+actions[i]+'.png';
    const file=path.join(out,filename);
    await page.locator('#view').screenshot({path:file});
    shots.push({job,sex,action:actions[i],filename,model:qa?.visibleModels?.[0]||null,pose:qa?.poseDiagnostics||null,equipment:qa?.equipment?.requested,warning:qa?.visibleModels?.length!==1?'model not visible':null});
   }
  }
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({version:1,shots,errors,reviewRubric:{hair:'scalp silhouette, no floating disc or clipping',weapon:'visible hand grip and blade free of palm intersections',motion:'grounded walk/run and smooth attack',guard:'arms and torso protective stance',dead:'fallen natural posture, no foot penetration',outfit:'model looks appropriate to selected job'}},null,2));
  console.log('Vision matrix generated',shots.length,'frames',selected.length,'jobs',errors.length,'JS errors');
  if(errors.length||shots.some(x=>x.warning))process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
