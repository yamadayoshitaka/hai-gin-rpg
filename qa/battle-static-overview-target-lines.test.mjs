import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {squadCalloutLeader,layoutSquadCallouts} from '../src/battle-squad-callout-layout.js';

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const required=[
 'let commandOverviewLocked=false;',
 'function enterCommandOverview(){',
 'commandOverviewLocked=true;',
 'controls.enabled=false;',
 "setBattleCamera(new THREE.Vector3(center,terrainY(center,center),center),cameraOverviewOffset);",
 "setCameraActive('camOverview');",
 'enterCommandOverview(); // Wide, static camera wins over the initial squad focus.',
 'pendingCircleTarget=candidate;\n enterCommandOverview();',
 'pickingSquadDestination=true;pickingSquadMission=null;pickingStrategistWarp=false;',
 'if(commandOverviewLocked&&!next)return;',
 'if(!commandOverviewLocked)setBattlePaused(false)',
 'commandOverviewLocked=false;\n document.body.classList.remove(\'battle-command-active\');\n controls.enabled=true;',
 'if(previous&&!finished&&paused!==previous.wasPaused)setBattlePaused(previous.wasPaused);',
 'if(commandOverviewLocked)return;',
 "const eligible=ids.filter(id=>isSquadCircleTargetActionable(id,team,pendingCircleTarget))",
 'chooseCircleActionTarget(closest,team)',
 'chooseCircleActionTarget(candidate.id,team)',
 "if(pendingCircleTarget){\n  // A real battlefield tap",
 "maskBase.setAttribute('fill','white')",
 "circle.setAttribute('fill','black')",
 "circleMask.replaceChildren(...excluded)",
 "leader.setAttribute('mask','url(#squadCalloutExclusionMask)')",
 "const dotCovered=[...placements.values()].some(circle=>",
 'commandOverviewLocked,cameraControlsEnabled:controls.enabled',
 'selectableTargets:pendingCircleTarget?'
];
for(const text of required)assert.ok(html.includes(text),'Missing static order or tap wiring: '+text);
assert.match(html,/#squadCalloutLines\{[^}]*z-index:0/,'Lines must be behind labels');
assert.match(html,/#squadScreenLabels \.squadScreenLabel\.ally\{background:#062b45!important\}/,'Opaque ally circles prevent see-through text');
assert.match(html,/#squadScreenLabels \.squadScreenLabel\.enemy\{background:#55212d!important\}/,'Opaque red circles prevent see-through text');
assert.match(html,/maskUnits','userSpaceOnUse/);
assert.match(html,/\$\('squadInspect'\)\.disabled=true;/,'Inspection must not steal locked overview');

const points=[
 {key:'ally-a',team:0,x:180,y:360,squadIndex:0},
 {key:'ally-b',team:0,x:180,y:360,squadIndex:1},
 {key:'enemy-a',team:1,x:180,y:360,squadIndex:0},
 {key:'enemy-b',team:1,x:180,y:360,squadIndex:1}
];
const layout=layoutSquadCallouts(points,{left:4,right:390,top:210,bottom:700});
assert.equal(layout.placements.size,4);
for(const circle of layout.placements.values()){
 assert.ok(circle.diameter>=10);
 assert.ok(circle.x>0&&circle.y>0);
 assert.equal(typeof squadCalloutLeader(circle),'string');
}
// Real HTML module syntax, not just string assertions.
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(source);
const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{
 input:source,encoding:'utf8',timeout:15000
});
assert.equal(syntax.status,0,syntax.stderr||'Battle command JavaScript must parse');

console.log('PASS: static full-overview order entry, no camera steal, selectable enemy fallback and masked readable squad circles');
