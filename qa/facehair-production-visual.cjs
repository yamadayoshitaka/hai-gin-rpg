'use strict';
// Captures ORIGINAL production face-studio geometry, not image-generation claims.
// The reference-art comparison remains a human approval gate.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {chromium} = require('playwright');
const {PNG} = require('pngjs');

const ROOT = (process.env.FACE_QA_BASE_URL || 'http://127.0.0.1:4177').replace(/\/$/, '');
const OUT = 'qa-reports/character-six-lane/faceHair-production-visual.json';
const IMAGE_DIR = 'qa-screenshots/facehair-production';
const VIEWS = ['front', 'threeQuarter', 'side', 'back'];
const SEXES = ['female', 'male'];
const report = {
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  source: 'face-mesh-studio.html / actual independent face GLB and groom',
  renderEnvironment: 'CI Chromium SwiftShader WebGL, not an Android GPU',
  views: [],
  status: 'starting',
  referenceArtSimilarityMeasured: false,
  ff15ArtisticQualityApproved: false,
  gameModelAdopted: false,
  note: 'Render and geometry guards detect missing/broken faces, hair and WebGL. Image differences do NOT certify artistic improvement. Compare captured views with approved original reference art before game adoption.'
};
function save() {
  fs.mkdirSync(path.dirname(OUT), {recursive:true});
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
}
function imageAudit(buffer) {
  const image = PNG.sync.read(buffer);
  assert.ok(image.width >= 160 && image.height >= 160,
    'A cropped WebGL model frame must have substantial resolution');
  const at = (x,y) => {
    const i = (y*image.width+x)*4;
    return [image.data[i],image.data[i+1],image.data[i+2]];
  };
  const reference = at(4,4);
  let distinct = 0, light = 0, minX=image.width, minY=image.height, maxX=0, maxY=0;
  // The face must visibly occupy the canvas rather than rendering a blank frame.
  for(let y=0;y<image.height;y+=2)for(let x=0;x<image.width;x+=2){
    const pixel=at(x,y);
    if(pixel[0]+pixel[1]+pixel[2]>75)light++;
    const distance=pixel.reduce((a,v,i)=>a+Math.abs(v-reference[i]),0);
    if(distance>58){
      distinct++;
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);
      minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    }
  }
  const minimum=Math.max(500,Math.floor(image.width*image.height*.006/4));
  assert.ok(distinct>minimum,
    'Face studio has insufficient visible non-background pixels: '+distinct);
  assert.ok(maxX-minX>image.width*.07 && maxY-minY>image.height*.09,
    'Face geometry did not occupy an observable region');
  return {
    width:image.width,height:image.height,nonBackgroundSamples:distinct,
    litSamples:light,bounds:[minX,minY,maxX,maxY],
    pngSha256:crypto.createHash('sha256').update(buffer).digest('hex')
  };
}
(async () => {
  let browser;
  try {
    fs.mkdirSync(IMAGE_DIR,{recursive:true});
    browser = await chromium.launch({headless:true,args:[
      '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
      '--disable-gpu-sandbox'
    ]});
    const page = await browser.newPage({
      viewport:{width:940,height:880},deviceScaleFactor:1
    });
    const pageErrors=[];
    page.on('pageerror',error=>pageErrors.push(String(error)));
    await page.goto(ROOT+'/face-mesh-studio.html?preview=1&gender=female',
      {waitUntil:'domcontentloaded',timeout:90000});
    await page.waitForFunction(()=>window.__faceMasterQA?.()?.loaded===true,
      null,{timeout:120000});
    for(const sex of SEXES){
      await page.locator('#'+sex).click();
      await page.waitForFunction(value=>{
        const m=window.__faceMasterQA?.();
        return m?.loaded&&m.gender===value&&m.visibleFaceMeshes===1;
      },sex,{timeout:70000});
      for(const view of VIEWS){
        await page.locator('#'+view).click();
        await page.waitForFunction(value=>
          window.__faceMasterQA?.()?.view===value,view,{timeout:25000});
        await page.waitForTimeout(260);
        const metrics=await page.evaluate(()=>window.__faceMasterQA());
        assert.equal(metrics.sourceUntouched,true,'Source head was modified');
        assert.equal(metrics.visibleFaceMeshes,1,'Visible face is missing');
        assert.ok(metrics.visiblePartMeshes>=2,
          'Visible face has lost its real eye and lid features');
        assert.ok(metrics.wigReport,'No built 3D scalp-anchored wig report');
        const screenshot=await page.locator('#faceCanvas').screenshot({
          animations:'disabled',timeout:40000
        });
        const image=imageAudit(screenshot);
        const filename=sex+'-'+view+'.png';
        fs.writeFileSync(path.join(IMAGE_DIR,filename),screenshot);
        report.views.push({
          sex,view,file:IMAGE_DIR+'/'+filename,
          faceMeshes:metrics.visibleFaceMeshes,partMeshes:metrics.visiblePartMeshes,
          wigVisible:metrics.wigVisible,wigStyleId:metrics.wigStyleId,
          ...image
        });
      }
    }
    assert.equal(report.views.length,8,'All 8 sex/view combinations required');
    assert.deepEqual(pageErrors,[],'Real studio raised JavaScript errors');
    for(const sex of SEXES){
      const frames=report.views.filter(v=>v.sex===sex);
      assert.notEqual(frames[0].pngSha256,frames[2].pngSha256,
        sex+' front and side geometry must not render identically');
    }
    report.status='webgl_images_captured_manual_art_review_pending';
  }catch(error){
    report.status='webgl_visual_regression_failed';
    report.error=String(error?.stack||error).slice(0,2300);
    process.exitCode=1;
  }finally{
    report.completedAt=new Date().toISOString();
    try{save()}catch(error){console.error('FACE_VISUAL_REPORT_WRITE_FAILED',error);process.exitCode=1}
    if(browser)await browser.close();
    console.log('FACEHAIR_REAL_VISUAL_RESULT',JSON.stringify({
      status:report.status,frames:report.views.length,error:report.error||null
    }));
  }
})();
