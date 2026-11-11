/**
 * Mission-aware one-click battle doctrine. No paid AI or new pathfinder.
 * A preset is fixed on the opening screen; its real squad orders/missions use
 * existing battle simulation methods, floor routes and destructible objects.
 *
 * "1 squad = 1 job"; squads are already recomposed by the caller.
 */
export const BATTLE_TACTIC_PRESETS=Object.freeze([
 Object.freeze({id:'balanced',name:'⚔ 基本迎撃',summary:'全隊の職業に合わせて攻撃・守備・回復を自動配置',detail:'敵軍殲滅またはステージ目標達成を優先'}),
 Object.freeze({id:'fortress_defense',name:'🛡 堅陣防衛',summary:'盾・前衛で敵の侵入を阻止し、遠距離隊と僧侶が後方支援',detail:'制限時間防衛・攻城防衛に有効'}),
 Object.freeze({id:'highground',name:'🏹 高地射撃',summary:'弓・魔法隊を既存の2階・窓・屋上ルートに誘導し、前衛が護衛',detail:'高所の射程・威力補正を活用。実在する登路が必要'}),
 Object.freeze({id:'siege_break',name:'💣 破城工作',summary:'盗賊の解錠、忍者の建物破壊、魔法使いの焼却を組み合わせる',detail:'障害物を突破して敵陣を制圧'}),
 Object.freeze({id:'bridge_denial',name:'🌉 橋破壊・封鎖',summary:'渡河前の味方位置を確認して橋を落とし、敵の進軍を遮断',detail:'味方が渡河中なら橋は破壊しない'}),
 Object.freeze({id:'objective_rush',name:'🚩 目標強襲',summary:'高速ジョブを敵陣へ直行、護衛と回復は隊の役割に応じ配置',detail:'時間制限のある陣地制圧と攻城戦に有効'}),
 Object.freeze({id:'rotation',name:'🔁 波状攻撃',summary:'複数の前衛隊が突撃→退却→守備を交代、僧侶は支援',detail:'作戦は固定。部隊号令だけ30秒ごとに交代'}),
 Object.freeze({id:'anti_siege',name:'🏰 城門死守',summary:'盾部隊が入口を守り、盗賊が施錠、僧侶が後方支援',detail:'防衛戦の拠点保持と殲滅を両立'}),
 Object.freeze({id:'arcane_barrage',name:'🔥 魔法弾幕',summary:'盾隊が敵を引きつけ、魔法隊が遠距離火力を集中',detail:'高低差・射線を使い、敵を殲滅する'}),
 Object.freeze({id:'commander_hunt',name:'🎯 主将狙撃',summary:'忍者や高速前衛が敵主将を優先追跡',detail:'攻城戦の主将撃破、または敵の号令停止を狙う'}),
 Object.freeze({id:'infiltration',name:'🗝 侵入・解錠',summary:'盗賊が施錠を解除し、忍者が屋上から侵入',detail:'実在する城門・屋上経路を利用する'}),
 Object.freeze({id:'rear_guard',name:'🩹 殿軍・支援',summary:'盾隊が守り、後衛を温存しながら前衛が敵の弱点を突く',detail:'損耗を抑えた持久戦・防衛向け'})
]);
export const TACTIC_DEFINITIONS=Object.freeze(BATTLE_TACTIC_PRESETS.map((p,index)=>
 Object.freeze({...p,version:1,priority:index,
  scope:'army',minSquads:p.id==='balanced'?1:2,
  steps:Object.freeze({
   balanced:['職業判定','号令分配','目標達成または殲滅'],
   fortress_defense:['前衛固定','高火力隊の迎撃','時間まで防衛または敵軍殲滅'],
   highground:['窓・屋上経路を確認','高所対応隊を配置','射線から集中攻撃'],
   siege_break:['敵の施錠・障害物を選定','職業ごとに解錠・焼却・解体','突入・制圧'],
   bridge_denial:['味方の渡河完了を確認','渡河路を破壊','残存渡河路と敵残兵を迎撃'],
   objective_rush:['高速部隊を前方に配置','敵拠点へ突入','目標確保・敵軍殲滅'],
   rotation:['前衛を2組に分割','突撃と守備を交代','僧侶が支援'],
   anti_siege:['盾隊を配置','施錠強化','拠点防衛・敵軍殲滅'],
   arcane_barrage:['盾隊が防衛','魔法隊が攻撃','敵軍殲滅'],
   commander_hunt:['敵主将を特定','高速隊が追跡','主将撃破・敵軍殲滅'],
   infiltration:['施錠扉を特定','盗賊が解錠','忍者が高所から侵入'],
   rear_guard:['盾隊が防御','前衛が攻勢','僧侶が回復']
  }[p.id])
 })));
