'use strict';
// Render the ACTUAL Three.js bestiary viewport. Geometry-only QA is not a
// replacement for verifying the 82-feather guardian wing under WebGL.
// Screenshots are technical QA candidates, never automatic art approval.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const folder=process.argv[2]||'qa-reports/avian-guardian-visual';
const ids=['m011','m012','m013','m014'];
(async()=>{
 fs.mkdirSync(folder,{recursive:true});
 const browser=await chromium.launch({
  headless:true,args:['--use-gl=angle','--use-angle=swiftshader',
   '--enable-webgl','--ignore-gpu-blocklist']});
 const report=[];
 try{
  for(const id of ids){
   const page=await browser.newPage({viewport:{width:1000,height:710},
    deviceScaleFactor:1});
   const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   try{
    await page.goto('http://127.0.0.1:8765/monster-manager.html?monster='+id+
     '&v=guardian-82-feather-20261118',
     {waitUntil:'domcontentloaded',timeout:90000});
    await page.waitForFunction(expected=>{
     const v=window.__monsterQualityQA?.();
     const wing=window.__avianWingQA?.();
     return v?.id===expected&&Number(v.meshes)>10&&wing?.id===expected;
    },id,{timeout:70000});
    const state=await page.evaluate(()=>window.__avianWingQA());
    if(!state||state.donor!=='seraph_guardian'||
      !state.wings.every(w=>w&&w.donor==='seraph_guardian'&&
       w.layers===3&&w.feathers===82&&w.shoulder&&w.elbow&&w.wrist))
      throw Error(id+' original guardian wing donor absent: '+JSON.stringify(state));
    if(state.bodyFeathers<100||state.tail<9)
      throw Error(id+' rebuilt plumage missing: '+JSON.stringify(state));
    const frames=[];
    for(const action of ['idle','run','attack']){
     await page.locator('#actions button[title="'+action+'"]').click({timeout:15000});
     await page.waitForFunction(a=>
      window.__monsterViewerLayoutQA?.()?.selectedMotion===a,
      action,{timeout:12000});
     await page.waitForTimeout(220);
     const filename=path.join(folder,id+'-'+action+'.png');
     const image=await page.locator('#view canvas').screenshot({
      path:filename,timeout:45000});
     if(image.byteLength<12000)
      throw Error(id+' '+action+' empty GPU frame: '+image.byteLength);
     frames.push({name:filename,bytes:image.byteLength,action});
    }
    if(id==='m013'){
     for(const angle of ['front','side','back']){
      const result=await page.evaluate(a=>window.__beastFaceCameraQA?.(a),angle);
      if(result?.id!==id)throw Error('Phoenix '+angle+' camera failed');
      await page.waitForTimeout(220);
      const filename=path.join(folder,'m013-'+angle+'.png');
      const image=await page.locator('#view canvas').screenshot({
       path:filename,timeout:45000});
      if(image.byteLength<12000)throw Error('Phoenix '+angle+' blank render');
      frames.push({name:filename,bytes:image.byteLength,action:'camera-'+angle});
     }
    }
    if(errors.length)throw Error(id+' Javascript: '+errors.join(' / '));
    report.push({id,source:state.donor,wingLayers:3,
     feathersPerWing:82,bodyFeathers:state.bodyFeathers,
     frames,technicalPass:true,visualApproved:false});
   }finally{await page.close();}
  }
  const summary={status:'webgl-capture-complete-not-art-approved',
   species:ids,reference:'original-seraph-82-feather-wing',results:report,
   date:new Date().toISOString()};
  fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify(summary,null,2));
  console.log(JSON.stringify({status:summary.status,frames:report.flatMap(x=>x.frames).length,
   species:report.map(x=>x.id)}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
