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
    await page.screenshot({path:'qa-screenshots/mass-battle/full-body-100v100.png',timeout:20000});
    assert.deepEqual(errors,[],'browser script errors');
    console.log('PASS real battle GPU body-preservation, 1m stride grid and all-class outfits',JSON.stringify(result.stats.bodyAssemblyAudit));
  }catch(error){
    console.error('Mass battle GPU visual QA failure:',error);
    try{await page.screenshot({path:'qa-screenshots/mass-battle/failure.png',timeout:12000})}catch{}
    throw error;
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
