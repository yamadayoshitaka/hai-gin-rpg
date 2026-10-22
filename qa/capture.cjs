const { chromium } = require('playwright');
const fs = require('node:fs');
const base = process.env.QA_URL || 'http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 const dir='qa-screenshots';fs.mkdirSync(dir,{recursive:true});
 const results=[];
 for(const id of [0,2,5,8,9,11]){
  const page=await browser.newPage({viewport:{width:430,height:932},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=new URL(base);url.searchParams.set('qaShot',String(id));url.searchParams.set('qa','0');url.searchParams.set('build','qa');
  await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:45000});
  try{await page.waitForFunction(()=>document.body.dataset.qaShotReady==='true',{timeout:25000});await page.waitForTimeout(1500)}catch(e){errors.push('QA shot not ready: '+e.message)}
  await page.screenshot({path:dir+'/building-'+String(id).padStart(2,'0')+'.png'});
  const build=await page.locator('.brand small').textContent().catch(()=>null);
  results.push({id,build,errors});
  await page.close();
 }
 fs.writeFileSync(dir+'/report.json',JSON.stringify(results,null,2));
 await browser.close();
 console.log(JSON.stringify(results,null,2));
 if(results.some(r=>r.errors.length))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});