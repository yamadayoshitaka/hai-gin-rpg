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
  // Check the 20 visible outdoor inhabitants plus the six fully rigged
  // player/shopkeepers. Their count must be observable in the actual 3D scene.
  const stats=await page.evaluate(()=>document.querySelector('#townScene').contentWindow.getTownVisitStats());
  assert.ok(stats.streetCitizens>=20,'at least 20 outdoor people must exist');
  assert.ok(stats.people>=26,'the 3D stage must contain townsfolk beyond hidden shopkeepers');
  const sunBefore=JSON.stringify([stats.shadowLight,stats.shadowTarget]);
  await page.waitForTimeout(1000);
  const sunAfter=await page.evaluate(()=>document.querySelector('#townScene').contentWindow.getTownVisitStats());
  assert.equal(JSON.stringify([sunAfter.shadowLight,sunAfter.shadowTarget]),sunBefore,
   'the sun/shadow projection must never jump while moving or visiting buildings');

  // Full town map must represent actual terrain and rooftops, not a decorative
  // unchanging background. Its canvas pixels must be populated by the scene.
  await page.locator('#showTownGuide').click();
  assert.equal(await page.locator('#townGuide').isVisible(),true);
  await page.waitForFunction(()=>{
   const c=document.querySelector('#townGuideCanvas');
   return c?.getContext('2d').getImageData(125,125,1,1).data[3]===255;
  },null,{timeout:16000});
  assert.ok(await page.locator('#townGuideBoard button').count()>=6,
   'all six civic building markers must be on the map');
  await page.locator('#townOverhead').click();
  await page.waitForFunction(()=>
   document.querySelector('#townScene').contentWindow.getTownVisitStats().overview,
   null,{timeout:12000});
  await page.locator('#townCameraView').click();
  await page.waitForFunction(()=>
   !document.querySelector('#townScene').contentWindow.getTownVisitStats().overview,
   null,{timeout:12000});

  // Low analogue input must really play walk clips. A full stick throw must
  // switch to run. Merely scaling the root position without changing motion
  // would reproduce the sliding animation reported on Android.
  const axis=async(x,y)=>page.evaluate(({x,y})=>{
   const frame=document.querySelector('#townScene');
   const stageId=new URL(frame.src).searchParams.get('townStage');
   frame.contentWindow.postMessage({type:'hai-gin-town-input',stageId,x,y},location.origin);
  },{x,y});
  await axis(.34,0);
  await page.waitForFunction(()=>
   document.querySelector('#townScene').contentWindow.getTownVisitStats().movement==='walk',
   null,{timeout:10000});
  const walkStats=await page.evaluate(()=>document.querySelector('#townScene').contentWindow.getTownVisitStats());
  await axis(1,0);
  await page.waitForFunction(()=>
   document.querySelector('#townScene').contentWindow.getTownVisitStats().movement==='run',
   null,{timeout:10000});
  const runStats=await page.evaluate(()=>document.querySelector('#townScene').contentWindow.getTownVisitStats());
  assert.ok(runStats.movementSpeed>walkStats.movementSpeed*1.5,
   'walking must be physically slower than the full-speed dash');
  assert.equal(runStats.shadowLive,true,
   'the full shadow map must follow running people every rendered frame');
  await axis(0,0);

  // Exercise real door proximity via the same button a mobile user taps.
  // Only the QA browser may position the hero at the shop's authored entrance;
  // the production build has no teleport/debug entry controls.
  const positioned=await page.evaluate(()=>
   document.querySelector('#townScene').contentWindow.__qaPlaceTownAvatarAtEntrance('shop'));
  assert.ok(positioned,'QA can stand at the existing item shop doorway');
  await page.locator('#townInteract').click();
  await page.waitForFunction(()=>
   document.querySelector('#townScene').contentWindow.getTownVisitStats().indoor==='shop',
   null,{timeout:12000});
  assert.equal(await page.locator('#townExitBuilding').isVisible(),true,
   'entering the actual 3D building displays an exit');
  const shopStats=await page.evaluate(()=>document.querySelector('#townScene').contentWindow.getTownVisitStats());
  assert.equal(shopStats.roomDecorVisible,true,'interior decoration is visible while inside the shop');
  assert.ok(shopStats.roomDecorCount>=6,'room contains multiple non-colliding visual objects');
  await page.locator('#townInteract').click();
  await page.waitForFunction(()=>!document.querySelector('#panel').hidden,null,{timeout:12000});
  assert.match(await page.locator('#panelTitle').innerText(),/道具屋/,
   'talking to the indoor shopkeeper opens the real shop');
  await page.locator('#panelClose').click();
  await page.locator('#townExitBuilding').click();
  await page.waitForFunction(()=>
   document.querySelector('#townScene').contentWindow.getTownVisitStats().indoor===null,
   null,{timeout:12000});
  const inCastle=await page.evaluate(()=>
   document.querySelector('#townScene').contentWindow.__qaPlaceTownAvatarAtEntrance('castle'));
  assert.ok(inCastle,'the authoring map includes a castle doorway');
  await page.locator('#townInteract').click();
  await page.waitForFunction(()=>
   document.querySelector('#townScene').contentWindow.getTownVisitStats().indoor==='castle',
   null,{timeout:12000});
  const castleStats=await page.evaluate(()=>document.querySelector('#townScene').contentWindow.getTownVisitStats());
  assert.ok(castleStats.roomDecorVisible,'royal hall must be visible when visiting');
  assert.ok(castleStats.royalFamily.includes('国王')&&castleStats.royalFamily.includes('王女'),
   'the throne room has the king and princess');
  await page.locator('#townExitBuilding').click();
  await page.waitForFunction(()=>
   document.querySelector('#townScene').contentWindow.getTownVisitStats().indoor===null,
   null,{timeout:12000});
  assert.equal(errors.length,0,'no browser errors after shop and castle: '+errors.join('; '));
  await page.locator('#leaveTown').click();
  await page.waitForURL(/world-map\.html/,{timeout:25000});
  assert.equal(await page.locator('#chapterTitle').count(),1,'world map renders');
  console.log('PASS: original 3D castle, whole-town map, walk/run, live shadow, decorated shop and occupied castle');
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