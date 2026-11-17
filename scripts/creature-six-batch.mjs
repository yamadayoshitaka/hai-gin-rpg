#!/usr/bin/env node
/** Six taxonomy-specific quality checks per hour; cannot itself retopologize GLBs.
 * Original mesh adoption only through user-reviewed versioned game route.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {CREATURE_RECONSTRUCTION_WORK,CREATURE_RECONSTRUCTION_SUMMARY} from '../src/creature-reconstruction-plan.js';
import {taxonomyBatch,CREATURE_SIX_FAMILY_LANES} from '../src/creature-quality-six-lanes.js';
const args=process.argv.slice(2),arg=k=>args.includes(k)?args[args.indexOf(k)+1]:undefined;
const category=arg('--category')||'creatureMonster';
if(!['creatureMonster','creatureSummon'].includes(category))throw Error('Invalid creature category');
const minute=new Date().getUTCMinutes(),slotArg=arg('--slot');
const slot=slotArg!==undefined?Number(slotArg):(Math.floor(minute/10)%6);
const switches=JSON.parse(fs.readFileSync(new URL('../data/batch-center-switches.json',import.meta.url)));
if(switches.groups?.[category]?.enabled!==true){console.log(category+' paused: zero writes');process.exit(0);}
const {lane,items}=taxonomyBatch(CREATURE_RECONSTRUCTION_WORK,category,slot);
const permitted=items.filter(x=>x.canModify===true);
const protectedIds=items.filter(x=>x.canModify!==true).map(x=>x.id);
if(items.length===0)throw Error('Empty taxonomy lane');
const root=new URL('../',import.meta.url);
const src=['src/monster-catalog.js','src/creature-game-model-routing.js',
 'src/monster-summon-registry.js','src/creature-reconstruction-plan.js',
 'src/creature-anatomy-mesh.js','src/monster-geometry.js','src/combat-creature-actions.js'];
const hash=crypto.createHash('sha256');
for(const p of src)hash.update(p+':'+crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex')+'\n');
const candidates=[
 ['qa/canine-fur-face-regression.test.mjs','qa/beast-m002-feline-gait-face-fx-regression.test.mjs'],
 ['qa/creature-face-volume-batch.test.mjs','qa/creature-fangs-garment-seam-batch.test.mjs'],
 ['qa/creature-face-mouth-saddle-regression.test.mjs','qa/creature-seam-geometry.test.mjs'],
 ['qa/nonhuman-monster-wardrobe.test.mjs','qa/creature-fangs-garment-seam-batch.test.mjs'],
 ['qa/monster-character-cosplay-regression.test.mjs','qa/monster-regal-wardrobe-batch.test.mjs'],
 ['qa/creature-face-volume-batch.test.mjs','qa/monster-studio-skinned-rig-audit.test.mjs']
];
const tests=candidates[slot].filter(p=>fs.existsSync(new URL(p,root)));
if(tests.length===0)throw Error('No relevant QA tests for '+lane.id);
const run=spawnSync(process.execPath,['--test',...tests],{cwd:new URL('../',import.meta.url),stdio:'inherit',timeout:210000,env:process.env});
const passed=run.status===0&&!run.error;
const result={schemaVersion:1,category,lane:lane.id,createdAt:new Date().toISOString(),
 targetCount:items.length,reviewEligible:permitted.length,protectedIds,
 modelIds:items.map(x=>x.id),speciesGroups:lane.families,visualCriteria:lane.criteria,
 canonicalTotal:CREATURE_RECONSTRUCTION_SUMMARY.total,
 tests,nodeTestExitCode:run.status,status:passed?'static_qa_passed':'static_qa_failed',
 actualSourceModelsChanged:0,generatedSkinnedGLBs:0,webglVisualApproved:false,
 androidFpsVerified:false,gameAdopted:0,sourceHash:hash.digest('hex'),
 adoptionSource:'src/creature-game-model-routing.js + src/monster-summon-registry.js',
 note:'6回/時はカテゴリ別QA・対象抽出の定期実行。実造形生成・FF15達成・本編採用は未証明。スクショとAndroid検証が必要。',
 nextAction:'分類モデルのGLBまたは3Dメッシュ生成器を実改修→保存SHA→対象別WebGL/Android QA→PR→main→Pages。'
};
const output=path.join(new URL('../',import.meta.url).pathname,'qa-reports/creature-six-lane',category+'-'+lane.id+'.json');
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
 '## '+category+' : '+lane.name+'\n'+items.length+' canonical IDs, '+protectedIds.length+' protected. QA '+result.status+'; real 3D updates 0; adoption 0.\n');
console.log(JSON.stringify({category,lane:lane.id,count:items.length,protectedIds,status:result.status,output}));
if(!passed)process.exitCode=1;
