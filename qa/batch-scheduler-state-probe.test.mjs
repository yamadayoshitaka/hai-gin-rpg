import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/hourly-batch-manual.yml','utf8');
test('owner issue request probes only three active FF15 quality workflow families',()=>{
 assert.match(workflow,/name: Check three active quality workflow schedules/);
 assert.match(workflow,/if: github\.event_name == 'issues' && startsWith\(github\.event\.issue\.title, '\[hai-gin-batch\]'\)/);
 for(const file of ['character-six-lane.yml','creature-six-lane.yml','world-six-lane.yml']){
  assert(workflow.includes("['"+file+"',"),'Missing scheduler probe '+file);
 }
 assert(workflow.includes("['faceHair','outfit']"));
 assert(workflow.includes("['creatureMonster','creatureSummon']"));
 assert(workflow.includes("['world']"));
 assert(!workflow.includes("['human','monster']"));
});
test('workflow state is checked and enabled only when disabled, without silently claiming six hourly runs',()=>{
 assert.match(workflow,/actions: write/);
 assert.match(workflow,/gh api "\$\{endpoint\}" --jq '\.state'/);
 assert.match(workflow,/if \[\[ "\$\{state\}" == disabled_\* \]\]/);
 assert.match(workflow,/gh api "\$\{endpoint\}\/enable" -X PUT/);
 assert.match(workflow,/Possible GitHub Actions API 403/);
 assert.match(workflow,/not a guarantee of/);
 assert.match(workflow,/workflow_dispatch/);
});
