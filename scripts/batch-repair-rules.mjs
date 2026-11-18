/** Deterministic, no-AI repairs for known game regressions.
 * Each rule has a small, explicit patch surface, idempotence and a QA suite.
 * Never rewrite object catalogs, story panels or source GLB/texture assets.
 */
export const REPAIR_RULES=Object.freeze([
 {id:'monster-refresh-duplicates',file:'src/creature-game-model-routing.js',
  tests:['qa/creature-game-model-routing.test.mjs']},
 {id:'studio-source-manifest-drift',file:'data/character-system/quality-six-targets.json',
  tests:['qa/character-six-lane-contract.test.mjs','qa/studio-model-route-contract.test.mjs']},
 {id:'invalid-crowd-lod-budget',file:'src/crowd-performance-budget.js',
  tests:['qa/crowd-longrun-performance.test.mjs']}
]);
export const PROTECTED_PATHS=Object.freeze([
 'object-list.html','src/object-catalog.js','src/tree-seasons.js',
 'data/world-quality/catalog-targets.json',
 'data/world-quality/production-model-adoption.json'
]);
const known=new Set(REPAIR_RULES.map(x=>x.file));
export function allowedRepairPath(file){
 return typeof file==='string'&&known.has(file)&&!PROTECTED_PATHS.includes(file);
}
export function repairMonsterPriority(src){
 const marker='export const MONSTER_REFRESH_PRIORITY=Object.freeze([';
 const a=src.indexOf(marker);
 const b=a<0?-1:src.indexOf('...MONSTER_CATALOG.map(s=>s.id).filter(id=>',a);
 if(a<0||b<0)return {code:src,changed:false,reason:'priority layout unrecognized'};
 const prefix=src.slice(a+marker.length,b);
 const requested=[...prefix.matchAll(/'m\d{3}'/g)].map(x=>x[0].slice(1,-1));
 if(!requested.length||requested.length>50)return {code:src,changed:false,reason:'no bounded priority prefix'};
 // Nonhuman first wave must have one entry per ID; generic tail excludes every
 // high-priority ID (plus canonical m001). This avoids doing costly mesh work twice.
 const unique=[...new Set(requested)];
 const desired=['m001',...unique.filter(id=>id!=='m001')];
 const last=src.indexOf(']);',b);
 if(last<0)return {code:src,changed:false,reason:'priority closing delimiter missing'};
 const tail=src.slice(b,last);
 const match=/!\[([\s\S]*?)\]\.includes\(id\)/.exec(tail);
 if(!match)return {code:src,changed:false,reason:'excluded-ID expression unrecognized'};
 const actual=[...match[1].matchAll(/'m\d{3}'/g)].map(x=>x[0].slice(1,-1));
 const uniquePrefix=unique.map(id=>"'"+id+"'").join(',');
 const expectedTail=desired.map(id=>"'"+id+"'").join(',');
 const newPrefix="\n "+uniquePrefix+",\n ";
 const newTail=tail.replace(match[0],"!["+expectedTail+"].includes(id)");
 const code=src.slice(0,a+marker.length)+newPrefix+
  src.slice(b,last).replace(tail,newTail)+src.slice(last);
 // Preserve the existing prefix when it is already unique and the filter is
 // correct. Otherwise regenerate ONLY the two portions of this priority list.
 if(requested.length===unique.length&&
  actual.length===desired.length&&actual.every((id,i)=>id===desired[i]))
  return {code:src,changed:false,reason:'priority list already unique'};
 const result=src.slice(0,a+marker.length)+newPrefix+newTail+src.slice(last);
 return {code:result,changed:result!==src,reason:'removed repeated priority IDs and corrected generic tail exclusions'};
}
export function repairStudioManifest(json,canonical){
 let obj;
 try{obj=JSON.parse(json)}catch{return {code:json,changed:false,reason:'malformed JSON requires manual investigation'}}
 if(obj?.schemaVersion!==1||!obj.groups)return {code:json,changed:false,reason:'unknown manifest schema'};
 let touched=0;
 for(const category of ['faceHair','outfit']){
  const from=canonical?.[category]?.gamePipeline;
  const to=obj.groups[category]?.gamePipeline;
  if(!Array.isArray(from)||!Array.isArray(to)||from.length<5||
   from.some(p=>typeof p!=='string'||p.includes('..')||p.startsWith('/')))
   return {code:json,changed:false,reason:'canonical source paths invalid'};
  if(JSON.stringify(from)!==JSON.stringify(to)){
   obj.groups[category].gamePipeline=[...from];touched++;
  }
 }
 return touched?{code:JSON.stringify(obj,null,2)+'\n',changed:true,
  reason:'synchronized '+touched+' studio source-path fingerprints with runtime registry'}:
  {code:json,changed:false,reason:'studio paths already match runtime registry'};
}
export function repairCrowdBudget(src){
 const re=/constructor\(\{targetFps=(\d+),minPx=(\d+),maxPx=(\d+)\}=\{\}\)/;
 const m=re.exec(src);
 if(!m)return {code:src,changed:false,reason:'LOD constructor layout unknown'};
 const [fps,min,max]=m.slice(1).map(Number);
 if(fps>=20&&fps<=120&&min>=16&&min<=160&&max>=min&&max<=240)
  return {code:src,changed:false,reason:'LOD budget parameters valid'};
 const code=src.replace(m[0],'constructor({targetFps=45,minPx=36,maxPx=60}={})');
 return {code,changed:code!==src,reason:'reset INVALID presentation-only budget; do not claim improved FPS'};
}
export function applyKnownRule(id,text,canonical){
 if(id==='monster-refresh-duplicates')return repairMonsterPriority(text);
 if(id==='studio-source-manifest-drift')return repairStudioManifest(text,canonical);
 if(id==='invalid-crowd-lod-budget')return repairCrowdBudget(text);
 throw Error('Unregistered fix rule: '+id);
}
