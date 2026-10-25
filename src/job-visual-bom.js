/** Job-authored visual/action BOM. Pure configuration: renderer and animator only consume data. */
export const JOB_VISUAL_BOM=Object.freeze({
 swordsman:{cloth:'#57729c',accent:'#d4bd8c',stance:-0.056,shoulderSwing:0.3,hipSwing:0.38,tempo:1,attackLean:0.12,weaponScale:0.68,idleSway:0.012},
 knight:{cloth:'#7186a8',accent:'#e2cfa0',stance:-0.028,shoulderSwing:0.28700000000000003,hipSwing:0.36700000000000005,tempo:0.895,attackLean:0.272,weaponScale:0.77,idleSway:0.018000000000000002},
 rogue:{cloth:'#4e7865',accent:'#c0b58c',stance:0,shoulderSwing:0.274,hipSwing:0.454,tempo:1.18,attackLean:0.23399999999999999,weaponScale:0.6,idleSway:0.024},
 monk:{cloth:'#b8794a',accent:'#e9bb75',stance:0.028,shoulderSwing:0.291,hipSwing:0.4,tempo:1.13,attackLean:0.19,weaponScale:0.6,idleSway:0.030000000000000002},
 merchant:{cloth:'#b59658',accent:'#ead88b',stance:0.056,shoulderSwing:0.3,hipSwing:0.40700000000000003,tempo:1.025,attackLean:0.142,weaponScale:0.68,idleSway:0.036000000000000004},
 traveler:{cloth:'#668f9d',accent:'#e0bd84',stance:-0.056,shoulderSwing:0.317,hipSwing:0.434,tempo:1.05,attackLean:0.16399999999999998,weaponScale:0.68,idleSway:0.012},
 smith:{cloth:'#94705e',accent:'#d6a971',stance:-0.028,shoulderSwing:0.30400000000000005,hipSwing:0.34,tempo:0.87,attackLean:0.25,weaponScale:0.77,idleSway:0.018000000000000002},
 chef:{cloth:'#bf8770',accent:'#f0d1a4',stance:0,shoulderSwing:0.351,hipSwing:0.40700000000000003,tempo:1.025,attackLean:0.142,weaponScale:0.68,idleSway:0.024},
 herbalist:{cloth:'#71936b',accent:'#e1bc8d',stance:0.028,shoulderSwing:0.3,hipSwing:0.434,tempo:1.05,attackLean:0.16399999999999998,weaponScale:0.68,idleSway:0.030000000000000002},
 bard:{cloth:'#946ab6',accent:'#f2d4a8',stance:0.056,shoulderSwing:0.20700000000000002,hipSwing:0.26,tempo:0.91,attackLean:0.06,weaponScale:0.66,idleSway:0.036000000000000004},
 farmer:{cloth:'#8a9250',accent:'#d6c89a',stance:-0.056,shoulderSwing:0.30400000000000005,hipSwing:0.36700000000000005,tempo:0.895,attackLean:0.272,weaponScale:0.77,idleSway:0.012},
 scholar:{cloth:'#657ba8',accent:'#c0bbef',stance:-0.028,shoulderSwing:0.241,hipSwing:0.314,tempo:0.9600000000000001,attackLean:0.104,weaponScale:0.66,idleSway:0.018000000000000002},
 innkeeper:{cloth:'#9b7962',accent:'#e2be92',stance:0,shoulderSwing:0.3,hipSwing:0.38,tempo:1,attackLean:0.12,weaponScale:0.68,idleSway:0.024},
 priest:{cloth:'#d4c4a0',accent:'#f1e4c8',stance:0.028,shoulderSwing:0.20700000000000002,hipSwing:0.28700000000000003,tempo:0.935,attackLean:0.08199999999999999,weaponScale:0.66,idleSway:0.030000000000000002},
 mage:{cloth:'#7866ad',accent:'#e3c2ff',stance:0.056,shoulderSwing:0.224,hipSwing:0.314,tempo:0.9600000000000001,attackLean:0.104,weaponScale:0.66,idleSway:0.036000000000000004},
 archer:{cloth:'#547e69',accent:'#bacc8d',stance:-0.056,shoulderSwing:0.291,hipSwing:0.4,tempo:1.13,attackLean:0.19,weaponScale:0.6,idleSway:0.012},
 paladin:{cloth:'#d5c58e',accent:'#f8e7b2',stance:-0.028,shoulderSwing:0.27,hipSwing:0.36700000000000005,tempo:0.895,attackLean:0.272,weaponScale:0.77,idleSway:0.018000000000000002},
 assassin:{cloth:'#4c566f',accent:'#aeb8c8',stance:0,shoulderSwing:0.257,hipSwing:0.454,tempo:1.18,attackLean:0.23399999999999999,weaponScale:0.6,idleSway:0.024},
 samurai:{cloth:'#a85d57',accent:'#e6d1aa',stance:0.028,shoulderSwing:0.33399999999999996,hipSwing:0.38,tempo:1,attackLean:0.12,weaponScale:0.68,idleSway:0.030000000000000002},
 ranger:{cloth:'#567966',accent:'#b7d6b1',stance:0.056,shoulderSwing:0.291,hipSwing:0.42700000000000005,tempo:1.1549999999999998,attackLean:0.212,weaponScale:0.6,idleSway:0.036000000000000004}
});
export function resolveJobVisual(job){return JOB_VISUAL_BOM[job]||JOB_VISUAL_BOM.traveler;}
export function validateJobVisuals(jobs){const ids=Object.keys(jobs);if(ids.length!==Object.keys(JOB_VISUAL_BOM).length||ids.some(id=>!JOB_VISUAL_BOM[id]))throw Error('Job visual BOM mismatch');for(const [id,v] of Object.entries(JOB_VISUAL_BOM))if(!/^#[0-9a-f]{6}$/i.test(v.cloth)||!Object.values(v).slice(2).every(Number.isFinite))throw Error('Bad job visual '+id);return true;}

/** Every job owns a unique action/equipment/material identity; animation renderer consumes the same data. */
export const JOB_IDENTITY_BOM=Object.freeze({
 swordsman:{weapon:'sword',outfit:'blade',finish:'steel',attack:'slash',idle:'idle_swordsman',walk:'walk_swordsman',run:'run_swordsman',guard:'guard_swordsman',interaction:'interact_swordsman',hit:'hit_swordsman',primary:'attack_swordsman',profileSeed:1},
 knight:{weapon:'shield',outfit:'plate',finish:'iron',attack:'bash',idle:'idle_knight',walk:'walk_knight',run:'run_knight',guard:'guard_knight',interaction:'interact_knight',hit:'hit_knight',primary:'attack_knight',profileSeed:2},
 rogue:{weapon:'dagger',outfit:'leather',finish:'matte',attack:'stab',idle:'idle_rogue',walk:'walk_rogue',run:'run_rogue',guard:'guard_rogue',interaction:'interact_rogue',hit:'hit_rogue',primary:'attack_rogue',profileSeed:3},
 monk:{weapon:'fists',outfit:'wrap',finish:'cloth',attack:'combo',idle:'idle_monk',walk:'walk_monk',run:'run_monk',guard:'guard_monk',interaction:'interact_monk',hit:'hit_monk',primary:'attack_monk',profileSeed:4},
 merchant:{weapon:'coins',outfit:'vest',finish:'linen',attack:'toss',idle:'idle_merchant',walk:'walk_merchant',run:'run_merchant',guard:'guard_merchant',interaction:'interact_merchant',hit:'hit_merchant',primary:'attack_merchant',profileSeed:5},
 traveler:{weapon:'shortsword',outfit:'coat',finish:'linen',attack:'slash',idle:'idle_traveler',walk:'walk_traveler',run:'run_traveler',guard:'guard_traveler',interaction:'interact_traveler',hit:'hit_traveler',primary:'attack_traveler',profileSeed:6},
 smith:{weapon:'hammer',outfit:'apron',finish:'iron',attack:'smash',idle:'idle_smith',walk:'walk_smith',run:'run_smith',guard:'guard_smith',interaction:'interact_smith',hit:'hit_smith',primary:'attack_smith',profileSeed:7},
 chef:{weapon:'knife',outfit:'apron',finish:'linen',attack:'flurry',idle:'idle_chef',walk:'walk_chef',run:'run_chef',guard:'guard_chef',interaction:'interact_chef',hit:'hit_chef',primary:'attack_chef',profileSeed:8},
 herbalist:{weapon:'pouch',outfit:'robe',finish:'linen',attack:'throw',idle:'idle_herbalist',walk:'walk_herbalist',run:'run_herbalist',guard:'guard_herbalist',interaction:'interact_herbalist',hit:'hit_herbalist',primary:'attack_herbalist',profileSeed:9},
 bard:{weapon:'lute',outfit:'cloak',finish:'silk',attack:'chord',idle:'idle_bard',walk:'walk_bard',run:'run_bard',guard:'guard_bard',interaction:'interact_bard',hit:'hit_bard',primary:'attack_bard',profileSeed:10},
 farmer:{weapon:'sickle',outfit:'tunic',finish:'linen',attack:'sweep',idle:'idle_farmer',walk:'walk_farmer',run:'run_farmer',guard:'guard_farmer',interaction:'interact_farmer',hit:'hit_farmer',primary:'attack_farmer',profileSeed:11},
 scholar:{weapon:'book',outfit:'robe',finish:'silk',attack:'cast',idle:'idle_scholar',walk:'walk_scholar',run:'run_scholar',guard:'guard_scholar',interaction:'interact_scholar',hit:'hit_scholar',primary:'attack_scholar',profileSeed:12},
 innkeeper:{weapon:'staff',outfit:'vest',finish:'linen',attack:'strike',idle:'idle_innkeeper',walk:'walk_innkeeper',run:'run_innkeeper',guard:'guard_innkeeper',interaction:'interact_innkeeper',hit:'hit_innkeeper',primary:'attack_innkeeper',profileSeed:13},
 priest:{weapon:'mace',outfit:'robe',finish:'silk',attack:'bless',idle:'idle_priest',walk:'walk_priest',run:'run_priest',guard:'guard_priest',interaction:'interact_priest',hit:'hit_priest',primary:'attack_priest',profileSeed:14},
 mage:{weapon:'staff',outfit:'robe',finish:'silk',attack:'cast',idle:'idle_mage',walk:'walk_mage',run:'run_mage',guard:'guard_mage',interaction:'interact_mage',hit:'hit_mage',primary:'attack_mage',profileSeed:15},
 archer:{weapon:'bow',outfit:'hood',finish:'leather',attack:'shoot',idle:'idle_archer',walk:'walk_archer',run:'run_archer',guard:'guard_archer',interaction:'interact_archer',hit:'hit_archer',primary:'attack_archer',profileSeed:16},
 paladin:{weapon:'shield',outfit:'plate',finish:'steel',attack:'holy',idle:'idle_paladin',walk:'walk_paladin',run:'run_paladin',guard:'guard_paladin',interaction:'interact_paladin',hit:'hit_paladin',primary:'attack_paladin',profileSeed:17},
 assassin:{weapon:'twinblade',outfit:'hood',finish:'leather',attack:'stab',idle:'idle_assassin',walk:'walk_assassin',run:'run_assassin',guard:'guard_assassin',interaction:'interact_assassin',hit:'hit_assassin',primary:'attack_assassin',profileSeed:18},
 samurai:{weapon:'katana',outfit:'kimono',finish:'silk',attack:'draw',idle:'idle_samurai',walk:'walk_samurai',run:'run_samurai',guard:'guard_samurai',interaction:'interact_samurai',hit:'hit_samurai',primary:'attack_samurai',profileSeed:19},
 ranger:{weapon:'bow',outfit:'cloak',finish:'leather',attack:'shoot',idle:'idle_ranger',walk:'walk_ranger',run:'run_ranger',guard:'guard_ranger',interaction:'interact_ranger',hit:'hit_ranger',primary:'attack_ranger',profileSeed:20},
});
export function resolveJobIdentity(job){return JOB_IDENTITY_BOM[job]||JOB_IDENTITY_BOM.traveler;}
export function validateJobIdentity(jobs){const ids=Object.keys(jobs),unique=new Set();for(const id of ids){const v=JOB_IDENTITY_BOM[id];if(!v||!v.weapon||!v.outfit||!v.attack||unique.has(v.primary))throw Error('Incomplete or duplicate job identity '+id);unique.add(v.primary);}return unique.size===ids.length;}
