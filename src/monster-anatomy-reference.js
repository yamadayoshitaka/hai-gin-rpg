/**
 * Traceable real-animal anatomical analogues for the existing 50 fictional
 * bestiary IDs. These are inspiration for mechanical design, NOT web-fetched
 * AI training, copyrighted mesh reuse, or species-specific scientific proof.
 *
 * Each entry must be checked individually against an authoritative source
 * before physical asset work begins. Humanoid-looking species remain listed
 * for coverage but FROZEN: no shared human model/face/rig changes.
 */
export const ANATOMY_EVIDENCE=Object.freeze({
 canine:Object.freeze({
   url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC4517757/',
   title:'Planar Covariation of Hindlimb and Forelimb Elevation Angles during Terrestrial and Aquatic Locomotion of Dogs',
   principle:'walking lateral footfall, trotting diagonal coordination; fore/hind timing differs',
 }),
 feline:Object.freeze({
   url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC3077521/',
   title:'Functional anatomy of the cheetah forelimb',
   principle:'mobile scapula and powerful distal joint and claw control',
 }),
 felineSpine:Object.freeze({
   url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC9049215/',
   title:'Three Characteristics of Cheetah Galloping Improve Running Performance Through Spinal Movement',
   principle:'flexible lumbar region participates in gather/extend gallop',
 }),
 avian:Object.freeze({
   url:'https://pubmed.ncbi.nlm.nih.gov/39329577/',
   title:'Characterization of Wing Kinematics by Decoupling Joint Movement in the Pigeon',
   principle:'wing shoulder, elbow and wrist independently flap, sweep, fold and twist',
 }),
 reptile:Object.freeze({
   url:'https://doi.org/10.1242/jeb.200.16.2177',
   title:'Mechanics of Locomotion in Lizards',
   principle:'lateral trunk bend accompanies terrestrial limb motion',
 }),
 serpent:Object.freeze({
   url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC9271186/',
   title:'Coordinating tiny limbs and long bodies: Geometric mechanics of lizard terrestrial swimming',
   principle:'long body propulsion incorporates traveling and standing body waves',
 }),
 insect:Object.freeze({
   url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC3102013/',
   title:'Kinematic and behavioral evidence for trotting and ambling gaits in a cockroach',
   principle:'six jointed legs alternate support tripod as gait speed changes',
 }),
 beetleWing:Object.freeze({
   url:'https://www.nature.com/articles/s41586-024-07755-9',
   title:'Passive wing deployment and retraction in beetles and flapping microrobots',
   principle:'elytra open before hindwing deployment and folding',
 }),
 spider:Object.freeze({
   url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC6935789/',
   title:'Analysis of Spiders Joint Kinematics and Driving Modes',
   principle:'alternating tetrapod support, hydraulic extension at certain joints',
 }),
 octopus:Object.freeze({
   url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC7704652/',
   title:'Octopus arms exhibit exceptional flexibility',
   principle:'muscular hydrostats bend, twist, elongate and shorten',
 }),
 skinning:Object.freeze({
   url:'https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html',
   title:'Khronos glTF 2.0 specification',
   principle:'deforming mesh needs skeleton joints, normalized skin weights and inverse bind matrices',
 }),
});

/** Reviewed mechanical analogue per catalogue entry. "hold" never edits
 * source models; these character/construct silhouettes may share human rigs.
 */
const species=[
 ['m001','canine','wolf','pursuit'],['m002','canine','wolf','lunge'],['m003','canine','large wolf','bound'],['m004','canine','wolf','sprint'],['m005','canine','wolf','creep'],
 ['m006','feline','panther','stalk'],['m007','feline','saber-tooth cat','strike'],['m008','feline','lion','run'],['m009','feline','leopard','pounce'],['m010','feline','tiger','sprint'],
 ['m011','avian','eagle','soar'],['m012','avian','eagle+lion fantasy composite','flap'],['m013','avian','phoenix/eagle analogue','flap'],['m014','avian','owl','glide'],
 ['m015','hold','human-like tengu','do not change shared humanoid anatomy'],
 ['m016','reptile','large lizard','crawl'],['m017','reptile','lizard','strike'],['m018','reptile','multi-neck fantasy lizard','strike'],['m019','reptile','salamander','crawl'],['m020','serpent','sea serpent','undulate'],
 ['m021','insect','beetle','crawl'],['m022','insect','rhinoceros beetle','fly'],['m023','insect','praying mantis','raptorial'],['m024','insect','scarab beetle','crawl'],['m025','insect','beetle','fly'],
 ['m026','spider','orb-web spider','crawl'],['m027','spider','tarantula','strike'],['m028','spider','spider','crawl'],['m029','spider','spider','dash'],['m030','spider','large spider','strike'],
 ['m031','hold','humanoid skeleton','human mesh exclusion'],['m032','hold','humanoid mummy','human mesh exclusion'],['m033','hold','humanoid knight','human mesh exclusion'],['m034','hold','vampire','human mesh exclusion'],['m035','hold','lich','human mesh exclusion'],
 ['m036','hold','humanoid golem','human-like rig exclusion'],['m037','hold','humanoid statue','human-like rig exclusion'],['m038','hold','humanoid crystal warrior','human-like rig exclusion'],['m039','hold','humanoid lava giant','human-like rig exclusion'],['m040','hold','humanoid silver colossus','human-like rig exclusion'],
 ['m041','hold','imp','human-like rig exclusion'],['m042','hold','gargoyle','human-like rig exclusion'],['m043','hold','demon','human-like rig exclusion'],['m044','hold','succubus','human-like rig exclusion'],['m045','hold','knight rider','human-like rig exclusion'],
 ['m046','octopus','hydrostatic jelly analogue','compress'],['m047','octopus','octopus','reach'],['m048','serpent','sea serpent','undulate'],['m049','octopus','giant octopus/kraken','grasp'],['m050','reptile','marine reptile/sea beast','swim'],
];

export const MONSTER_ANATOMY_RESEARCH=Object.freeze(Object.fromEntries(
 species.map(([id,source,analogue,motion])=>{
   const cited=ANATOMY_EVIDENCE[source]??null;
   return [id,Object.freeze({
     id,analogue,motion,source:source==='hold'?null:source,
     evidence:cited?.url??null,
     status:source==='hold'?'protected-humanlike':'biomechanical-analogue',
     notes:source==='hold'
       ?'No model, rig, clothing, shared head or skin edits until separately verified'
       :'Fantasy proportions require artistic review, collision QA and real rendering',
   })];
 })
));
export function monsterEvidenceFor(spec){
 return MONSTER_ANATOMY_RESEARCH[spec?.id]??null;
}