const frontJobs=new Set(['sword','shield','fighter','lancer']);
const fastJobs=new Set(['ninja','fighter','lancer','thief']);
const rangedJobs=new Set(['archer','mage','summoner']);
export const tacticById=id=>BATTLE_TACTIC_PRESETS.find(p=>p.id===id)||null;
export const normalizeJob=job=>String(job?.jobId||job?.job||job||'').toLowerCase();
const present=object=>object?.alive!==false&&(object?.hp==null||object.hp>0);
const validStructure=object=>present(object)&&(object?.category===undefined||object.category==='structure');
const nearEnemySide=object=>object?.team===1;
const structureType=object=>String(object?.type||'');
const bridge=object=>validStructure(object)&&structureType(object)==='bridge';
const breachObject=object=>validStructure(object)&&nearEnemySide(object)&&
 (['building','tree'].includes(structureType(object))||structureType(object)==='door'&&object.locked);
const highRoute=route=>route?.team===0&&['window','roof','interior'].includes(route.kind) &&
 Number.isFinite(route?.access?.x)&&Number.isFinite(route?.access?.z);
export function tacticAvailability({squads=[],objective=null,structures=[],highGroundRoutes=[]}={}){
 const jobs=squads.filter(s=>(s.total??s.count??1)>0).map(s=>normalizeJob(s.jobId||s.job));
 const count=job=>jobs.filter(j=>j===job).length;
 const has=job=>count(job)>0;
 const frontline=jobs.filter(j=>frontJobs.has(j)).length;
 const attackers=jobs.filter(j=>fastJobs.has(j)).length;
 const high=highGroundRoutes.some(highRoute);
 const destructive=structures.some(breachObject);
 const lockedDoor=structures.some(o=>validStructure(o)&&o.type==='door'&&o.team===1&&o.locked);
 const building=structures.some(o=>validStructure(o)&&o.team===1&&['building','tree'].includes(o.type));
 const hasBridge=structures.some(bridge);
 const stage=objective?.type||'eliminate';
 const check={
  balanced:[true,''],
  fortress_defense:[frontline>0,'盾騎士・騎士などの前衛隊が必要'],
  highground:[high&&(has('archer')||has('mage')),high?'弓兵または魔法使いが必要':'移動可能な2階・屋上・窓の経路が必要'],
  siege_break:[(lockedDoor&&has('thief'))||(building&&(has('ninja')||has('mage'))),
   '敵の施錠扉＋盗賊、または破壊可能な敵建物＋忍者・魔法使いが必要'],
  bridge_denial:[hasBridge&&(has('ninja')||has('mage')),
   hasBridge?'忍者または魔法使いが必要':'破壊可能な橋が必要'],
  objective_rush:[(stage==='capture_zone'||stage==='siege')&&attackers>0,
   stage==='capture_zone'||stage==='siege'?'忍者・格闘家・槍兵・盗賊のいずれかが必要':'敵陣制圧・攻城戦で使用可能'],
  rotation:[frontline>=2&&has('priest'),'前衛2隊以上＋僧侶隊が必要'],
  anti_siege:[has('shield')&&(has('thief')||has('priest')),
   '盾騎士隊＋盗賊隊または僧侶隊が必要'],
  arcane_barrage:[has('mage')&&(has('shield')||frontline>0),'魔法使い＋前衛の隊が必要'],
  commander_hunt:[has('ninja')||has('fighter')||has('lancer'),'忍者・格闘家・槍兵のいずれかが必要'],
  infiltration:[has('thief')&&(lockedDoor||high),'盗賊隊と敵の施錠扉または高所進入路が必要'],
  rear_guard:[has('shield')&&has('priest'),'盾騎士隊＋僧侶隊が必要']
 };
 const recommended=stage==='defend_timer'?'fortress_defense':
  stage==='siege'&&check.siege_break[0]?'siege_break':
  (stage==='capture_zone'||stage==='siege')&&check.objective_rush[0]?'objective_rush':
  check.highground[0]?'highground':'balanced';
 return TACTIC_DEFINITIONS.map(p=>{
  const enoughSquads=jobs.length>=p.minSquads;
  const enabled=enoughSquads&&check[p.id][0];
  return {...p,enabled,
   reason:enabled?'使用可能':!enoughSquads?'この連携戦術には2部隊以上が必要':check[p.id][1],
   recommended:p.id===recommended&&enabled};
 });
}
function defaultOrder(job,defending=false){
 if(job==='priest')return 'hold';
 if(job==='shield')return 'defend';
 if(rangedJobs.has(job))return 'defend';
 return defending?'defend':'charge';
}
function appropriateEnemyStructure(job,objects,center){
 const missionByJob={
  thief:['unlock_door','door'],
  ninja:['demolish_structure','building'],
  mage:['burn_building','building']
 };
 const recipe=missionByJob[job];
 if(!recipe)return null;
 const candidates=objects.filter(o=>validStructure(o)&&o.team===1&&
  o.type===recipe[1]&&(job!=='thief'||o.locked));
 if(job==='ninja'&&candidates.length===0)candidates.push(...objects.filter(o=>
  validStructure(o)&&o.team===1&&o.type==='tree'));
 if(!candidates.length)return null;
 candidates.sort((a,b)=>Math.hypot(a.x-center.x,a.z-center.z)-
  Math.hypot(b.x-center.x,b.z-center.z)||String(a.id).localeCompare(String(b.id)));
 const o=candidates[0];
 return {type:job==='mage'&&o.type==='tree'?'burn_tree':recipe[0],
  targetId:o.id,x:Math.round(o.x),z:Math.round(o.z)};
}
function safelyDestroyableBridge(objects,allyPositions=[],enemyPositions=[]){
 if(!allyPositions.length||!enemyPositions.length)return null;
 const ay=allyPositions.reduce((sum,p)=>sum+p.x,0)/allyPositions.length;
 const ey=enemyPositions.reduce((sum,p)=>sum+p.x,0)/enemyPositions.length;
 const candidates=objects.filter(bridge).filter(o=>{
  const bx=Number(o.x);
  if(!(Number.isFinite(bx)&&Math.min(ay,ey)<bx&&bx<Math.max(ay,ey)))return false;
  const ownBeyond=allyPositions.some(p=>ey>ay?p.x>=bx-1:p.x<=bx+1);
  return !ownBeyond;
 }).sort((a,b)=>Math.abs(a.x-(ay+ey)/2)-Math.abs(b.x-(ay+ey)/2));
 if(!candidates.length)return null;
 const o=candidates[0];return {type:'destroy_bridge',
  targetId:o.id,x:Math.round(o.x),z:Math.round(o.z)};
}
/**
 * Per-squad tasks. `mission` is supplied only if a real registered structure
 * is present. Never fabricate destructible targets.
 */
