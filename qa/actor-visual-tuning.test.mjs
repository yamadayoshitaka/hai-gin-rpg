import assert from 'node:assert/strict';
import test from 'node:test';
import {ACTOR_VISUAL_TUNING,resolveActorVisualTuning,validateActorVisualTuning} from '../src/actor-visual-tuning.js';
test('BOM controls hero outdoor NPC and indoor NPC scales and camera',()=>{
 assert.equal(validateActorVisualTuning(),true);
 const hero=resolveActorVisualTuning({role:'hero',body:'adult'},'outdoor');
 assert.ok(hero.targetHeight>0&&hero.targetHeight<2);
 assert.ok(hero.cameraDistanceMultiplier>1);
 const adult=resolveActorVisualTuning({id:'town-craftsman',role:'civilian',body:'adult'},'outdoor');
 const child=resolveActorVisualTuning({id:'child',role:'civilian',body:'child'},'outdoor');
 assert.ok(child.targetHeight<adult.targetHeight);
 const indoor=resolveActorVisualTuning({role:'civilian',body:'adult'},'indoor');
 assert.equal(indoor.targetHeight,ACTOR_VISUAL_TUNING.indoorNpc.targetHeight);
 assert.ok(ACTOR_VISUAL_TUNING.bounds.maxRenderedHeight>=hero.targetHeight);
});
