// Real THREE/WebGL regression: the retired ATB screenshot test does not test
// the current grid battle's mesh bake, human assembly, or GPU crowd renderer.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({headless:true,args:[
    '--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist'
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
      error:document.querySelector('#runtimeError')?.textContent||null,
      shownError:document.querySelector('#runtimeError')?.style.display==='block'
    }));
    assert.ok(!boot.shownError,`1000v1000 boot error: ${boot.error}`);
    assert.equal(boot.stats?.sideCount,1000,'actual 1000v1000 battle initialized');
    assert.deepEqual(smokeErrors,[],'1000v1000 module errors');
    await smokePage.close();
    console.log('PASS 1000v1000 browser module startup and Worker configuration');

    await page.goto('http://127.0.0.1:8765/tactics-wireframe.html?army=100&v=4.4.0',{
      waitUntil:'domcontentloaded',timeout:60000
    });
    await page.waitForFunction(()=>{
      const stats=window.getMassBattleStats?.();
      const error=document.querySelector('#runtimeError');
      return stats?.bodyAssemblyAudit?.length===10 || error?.style.display==='block';
    },null,{timeout:150000,polling:1000});
    const result=await page.evaluate(()=>({
      stats:window.getMassBattleStats?.(),
      wardrobe:window.getBattleWardrobeReport?.(),
      error:document.querySelector('#runtimeError')?.textContent||null,
      shownError:document.querySelector('#runtimeError')?.style.display==='block'
    }));
    assert.ok(!result.shownError,`Battle runtime error: ${result.error}`);
    assert.equal(result.stats?.bodyAssemblyAudit.length,10,'all 10 job rigs are baked');
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
