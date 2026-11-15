/**
 * CI / batch-centre rollup of evidence-backed monster quality, without
 * fabricating results for unreviewed creatures. Non-zero exit for malformed
 * committed evidence; unreviewed creatures are reported, not promoted.
 */
import {readFileSync,appendFileSync} from 'node:fs';
import {MONSTER_CATALOG} from '../src/monster-catalog.js';
import {MONSTER_SUMMON_ENTRIES} from '../src/monster-summon-registry.js';
import {MONSTER_QUALITY_SCHEMA,assessMonsterQuality,monsterQualityScore,
 MONSTER_QUALITY_TARGET} from '../src/monster-quality-kpi.js';
const path=new URL('../data/monster-quality-review.json',import.meta.url);
const payload=JSON.parse(readFileSync(path,'utf8'));
if(payload.schema!==MONSTER_QUALITY_SCHEMA||!payload.records||
 typeof payload.records!=='object'||Array.isArray(payload.records))
 throw Error('Invalid quality KPI data schema');
const extras=['wolf','wyvern','dragon','elder_dragon','dragon_lord',
 'forest_archer','seraph_guardian','horse'];
const universe=[
 ...MONSTER_CATALOG.map(m=>m.id),
 ...MONSTER_SUMMON_ENTRIES.map(m=>m.id),
 ...extras
];
if(new Set(universe).size!==108)
 throw Error('Unexpected 50 + 50 + 8 monster/summon quality universe');
const list=universe.map(id=>{
 const rec=payload.records[id]||{},before=monsterQualityScore(rec.before?.ratings);
 const after=assessMonsterQuality(rec.after);
 return {id,scored:after.score!==null,pass:after.pass,
  score:after.score,baseline:before,delta:before!==null&&after.score!==null?
   Math.round((after.score-before)*10)/10:null,
  status:after.status,missingActions:after.missingActions.length,
  missingEvidence:after.missingEvidence.length,unverified:after.unverified.length};
});
for(const [id,v] of Object.entries(payload.records)){
 if(!universe.includes(id))throw Error('Unknown monster review id: '+id);
 if(v===null||typeof v!=='object')throw Error('Malformed review for '+id);
}
const completed=list.filter(x=>x.scored).length;
const approved=list.filter(x=>x.pass).length;
const unverified=list.filter(x=>x.status==='unverified').length;
const improving=list.filter(x=>x.delta!==null&&x.delta>0).length;
const regressions=list.filter(x=>x.delta!==null&&x.delta<0).map(x=>x.id);
const report={
 schema:'hai-gin/monster-quality-ci/v1',
 time:new Date().toISOString(),
 targetScore:MONSTER_QUALITY_TARGET,total:list.length,scored:completed,
 approved,unverified,unscored:list.length-completed,
 improving,regressions,
 message:approved===0?'検証済み合格モンスターは未登録（未測定を成功扱いしない）':
  '実測・根拠つきの品質KPI評価のみ集計',
 records:list
};
console.log(JSON.stringify(report,null,2));
const summary=[
 '## モンスター品質 KPI / Github Pages',
 '| 指標 | 件数 |','|---|---:|',
 '| 対象（モンスター50＋召喚版50＋専用8） | '+report.total+' |',
 '| 100点評価が記録済み | '+report.scored+' |',
 '| 90点＋全重大ゲート・実測合格 | '+report.approved+' |',
 '| 未評価/未検証 | '+report.unverified+' |',
 '| 前回比改善 | '+report.improving+' |',
 '| 点数が下がった個体 | '+report.regressions.length+' |',
 '',report.message
].join('\n');
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary+'\n');
