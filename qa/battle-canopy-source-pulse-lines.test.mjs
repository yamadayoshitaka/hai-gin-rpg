import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {selectCanopiesAroundCamera,selectCameraOccluders} from '../src/battle-camera-occlusion.js';

const near={key:'pink-flowers',id:'flower_tree_001',tree:true,
 bounds:{minX:-5,maxX:5,minY:0,maxY:12,minZ:-5,maxZ:5}};
const nearBack={key:'pink-off-center',id:'flower_tree_001',tree:true,
 bounds:{minX:2,maxX:10,minY:0,maxY:11,minZ:-7,maxZ:-1}};
const far={key:'far-forest',id:'flower_tree_001',tree:true,
 bounds:{minX:40,maxX:55,minY:0,maxY:12,minZ:40,maxZ:55}};
const fence={key:'fence',id:'wood_fence',tree:false,bounds:near.bounds};
const camera={x:0,y:6,z:0},goal={x:0,y:2,z:20};
assert.deepEqual(selectCanopiesAroundCamera(camera,[far,near,fence,nearBack]).map(x=>x.key),
 ['pink-flowers','pink-off-center'],
 'All tree crowns surrounding camera must hide, but no unrelated fence or distant forest');
assert.equal(selectCameraOccluders(camera,goal,[nearBack],{padding:0}).length,0,
 'Old single central ray missed off-axis blossoms even while camera was immersed');
assert.deepEqual(selectCanopiesAroundCamera({x:0,y:30,z:0},[near]),[],
 'An overhead camera does not erase the stage vegetation');
assert.deepEqual(selectCanopiesAroundCamera({x:45,y:6,z:45},[far]),[far],
 'Cutaway must follow the camera and restore previous vegetation');

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
for(const token of [
 "const cameraTreeCandidates=stageBatchStats.occlusionCandidates.filter(item=>item.id==='tree_deciduous_001'||item.id==='flower_tree_001')",
 "selectCanopiesAroundCamera(camera.position,cameraTreeCandidates)",
 "for(const [sx,sy] of [[-.65,-.5],[.65,-.5],[-.65,.5],[.65,.5]])",
 'if(TOWN_MODE)setBattleCamera(cameraHome,cameraCloseOffset);',
 'else setBattleCamera(new THREE.Vector3(openingOverviewCenter',
 'document.body.classList.add(\'battle-command-active\')',
 'document.body.classList.remove(\'battle-command-active\')',
 "label.classList.toggle('command-source',Boolean(commandOverviewLocked&&",
 "const showLeader=Boolean(line)&&(showAllSquadLeaders||",
 '(commandOverviewLocked&&team===0&&id===String(selectedSquadId)))',
 "dot.style.display=showLeader&&!dotCovered?'':'none';"
])assert.ok(html.includes(token),'Missing start-camera / source pulse / clean connector behavior: '+token);
assert.match(html,/@keyframes commandSourcePulse/);
assert.match(html,/\.squadScreenLabel\.command-source\{[\s\S]*?outline:3px solid #46dbff!important/);
assert.match(html,/\.squadScreenLabel:not\(\.eligible-target\):not\(\.command-source\)/,
 'Non-actionable labels dim but never suppress the currently commanding blue squad');
assert.match(html,/\.squadScreenLabel\.eligible-target:not\(\.defeated\)/,
 'Eligible attack/heal targets still have their distinct second-step pulse');
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(source,'Game module must exist');
const check=spawnSync(process.execPath,['--check','--input-type=module'],{
 input:source,encoding:'utf8',timeout:15000
});
assert.equal(check.status,0,check.stderr||'Game module must compile');
console.log('PASS: battle opens above canopy, close camera clears petals; only current order source pulses cyan, targets gold and idle lines hide');
