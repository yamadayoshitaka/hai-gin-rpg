const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:412,height:915},isMobile:true,hasTouch:true});
  const failures=[],exceptions=[];
  page.on('pageerror',e=>exceptions.push(e.message));
  await page.goto('http://127.0.0.1:8765/action-test.html?visual-audit=12748',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.__actionTestQA==='function',null,{timeout:30000});
  fs.mkdirSync('qa-screenshots',{recursive:true});
  for(const field of ['body','face','hair','outfit','equipment']){
   const options=await page.locator('#edit-'+field+' option').evaluateAll(a=>a.map(n=>n.value));
   for(const value of options){
    await page.selectOption('#edit-'+field,value);
    await page.waitForTimeout(900);
    const qa=await page.evaluate(()=>window.__actionTestQA());
    const state=await page.evaluate(()=>document.querySelector('#edit-'+field)?.value).catch(()=>null);
    if(state!==value)failures.push(field+'='+value+': UI selection reverted');
    if(!qa.hasRig)failures.push(field+'='+value+': rig missing');
    if(qa.equipment?.requested!==await page.locator('#edit-equipment').inputValue())failures.push(field+'='+value+': weapon mismatch');
   }
   await page.screenshot({path:'qa-screenshots/audit-'+field+'.png'});
  }
  for(const name of ['idle','walk','run','attack','guard','hit','dead']){
   await page.getByRole('button',{name:({idle:'待機',walk:'歩行',run:'ダッシュ',guard:'防御',hit:'被弾',dead:'戦闘不能'})[name]||/特技/}).first().click().catch(()=>{failures.push('button missing: '+name)});
   await page.waitForTimeout(350);
   const qa=await page.evaluate(()=>window.__actionTestQA());
   if(qa.action!==name)failures.push('motion '+name+' became '+qa.action);
   await page.screenshot({path:'qa-screenshots/motion-'+name+'.png'});
  }
  console.log('Character selection and action browser QA',JSON.stringify({failures,exceptions}));
  if(failures.length||exceptions.length)throw Error('Visual QA failure '+failures.join(' | ')+' JS '+exceptions.join(' | '));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
