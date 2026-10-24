import assert from 'node:assert/strict';
import {STARTER_TOWN} from '../src/starter-town.js';
import {getInteriorResidentDefinitions} from '../src/interior-scenes.js';
import {createInteractionRegistry,resolveDialogueById} from '../src/interaction-registry.js';
const registry=createInteractionRegistry({town:STARTER_TOWN,interiors:STARTER_TOWN.buildings,getResidents:getInteriorResidentDefinitions});
assert.ok(registry.size>=STARTER_TOWN.citizens.length);
for(const entry of registry.values()){
 assert.ok(entry.id&&entry.areaId&&entry.dialogueId&&entry.dialogue?.text);
 const result=resolveDialogueById(registry,{areaId:entry.areaId,entityId:entry.id});
 assert.equal(result.text,entry.dialogue.text);
 assert.throws(()=>resolveDialogueById(registry,{areaId:'wrong',entityId:entry.id}),/different area/);
}
assert.throws(()=>resolveDialogueById(registry,{areaId:'town',entityId:'unknown'}),/Unknown entity/);
console.log('Area/entity/dialogue ID graph verified');
