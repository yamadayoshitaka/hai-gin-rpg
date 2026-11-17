'use strict';
// Actual WebGL model preview, not a static mesh count or synthetic screenshot.
// Record all captures as QA candidates. No automatic aesthetic acceptance.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const root=process.argv[2]||'qa-reports/beast-mother-visual';
const ids=['m002','m003','m004','m007','m008','m009','m010'];
(async()=>{
 fs.mkdirSync(root,{recursive:true});
 const browser=await chromium.launch({
  headless:true,args:['--use-gl=angle','--use-angle=swiftshader',
   '--enable-webgl','--ignore-gpu-blocklist']});
 const report=[];
 try{
  for(const id of ids){
   const page=await browser.newPage({viewport:{width:960,height:700},
    deviceScaleFactor:1});
   const errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   await page.goto('http://127.0.0.1:8765/monster-manager.html?monster='+id+
     '&v=beast-copy-v5',{waitUntil:'domcontentloaded',timeout:90000});
   await page.waitForFunction(expected=>{
    const q=window.__monsterQualityQA?.();
    return q?.id===expected&&Number(q.meshes)>5;
   },id,{timeout:60000});
   const state=await page.evaluate(()=>window.__monsterQualityQA());
   if(errors.length)throw Error(id+': viewer JS '+errors.join('; '));
   if(!Number.isFinite(Number(state.triangles))||state.triangles<=1000)
    throw Error(id+': missing WebGL geometry '+JSON.stringify(state));
   const frames=[];
   for(const action of ['idle','run','attack']){
    const button=page.locator('#actions button[title="'+action+'"]');
    await button.click({timeout:10000});
    await page.waitForFunction(a=>
      window.__monsterViewerLayoutQA?.()?.selectedMotion===a,action,{timeout:10000});
    await page.waitForTimeout(170);
    const name=id+'-'+action+'.png';
    const filename=path.join(root,name);
    const result=await page.locator('#view canvas').screenshot({path:filename,
     timeout:45000});
    if(result.byteLength<12000)
     throw Error(id+' '+action+': empty rendered frame');
    frames.push({action,bytes:result.byteLength,filename});
   }
   if(['m002','m007'].includes(id)){
    for(const angle of ['front','side']){
     const result=await page.evaluate(p=>window.__beastFaceCameraQA?.(p),angle);
     if(!result||result.id!==id||result.angle!==angle)
      throw Error(id+': missing real '+angle+' facial camera');
     if(id==='m002'&&(!result.carvedEyes||!result.eyeDepthFitted))
      throw Error('m002 eyes still hidden in uncaved forehead');
     if(id==='m007'&&result.cheekRoots<200)
      throw Error('m007 face cheek fur not generated');
     await page.waitForTimeout(190);
     const filename=path.join(root,id+'-'+angle+'-face.png');
     const output=await page.locator('#view canvas').screenshot({
      path:filename,timeout:45000});
     if(output.length<12000)throw Error(id+': empty '+angle+' face view');
     frames.push({action:'face-'+angle,bytes:output.length,filename});
    }
   }
   // Explicitly capture the user's problem angles: upper rear leg
   // openings and belly/hip seams. Screenshot remains a review candidate.
   for(const angle of ['back','underbody']){
    const check=await page.evaluate(p=>window.__beastFaceCameraQA?.(p),angle);
    if(!check||check.id!==id||check.angle!==angle)
     throw Error(id+': missing '+angle+' WebGL inspection view');
    if(['m007','m008','m009','m010'].includes(id)&&
       (check.closedCatLimbs!==4||!check.closedTorso))
     throw Error(id+': open cat shell '+JSON.stringify(check));
    if(['m003','m004'].includes(id)&&
       (!check.wolfFullCoat||check.wolfDonorStrands<1400))
     throw Error(id+': m001 source fur absent '+JSON.stringify(check));
    await page.waitForTimeout(220);
    const filename=path.join(root,id+'-'+angle+'-seam.png');
    const result=await page.locator('#view canvas').screenshot({
     path:filename,timeout:45000
    });
    if(result.byteLength<12000)
     throw Error(id+': empty rear/underbody visual '+angle);
    frames.push({action:'seam-'+angle,bytes:result.byteLength,filename,
     visualApproved:false});
   }
   if(errors.length)throw Error(id+': runtime error after motion '+errors.join('; '));
   report.push({id,geometry:state.triangles,meshes:state.meshes,
    frames,visualApproved:false,androidFpsVerified:false});
   await page.close();
  }
  fs.writeFileSync(path.join(root,'capture-report.json'),
   JSON.stringify({kind:'real-browser-model-candidates',report},null,2)+'\n');
  console.log('PASS: '+report.length+' actually rendered wolf/feline donor species, 3 pose frames each');
 }finally{await browser.close()}
})().catch(e=>{console.error('BEAST_WEBGL_BLOCKED '+e.stack);process.exit(2)});
