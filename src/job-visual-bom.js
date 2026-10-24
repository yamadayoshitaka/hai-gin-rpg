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
