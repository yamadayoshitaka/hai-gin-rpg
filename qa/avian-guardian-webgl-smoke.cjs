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
   page.on('console',msg=>{
    if(msg.type()==='error'&&/shader|WebGLProgram|GLSL|VALIDATE_STATUS|INVALID_OPERATION/i.test(msg.text()))
     errors.push('GPU shader: '+msg.text());
   });
   try{
    await page.goto('http://127.0.0.1:8765/monster-manager.html?monster='+id+
     '&v=phoenix-adult-raptor-v13-tengu-flight-20261118',
     {waitUntil:'domcontentloaded',timeout:90000});
    await page.waitForFunction(expected=>{
     const v=window.__monsterQualityQA?.();
     const wing=window.__avianWingQA?.();
     return v?.id===expected&&Number(v.meshes)>10&&wing?.id===expected;
    },id,{timeout:70000});
    const state=await page.evaluate(()=>window.__avianWingQA());
    if(!state||state.donor!=='seraph_guardian'||
      !state.wings.every(w=>w&&w.donor==='seraph_guardian'&&
       w.layers===3&&w.feathers===82&&w.surfaceRooted&&w.phoenixCoverts>5&&
       w.shoulder&&w.elbow&&w.wrist))
      throw Error(id+' original guardian wing donor absent: '+JSON.stringify(state));
    if(!state.hardBrow||!state.sweptCheeks||
       (id==='m014'&&!state.angularOwl))
      throw Error(id+' stern predator face not applied in WebGL: '+JSON.stringify(state));
     if(state.bodyFeathers<100||state.tail<9)
      throw Error(id+' rebuilt plumage missing: '+JSON.stringify(state));
    if(id==='m013'){
     const shape=state.phoenix;
      if(shape?.volumetricFire<75)throw Error('Phoenix real flame-mantle feathers missing');
     if(!state.revision?.includes('phoenix-adult-raptor-v13'))throw Error('Old Phoenix revision still loaded: '+state.revision);
     if(!shape?.enlargedBody||shape.torsoRadiusX<.36||
       shape.torsoRadiusY<.46||shape.bellyScaleMultiplier<11||
       shape.bodyScaleWidth<.25||shape.visibleFaceScales<90||
       shape.faceScaleWidth<.09||!shape.thighSeparated||
       shape.thighRadius<.25||!shape.featherHands||!shape.independentArms||
       !shape.shortBeak||shape.beakLength>.70||
        !shape.eyeliner||!shape.visiblePupils||
        !shape.bareHandsHidden||!shape.raisedScutes||
       !Array.isArray(shape.featherHandDigits)||
       !shape.featherHandDigits.every(count=>count===3)||
       !shape.realKnees||!shape.thighMuscles||
       !shape.floatingWingBandsRemoved||
       !shape.thighScales||!shape.shankScales||!shape.toeScales||
       !shape.wingHandScales||!shape.chickenFeet||!shape.flexedToes||
       !shape.neckScaleFade||!shape.headMicroScales||
       !shape.noEars||!shape.smallHead||!shape.longBeak||
       !shape.allBackCrest||shape.denseScales!==15*14||
       !shape.facialFlameMesh||!shape.eyesUncovered||
        shape.facialFlameVanes<10||!shape.guardianFeatherHands||
        !Array.isArray(shape.handFeathersPerSide)||
        !shape.handFeathersPerSide.every(n=>n>=82)||
        !shape.highQualityHandFeathers||
        !shape.flightMode||!shape.inAir||!shape.flightWingRig||
        !shape.legsFoldInFlight||!shape.fineFeatherBarbs||shape.currentAltitude<.80||
        shape.tailLength<4.55||shape.waveMeshes!==4||state.tail!==31)
       throw Error('Phoenix requested remodel absent in actual WebGL viewer: '+
        JSON.stringify(shape));
    }
    const frames=[];
    for(const action of ['idle','run','attack']){
     await page.locator('#actions button[title="'+action+'"]').click({timeout:15000});
     await page.waitForFunction(a=>
      window.__monsterViewerLayoutQA?.()?.selectedMotion===a,
      action,{timeout:12000});
     // Sample the time-limited animation before the SwiftShader screenshot.
     // GPU readback may exceed attack duration and return the actor to idle.
     if(id==='m013')await page.waitForFunction(expected=>{
      const flight=window.__avianWingQA?.()?.phoenix;
      return flight?.flightAction===expected&&flight.inAir&&
       flight.currentAltitude>.35&&flight.airborneKnees.every(k=>k<-.4);
     },action,{timeout:10000});
     await page.waitForTimeout(120);
     const filename=path.join(folder,id+'-'+action+'.png');
     const image=await page.locator('#view canvas').screenshot({
      path:filename,timeout:45000});
     if(image.byteLength<12000)
      throw Error(id+' '+action+' empty GPU frame: '+image.byteLength);
     frames.push({name:filename,bytes:image.byteLength,action});
    }
    if(id==='m013'){
     await page.locator('#actions button[title="defeat"]').click({timeout:15000});
     await page.waitForTimeout(1400);
     const landed=await page.evaluate(()=>window.__avianWingQA()?.phoenix);
     if(!landed||landed.inAir||landed.currentAltitude>.15)
      throw Error('Phoenix failed to land after defeat: '+JSON.stringify(landed));
     await page.locator('#actions button[title="idle"]').click({timeout:15000});
     await page.waitForTimeout(220);
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
