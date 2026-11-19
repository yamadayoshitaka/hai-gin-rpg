/** Tactical command doctrine shared by the battle renderer and authoritative sim.
 * Soldier count affects total DPS; wounded soldiers also individually hit less.
 * Neither physical guard nor movement is reduced by loss of HP.
 */
export const COMMAND_RALLY_EFFECTS=Object.freeze({
 attack:{id:'command_attack',name:'⚔ 総攻撃号令',attack:.20,defense:0,speed:0,duration:22},
 defend:{id:'command_defend',name:'🛡 鉄壁号令',attack:0,defense:.20,speed:0,duration:22},
 advance:{id:'command_advance',name:'⚡ 進軍号令',attack:0,defense:0,speed:.20,duration:22}
});
export const COMMAND_RALLY_TYPES=Object.freeze(Object.values(COMMAND_RALLY_EFFECTS));
export function commanderTargetLimit(level){
 const lv=Math.max(1,Math.floor(Number(level)||1));
 return lv>=20?3:lv>=10?2:1;
}
export const strengthFromHp=(hp,maxHp)=>
 Math.max(0,Math.min(1,Math.max(0,Number(hp)||0)/Math.max(1,Number(maxHp)||1)));
export function squadCombatMeters(units=[],team,id){
 const members=units.filter(u=>Number(u.team)===Number(team)&&String(u.squadId)===String(id));
 const alive=members.filter(u=>u.alive!==false&&Number(u.hp)>0);
 const sum=(values,key)=>values.reduce((a,u)=>a+Math.max(0,Number(u[key])||0),0);
 const maxHp=sum(members,'maxHp'),hp=sum(alive,'hp');
 return {attackPercent:Math.round(strengthFromHp(hp,maxHp)*100),
  mp:Math.round(sum(alive,'mp')),maxMp:Math.round(sum(members,'maxMp'))};
}
export function squadReinforcementCapacity(units=[],team,id){
 const group=units.filter(u=>Number(u.team)===Number(team)&&String(u.squadId)===String(id)&&!u.isStrategist);
 return {total:group.length,missing:group.filter(u=>u.alive===false||!(u.hp>0)).length};
}
export const REINFORCEMENT_ITEMS=Object.freeze([
 'healing_potion','high_potion','elixir','field_bandage','medical_kit','royal_elixir'
]);
export function reinforcementSlots(itemId,level=1){
 const base={healing_potion:1,field_bandage:1,medical_kit:2,high_potion:2,elixir:3,royal_elixir:4}[itemId]||0;
 return Math.min(base,commanderTargetLimit(level)*2);
}
