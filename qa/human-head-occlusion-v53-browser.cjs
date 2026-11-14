'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:460,height:900},deviceScaleFactor:1});
  page.on('pageerror',e=>console.error('BROWSER_PAGE_ERROR '+e.message));
  await page.goto('http://127.0.0.1:8766/face-body-studio.html?v=59',
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
    donor:state.v36RealBattleCostume?.headReport,
    unifiedFaceGeometry:!!face.geometry.userData.studioUnifiedNeck,
    neck:state.v36RealBattleCostume?.proportions?.neckClearance,
    neckContinuity:state.v36RealBattleCostume?.proportions?.neckContinuity,
    headAlignment:state.v36RealBattleCostume?.proportions?.headAlignment,
    active:state.v36RealBattleCostume?.active,
    meshes:meshes.sort((a,b)=>b.box.max[1]-a.box.max[1]).slice(0,85)};
  });
  console.log('HUMAN_V59_ACTUAL_MESH_DIAGNOSTICS '+JSON.stringify(result));
  if(!(result.unifiedFaceGeometry&&
        result.neckContinuity?.unifiedSkinNeckApplied&&
        result.neckContinuity.unifiedSkinNeckEdges>=12&&
        result.neckContinuity.unifiedSkinNeckTriangles>=30&&
        result.neckContinuity.reusedFaceMaterial&&
        result.neckContinuity.separateNeckGeometryHidden&&
        result.neckContinuity.actualCollarSource&&
        result.neckContinuity.unifiedNeckBottomHeight<result.neckContinuity.actualCollarHeight))
    throw Error('STILL_HAS_DETACHED_NECK_OR_ORANGE_GAP: '+JSON.stringify(result.neckContinuity));
  if(!(result.donor?.removedNeckTriangles>0))
    throw Error('DONOR_ORANGE_NECK_STILL_PRESENT: '+JSON.stringify(result.donor));
  if(!(result.neckContinuity?.applied&&result.neckContinuity.bustTrianglesRemoved>3&&
        result.neckContinuity.originalFaceNormalsPreserved&&
        result.neckContinuity.smoothedFacialNormals&&
        result.neckContinuity.anatomicalJawCut&&
        result.neckContinuity.narrowUnderJawConnector&&
        result.neckContinuity.lowerBustTapered&&
        result.neckContinuity.lowerBustTaperedVertices>30&&
        result.neckContinuity.normalWeldGroups>50&&
        result.neckContinuity.untouchedFaceTriangles>100&&
        result.neckContinuity.matchedFaceMaterial&&
        result.neckContinuity.transparentNeckEdge))
    throw Error('FACETED_FACE_OR_UNMATCHED_NECK: '+JSON.stringify(result.neckContinuity));
  if(!(result.neckContinuity?.applied&&result.neckContinuity.bustTrianglesRemoved>3))
    throw Error('HEAD_BUST_STILL_PRESENT: '+JSON.stringify(result.neckContinuity));
  if(result.neckContinuity.legacyNeckPartsHidden<3)
    throw Error('FLAT_NECK_CAPS_STILL_VISIBLE: '+JSON.stringify(result.neckContinuity));
  if(result.meshes.some(mesh=>/^(REAL_HEAD_BODY_CLOSED_NECK_SEAL|(?:LEFT|RIGHT)_SHOULDER_CUT_SURFACE_CAP)$/.test(mesh.name)))
    throw Error('LEGACY_FLAT_NECK_MESH_IN_RENDER_LIST');
  if(!(result.headAlignment?.applied&&
      Math.abs(result.headAlignment.gapMeters+result.headAlignment.anatomicalInset)<.006))
    throw Error('HEAD_NOT_ANATOMICALLY_SEATED: '+JSON.stringify(result.headAlignment));
  if(!(result.neckContinuity.neckHeight<.052&&
      result.neckContinuity.neckToHeadRatio<.22))
    throw Error('GIRAFFE_NECK_DETECTED: '+JSON.stringify(result.neckContinuity));
  if(!(result.neck?.applied&&result.neck.clearanceMeters>=.007))
    throw Error('CHEST_STILL_ABOVE_CHIN: '+JSON.stringify(result.neck));
  fs.mkdirSync('qa-screenshots/human-v59',{recursive:true});
  await page.screenshot({path:'qa-screenshots/human-v59/female-overlap.png',timeout:90000});
  // Render actual close-up portraits, not only the distant full-body view.
  // These reveal facial normal faceting and any opaque neck plate.
  // Costume-only UI hides the portrait button; invoke its existing view
  // controller directly for automated QA without changing user-facing UI.
  await page.evaluate(()=>document.getElementById('portrait').click());
  await page.waitForTimeout(350);
  await page.screenshot({path:'qa-screenshots/human-v59/female-face-front.png',timeout:90000});
  // Diagnostic isolation: identify whether the bright horizontal jaw plate
  // belongs to the new neck connector or the cropped original face sculpt.
  await page.evaluate(()=>{
   const actor=window.__heroineBodyPreview?.getBattleActor?.();
   // Confirm the skinned donor is not responsible for any remaining
   // orange cervical area in this side-by-side debug frame.
   const donor=actor?.getObjectByName('Superhero_Female');
   if(donor)donor.visible=false;
  });
  await page.waitForTimeout(120);
  await page.screenshot({path:'qa-screenshots/human-v59/female-connector-hidden.png',timeout:90000});
  await page.evaluate(()=>{
   const actor=window.__heroineBodyPreview?.getBattleActor?.();
   const donor=actor?.getObjectByName('Superhero_Female');
   if(donor)donor.visible=true;
  });
  await page.locator('#side').click();
  await page.waitForTimeout(350);
  await page.screenshot({path:'qa-screenshots/human-v59/female-face-side.png',timeout:90000});
 }finally{await browser.close()}
})().catch(e=>{console.error('HUMAN_V59_DIAGNOSTIC_FAIL '+e.stack);process.exitCode=1});
