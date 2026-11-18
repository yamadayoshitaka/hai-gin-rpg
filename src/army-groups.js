/** Ten command groups, independent of deployment cells and soldier jobs. */
export const ARMY_GROUP_IDS=Object.freeze(Array.from({length:10},(_,i)=>i+1));
export const normalizeArmyGroup=value=>ARMY_GROUP_IDS.includes(Number(value))?Number(value):1;
const leaders=state=>[{...state.commander,id:'player'},...(state.commanders||[])];
const leaderFor=(state,id)=>String(id)==='player'?state.commander:state.commanders.find(c=>String(c.id)===String(id));
export function armyGroupFor(state,id){return normalizeArmyGroup(leaderFor(state,id)?.armyGroupId);}
export function setArmyGroup(state,id,group){
 if(!ARMY_GROUP_IDS.includes(Number(group)))throw Error('班は第1〜第10班から選んでください。');
 const leader=leaderFor(state,id);if(!leader)throw Error('隊が見つかりません。');
 leader.armyGroupId=Number(group);
}
export function captainCandidates(state,id){
 return state.squads.filter(s=>s.count>0&&String(s.commanderId??'player')===String(id)).map(s=>({
  id:s.id,name:s.characterName||s.name||s.job+'代表',rarity:s.rarity,job:s.job,faceId:s.faceId??0,
  characterBuff:s.characterBuff||{}
 }));
}
export function armyCaptain(state,id){
 const selected=leaderFor(state,id)?.captainId;
 return captainCandidates(state,id).find(c=>String(c.id)===String(selected))||null;
}
export function setArmyCaptain(state,id,candidateId){
 const leader=leaderFor(state,id);if(!leader)throw Error('隊が見つかりません。');
 if(candidateId===null){delete leader.captainId;return;}
 const candidate=captainCandidates(state,id).find(c=>String(c.id)===String(candidateId));
 if(!candidate)throw Error('この隊に所属するキャラクターを選んでください。');
 leader.captainId=candidate.id;
}
export function captainBonus(captain){
 if(!captain)return {attack:0,defense:0};
 const rarity={N:0,R:.05,SR:.08,SSR:.12,UR:.15}[captain.rarity]??0;
 // Job/character traits and rarity stack; values are fractional increases.
 const jobAttack=['騎士','忍者','魔法使い','格闘家'].includes(captain.job)?.05:0;
 const jobDefense=['盾騎士','僧侶','召喚士','シーフ'].includes(captain.job)?.05:0;
 const trait=key=>Math.max(0,Math.min(.2,Number(captain.characterBuff?.[key])||0));
 return {attack:rarity+jobAttack+trait('attack'),defense:rarity+jobDefense+trait('defense')};
}
export function armyGroups(state){
 return ARMY_GROUP_IDS.map(id=>({id,name:'第'+id+'班',commanders:leaders(state).filter(c=>armyGroupFor(state,c.id)===id)}));
}
/** All member IDs are resolved before issue so a cooldown cannot cause a partial order. */
export function battleGroupMembers(id,squadIds,groupBySquad){
 const group=normalizeArmyGroup(groupBySquad[String(id)]);
 return squadIds.filter(sid=>normalizeArmyGroup(groupBySquad[String(sid)])===group);
}
