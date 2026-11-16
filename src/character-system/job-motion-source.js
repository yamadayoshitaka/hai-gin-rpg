// Shared source of truth for the action preview and game. No animation is
// substituted by name similarity: only explicit, available job assignments.
export const JOB_NAME_BY_ID=Object.freeze({
 swordsman:'剣士',fighter:'格闘家',mage:'魔法使い',archer:'弓使い',
 guardian:'盾戦士',shield:'盾戦士',thief:'盗賊',ninja:'忍者',
 priest:'僧侶',summoner:'召喚士',farmer:'農民・職人',
 warrior:'剣士',monk:'格闘家',wizard:'魔法使い',ranger:'弓使い'
});
export const COMMAND_BY_STATE=Object.freeze({
 idle:['待機','盾構え','照準','忍び歩き','歩行','ダッシュ'],jump:['ジャンプ'],walk:['歩行','忍び歩き','弓を持って走る','ダッシュ'],run:['ダッシュ','走行','弓を持って走る'],attack:['通常斬り','正拳突き','ナイフ斬り','二刀斬り','射撃','魔法発射','魔法攻撃','盾構え','通常攻撃','攻撃','突き','蹴り'],
 guard:['防御','ガード'],hit:['被弾'],dead:['戦闘不能'],death:['戦闘不能'],skill:['袈裟斬り','突き','強連撃','蹴り','魔法詠唱','魔法発射','技']
});
// Exact commands recorded in the source manifest. Previously '魔法詠唱'
// and '強連撃' were looked up by generic names that do not exist for most
// jobs, leaving their skill poses at idle or on a frozen last frame.
export const JOB_SKILL_MOTION_COMMANDS=Object.freeze({
 '剣士':['袈裟斬り','突き'],
 '格闘家':['蹴り','正拳突き'],
 '魔法使い':['長詠唱','詠唱','魔法発射'],
 '弓使い':['上方射撃','弓を引く','射撃'],
 '盾戦士':['盾構え','防御'],
 '盗賊':['ナイフ連撃','ナイフ突き'],
 '忍者':['二刀突き','二刀斬り'],
 '農民・職人':['防御','鍛冶作業'],
 '僧侶':['範囲回復・長詠唱','祈り・回復詠唱','回復魔法発動'],
 '召喚士':['召喚詠唱','召喚発動','魔法攻撃']
});
export const JOB_CAST_MOTION_COMMANDS=Object.freeze({
 '魔法使い':['詠唱','長詠唱'],
 '僧侶':['祈り・回復詠唱','範囲回復・長詠唱'],
 '召喚士':['召喚詠唱','召喚発動']
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
 const labels=state==='skill'?JOB_SKILL_MOTION_COMMANDS[name]||COMMAND_BY_STATE.skill:
  state==='cast'?JOB_CAST_MOTION_COMMANDS[name]||JOB_SKILL_MOTION_COMMANDS[name]||COMMAND_BY_STATE.skill:
  COMMAND_BY_STATE[state]||[state];
 const selected=labels.map(label=>rows.find(x=>x.command===label)).find(Boolean);
 if(selected)return selected;
 if(state==='run'){
  // Every combatant uses the same KayKit Rig_Medium retarget skeleton.
  // Shield warriors and villagers have only WALK rows in their own command
  // maps. Previously a RUN request silently fell back to the slow walk
  // action, so a fifth of the 50v50 battlefield appeared to stroll.
  // Borrow the existing, licensed and physically captured Running_A motion
  // from the swordfighter instead of inventing a proxy or speeding up WALK.
  const sharedDash=(jobs?.['剣士']||[]).find(row=>
   row.available===true&&row.command==='ダッシュ'&&row.clip==='Running_A');
  return sharedDash||null;
 }
 return null;
}
