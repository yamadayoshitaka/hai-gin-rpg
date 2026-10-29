import fs from 'node:fs';
import {PLAYER_JOBS} from '../src/game-content.js';
import {characterAssetRecipe} from '../src/character-asset-registry.js';
import {sampleHumanClip} from '../src/human-motion-clips.js';
import {HUMANOID_BONE_BINDINGS} from '../src/humanoid-skeleton-adapter.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const adapter=read('src/humanoid-skeleton-adapter.js');
const renderer=read('src/cc0-town-npc-visuals.js');
const editor=read('action-test.html');
const tests=[];
function check(id,label,success,detail){tests.push({id,label,status:success?'PASS':'FAIL',detail});}
const names=HUMANOID_BONE_BINDINGS.map(x=>x[0]);
check(1,'External skeleton discovery',/model\.traverse\(n=>\{if\(n\.isBone\)/.test(adapter)&&/assertSkinnedBones/.test(renderer),'Bone scan and skinned mesh checks are present; runtime bone counts still need browser verification');
const missing=['hand_l','hand_r','foot_l','foot_r','upperarm_l','upperarm_r','lowerarm_l','lowerarm_r','thigh_l','thigh_r','shin_l','shin_r'].filter(n=>!names.includes(n));
check(2,'Full-body BOM retarget',missing.length===0,'Missing mapped bones: '+missing.join(', '));
const fingerMapped=/fingerBones=allBones\.filter/.test(renderer)&&/index\|middle\|ring\|pinky\|thumb/.test(renderer);const gripping=/fingerDelta\.setFromAxisAngle/.test(renderer)&&/gripAngle\(/.test(renderer)&&/actionStrength/.test(read('src/human-grip-bom.js'));
check(3,'Weapon grip and finger articulation',fingerMapped&&gripping,'Finger mapping '+fingerMapped+', grip animation '+gripping+'; hand pivot equality alone is insufficient');
const joints=read('src/human-motion-clips.js');
const footContact=/footLock|groundContact|plantFoot|footIK/.test(joints+editor+renderer+read('src/human-foot-contact-ik.js'));
check(4,'Walk foot contact and body weight',footContact,'Ground contact / foot lock / IK present: '+footContact);
const attack=sampleHumanClip('attack',.38,characterAssetRecipe('swordsman','male').motion);
const coordinated=attack.hips.some(x=>Math.abs(x)>.1)&&attack.shoulders.some(x=>Math.abs(x)>.2)&&/spine/.test(joints);
const wristAttack=attack.wrists.some(x=>Math.abs(x)>.15);
check(5,'Coordinated strike hip torso shoulder elbow wrist',coordinated&&wristAttack,'Body and shoulder motion '+coordinated+'; attack-specific wrist motion '+wristAttack);
let cases=0,invalid=0;
for(const job of Object.keys(PLAYER_JOBS))for(const sex of ['male','female']){
 const config=characterAssetRecipe(job,sex);
 for(const action of ['idle','walk','run','attack','guard','hit','dead']){
  const pose=sampleHumanClip(action,.37,config.motion);
  cases++;
  if(![...pose.hips,...pose.knees,...pose.ankles,...pose.shoulders,...pose.elbows,...pose.wrists].every(Number.isFinite))invalid++;
 }
}
const uniqueSource=new Set(Object.keys(PLAYER_JOBS).flatMap(job=>['male','female'].map(sex=>characterAssetRecipe(job,sex).modelId))).size;
check(6,'20 jobs appearance and motion data regression',invalid===0&&uniqueSource>=20,'Finite motion poses '+(cases-invalid)+'/'+cases+', unique underlying imported models '+uniqueSource+' for 20 jobs; geometric outfits require rendered screenshot checks');
for(const t of tests)console.log(t.status+' | '+t.id+' '+t.label+' | '+t.detail);
const failures=tests.filter(t=>t.status==='FAIL');
console.log('Full-body regression audit: '+(tests.length-failures.length)+'/6 PASS, '+failures.length+' FAIL');
if(failures.length)process.exitCode=1;
