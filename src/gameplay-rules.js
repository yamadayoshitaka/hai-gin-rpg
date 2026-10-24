/**
 * Declarative gameplay tuning. No runtime classes or THREE dependencies.
 * Rules are explicit data so balancing does not require editing update loops.
 */
export const GAMEPLAY_RULES=Object.freeze({
 combat:{staminaRegen:{active:8,idle:17},mpRegen:2.5,guardPostureRegen:19,
   staminaMaxKey:'maxStamina',mpMaxKey:'maxMp',guardPostureMaxKey:'maxGuardPosture'},
 progression:{xp:{base:35,quadratic:14},levelUp:{maxHp:8,hp:8,maxStamina:3,maxMp:3},
   job:{skillLevelInterval:3,maxSkillTiers:5,damagePerTier:7,costPerTier:3}},
 alignment:{minimum:-100,maximum:100,branchThreshold:20,endingThreshold:60,
   questLevel:10,civilianKill:-20,residentHelp:7,residentRewardGold:8},
 npc:{town:{chaseDistance:2.7,chaseSpeed:3.2,maxChaseStep:.13,collisionRadius:.38},indoor:{chaseDistance:2.7,chaseSpeed:2.5,collisionRadius:.52}},
 interactions:{buildingEntry:12,actor:5.2,stair:3.2,blueprintDoor:3.4,
   plannedDoor:3.6,indoorDoor:3.6,prototypeDoor:2.9}
});
