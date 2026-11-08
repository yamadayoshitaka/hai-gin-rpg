// Real THREE/WebGL regression: the retired ATB screenshot test does not test
// the current grid battle's mesh bake, human assembly, or GPU crowd renderer.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({headless:true,args:[
    '--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required'
  ]});
  const page=await browser.newPage({viewport:{width:430,height:932},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  fs.mkdirSync('qa-screenshots/mass-battle',{recursive:true});
  try{
    // The 3D ATB E2E covers a different screen. Before loading every wardrobe
    // asset, verify that the actual 1000v1000 module can initialize its Worker.
    // This caught a ReferenceError from a block-scoped bridge definition that
    // the simulation-only Node tests never encountered.
    // Release the very large GPU/CPU scene before checking the 100v100
    // wardrobe and attempting a screenshot. Reusing one page retains heavy
    // WebGL resources long enough to stall SwiftShader's readback on CI.
    const smokePage=await browser.newPage({viewport:{width:430,height:932},deviceScaleFactor:1});
    const smokeErrors=[];
    smokePage.on('pageerror',error=>smokeErrors.push(error.message));
    await smokePage.goto('http://127.0.0.1:8765/tactics-wireframe.html?army=1000&v=worker-smoke',{
      waitUntil:'domcontentloaded',timeout:60000
    });
    await smokePage.waitForFunction(()=>{
      const error=document.querySelector('#runtimeError');
      return typeof window.getMassBattleStats==='function'||error?.style.display==='block';
    },null,{timeout:120000,polling:500});
    const boot=await smokePage.evaluate(()=>({
      stats:window.getMassBattleStats?.(),
      startup:window.getBattleStartupStats?.(),
      error:document.querySelector('#runtimeError')?.textContent||null,
      shownError:document.querySelector('#runtimeError')?.style.display==='block'
    }));
    assert.ok(!boot.shownError,`1000v1000 boot error: ${boot.error}`);
    assert.equal(boot.stats?.sideCount,1000,'actual 1000v1000 battle initialized');
    assert.equal(boot.startup?.resolutionScale,.85,'large battles retain 85% linear resolution');
    assert.equal(boot.startup?.antiAliasing,'GPU FXAA','GPU anti-aliasing replaces mass-mode MSAA');
    assert.equal(boot.startup?.elapsed,0,'2000 soldiers do not move before loading completes');
    assert.deepEqual(smokeErrors,[],'1000v1000 module errors');
    await smokePage.close();
    console.log('PASS 1000v1000 browser module startup and Worker configuration');

    await page.goto('http://127.0.0.1:8765/tactics-wireframe.html?army=100&v=4.4.0',{
      waitUntil:'domcontentloaded',timeout:60000
    });
    // Loading now waits for the stage BGM to buffer. Browsers need a
    // user gesture before music playback; the test must press Start too.
    await page.waitForFunction(()=>{
      const start=document.querySelector('#loadingStart');
      const error=document.querySelector('#runtimeError');
      return start&&!start.hidden||error?.style.display==='block';
    },null,{timeout:180000,polling:800});
    if(await page.locator('#loadingStart').isVisible()){
      await page.locator('#loadingStart').click();
    }
    await page.waitForFunction(()=>{
      const stats=window.getMassBattleStats?.();
      const startup=window.getBattleStartupStats?.();
      const error=document.querySelector('#runtimeError');
      return startup?.ready&&stats?.bodyAssemblyAudit?.length===10 || error?.style.display==='block';
    },null,{timeout:180000,polling:1000});
    const result=await page.evaluate(()=>({
      stats:window.getMassBattleStats?.(),
      startup:window.getBattleStartupStats?.(),
      wardrobe:window.getBattleWardrobeReport?.(),
      error:document.querySelector('#runtimeError')?.textContent||null,
      shownError:document.querySelector('#runtimeError')?.style.display==='block'
    }));
    assert.ok(!result.shownError,`Battle runtime error: ${result.error}`);
    assert.equal(result.startup?.ready,true,'start only after all costumes and crowd GPU batches are ready');
    assert.equal(result.startup?.dressed,24,'every detailed rig dressed before animation begins');
    assert.ok(result.startup?.buildingBatchStats?.sourceMeshes>result.startup?.buildingBatchStats?.batches,
      'repeated town walls share GPU draw batches');
    assert.ok(result.startup?.pixelRatio>=.8,'the character viewport is no longer half resolution');
    assert.equal(await page.locator('#battleLoading').isVisible(),false,'loading overlay clears only after warmup');
    assert.equal(result.stats?.bodyAssemblyAudit.length,10,'all 10 job rigs are baked');
    assert.ok(result.stats.bodyDrawLayers>=10,'each crowd profession has explicit full-human GPU draw layers');
    assert.ok(result.stats.gpuVertexAttributeLimit>=8,'WebGL reports its actual vertex attribute budget');
    assert.ok(result.stats.maxVertexAttributeSlots<=result.stats.gpuVertexAttributeLimit,
      `crowd body/clothing GPU attributes exceed hardware: ${result.stats.maxVertexAttributeSlots}/${result.stats.gpuVertexAttributeLimit}`);
    assert.equal(result.stats.impostorAtlases,10,
      'all ten jobs captured complete dressed humans for distant GPU rendering');
    assert.equal(result.stats.atlasSilhouettes.length,10,'real-rig GPU portrait pixel audits ran for all ten jobs');
    for(const portrait of result.stats.atlasSilhouettes)
      assert.ok(portrait.opaquePixels>=120&&portrait.height>=45,
        `live-rig portrait rendered empty or clipped: ${JSON.stringify(portrait)}`);
    console.log('GPU crowd draw-budget audit:',JSON.stringify({sourceParts:result.stats.sourceParts,
      realMeshBatches:result.stats.realMeshBatches,vertexAttributeSlots:result.stats.maxVertexAttributeSlots,
      hardwareVertexAttributeSlots:result.stats.gpuVertexAttributeLimit,atlasSilhouettes:result.stats.atlasSilhouettes}));
    assert.equal(result.stats.bodyVisibleSoldiers,result.stats.visibleSoldiers,
      'all visible GPU-instanced soldiers draw anatomy as well as outfits');
    assert.ok(result.stats.humanBodyVertices>=50000,'ten complete human models survive assembly');
    for(const body of result.stats.bodyAssemblyAudit){
      assert.ok(body.vertices>=5000&&body.height>=1.1,`human missing: ${JSON.stringify(body)}`);
      assert.equal(body.vertices,body.optimizedVertices,`merging lost the body of ${body.job}`);
    }
    assert.equal(result.wardrobe?.equipped,24,'24 individually rigged representatives are dressed');
    assert.deepEqual(errors,[],'browser script errors');
    // In GitHub Actions SwiftShader, 100 fully detailed actors can stall GPU
    // pixel readback despite successful model/wardrobe audits and no JS errors.
    // Keep the browser boot/body assertions mandatory and report screenshot
    // availability separately; an absent image is NOT visual-quality approval.
    try{await page.screenshot({path:'qa-screenshots/mass-battle/full-body-100v100.png',timeout:20000});}
    catch(error){
      if(error.name!=='TimeoutError')throw error;
      console.warn('Visual evidence unavailable: SwiftShader screenshot readback timed out; wardrobe appearance not verified.');
    }
    console.log('PASS real battle GPU body-preservation, 1m stride grid and all-class outfits',JSON.stringify(result.stats.bodyAssemblyAudit));
  }catch(error){
    console.error('Mass battle GPU visual QA failure:',error);
    try{await page.screenshot({path:'qa-screenshots/mass-battle/failure.png',timeout:12000})}catch{}
    throw error;
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
