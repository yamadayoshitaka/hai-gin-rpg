/* Real Android-viewport startup smoke for the shared battle renderer in peaceful town mode.
 * No fake geometry; asserts original stage renderer and skinned actor pipeline completed.
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:412,height:915},isMobile:true,hasTouch:true});
 const errors=[];
 page.on('pageerror',e=>errors.push('PARENT '+e.message));
 page.on('frameattached',frame=>frame.on('pageerror',e=>errors.push('TOWN '+e.message)));
 try{
  let r=await page.goto('http://127.0.0.1:8765/game.html?qa=real-stage-town',{waitUntil:'domcontentloaded',timeout:35000});
  assert.ok(r?.ok(),'Title returned HTTP error');
  await page.locator('#skip').click();
  await page.locator('#newGame').click();
  await page.locator('#playerName').fill('町テスト軍師');
  await page.locator('#playerGender').selectOption('female');
  await page.locator('#newForm button[type=submit]').click();
  await page.waitForURL(/town-hub\.html/,{timeout:20000});
  const opening=page.locator('#opening');
  if(await opening.isVisible()){
   for(let n=0;n<4;n++)await page.locator('#eventNext').click();
  }
  const frame=page.frameLocator('#townScene');
  await page.waitForFunction(()=>{
   const iframe=document.getElementById('townScene');
   return !!iframe&&/tactics-wireframe\.html\?town=1/.test(iframe.getAttribute('src')||'');
  },null,{timeout:10000});
  console.log('Town iframe points to original tactical renderer');
  const details=await page.waitForFunction(()=>{
   const child=document.getElementById('townScene')?.contentWindow;
   const report=child?.getBattleStartupStats?.();
   if(!report?.ready)return false;
   return {report,stage:child.getCurrentStage?.(),status:document.querySelector('#townStatus')?.textContent};
  },null,{timeout:190000,polling:1000});
  const report=await details.jsonValue();
  console.log('Town real stage loaded:',JSON.stringify(report));
  assert.equal(report?.stage?.id,'royal-castle');
  assert.equal(report?.report?.actors,6);
  assert.equal(report?.report?.dressed,6);
  assert.ok(report?.report?.buildingBatchStats,'real building renderer must exist');
  // The parent now shows wallet/church status. Check the real ready handshake:
  // this is the only event that removes the loading guard from controls.
  assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('town-loading')),false,
   'parent received stage-ready and unlocked controls');
  assert.equal(await page.locator('#showTownGuide').count(),1,'facility guide rendered');
  assert.equal(errors.length,0,'browser errors '+errors.join('; '));
  // The paper-theater opens after the 3D stage finishes, not before.
  if(await opening.isVisible())await page.locator('#skipPaper').click();
  await page.locator('#leaveTown').click();
  await page.waitForURL(/world-map\.html/,{timeout:25000});
  assert.equal(await page.locator('#chapterTitle').count(),1,'world map renders');
  console.log('PASS: original 3D castle, six real clothed characters, peaceful town, map exit');
 }catch(error){
  const frames=page.frames();
  for(const frame of frames){
   if(!frame.url().includes('tactics-wireframe'))continue;
   try{
    console.log('TOWN DIAGNOSTICS',JSON.stringify(await frame.evaluate(()=>({
     body:document.body.className,loading:document.getElementById('loadingStage')?.textContent,
     error:document.getElementById('loadingError')?.textContent,
     startup:window.getBattleStartupStats?.(),stage:window.getCurrentStage?.()
    }))));
   }catch{}
  }
  console.error('BROWSER ERRORS',JSON.stringify(errors));
  throw error;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});