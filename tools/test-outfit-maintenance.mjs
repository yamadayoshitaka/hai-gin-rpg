/**
 * Browser smoke/regression test for all sixteen outfits and both sexes.
 * Usage: node tools/test-outfit-maintenance.mjs http://127.0.0.1:8765
 * Requires Playwright Chromium; this script does not change repo assets.
 */
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const url=(process.argv[2]||'http://127.0.0.1:8765').replace(/\/$/,'')+'/outfit-maintenance.html';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:700,height:1000},deviceScaleFactor:1});
const failures=[],consoleErrors=[];
page.on('pageerror',e=>consoleErrors.push(e.message));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
await page.goto(url,{waitUntil:'domcontentloaded'});
const jobs=await page.locator('#jobList option').evaluateAll(nodes=>nodes.map(n=>({id:n.value,name:n.textContent})));
if(jobs.length!==16)failures.push(`Expected 16 jobs, got ${jobs.length}`);
for(const sex of ['male','female']){
  await page.selectOption('#sex',sex);
  for(const {id,name} of jobs){
    await page.selectOption('#jobList',id);
    try{
      await page.waitForFunction(()=>document.querySelector('#meshStats')?.textContent.includes('三角形'),{timeout:20000});
      await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('表示中：'),{timeout:20000});
      const n=Number((await page.locator('#meshStats').textContent()).replace(/[^\d]/g,''));
      if(n<10000)failures.push(`${sex}/${name}: only ${n} triangles`);
      if(await page.locator('#error').isVisible())failures.push(`${sex}/${name}: ${await page.locator('#error').textContent()}`);
    }catch(e){failures.push(`${sex}/${name}: ${await page.locator('#status').textContent()} / ${e.message.slice(0,100)}`)}
  }
}
await page.selectOption('#sex','female');await page.selectOption('#jobList','prince');
await page.waitForTimeout(800);
await page.click('#back');
await page.screenshot({path:'/tmp/outfit-prince-back.png'});
await page.click('#front');
await page.screenshot({path:'/tmp/outfit-prince-front.png'});
if(consoleErrors.length)failures.push(...consoleErrors.map(x=>'Console: '+x));
console.log(JSON.stringify({tested:jobs.length*2,failures,screenshots:['/tmp/outfit-prince-back.png','/tmp/outfit-prince-front.png']},null,2));
await browser.close();
process.exitCode=failures.length?1:0;
