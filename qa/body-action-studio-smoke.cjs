const {chromium}=require('playwright');const assert=require('node:assert/strict');const path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:412,height:915},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://cdn.jsdelivr.net/npm/three@0.160.1/**',async route=>{const suffix=new URL(route.request().url()).pathname.split('/npm/three@0.160.1/')[1];await route.fulfill({path:path.resolve('node_modules/three',suffix),contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}})});
 await page.goto('http://127.0.0.1:8791/body-action-studio.html',{waitUntil:'domcontentloaded'});
 const audit=()=>page.evaluate(()=>window.__bodyActionAudit?.());
 await page.waitForFunction(()=>window.__bodyActionAudit?.().ready,{},{timeout:60000});
 for(const sex of ['female','male']){
  await page.selectOption('#sex',sex);await page.waitForFunction(s=>window.__bodyActionAudit?.().ready&&window.__bodyActionAudit().sex===s,sex,{timeout:60000});
  assert.equal((await audit()).bones,163);assert.ok((await audit()).skins>0);
  assert.equal(await page.locator('#age option').count(),9);assert.equal(await page.locator('#build option').count(),4);
  await page.selectOption('#age','eightyPlus');await page.waitForFunction(()=>window.__bodyActionAudit?.().ready&&window.__bodyActionAudit().donor.includes('senior'),{},{timeout:60000});await page.selectOption('#build','fat');assert.equal((await audit()).age,'eightyPlus');assert.ok((await audit()).height<1);
  await page.selectOption('#age','under10');await page.waitForFunction(()=>window.__bodyActionAudit?.().ready&&window.__bodyActionAudit().donor.includes('child'),{},{timeout:60000});await page.selectOption('#age','twenties');await page.waitForFunction(()=>window.__bodyActionAudit?.().ready&&/adult/.test(window.__bodyActionAudit().donor),{},{timeout:60000});await page.selectOption('#build','normal');
  await page.click('#open');await page.waitForFunction(()=>window.__bodyActionAudit().grip<.03);const opened=(await audit()).finger;
  await page.click('#close');await page.waitForFunction(()=>window.__bodyActionAudit().grip>.95);
  assert.notDeepEqual((await audit()).finger,opened);
  await page.selectOption('#item','rod');await page.click('#carry');assert.ok((await audit()).held);assert.equal((await audit()).props,1);
  await page.click('#release');assert.equal((await audit()).held,false);
  await page.click('[data-action=walk]');const hand=(await audit()).hand;await page.waitForTimeout(650);assert.notDeepEqual((await audit()).hand,hand);
  await page.click('[data-action=pickup]');await page.waitForFunction(()=>window.__bodyActionAudit().held);await page.click('#release');await page.waitForTimeout(300);assert.equal((await audit()).held,false);
  assert.ok((await audit()).finite);
 }
 assert.deepEqual(errors,[]);console.log('PASS both genders, 163 bones, grip, props, action and demographics');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});