export function buildTacticPlan({tacticId='balanced',squads=[],objective=null,structures=[],
 allyPositions=[],enemyPositions=[],enemyZone=null,enemyCommanders=[]}={}){
 if(!tacticById(tacticId))throw Error('不明な作戦です');
 const defenders=objective?.defenderTeam===0;
 const base=squads.map((s,index)=>{
  const jobId=normalizeJob(s.jobId||s.job),id=String(s.squadId??s.id);
  return {id,jobId,index,
   role:jobId==='priest'?'healer':jobId==='shield'?'guard':
    rangedJobs.has(jobId)?'fire_support':frontJobs.has(jobId)?'vanguard':'flank',
   order:defaultOrder(jobId,defenders),
   strategy:jobId==='priest'?'recovery':'eliminate',mission:null,destination:null};
 });
 const centerFor=s=>{
  const squadPoints=allyPositions.filter(p=>String(p.squadId)===s.id);
  const pts=squadPoints.length?squadPoints:allyPositions;
  return {x:pts.length?pts.reduce((n,p)=>n+p.x,0)/pts.length:0,
   z:pts.length?pts.reduce((n,p)=>n+p.z,0)/pts.length:0};
 };
 if(tacticId==='fortress_defense')for(const s of base){
  s.order=s.jobId==='priest'?'hold':s.jobId==='shield'?'hold':'defend';
 }
 if(tacticId==='highground')for(const s of base){
  s.order=rangedJobs.has(s.jobId)?'defend':s.jobId==='priest'?'hold':'defend';
  if(s.jobId==='archer'||s.jobId==='mage')s.highGround=true;
 }
 if(tacticId==='siege_break')for(const s of base){
  const mission=appropriateEnemyStructure(s.jobId,structures,centerFor(s));
  if(mission){s.order='mission';s.mission=mission;s.strategy='environment_prepare';}
 }
 if(tacticId==='bridge_denial'){
  const bridgeTarget=safelyDestroyableBridge(structures,allyPositions,enemyPositions);
  const saboteur=base.find(s=>['ninja','mage'].includes(s.jobId));
  if(bridgeTarget&&saboteur){saboteur.order='mission';saboteur.mission=bridgeTarget;
   saboteur.strategy='environment_prepare';}
  for(const s of base)if(s!==saboteur)s.order=s.jobId==='priest'?'hold':'defend';
 }
 if(tacticId==='objective_rush'&&enemyZone)for(const s of base){
  if(fastJobs.has(s.jobId)){s.order='move';s.destination={x:Math.round(enemyZone.x),z:Math.round(enemyZone.z)};}
  else if(s.jobId==='priest')s.order='defend';
 }
 if(tacticId==='rotation'){
  const rotating=base.filter(s=>frontJobs.has(s.jobId));
  for(const [i,s] of rotating.entries())s.order=i%2===0?'charge':'defend';
  for(const s of base.filter(s=>s.jobId==='priest'))s.order='hold';
 }
 if(tacticId==='anti_siege')for(const s of base){
  s.order=s.jobId==='priest'?'hold':s.jobId==='shield'?'hold':'defend';
  if(s.jobId==='thief'){
   const doors=structures.filter(o=>validStructure(o)&&o.type==='door'&&o.team===0&&o.lockLevel<5);
   doors.sort((a,b)=>Math.hypot(a.x-centerFor(s).x,a.z-centerFor(s).z)-
    Math.hypot(b.x-centerFor(s).x,b.z-centerFor(s).z));
   if(doors[0]){s.order='mission';s.strategy='environment_prepare';
    s.mission={type:'fortify_lock',targetId:doors[0].id,x:Math.round(doors[0].x),z:Math.round(doors[0].z)};}
  }
 }
 if(tacticId==='arcane_barrage')for(const s of base){
  s.order=s.jobId==='priest'?'hold':s.jobId==='shield'?'defend':
   s.jobId==='mage'?'charge':frontJobs.has(s.jobId)?'defend':'charge';
 }
 if(tacticId==='commander_hunt'){
  const commanders=enemyCommanders.filter(u=>u.alive!==false&&u.hp>0&&u.isStrategist);
  const hunter=base.find(s=>s.jobId==='ninja')||base.find(s=>s.jobId==='fighter')||base.find(s=>s.jobId==='lancer');
  if(hunter&&commanders.length){
   commanders.sort((a,b)=>Number(a.id)-Number(b.id));
   const u=commanders[0];
   hunter.order='mission';hunter.mission={type:'eliminate_commander',
    targetSquadId:String(u.squadId),x:Math.round(u.x??u.cell?.x??0),z:Math.round(u.z??u.cell?.z??0)};
  }
 }
 if(tacticId==='infiltration')for(const s of base){
  if(s.jobId==='thief'){
   const mission=appropriateEnemyStructure('thief',structures,centerFor(s));
   if(mission){s.order='mission';s.mission=mission;s.strategy='environment_prepare';}
  }else if(s.jobId==='ninja')s.order='charge';
  else s.order=s.jobId==='priest'?'hold':'defend';
 }
 if(tacticId==='rear_guard')for(const s of base){
  s.order=s.jobId==='shield'?'hold':s.jobId==='priest'?'hold':
   rangedJobs.has(s.jobId)?'defend':'charge';
 }
 return {id:tacticId,scope:'army',
  participatingSquadIds:base.map(row=>row.id),
  coordinated:base.length>=2,
  orders:base};
}
export function rotationOrders({tacticId,seconds=0,squads=[]}={}){
 if(tacticId!=='rotation')return [];
 const frontline=squads.filter(s=>frontJobs.has(normalizeJob(s.jobId||s.job)));
 if(frontline.length<2)return [];
 const phase=Math.floor(Math.max(0,Number(seconds)||0)/30)%3;
 const choices=phase===0?['charge','defend']:phase===1?['retreat','charge']:['defend','charge'];
 return frontline.map((s,index)=>({id:String(s.squadId??s.id),order:choices[index%2]}));
}
