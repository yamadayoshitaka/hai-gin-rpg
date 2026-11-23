import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FORMATION_SIGNATURE_STRATEGIES,signatureStrategyFor,
 formationSignatureWaypoints,renderFormationSignaturePreview
} from '../src/formation-signature-strategies.js';
import {SORTIE_FORMATIONS} from '../src/three-team-sortie.js';

const ids=Object.keys(SORTIE_FORMATIONS);
assert.equal(ids.length,14,'Fourteen inn formations remain available');
assert.ok(ids.every(id=>SORTIE_FORMATIONS[id].slots===3),
 'all fourteen named formations must have exactly three job positions');
assert.deepEqual(Object.keys(FORMATION_SIGNATURE_STRATEGIES).sort(),ids.sort(),
 'Each actual inn formation has exactly one unique signature strategy');
const names=new Set();
for(const id of ids){
 const rule=signatureStrategyFor(id);
 assert.ok(rule&&rule.name&&rule.summary,'All formations need descriptions: '+id);
 assert.equal(rule.steps.length,3,'The maneuver description has three phases: '+id);
 assert.equal(rule.phases.length,2,'The battle executes two moving phases: '+id);
 assert.equal(rule.final.length,3,'All three jobs have a final combat stance: '+id);
 assert.ok(rule.final.every(x=>['charge','defend','hold'].includes(x)));
 assert.ok(!names.has(rule.name),'The formation owns a unique order name: '+rule.name);
 names.add(rule.name);
 const svg=renderFormationSignaturePreview(id);
 assert.ok(svg.includes(rule.name)&&svg.includes(rule.steps[1]),
  'Visible animation matches the executable doctrine for '+id);
 assert.equal((svg.match(/<animateTransform /g)||[]).length,3,
  'Each role visibly moves rather than a still diagram: '+id);
 for(let role=0;role<3;role++){
  const points=formationSignatureWaypoints(id,{x:70,z:90},{x:160,z:90},role);
  assert.equal(points.length,2);
  assert.ok(points.every(p=>Number.isInteger(p.x)&&Number.isInteger(p.z)));
  assert.ok(points.every(p=>p.x>=70),'Progress moves toward the target');
 }
}
// The signature has three steps, but only occupied team slots should
// appear as moving allied markers in a training-ground preview.
for(const [activeSlots,expected] of [[[],0],[[0],1],[[0,2],2],[[0,1,2],3]]){
 const preview=renderFormationSignaturePreview('attack',{activeSlots});
 assert.equal((preview.match(/<animateTransform /g)||[]).length,expected);
 assert.match(preview,new RegExp('味方 '+expected+'ジョブ'));
}
const separated=renderFormationSignaturePreview('attack',{activeSlots:[0,2]});
assert.ok(separated.includes('>1</text>'));
assert.ok(separated.includes('>3</text>'));
assert.ok(!separated.includes('>2</text>'));

const wedge=signatureStrategyFor('wedge');
assert.ok(wedge.phases[1][0][0]>wedge.phases[1][1][0],
 'Wedge leader is at the tip, with flanking followers behind');
const pincer=signatureStrategyFor('pincer');
assert.ok(pincer.phases[1][0][1]<0&&pincer.phases[1][2][1]>0,
 'Left and right wings take distinct routes around opponents');
const defense=signatureStrategyFor('wall');
assert.ok(defense.final.every(x=>x==='defend'),'Wall doctrine genuinely guards the front');
const heal=signatureStrategyFor('support');
assert.ok(heal.final.every(x=>x==='defend'),'Healing remains protected behind the line');
const facingNorth=formationSignatureWaypoints('wedge',{x:70,z:90},{x:70,z:150},0);
assert.ok(facingNorth[1].z>facingNorth[0].z,
 'Real movements rotate toward the actual enemy, not a fixed X direction');
assert.equal(signatureStrategyFor('free'),null,'The free layout does not invent a formation ability');

const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const inn=file('src/inn-formation-wizard.js'),battle=file('tactics-wireframe.html'),
 commands=file('src/battle-realtime-commands.js'),strategy=file('src/targeted-strategy-runtime.js');
assert.match(inn,/renderFormationSignaturePreview\(id/);
assert.match(inn,/専用作戦：/);
assert.match(battle,/function issueFormationSignature\(/);
assert.match(battle,/formationSignatureWaypoints\(/);
assert.match(battle,/function advanceFormationSignatures\(/);
assert.match(battle,/onSignatureStrategy:issueFormationSignature/);
assert.match(strategy,/data-strategy-signature/);
assert.match(strategy,/onSignatureStrategy\(\{groupId/);
assert.match(commands,/openMap\('deploy'\);/,'Initial placement opens without a second radar tap');
assert.match(commands,/placedTeams\.add\(key\)/,'Live spawn points are preselected');
assert.match(commands,/initialTeamPlans\.set\(key,initial\)/,'A useful opening plan is preselected');
assert.match(commands,/getLegalPoint\(sample\.x,sample\.z,true\)/,
 'Deployment visibility samples real passable terrain');
assert.match(commands,/previewDeploy\(selectedId,point\)/,
 'Only tiles accommodating every member of the selected team appear blue');
assert.match(commands,/chooseMapCell\(hit\.x,hit\.z\)/,
 'Tapping a blue tile executes its validated placement anchor');
assert.match(commands,/realtimeDeploymentLegend/);
assert.match(commands,/onPrebattleMusic\(\)/);
assert.match(battle,/battleAudio\.setPhase\('march'\); \/\/ Music starts/,
 'March music is prepared during prebattle');
console.log('PASS: 14 unique real doctrines, animated previews, tactical execution, direct preplacement and BGM contract');
