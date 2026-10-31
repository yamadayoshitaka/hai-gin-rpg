// Data-only occupation catalog. Animation assets are selected by motionSet, not duplicated per job.
export const MOTION_SET_BOM=Object.freeze({
 common:{idle:'Idle_Loop',walk:'Walk_Loop',run:'Jog_Fwd_Loop',sprint:'Sprint_Loop'},
 noble:{base:'common'},hammer:{base:'common'},axe:{base:'common'},
 sword:{base:'common',idle:'Sword_Idle',attack:'Sword_Attack'},
 dagger:{base:'common'},spear:{base:'common'},unarmed:{base:'common'},
 bow:{base:'common'},ranged:{base:'common'},staff:{base:'common'}
});
export const JOB_CATALOG=Object.freeze({
  "civilian": {
    "name": "民間人",
    "category": "general",
    "motionSet": "common",
    "role": "civilian"
  },
  "farmer": {
    "name": "農民",
    "category": "general",
    "motionSet": "common",
    "role": "civilian"
  },
  "merchant": {
    "name": "商人",
    "category": "general",
    "motionSet": "common",
    "role": "civilian"
  },
  "blacksmith": {
    "name": "鍛冶師",
    "category": "general",
    "motionSet": "hammer",
    "role": "civilian"
  },
  "cook": {
    "name": "料理人",
    "category": "general",
    "motionSet": "common",
    "role": "civilian"
  },
  "fisher": {
    "name": "漁師",
    "category": "general",
    "motionSet": "common",
    "role": "civilian"
  },
  "woodcutter": {
    "name": "木こり",
    "category": "general",
    "motionSet": "axe",
    "role": "civilian"
  },
  "miner": {
    "name": "鉱夫",
    "category": "general",
    "motionSet": "hammer",
    "role": "civilian"
  },
  "traveler": {
    "name": "旅人",
    "category": "general",
    "motionSet": "common",
    "role": "civilian"
  },
  "noble": {
    "name": "貴族",
    "category": "general",
    "motionSet": "noble",
    "role": "civilian"
  },
  "swordsman": {
    "name": "剣士",
    "category": "melee",
    "motionSet": "sword",
    "role": "combatant"
  },
  "knight": {
    "name": "騎士",
    "category": "melee",
    "motionSet": "sword",
    "role": "combatant"
  },
  "samurai": {
    "name": "侍",
    "category": "melee",
    "motionSet": "sword",
    "role": "combatant"
  },
  "spearman": {
    "name": "槍兵",
    "category": "melee",
    "motionSet": "spear",
    "role": "combatant"
  },
  "axeman": {
    "name": "斧戦士",
    "category": "melee",
    "motionSet": "axe",
    "role": "combatant"
  },
  "martial_artist": {
    "name": "格闘家",
    "category": "melee",
    "motionSet": "unarmed",
    "role": "combatant"
  },
  "thief": {
    "name": "盗賊",
    "category": "melee",
    "motionSet": "dagger",
    "role": "combatant"
  },
  "assassin": {
    "name": "暗殺者",
    "category": "melee",
    "motionSet": "dagger",
    "role": "combatant"
  },
  "berserker": {
    "name": "狂戦士",
    "category": "melee",
    "motionSet": "axe",
    "role": "combatant"
  },
  "paladin": {
    "name": "聖騎士",
    "category": "melee",
    "motionSet": "sword",
    "role": "combatant"
  },
  "archer": {
    "name": "弓使い",
    "category": "ranged",
    "motionSet": "bow",
    "role": "combatant"
  },
  "hunter": {
    "name": "狩人",
    "category": "ranged",
    "motionSet": "bow",
    "role": "combatant"
  },
  "gunner": {
    "name": "銃士",
    "category": "ranged",
    "motionSet": "ranged",
    "role": "combatant"
  },
  "thrower": {
    "name": "投擲士",
    "category": "ranged",
    "motionSet": "ranged",
    "role": "combatant"
  },
  "sniper": {
    "name": "狙撃手",
    "category": "ranged",
    "motionSet": "bow",
    "role": "combatant"
  },
  "machinist": {
    "name": "機工士",
    "category": "ranged",
    "motionSet": "ranged",
    "role": "combatant"
  },
  "mage": {
    "name": "魔法使い",
    "category": "magic",
    "motionSet": "staff",
    "role": "combatant"
  },
  "black_mage": {
    "name": "黒魔導士",
    "category": "magic",
    "motionSet": "staff",
    "role": "combatant"
  },
  "white_mage": {
    "name": "白魔導士",
    "category": "magic",
    "motionSet": "staff",
    "role": "combatant"
  },
  "summoner": {
    "name": "召喚士",
    "category": "magic",
    "motionSet": "staff",
    "role": "combatant"
  },
  "elementalist": {
    "name": "精霊術師",
    "category": "magic",
    "motionSet": "staff",
    "role": "combatant"
  },
  "time_mage": {
    "name": "時魔導士",
    "category": "magic",
    "motionSet": "staff",
    "role": "combatant"
  },
  "necromancer": {
    "name": "死霊術師",
    "category": "magic",
    "motionSet": "staff",
    "role": "combatant"
  },
  "hexer": {
    "name": "呪術師",
    "category": "magic",
    "motionSet": "staff",
    "role": "combatant"
  },
  "sage": {
    "name": "賢者",
    "category": "magic",
    "motionSet": "staff",
    "role": "combatant"
  },
  "spellblade": {
    "name": "魔剣士",
    "category": "magic",
    "motionSet": "sword",
    "role": "combatant"
  },
  "monk": {
    "name": "僧侶",
    "category": "support",
    "motionSet": "staff",
    "role": "combatant"
  },
  "priest": {
    "name": "神官",
    "category": "support",
    "motionSet": "staff",
    "role": "combatant"
  },
  "bard": {
    "name": "吟遊詩人",
    "category": "support",
    "motionSet": "common",
    "role": "combatant"
  },
  "dancer": {
    "name": "踊り子",
    "category": "support",
    "motionSet": "common",
    "role": "combatant"
  },
  "alchemist": {
    "name": "錬金術師",
    "category": "support",
    "motionSet": "staff",
    "role": "combatant"
  },
  "apothecary": {
    "name": "薬師",
    "category": "support",
    "motionSet": "common",
    "role": "combatant"
  },
  "beastmaster": {
    "name": "獣使い",
    "category": "support",
    "motionSet": "bow",
    "role": "combatant"
  },
  "astrologer": {
    "name": "占星術師",
    "category": "support",
    "motionSet": "staff",
    "role": "combatant"
  },
  "bandit": {
    "name": "山賊",
    "category": "enemy",
    "motionSet": "dagger",
    "role": "enemy"
  },
  "pirate": {
    "name": "海賊",
    "category": "enemy",
    "motionSet": "sword",
    "role": "enemy"
  },
  "mercenary": {
    "name": "傭兵",
    "category": "enemy",
    "motionSet": "sword",
    "role": "enemy"
  },
  "guard": {
    "name": "衛兵",
    "category": "enemy",
    "motionSet": "spear",
    "role": "enemy"
  },
  "demon_soldier": {
    "name": "魔族兵",
    "category": "enemy",
    "motionSet": "sword",
    "role": "enemy"
  },
  "demon_lord": {
    "name": "魔王",
    "category": "enemy",
    "motionSet": "staff",
    "role": "enemy"
  }
});
// Town simulation defaults: data-only, shared by NPC AI and actor construction.
export const JOB_LIFE_BOM=Object.freeze({
 civilian:{schedule:'wander',workplace:'town',equipment:null},
 farmer:{schedule:'fieldwork',workplace:'farm',equipment:'hoe'},
 merchant:{schedule:'shopkeeper',workplace:'shop',equipment:null},
 blacksmith:{schedule:'craft',workplace:'forge',equipment:'hammer'},
 cook:{schedule:'craft',workplace:'kitchen',equipment:null},
 fisher:{schedule:'fieldwork',workplace:'waterfront',equipment:'rod'},
 woodcutter:{schedule:'fieldwork',workplace:'forest',equipment:'axe'},
 miner:{schedule:'fieldwork',workplace:'mine',equipment:'pickaxe'},
 traveler:{schedule:'wander',workplace:'road',equipment:null},
 noble:{schedule:'social',workplace:'manor',equipment:null},
 guard:{schedule:'patrol',workplace:'gate',equipment:'spear'},
 priest:{schedule:'service',workplace:'church',equipment:'staff'},
 apothecary:{schedule:'shopkeeper',workplace:'apothecary',equipment:null},
 alchemist:{schedule:'craft',workplace:'laboratory',equipment:null}
});
export function resolveJobLife(jobId){
 const job=JOB_CATALOG[jobId];if(!job)throw Error('Unknown job: '+jobId);
 return {...(JOB_LIFE_BOM[jobId]??(job.role==='enemy'?{schedule:'hostile',workplace:'wilds',equipment:null}:{schedule:'wander',workplace:'town',equipment:null}))};
}
export function resolveJobMotion(jobId,action){
 const job=JOB_CATALOG[jobId];if(!job)throw Error('Unknown job: '+jobId);
 let set=MOTION_SET_BOM[job.motionSet],clip;
 for(let i=0;i<3&&set;i++){if(set[action]){clip=set[action];break;}set=set.base?MOTION_SET_BOM[set.base]:null;}
 return clip??null;
}
export function validateJobCatalog(){
 if(Object.keys(JOB_CATALOG).length!==50)throw Error('Expected 50 jobs');
 for(const [id,job] of Object.entries(JOB_CATALOG))if(!MOTION_SET_BOM[job.motionSet]||!job.name||!job.role)throw Error('Invalid job '+id);
 return true;
}
