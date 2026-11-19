/** Battle roster contract: one distinct job per squad, at most ten squads.
 * Internal combat job IDs remain unchanged to preserve animations and saves.
 */
export const BATTLE_JOB_SQUADS=Object.freeze([
 {id:'sword',job:'剣士',index:0},
 {id:'shield',job:'盾騎士',index:1},
 {id:'lancer',job:'騎士',index:9},
 {id:'ninja',job:'忍者',index:3},
 {id:'thief',job:'シーフ',index:4},
 {id:'fighter',job:'格闘家',index:2},
 {id:'archer',job:'弓使い',index:5},
 {id:'mage',job:'魔法使い',index:6},
 {id:'priest',job:'僧侶',index:7},
 {id:'summoner',job:'召喚士',index:8}
]);
const ENGINE_NAMES=Object.freeze({'盾戦士':'盾騎士','盗賊':'シーフ','槍兵':'騎士'});
export const displayBattleJobName=name=>ENGINE_NAMES[String(name||'')]||String(name||'兵士');
export const battleSquadJob=(id)=>BATTLE_JOB_SQUADS[Number(id)]||null;
export const engineBattleJobNameForSquad=id=>{
 const job=battleSquadJob(id);
 return job?.id==='shield'?'盾戦士':job?.id==='thief'?'盗賊':
  job?.id==='lancer'?'槍兵':job?.job;
};
export const battleSquadLabel=(id,job)=>'第'+(Number(id)+1)+'隊｜'+displayBattleJobName(job||battleSquadJob(id)?.job);
