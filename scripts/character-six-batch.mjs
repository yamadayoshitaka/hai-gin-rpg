#!/usr/bin/env node
/** Real source QA and evidence, never a fabricated "FF15 model generated" report.
 * Every 10min slot processes one lane for EACH of faceHair/outfit.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {CHARACTER_QUALITY_SIX_LANES,partitionHairStyles} from '../src/character-system/character-quality-six-lanes.js';
import {listWigStyles} from '../src/face-wig-styles.js';
const root=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const args=process.argv.slice(2);
const value=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
const category=value('--category')||'faceHair';
if(!['faceHair','outfit'].includes(category))throw Error('Unknown character quality category');
const slotArg=value('--slot');
const slot=slotArg!==undefined?Number(slotArg):(Math.floor(new Date().getUTCMinutes()/10)%6);
if(!Number.isInteger(slot)||slot<0||slot>=6)throw Error('Slot outside 0..5');
const switches=JSON.parse(read('data/batch-center-switches.json'));
if(switches.groups?.[category]?.enabled!==true){
 console.log(JSON.stringify({category,slot,status:'disabled',message:'No quality batch executed.'}));
 process.exit(0);
}
const entry=CHARACTER_QUALITY_SIX_LANES[category],lane=entry.lanes[slot];
const tests={
 faceHair:[
  ['qa/human-v65-photoreal-quality.test.mjs','qa/independent-face-masters.test.mjs','qa/facehair-fivefold-cosmetics-braid.test.mjs'],
  ['qa/human-v65-photoreal-quality.test.mjs','qa/studio-face-quality-v56.test.mjs','qa/facehair-fivefold-cosmetics-braid.test.mjs'],
  ['qa/face-expression-v48.test.mjs','qa/face-v49-regression.test.mjs'],
  ['qa/face-expression-v48.test.mjs','qa/battle-face-action-policy.test.mjs'],
  ['qa/human-v64-catalog-and-hair.test.mjs','qa/hair-headwear-occlusion.test.mjs','qa/facehair-fivefold-cosmetics-braid.test.mjs'],
  ['qa/hair-camera-distance-stability.test.mjs','qa/battle-face-hair-shield-recovery.test.mjs']
 ],
 outfit:[
  ['qa/battle-outfit-integration.test.mjs','qa/outfit-rarity-regression.test.mjs'],
  ['qa/outfit-surface-regression.test.mjs','qa/face-skin-protection.test.mjs'],
  ['qa/garment-coverage-regression.test.mjs','qa/armor-four-legs-regression.test.mjs'],
  ['qa/wardrobe-inspection-pose.test.mjs','qa/helmet-faceguard-regression.test.mjs'],
  ['qa/rig-motion-transition.test.mjs','qa/rider-armor-coverage-regression.test.mjs'],
  ['qa/battle-lod-pipeline.test.mjs','qa/battle-outfit-integration.test.mjs']
 ]
};
const sourceFilenames=entry.gamePipeline.filter(p=>fs.existsSync(new URL(p,root)));
const sha256=p=>crypto.createHash('sha256').update(read(p)).digest('hex');
const sourceFingerprint=crypto.createHash('sha256').update(sourceFilenames.map(p=>p+':'+sha256(p)).join('\n')).digest('hex');
const hairCatalog=['female','male'].flatMap(gender=>listWigStyles(gender).map(style=>({...style,gender})));
const hairGroups=partitionHairStyles(hairCatalog);
if(hairGroups.flatMap(x=>x.items).length!==hairCatalog.length)throw Error('Hair partition mismatch');
const testArgs=['--test',...tests[category][slot]];
const run=spawnSync(process.execPath,testArgs,{cwd:new URL('../',import.meta.url),stdio:'inherit',timeout:210000,env:process.env});
const testPass=run.status===0&&!run.error;
const report={
 schemaVersion:1,createdAt:new Date().toISOString(),category,slot,lane:lane.id,
 title:lane.title,target:'FF15 quality direction, original JRPG models',
 criteria:lane.criteria,canonicalHairstyleCount:hairCatalog.length,
 hairstylePartitions:category==='faceHair'?hairGroups:undefined,
 tests:tests[category][slot],nodeTestExitCode:run.status,
 status:testPass?'static_qa_passed':'static_qa_failed',
 sourceFingerprint,sourceFilenames,realModelChangesThisRun:0,generatedGLBsThisRun:0,
 webglVisualApproved:false,androidFpsVerified:false,gameAdopted:false,
 releaseGate:'not_promoted',
 nextAction:'実ソースの形状/PBR/リグを改善し、WebGL四方向・動作・Android実測で見本と比較。合格した実モデル差分をPR→main→Pagesへ。',
 note:'このジョブは既存実モデルの回帰QAと改善対象の抽出。3D生成/品質改善コードコミットがなければ実改修数0。QAの緑とFF15品質承認は別。'
};
const output=path.join(new URL('../',import.meta.url).pathname,'qa-reports/character-six-lane',category+'-'+lane.id+'.json');
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
 '### '+category+' / '+lane.title+'\n- '+report.status+'\n- Real 3D updates: 0; game adoption: 0; visual QA: pending\n- Source fingerprint: '+sourceFingerprint.slice(0,12)+'\n');
console.log(JSON.stringify({category,slot,lane:lane.id,status:report.status,report:output}));
if(!testPass)process.exitCode=1;
