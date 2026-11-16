import assert from 'node:assert/strict';
import {createMountInteriorMask,isMountInteriorCell} from '../src/mount-interior-policy.js';
import {CombatActionRuntime} from '../src/combat-action-runtime.js';
const width=24,height=24;
const mask=createMountInteriorMask(width,height,[
 {kind:'house',x:10,z:10,w:8,d:8},
 {kind:'castle',x:20,z:20,w:8,d:8}
],[{minX:2,maxX:5,minZ:2,maxZ:5}]);
assert.equal(isMountInteriorCell(mask,width,10,10),true);
assert.equal(isMountInteriorCell(mask,width,10,5),false);
assert.equal(isMountInteriorCell(mask,width,20,20),false,'castle courtyard remains outdoor');
assert.equal(isMountInteriorCell(mask,width,3,3),true,'independent cottage is included');
const action=new CombatActionRuntime({width,height,walkable:new Uint8Array(width*height).fill(1),mountForbidden:mask});
const rider={id:0,x:10,z:6,team:0,hp:100,mountId:'horse-0',alive:true};
const horse={id:'horse-0',type:'horse',category:'mount',alive:true,team:0,
 x:10,z:6,mountedBy:0,blocking:false,flying:false};
action.objects.push(horse);
action._occupancy=new Int32Array(width*height).fill(-1);
assert.equal(action.dismountObject(rider),true);
assert.equal(rider.mountId,null);
assert.equal(horse.mountedBy,null);
assert.equal(isMountInteriorCell(mask,width,horse.x,horse.z),false,'horse is left outdoors');
assert.equal(action.mountObject({...rider,x:10,z:7,mountId:null},horse),false,'cannot remount indoors');
const inside={id:7,x:10,z:10,team:0,hp:100,alive:true,squadId:7};
assert.equal(action.spawnObject('horse',inside,inside.x,inside.z,{mounted:true}),null,
 'mounted horse must not spawn indoors');
console.log('PASS: enclosed-house mount exclusion, outdoor dismount and no indoor respawn');
