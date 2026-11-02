// Shared source of truth for the action preview and game. No animation is
// substituted by name similarity: only explicit, available job assignments.
export const JOB_NAME_BY_ID=Object.freeze({
 swordsman:'剣士',fighter:'格闘家',mage:'魔法使い',archer:'弓使い',
 guardian:'盾戦士',shield:'盾戦士',thief:'盗賊',ninja:'忍者',
 priest:'僧侶',summoner:'召喚士',farmer:'農民・職人',
 warrior:'剣士',monk:'格闘家',wizard:'魔法使い',ranger:'弓使い'
});
export const COMMAND_BY_STATE=Object.freeze({
 idle:['待機'],jump:['ジャンプ'],walk:['歩行'],run:['ダッシュ','走行'],attack:['通常斬り','正拳突き','通常攻撃','攻撃','突き'],
 guard:['防御','ガード'],hit:['被弾'],dead:['戦闘不能'],skill:['袈裟斬り','突き','強連撃','蹴り','魔法詠唱','魔法発射','技']
});
let mapPromise;
export function loadJobMotionMap(){
 return mapPromise??=fetch('./job-command-motion-map.json').then(r=>{
  if(!r.ok)throw Error('job-command-motion-map HTTP '+r.status);
  return r.json();
 }).then(j=>j.jobs).catch(e=>{mapPromise=null;throw e});
}
export function resolveJobMotion(jobs,job,state){
 const name=jobs[job]?job:JOB_NAME_BY_ID[job]||job;
 const rows=(jobs[name]||[]).filter(x=>x.available===true);
 const labels=COMMAND_BY_STATE[state]||[state];
 return labels.map(label=>rows.find(x=>x.command===label)).find(Boolean)||null;
}
