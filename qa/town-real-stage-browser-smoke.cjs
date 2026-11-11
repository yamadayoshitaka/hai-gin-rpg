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
  if(await page.locator('#skip').isVisible())await page.locator('#skip').click();
  await page.locator('#newGame').click();
  // Recent builds intentionally show the first-play tutorial before the name form.
  if(await page.locator('#tutorialModal').isVisible())await page.locator('#guideSkip').click();
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
  assert.equal(await page.locator('#townRadar').isVisible(),true,'battle-style town radar becomes visible once the map is ready');
  assert.ok(await page.locator('#townRadarPins button').count()>=6,'all civic buildings have mini-radar pins');
  // Check the 20 visible outdoor inhabitants plus the six fully rigged
  // player/shopkeepers. Their count must be observable in the actual 3D scene.
  const stats=await page.evaluate(()=>document.querySelector('#townScene').contentWindow.getTownVisitStats());
  assert.ok(stats.streetCitizens>=20,'at least 20 outdoor people must exist');
  assert.ok(stats.people>=26,'the 3D stage must contain townsfolk beyond hidden shopkeepers');
  assert.equal(stats.sceneMode,'peaceful-exploration',
   'town movement and population must use peaceful-scene physics');
  assert.equal(stats.solidCitizens,stats.streetCitizens,
   'every loaded town resident needs a physical capsule');
  assert.equal(stats.headMeshes.length,stats.streetCitizens,
   'each registered town NPC must have an actual head geometry, not only a Head bone');
  assert.ok(stats.headMeshes.every(n=>n>=2),
   'villagers must receive actual face and eye/eyebrow mesh parts');
  assert.ok(stats.headTriangles.every(n=>n>=30),
   'all village heads must be built from real facial polygons');
  assert.ok(stats.fallbackHeadMeshes.every(n=>n>=2),
   'registered replacement shopkeepers must have restored facial meshes');
  assert.ok(stats.npcMotion.procedural>=stats.streetCitizens,
   'registered villagers without embedded animation clips must have an active full-body procedural gait');
  assert.equal(stats.npcMotion.tPoses,0,
   'all actively animated town NPCs must lower their arms rather than marching in T pose');
  assert.ok(stats.registeredFallbacks>=1,
   'oversized shopkeepers should still use the repaired catalog model and its idle pose');
  for(const [kind,heights] of [['battle-origin adults',stats.actorHeights],
    ['registered villagers',stats.citizenHeights]]){
   assert.ok(heights.length>0,kind+' must render');
   assert.ok(heights.every(h=>h>.45&&h<=2.05),
    kind+' may not contain giants or tiny proxies: '+JSON.stringify(heights));
  }
  const sunBefore=JSON.stringify([stats.shadowLight,stats.shadowTarget]);
  await page.waitForTimeout(1000);
  const sunAfter=await page.evaluate(()=>document.querySelector('#townScene').contentWindow.getTownVisitStats());
  assert.equal(JSON.stringify([sunAfter.shadowLight,sunAfter.shadowTarget]),sunBefore,
   'the sun/shadow projection must never jump while moving or visiting buildings');

  // The actual 3D interior must be reached by tapping the mini radar, not
  // by merely moving the camera to a building or showing a detached menu.
  await page.locator('#townRadarPins button[aria-label="教会に入る"]').click();
  await page.waitForFunction(()=>
   document.querySelector('#townScene').contentWindow.getTownVisitStats().indoor==='church',
   null,{timeout:18000});
  assert.equal(await page.locator('#townExitBuilding').isVisible(),true,
   'radar directly enters the real church interior');
  await page.locator('#townExitBuilding').click();
  await page.waitForFunction(()=>
   document.querySelector('#townScene').contentWindow.getTownVisitStats().indoor===null,
   null,{timeout:12000});

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
  await page.locator('#townGuideBoard button').first().click();
  await page.waitForFunction(()=>
   document.querySelector('#townScene').contentWindow.getTownVisitStats().indoor!==null,
   null,{timeout:18000});
  assert.equal(await page.locator('#townGuide').isVisible(),false,
   'whole-town map closes only after the actual building entry acknowledgement');
  await page.locator('#townExitBuilding').click();
  await page.waitForFunction(()=>
   document.querySelector('#townScene').contentWindow.getTownVisitStats().indoor===null,
   null,{timeout:12000});
  await page.locator('#showTownGuide').click();
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
  assert.ok(shopStats.roomDecorCount>=6,'room contains multiple decorated 3D objects');
  assert.ok(shopStats.indoorSolidCount>=3,'shelves and counter must block indoor walking, while carpet/bottles remain decorative');
  await page.locator('#townInteract').click();
  // Entry places the hero by the real door. Depending on this building's
  // dimensions, the keeper can still be beyond the physical talk radius.
  // Do not regress the distance check just to satisfy a stale test.
  const talkOutcome=await page.waitForFunction(()=>{
   if(!document.querySelector('#panel').hidden)return 'shop-opened';
   if((document.querySelector('#townExplorerMessage')?.textContent||'').includes('店主まで近づく'))return 'approach-keeper';
   return null;
  },null,{timeout:12000});
  if(await talkOutcome.jsonValue()==='shop-opened'){
   assert.match(await page.locator('#panelTitle').innerText(),/道具屋/,
    'talking to the nearby indoor shopkeeper opens the real shop');
   await page.locator('#panelClose').click();
  }else{
   assert.equal(await page.locator('#panel').isVisible(),false,
    'shopkeeper outside talk radius should not open a remote service panel');
  }
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
  assert.ok(castleStats.indoorSolidCount>=3,'throne, columns and furnishings must obey physical collision');
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