'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:460,height:900},deviceScaleFactor:1});
  page.on('pageerror',e=>console.error('BROWSER_PAGE_ERROR '+e.message));
  await page.goto('http://127.0.0.1:8766/face-body-studio.html?v=54',
    {waitUntil:'commit',timeout:90000});
  await page.waitForFunction(()=>window.__heroineBodyQA?.()?.v36RealBattleCostume?.active,
    null,{timeout:180000});
  await page.waitForTimeout(900);
  const result=await page.evaluate(()=>{
   const preview=window.__heroineBodyPreview,actor=preview.getBattleActor(),
    face=preview.getFace(),state=window.__heroineBodyQA();
   actor.updateWorldMatrix(true,true);face.updateWorldMatrix(true,false);
   const bface=face.geometry.boundingBox.clone().applyMatrix4(face.matrixWorld);
   const q=(v)=>Math.round(v*1000)/1000;
   const format=(box)=>({min:[box.min.x,box.min.y,box.min.z].map(q),
      max:[box.max.x,box.max.y,box.max.z].map(q)});
   const meshes=[];
   actor.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.visible||!mesh.geometry?.getAttribute('position'))return;
    let o=mesh.parent,visible=true;
    while(o&&o!==actor){if(!o.visible){visible=false;break;}o=o.parent;}
    if(!visible)return;
    if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
    const box=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
    const touchesFace=box.max.y>bface.min.y&&box.min.y<bface.max.y&&
      box.max.x>bface.min.x&&box.min.x<bface.max.x;
    const isOutfit=/armor|cuirass|plate|neck|collar|gambeson|tunic|chest|cloth|body/i.test(mesh.name);
    if(touchesFace||isOutfit)meshes.push({
      name:mesh.name,slot:mesh.userData?.equipmentSlot||null,
      class:mesh.userData?.equipmentClass||null,
      skinned:!!mesh.isSkinnedMesh,count:mesh.geometry.getAttribute('position').count,
      box:format(box),touchesFace
    });
   });
   return {face:format(bface),headPosition:face.getWorldPosition(face.position.clone()).toArray().map(q),
    neck:state.v36RealBattleCostume?.proportions?.neckClearance,
    neckContinuity:state.v36RealBattleCostume?.proportions?.neckContinuity,
    headAlignment:state.v36RealBattleCostume?.proportions?.headAlignment,
    active:state.v36RealBattleCostume?.active,
    meshes:meshes.sort((a,b)=>b.box.max[1]-a.box.max[1]).slice(0,85)};
  });
  console.log('HUMAN_V53_ACTUAL_MESH_DIAGNOSTICS '+JSON.stringify(result));
  if(!(result.neckContinuity?.applied&&result.neckContinuity.bustTrianglesRemoved>3))
    throw Error('HEAD_BUST_STILL_PRESENT: '+JSON.stringify(result.neckContinuity));
  if(!(result.headAlignment?.applied&&result.headAlignment.gapMeters>=.006))
    throw Error('FACE_STILL_INSIDE_TORSO: '+JSON.stringify(result.headAlignment));
  if(!(result.neck?.applied&&result.neck.clearanceMeters>=.007))
    throw Error('CHEST_STILL_ABOVE_CHIN: '+JSON.stringify(result.neck));
  fs.mkdirSync('qa-screenshots/human-v54',{recursive:true});
  await page.screenshot({path:'qa-screenshots/human-v54/female-overlap.png',timeout:90000});
 }finally{await browser.close()}
})().catch(e=>{console.error('HUMAN_V53_DIAGNOSTIC_FAIL '+e.stack);process.exitCode=1});
