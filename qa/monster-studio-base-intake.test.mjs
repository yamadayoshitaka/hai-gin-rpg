import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 STUDIO_ACTOR_PACKAGE_SCHEMA,STUDIO_MODEL_PREVIEW_REVISION,
 REQUIRED_SKINNED_BONE_SLOTS,REQUIRED_MOTION_SLOTS,REQUIRED_VIEW_ANGLES,
 HUMANLIKE_SUMMON_PILOT_IDS,HUMANOID_COSPLAY_TARGET_IDS,
 COSPLAY_HUMAN_BASE_RELEASE_POLICY,
 validateStudioHumanActorPackage,planHumanoidCosplayBase
} from '../src/monster-studio-base-intake.js';
import {FEMALE_SUMMON_FORMS}
 from '../src/female-summon-forms.js';
import {HUMANOID_MONSTER_COSTUMES}
 from '../src/monster-character-cosplay-manifest.js';
import {CHARACTER_MODEL_REGISTRY}
 from '../src/character-model-registry.js';

assert.equal(STUDIO_MODEL_PREVIEW_REVISION,'v59');
assert.equal(HUMANLIKE_SUMMON_PILOT_IDS.length,3);
assert.deepEqual(new Set(HUMANLIKE_SUMMON_PILOT_IDS),
 new Set(Object.keys(FEMALE_SUMMON_FORMS)));
assert.equal(HUMANOID_COSPLAY_TARGET_IDS.length,16);
assert.deepEqual(new Set(HUMANOID_COSPLAY_TARGET_IDS),
 new Set(Object.keys(HUMANOID_MONSTER_COSTUMES)));
assert.equal(COSPLAY_HUMAN_BASE_RELEASE_POLICY.applyUnverifiedStudioModel,false);

const all=[...Object.values(FEMALE_SUMMON_FORMS),
 ...Object.values(HUMANOID_MONSTER_COSTUMES)];
for(const profile of all){
 const result=planHumanoidCosplayBase(profile);
 assert.equal(result.liveSource,'canonical-fullbody');
 assert.equal(result.activationAllowed,false);
 assert.equal(result.studioPackageReady,false);
 assert.equal(result.activeModelId,CHARACTER_MODEL_REGISTRY[profile.sex].id);
 assert.ok(result.errors.includes('studio-actor-package-missing'));
 assert.equal(result.rollout,profile.id.startsWith('m')?
  'humanoid-monster-next':'female-summon-pilot');
}

// Simulated future handoff package: a valid data contract is *only* a
// candidate. It MUST NOT automatically deploy an unreviewed new body.
const slots=Object.fromEntries(REQUIRED_SKINNED_BONE_SLOTS.map(x=>[x,x]));
const motions=Object.fromEntries(REQUIRED_MOTION_SLOTS.map(x=>[x,x]));
const visualQA=Object.fromEntries(REQUIRED_VIEW_ANGLES.map(x=>[x,true]));
const packageCandidate={
 schema:STUDIO_ACTOR_PACKAGE_SCHEMA,sex:'female',
 modelId:'Studio_Female_Production_Rig_01',
 modelUrl:'./assets/characters/studio/studio-female-prod-v60.glb',
 revision:'v60',productionSkinnedActor:true,
 sourceFaceNeckContinuous:true,
 bones:slots,motions,
 mappedBoneNames:REQUIRED_SKINNED_BONE_SLOTS.slice(),
 measuredHeightM:1.655,targetHeightM:1.66,
 face:{eyes:true,eyelids:true,blink:true,mouth:true,jaw:true,neck:true},
 fitting:{wigBaseMasked:true,armorAndCostumeNoClips:true,
  wingAndHornRoots:true},
 visualQA:{...visualQA,androidWebGL:true,battleRegression:true}
};
assert.equal(validateStudioHumanActorPackage(packageCandidate).ready,true);
for(const profile of Object.values(FEMALE_SUMMON_FORMS)){
 const result=planHumanoidCosplayBase(profile,{studioPackage:packageCandidate});
 assert.equal(result.studioPackageReady,true);
 assert.equal(result.studioRigReady,false);
 assert.deepEqual(result.studioRigErrors,['studio-scene-not-audited']);
 assert.equal(result.liveSource,'canonical-fullbody');
 assert.equal(result.activationAllowed,false);
 assert.equal(result.nextAction,'audit-loaded-studio-skeleton-and-motion');
}
const bad=[
 {part:{modelId:'Superhero_Female_FullBody'},error:'new-model-id'},
 {part:{modelUrl:'../../secrets.glb'},error:'versioned-game-glb'},
 {part:{face:{...packageCandidate.face,eyes:false}},error:'eyes-missing'},
 {part:{face:{...packageCandidate.face,eyelids:false}},error:'eyes-missing'},
 {part:{face:{...packageCandidate.face,mouth:false}},error:'mouth-expression'},
 {part:{sourceFaceNeckContinuous:false},error:'face-neck-unified'},
 {part:{bones:{head:'Head'}},error:'anatomical-bone-anchors'},
 {part:{motions:{idle:'idle'}},error:'game-action-mapping'},
 {part:{mappedBoneNames:['Head']},error:'retarget-joint-coverage'},
 {part:{measuredHeightM:1.98},error:'height-compatibility'},
 {part:{fitting:{...packageCandidate.fitting,wigBaseMasked:false}},
  error:'wig-source-scalp-overlap'},
 {part:{visualQA:{...packageCandidate.visualQA,top:false}},
  error:'2d-four-view-comparison'},
 {part:{visualQA:{...packageCandidate.visualQA,androidWebGL:false}},
  error:'android-webgl-qa'},
 {part:{visualQA:{...packageCandidate.visualQA,battleRegression:false}},
  error:'battle-regression'},
];
for(const {part,error} of bad){
 const pkg={...packageCandidate,...part};
 const result=validateStudioHumanActorPackage(pkg);
 assert.equal(result.ready,false,'Unsafe proposed studio model passed: '+error);
 assert.ok(result.errors.includes(error));
}
const adapter=readFileSync(
 new URL('../src/monster-character-cosplay.js',import.meta.url),'utf8');
assert.match(adapter,/planHumanoidCosplayBase\(profile,/);
assert.match(adapter,/studioActorPackage=null/);
assert.match(adapter,/humanBaseMigration/);
assert.match(adapter,/attachTownOutfitNpc\(/,
 'Legacy skinned actor must remain the production loader');
assert.ok(!adapter.includes('studioActorPackage.modelUrl'),
 'Unverified package URL must never be loaded directly');

const visualManifest=JSON.parse(readFileSync(
 new URL('../docs/monster-research/approved-humanoid-visual-targets-v1.json',
 import.meta.url),'utf8'));
assert.equal(visualManifest.runtimeMigrationEnabled,false);
assert.equal(visualManifest.targetHumanBase.modelReadyForCosplay,false);
assert.equal(visualManifest.qualityTargets.length,4);
assert.equal(visualManifest.repositoryImagesCommitted,false);
console.log('studio humanoid intake PASS: 3 summons, 16 humanoids, 2D reference requirements, production fallback and rig validation');
