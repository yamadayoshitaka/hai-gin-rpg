/**
 * Attack order variants exposed to the player.
 * The underlying simulation accepts charge/defend/hold. A ranged stance
 * holds ground and allows built-in ranged AI to fire; it doesn't create
 * fictional projectile skills. "Delay" holds until a subsequent order.
 */
export const BATTLE_ATTACK_CHOICES=Object.freeze([
 {id:'near',label:'近距離',command:'charge',description:'接近して攻撃'},
 {id:'far',label:'遠距離',command:'hold',description:'位置を保って射程内を攻撃'},
 {id:'intercept',label:'迎撃',command:'defend',description:'守備姿勢から敵を迎え撃つ'},
 {id:'delay',label:'延期',command:'hold',description:'次の命令まで攻撃を保留'}
]);
const RANGED_JOBS=['弓使い','魔法使い','僧侶','召喚士'];
export function isRangedBattleJob(job){
 return RANGED_JOBS.some(name=>String(job||'').includes(name));
}
export function battleAttackCommand(type,job){
 const choice=BATTLE_ATTACK_CHOICES.find(item=>item.id===type);
 if(!choice)return null;
 if(choice.id==='far'&&!isRangedBattleJob(job))return null;
 return choice.command;
}
