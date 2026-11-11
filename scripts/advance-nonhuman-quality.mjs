/**
 * Advance exactly ONE curated nonhuman quality profile stage per run.
 * All actual geometry changes live in reviewed, bounded renderer code;
 * this script can only update numeric values in the allowlisted profile.
 * No generation APIs, no network calls, no human-model edits or auto-merge.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {NONHUMAN_QUALITY_PROGRESS,NONHUMAN_QUALITY_LIMITS} from
  '../src/nonhuman-model-quality.js';

const file=fileURLToPath(new URL('../src/nonhuman-model-quality.js',import.meta.url));
const keys=Object.keys(NONHUMAN_QUALITY_LIMITS);
const assert=(valid,msg)=>{if(!valid)throw Error(msg);};
assert(keys.length===9,'Expected exactly nine curated nonhuman categories');
assert(Object.keys(NONHUMAN_QUALITY_PROGRESS).length===keys.length+1,
  'Unexpected profile key: stop instead of touching unreviewed assets');
for(const key of keys){
  const level=NONHUMAN_QUALITY_PROGRESS[key],limit=NONHUMAN_QUALITY_LIMITS[key];
  assert(Number.isSafeInteger(level)&&level>=0&&level<=limit,
    'Unbounded quality stage: '+key);
}
assert(Number.isSafeInteger(NONHUMAN_QUALITY_PROGRESS.cycle)&&
  NONHUMAN_QUALITY_PROGRESS.cycle>=0,'Invalid cycle cursor');
if(process.argv.includes('--check')){
  console.log(JSON.stringify({status:'valid',cycle:NONHUMAN_QUALITY_PROGRESS.cycle,
    stages:NONHUMAN_QUALITY_PROGRESS,limits:NONHUMAN_QUALITY_LIMITS}));
  process.exit(0);
}
assert(process.argv.includes('--apply'),
  'Usage: node scripts/advance-nonhuman-quality.mjs --apply|--check');

const cursor=NONHUMAN_QUALITY_PROGRESS.cycle;
const candidate=Array.from({length:keys.length},(_,i)=>keys[(cursor+i)%keys.length])
  .find(key=>NONHUMAN_QUALITY_PROGRESS[key]<NONHUMAN_QUALITY_LIMITS[key]);
if(!candidate){
  console.log('No safe pre-reviewed geometry stages remain; QA only. Never invent quality gains.');
  process.exit(0);
}
let source=await readFile(file,'utf8');
function replaceNumeric(key,expected,next){
  const pattern=new RegExp('(^\\s*'+key+':\\s*)('+expected+')(,?\\s*$)','m');
  assert(pattern.test(source),'Unexpected profile format for '+key);
  source=source.replace(pattern,(_m,a,_value,c)=>a+next+c);
}
replaceNumeric('cycle',cursor,cursor+1);
replaceNumeric(candidate,NONHUMAN_QUALITY_PROGRESS[candidate],
  NONHUMAN_QUALITY_PROGRESS[candidate]+1);
assert(path.basename(file)==='nonhuman-model-quality.js',
  'Refuse to update any non-allowlisted file');
await writeFile(file,source,'utf8');
console.log(JSON.stringify({
  status:'advanced',category:candidate,
  old:NONHUMAN_QUALITY_PROGRESS[candidate],
  next:NONHUMAN_QUALITY_PROGRESS[candidate]+1,
  cycle:cursor+1,
  nextStep:'Node geometry regression; human models untouched'
}));
