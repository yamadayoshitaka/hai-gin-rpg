import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

const url='http://127.0.0.1:8765/face-mesh-studio.html?qa=expression';
const out='qa/screenshots/face-v86';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--use-gl=angle','--use-angle=swiftshader',
 '--enable-webgl','--enable-unsafe-swiftshader'
]});
try{
 const page=await browser.newPage({viewport:{width:768,height:1050},
  deviceScaleFactor:1});
 const failures=[];
 page.on('pageerror',e=>failures.push(e.message));
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:100000});
 await page.waitForFunction(()=>{
  const q=window.__faceExpressionQA?.nativeLipProbe?.();
  return q?.seal&&document.querySelector('#facePoseDiagnostics')?.textContent
   ?.includes('実行JS：v86確認済');
 },{timeout:120000});
 let native=await page.evaluate(()=>window.__faceExpressionQA.nativeLipProbe());
 assert.equal(native.seal.sealed,true,
  'Actual browser GLB must have the front lip aperture sealed: '+JSON.stringify(native));
 // Playwright's element screenshot waits for a static element layout. This
 // 3D canvas continuously changes layout while the wig/preview animates.
 // A viewport screenshot avoids an endless 'waiting for element to be stable'.
 await page.evaluate(()=>document.getElementById('faceCanvas')
  ?.scrollIntoView({block:'center',behavior:'instant'}));
 await page.waitForTimeout(300);
 const canvas=page.locator('#faceCanvas');
 for(const expression of ['neutral','laugh','surprised']){
  await page.locator('#faceExpression').selectOption(expression);
  await page.waitForTimeout(600);
  const canvasBox=await canvas.boundingBox();
  assert.ok(canvasBox,'WebGL canvas must be visible');
  const data=await page.screenshot({path:out+'/'+expression+'.png',
   animations:'disabled',timeout:30000});
  const png=PNG.sync.read(data);
  native=await page.evaluate(()=>window.__faceExpressionQA.nativeLipProbe());
  const {x,y,width,height}=native.rect;
  assert.ok(width>25&&height>25,'Must sample a real projected mouth region');
  let total=0,black=0,skin=0;
  const minX=Math.max(0,Math.floor(x+canvasBox.x));
  const maxX=Math.min(png.width,Math.ceil(x+width+canvasBox.x));
  const minY=Math.max(0,Math.floor(y+canvasBox.y));
  const maxY=Math.min(png.height,Math.ceil(y+height+canvasBox.y));
  for(let yy=minY;yy<maxY;yy++)for(let xx=minX;xx<maxX;xx++){
   const i=(yy*png.width+xx)*4,r=png.data[i],
    g=png.data[i+1],b=png.data[i+2];
   total++;
   if(r<=8&&g<=8&&b<=8)black++;
   if(r>90&&g>65&&b>55)skin++;
  }
  const blackPercent=total?black/total*100:100;
  const skinPercent=total?skin/total*100:0;
  console.log(JSON.stringify({expression,renderer:'Chromium/SwiftShader',
   seal:native.seal,rect:native.rect,total,
   blackPixels:black,blackPercent:Number(blackPercent.toFixed(3)),
   skinPercent:Number(skinPercent.toFixed(3)),
   saved:out+'/'+expression+'.png'}));
  assert.ok(skinPercent>35,'Mouth screen probe must contain skin, not background');
  assert.ok(blackPercent<6,
   'Mouth still contains the large pure-black polygonal defect');
 }
 assert.deepEqual(failures,[],
  'Face editor cannot throw JavaScript/WebGL errors during visual QA');
}finally{
 await browser.close();
}
