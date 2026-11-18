#!/usr/bin/env node
/** Truthful CI SwiftShader FPS evidence for the actual outfit-bearing battle.
 * A measured game frame is not an Android device result or a visual approval.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function classifyOutfitFps(b){
 const valid=b?.status==='measured_ci_fps'&&
  b.environment==='github-actions-swiftshader-chromium'&&
  b.scenario==='50v50'&&Number.isFinite(b.fps)&&b.fps>0&&
  Number.isFinite(b.p95Ms)&&b.p95Ms>0&&
  b.runtimeErrors===0&&b.webglContextLost!==true&&
  Number.isFinite(b.screenshotBytes)&&b.screenshotBytes>=10000;
 return {
  schemaVersion:1,category:'outfit',scene:'tactics-wireframe.html?army=50',
  status:valid?'measured_ci_fps':'fps_unverified',
  environment:'github-actions-swiftshader-chromium',
  measuredAt:b?.at||null,
  fps:valid?b.fps:null,p95Ms:valid?b.p95Ms:null,
  drawCalls:valid&&Number.isFinite(b.drawCalls)?b.drawCalls:null,
  gpuGeometries:valid&&Number.isFinite(b.gpuGeometries)?b.gpuGeometries:null,
  gpuTextures:valid&&Number.isFinite(b.gpuTextures)?b.gpuTextures:null,
  runtimeErrors:b?.runtimeErrors??null,
  screenshotBytes:b?.screenshotBytes??0,
  webglContextLost:b?.webglContextLost??null,
  failure:valid?null:String(b?.error||b?.screenshotError||'WebGL frame, FPS or rendered screenshot missing').slice(0,600),
  beforeAfterComparable:false,androidFpsMeasured:false,
  visualQualityApproved:false,sourceModifiedByDiagnostic:false
 };
}

const filename=process.argv[1]&&path.resolve(process.argv[1]);
if(filename===fileURLToPath(import.meta.url)){
 let browser=null;
 try{browser=JSON.parse(fs.readFileSync('qa-reports/game-quality-six/browser-frame.json','utf8'))}
 catch(e){browser={status:'missing',error:String(e.message||e)}}
 const r=classifyOutfitFps(browser);
 r.sourceSha=process.env.GITHUB_HEAD_SHA||process.env.GITHUB_SHA||null;
 r.runUrl='https://github.com/'+(process.env.GITHUB_REPOSITORY||'yamadayoshitaka/hai-gin-rpg')+
  '/actions/runs/'+(process.env.GITHUB_RUN_ID||'unknown');
 fs.mkdirSync('qa-reports/character-six-lane',{recursive:true});
 fs.writeFileSync('qa-reports/character-six-lane/outfit-fps-diagnostic.json',
  JSON.stringify(r,null,2)+'\n');
 const summary='### Outfit actual battle CI FPS diagnostic\n'+
  '- Result: '+r.status+'; 50v50 real dressed actors\n'+
  '- FPS: '+(r.fps??'not measured')+'; P95: '+(r.p95Ms??'not measured')+' ms; draw calls: '+(r.drawCalls??'not measured')+'\n'+
  '- Browser errors: '+(r.runtimeErrors??'unknown')+'; failure: '+(r.failure??'none')+'\n'+
  '- Android FPS: NOT MEASURED; visual / FF15 approval: NOT APPROVED; no model change committed by this probe.\n';
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
 console.log('OUTFIT_FPS_DIAGNOSTIC '+JSON.stringify(r));
}
