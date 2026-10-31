import assert from 'node:assert/strict';
import {HUMAN_JOINT_BOM,ACTION_MUSCLE_BOM,createHumanMuscleController} from '../src/human-muscle-bom.js';
for(const [name,s] of Object.entries(HUMAN_JOINT_BOM)){
 assert(s.massKg>0&&s.leverM>0&&s.maxTorqueNm>0,name);
 assert(s.limit[0]<s.limit[1],name);
}
assert.equal(ACTION_MUSCLE_BOM.dead.activation,0);
const c=createHumanMuscleController();
for(let i=0;i<240;i++)c.advance('elbows',0,-1,1/120,'attack');
const angle=c.state.get('elbows:0').angle;
assert(angle>=HUMAN_JOINT_BOM.elbows.limit[0]&&angle<=HUMAN_JOINT_BOM.elbows.limit[1]);
console.log('Human muscle BOM contract passed');
