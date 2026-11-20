/** Inn and battlefield plan recommendations. Immutable defaults; no paid API.
 * Scores are tactical fit (0-100), NOT probability of victory.
 * Planning never modifies battle stats, meshes, visual FX or animation.
 */
import {STRATEGY_METHODS,STORY_JOB_TO_STRATEGY_JOB} from './three-step-strategy-catalog.js';
import {SORTIE_FORMATIONS} from './three-team-sortie.js';
export const BATTLE_PLAN_PRESETS=Object.freeze([
 {id:'assault',name:'集中殲滅',methodId:'melee_focus',kind:'explore',jobs:['sword','fighter','archer'],terrain:['plains','urban']},
 {id:'defense',name:'拠点防衛',methodId:'block_passage',kind:'defend',jobs:['shield','priest','archer'],terrain:['village','urban','highland']},
 {id:'ranged',name:'高所制圧',methodId:'ranged_focus',kind:'capture',jobs:['archer','mage','summoner'],terrain:['highland','urban']},
 {id:'demolition',name:'橋・障害物破壊',methodId:'destroy_path',kind:'siege',jobs:['mage','ninja'],terrain:['urban','ruins','coast']},
 {id:'scouting',name:'偵察・探索',methodId:'scout_walk',kind:'explore',jobs:['thief','ninja'],terrain:['forest','ruins','marsh']},
 {id:'support',name:'長期支援',methodId:'heal_wounded',kind:'defend',jobs:['priest','summoner','shield'],terrain:['urban','village']},
 {id:'retreat',name:'撤退・再集結',methodId:'regroup',kind:'defend',jobs:['ninja','shield','priest'],terrain:['forest','marsh']}
]);
const clean=(x,n=40)=>String(x??'').trim().slice(0,n);
const traits={
 sword:{attack:78,defense:55,mobility:57,recon:32,support:10,demolition:24,ranged:3,magic:8},
 shield:{attack:38,defense:98,mobility:28,recon:18,support:18,demolition:12,ranged:0,magic:5},
 ninja:{attack:70,defense:34,mobility:96,recon:95,support:19,demolition:73,ranged:18,magic:25},
 thief:{attack:46,defense:27,mobility:90,recon:100,support:25,demolition:54,ranged:12,magic:8},
 priest:{attack:24,defense:55,mobility:49,recon:25,support:100,demolition:10,ranged:42,magic:80},
 mage:{attack:93,defense:18,mobility:44,recon:55,support:30,demolition:100,ranged:94,magic:100},
 summoner:{attack:67,defense:30,mobility:61,recon:50,support:85,demolition:64,ranged:76,magic:95},
 fighter:{attack:100,defense:66,mobility:75,recon:27,support:6,demolition:34,ranged:0,magic:5},
 archer:{attack:80,defense:32,mobility:57,recon:72,support:5,demolition:36,ranged:100,magic:12}
};
export const BATTLE_TRAIT_LABELS=Object.freeze({attack:'攻撃',defense:'防御',mobility:'機動',recon:'索敵',support:'支援',demolition:'対物',ranged:'射撃',magic:'魔法'});
export function battleTeamParameters(game,teamId){
 const team=game?.sortiePlan?.teams?.find(t=>String(t.id)===String(teamId));
 const byId=new Map((game?.campaign?.squads||[]).map(s=>[String(s.id),s]));
 const weight=Object.fromEntries(Object.keys(BATTLE_TRAIT_LABELS).map(k=>[k,0]));
 let people=0;const jobs={};
 for(const [sourceId,n0] of Object.entries(team?.counts||{})){
  const n=Math.max(0,Number(n0)||0),source=byId.get(sourceId),job=STORY_JOB_TO_STRATEGY_JOB[source?.job];
  if(!n||!job)continue;
  people+=n;jobs[job]=(jobs[job]||0)+n;
  for(const [k,v] of Object.entries(traits[job]||{}))weight[k]+=v*n;
 }
 const formation=team?.formation||'free';
 const formationBonus=SORTIE_FORMATIONS[formation]||{};
 const parameters=Object.fromEntries(Object.entries(weight).map(([k,v])=>{
  const bonus=formation==='free'?0:(formationBonus[k]||0);
  return [k,people?Math.max(0,Math.min(100,Math.round(v/people*(1+bonus)))):0];
 }));
 const highlights=Object.entries(parameters).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k])=>BATTLE_TRAIT_LABELS[k]);
 return {teamId:Number(teamId),people,jobs,parameters,highlights,formation};
}
export const savedBattlePlans=game=>Array.isArray(game?.battlePlanTemplates)?game.battlePlanTemplates:[];
export const allBattlePlans=game=>[...BATTLE_PLAN_PRESETS,...savedBattlePlans(game)];
export function registerBattlePlan(game,{name,methodId,kind='explore',terrain='plains'}){
 if(!game||typeof game!=='object')throw Error('セーブデータが不正です');
 if(savedBattlePlans(game).length>=20)throw Error('作戦テンプレートは最大20件です');
 const method=STRATEGY_METHODS[methodId];
 if(!method)throw Error('有効な作戦方法を選択してください');
 const label=clean(name,28);if(!label)throw Error('テンプレート名を入力してください');
 const plan={id:'custom-'+Date.now().toString(36)+'-'+(savedBattlePlans(game).length+1),
  name:label,methodId,kind:clean(kind,24),terrain:[clean(terrain,24)],
  jobs:method.jobs.slice()};
 game.battlePlanTemplates=[...savedBattlePlans(game),plan];return plan;
}
export function selectBattlePlan(game,teamId,planId){
 const plan=allBattlePlans(game).find(p=>p.id===planId);
 if(!plan)throw Error('登録済みテンプレートを選んでください');
 const team=game?.sortiePlan?.teams?.find(t=>String(t.id)===String(teamId));
 if(!team)throw Error('班を選択してください');
 game.activeBattlePlanByTeam??={};
 game.activeBattlePlanByTeam[String(teamId)]=plan.id;
 return plan;
}
export function recommendBattlePlans(game,stage,teamId,{limit=5}={}){
 const parameters=battleTeamParameters(game,teamId);
 const stageKind=stage?.kind||'explore',terrain=stage?.biome||stage?.terrain||'plains';
 return allBattlePlans(game).map(plan=>{
  const method=STRATEGY_METHODS[plan.methodId];
  const matchingPeople=method?.jobs?.length?
   method.jobs.reduce((n,j)=>n+(parameters.jobs[j]||0),0):parameters.people;
  const roleFit=parameters.people?Math.round(100*matchingPeople/parameters.people):0;
  const purposeFit=plan.kind===stageKind?30:plan.kind==='explore'&&stageKind==='boss'?12:0;
  const terrainFit=(plan.terrain||[]).includes(terrain)?15:0;
  const availability=matchingPeople>0?18:0;
  const score=Math.max(0,Math.min(100,Math.round(15+purposeFit+terrainFit+availability+roleFit*.22)));
  const reason=[plan.kind===stageKind?'勝利目的に一致':'別目的の作戦',
   terrainFit?'地形適性あり':'地形適性は標準',
   matchingPeople+'人が実行可能'].join('・');
  return {...plan,score,reason,eligible:matchingPeople>0,teamId:Number(teamId)};
 }).sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.score-a.score).slice(0,Math.max(1,limit));
}
export function battleStageContext(stage){
 return {id:stage?.id||'',name:stage?.name||'戦闘',kind:stage?.kind||stage?.stageKind||'explore',
  biome:stage?.biome||stage?.terrain||'plains',winCondition:stage?.winCondition||''};
}
