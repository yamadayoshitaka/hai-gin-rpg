'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');

/**
 * Capture the actual Chromium compositor without Playwright's implicit
 * document.fonts.ready wait. Real WebGL suites were spuriously failing
 * after 60-90 seconds on CI while the glyph/font promise stayed pending.
 * The CDP Page.captureScreenshot command includes the same UI and canvas,
 * even if web fonts are still loading. It works only with Chromium, which
 * these screenshot regressions already require.
 */
async function captureChromiumScreenshot(page,filename,{selector=null}={}){
 const client=await page.context().newCDPSession(page);
 try{
  let clip;
  if(selector){
   const rect=await page.locator(selector).evaluate(node=>{
    const r=node.getBoundingClientRect();
    return {x:r.x+window.scrollX,y:r.y+window.scrollY,
     width:r.width,height:r.height};
   });
   if(rect.width<=0||rect.height<=0)throw Error('Empty screenshot element '+selector);
   clip={...rect,scale:1};
  }
  const result=await client.send('Page.captureScreenshot',{
   format:'png',fromSurface:true,captureBeyondViewport:!!selector,
   ...(clip?{clip}:{})
  });
  const buffer=Buffer.from(result.data,'base64');
  if(buffer.length<100)throw Error('Empty Chromium WebGL screenshot');
  await fs.mkdir(path.dirname(filename),{recursive:true});
  await fs.writeFile(filename,buffer);
  return buffer;
 }finally{
  await client.detach();
 }
}
module.exports={captureChromiumScreenshot};
