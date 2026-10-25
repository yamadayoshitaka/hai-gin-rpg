/** Character/equipment/VFX assembly contract v106.
 * Data describes appearance; runtime only instantiates and animates.
 * A null asset means use the existing procedural fallback until GLTF is deployed.
 */
export const VISUAL_ASSET_ROOTS=Object.freeze({
 outfits:'./assets/characters/quaternius-outfits/',
 props:'./assets/props/fantasy-megakit/',
 particles:'./assets/vfx/kenney/'
});
const make=(outfit,weapon,magic,attack,accent)=>Object.freeze({outfit,weapon,magic,attack,accent});
export const JOB_ASSEMBLY=Object.freeze({
 swordsman:make('Male_Ranger','Sword','steel','slash','#c4d8eb'),
 knight:make('Male_Ranger','Sword','steel','heavy','#ddc9a1'),
 rogue:make('Male_Ranger','Dagger','shadow','quick','#9bc2cb'),
 monk:make('Male_Peasant',null,'ki','punch','#f0a86b'),
 merchant:make('Male_Peasant',null,'coin','quick','#e9bb70'),
 traveler:make('Male_Peasant','Sword','wind','slash','#9dd8d0'),
 smith:make('Male_Peasant','Hammer','ember','heavy','#e49e61'),
 chef:make('Male_Peasant','Dagger','steam','quick','#f5c38b'),
 herbalist:make('Female_Peasant','Staff','nature','cast','#83dca9'),
 bard:make('Female_Peasant',null,'music','cast','#df8de2'),
 farmer:make('Male_Peasant','Staff','earth','heavy','#babb7d'),
 scholar:make('Male_Peasant','Staff','arcane','cast','#839ff3'),
 innkeeper:make('Female_Peasant',null,'warmth','quick','#edbd85'),
 priest:make('Female_Peasant','Staff','holy','cast','#efdb9a'),
 mage:make('Male_Ranger','Staff','arcane','cast','#a49cff'),
 archer:make('Male_Ranger','Bow','wind','shot','#a4dcbe'),
 paladin:make('Male_Ranger','Sword','holy','heavy','#edd5a5'),
 assassin:make('Male_Ranger','Dagger','shadow','quick','#9ba5e3'),
 samurai:make('Male_Ranger','Sword','steel','slash','#e2b8b2'),
 ranger:make('Female_Ranger','Bow','nature','shot','#8dd7b5')
});
export const VFX_RECIPES=Object.freeze({
 slash:{shape:'arc',width:.88,life:.26,particles:10},
 heavy:{shape:'arc',width:1.15,life:.34,particles:16},
 quick:{shape:'streak',width:.62,life:.15,particles:6},
 punch:{shape:'impact',width:.30,life:.16,particles:5},
 shot:{shape:'tracer',width:1.1,life:.20,particles:8},
 cast:{shape:'ring',width:.74,life:.60,particles:14}
});
export function resolveVisualAssembly(job){return JOB_ASSEMBLY[job]||JOB_ASSEMBLY.traveler;}
export function validateVisualAssembly(jobs){const ids=Object.keys(jobs);const absent=ids.filter(id=>!JOB_ASSEMBLY[id]||!JOB_OUTFIT_BOM[id]);if(absent.length)throw Error('Visual recipes missing: '+absent.join(','));return true;}

// Outfit recipes are independent of rendering, animation and collision logic.
// Parts are available as Quaternius skinned modular meshes: peasant/ranger variants.
const fit=(body,arms,legs,feet,hood=false,pauldron=false)=>Object.freeze({body,arms,legs,feet,hood,pauldron});
export const JOB_OUTFIT_BOM=Object.freeze({
 swordsman:fit('ranger','ranger','ranger','ranger',false,true),
 knight:fit('ranger','ranger','ranger','ranger',false,true),
 rogue:fit('ranger','peasant','ranger','ranger',true,false),
 monk:fit('peasant','peasant','peasant','peasant'),
 merchant:fit('peasant','peasant','ranger','peasant'),
 traveler:fit('peasant','ranger','peasant','ranger'),
 smith:fit('peasant','ranger','peasant','ranger'),
 chef:fit('peasant','peasant','ranger','peasant'),
 herbalist:fit('peasant','peasant','peasant','ranger'),
 bard:fit('peasant','ranger','peasant','peasant'),
 farmer:fit('peasant','peasant','peasant','peasant'),
 scholar:fit('peasant','ranger','peasant','ranger',true),
 innkeeper:fit('peasant','peasant','peasant','ranger'),
 priest:fit('peasant','ranger','ranger','peasant'),
 mage:fit('peasant','ranger','peasant','ranger',true),
 archer:fit('ranger','peasant','ranger','ranger',true),
 paladin:fit('ranger','ranger','peasant','ranger',false,true),
 assassin:fit('ranger','ranger','ranger','peasant',true),
 samurai:fit('ranger','peasant','ranger','peasant',false,true),
 ranger:fit('ranger','ranger','ranger','ranger',true)
});
export function resolveJobOutfit(job){return JOB_OUTFIT_BOM[job]||JOB_OUTFIT_BOM.traveler;}
